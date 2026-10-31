// Run against a running Vite dev server or preview: node scripts/font-loading-check.mjs [URL]
// Holds font responses after app bootstrap, then records only layout shifts caused by their release.
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.argv[2] || 'http://127.0.0.1:4173';
const output = '.cache/typography';
const faces = [['Lora', 500], ['PT Sans', 400], ['PT Sans', 700]];
const alphabet = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const extended = 'ҐґЄєІіЇїЎўЂђЈјЉљЊњЋћЏџЃѓЅѕЌќӘәҒғҚқҢңӨөҰұҮүҺһӀӏ';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1234/chrome-win64/chrome.exe'),
  headless: true,
});
const failures = [];
const report = { baseURL, delayedFontMilliseconds: 3000, specimen: null, swaps: [] };
// Screenshots of intentionally held webfonts must not wait for document.fonts.ready.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';

function geometry() {
  return [...document.querySelectorAll('h1, h2, h3, p, button, input, label, .budget-total')]
    .map((element, index) => {
      const r = element.getBoundingClientRect();
      return { index, tag: element.tagName, className: element.className,
        text: (element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 90),
        x: r.x, y: r.y, width: r.width, height: r.height };
    }).filter(r => r.width && r.height);
}

try {
  const specimen = await browser.newPage({ viewport: { width: 1280, height: 1024 }, deviceScaleFactor: 1 });
  await specimen.goto(baseURL);
  await specimen.getByTestId('budget-total').first().waitFor({ state: 'attached' });
  await specimen.evaluate(({ faces, alphabet, extended }) => {
    document.body.innerHTML = `<main class="font-specimen"><h1>Кириллица и цифры</h1>${faces.map(([family, weight]) => `<section style="font-weight:${weight}" class="${family === 'Lora' ? 'specimen-display' : 'specimen-body'}"><small>${family} ${weight}</small><p>${alphabet}</p><p>${extended}</p><p class="specimen-numbers">Площадь 24,5 м². Материалы 128 450 ₽. Ёлка, подъём, съёмка.</p><div class="specimen-numbers specimen-digits">${'0123456789'.split('').map(d => `<span>${d}</span>`).join('')}</div></section>`).join('')}</main>`;
  }, { faces, alphabet, extended });
  await specimen.addStyleTag({ content: `.font-specimen{max-width:1200px;padding:32px;margin:auto}
    .font-specimen section{padding:20px 0;border-top:1px solid var(--color-rule)}
    .font-specimen p{margin:8px 0;max-width:none;font-size:26px;line-height:1.5}
    .font-specimen small{font-family:var(--font-body);font-size:15px;color:var(--color-muted)}
    .specimen-numbers{font-variant-numeric:tabular-nums}.specimen-display{font-family:var(--font-display)}
    .specimen-body{font-family:var(--font-body)} .specimen-digits span{display:inline-block}` });
  report.specimen = await specimen.evaluate(async ({ faces, sample }) => {
    const loads = await Promise.all(faces.map(async ([family, weight]) => {
      const loaded = await document.fonts.load(`${weight} 26px "${family}"`, sample);
      return { family, weight, matchingFacesLoaded: loaded.length, loaded: loaded.length > 0 && document.fonts.check(`${weight} 26px "${family}"`, sample) };
    }));
    await document.fonts.ready;
    return {
      faces: loads,
      digits: [...document.querySelectorAll('.font-specimen section')].map(section => ({
        family: getComputedStyle(section).fontFamily, weight: getComputedStyle(section).fontWeight,
        widths: [...section.querySelectorAll('.specimen-digits span')].map(e => e.getBoundingClientRect().width),
      })),
      fontRequests: performance.getEntriesByType('resource').filter(r => /\.woff2(?:$|\?)/.test(r.name)).map(r => new URL(r.name).pathname),
    };
  }, { faces, sample: `${alphabet} ${extended} ₽ 0123456789` });
  await specimen.screenshot({ path: `${output}/cyrillic-specimen.png`, fullPage: true });
  if (report.specimen.faces.some(face => !face.loaded)) failures.push('A Cyrillic face did not load');
  if (report.specimen.digits.some(face => Math.max(...face.widths) - Math.min(...face.widths) > 0.02)) failures.push('Numerals are not tabular');
  await specimen.close();

  for (const width of [375, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      localStorage.setItem('repaircalc.runtime.v1', JSON.stringify({ mode: 'mock', baseUrl: 'http://127.0.0.1:8000/api/v1', delay: 0, scenario: 'normal' }));
      window.fontSwapShifts = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.fontSwapShifts.push({ value: entry.value, startTime: entry.startTime,
            sources: entry.sources.map(source => ({ node: source.node?.className || source.node?.tagName,
              previousRect: source.previousRect.toJSON(), currentRect: source.currentRect.toJSON() })) });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    let releaseFonts;
    const held = new Promise(resolve => { releaseFonts = resolve; });
    const requests = [];
    await context.route(/\.woff2(?:$|\?)/, async route => {
      requests.push(route.request().url());
      await held;
      await route.continue();
    });
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('budget-total').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(report.delayedFontMilliseconds);
    const before = await page.evaluate(geometry);
    await page.screenshot({ path: `${output}/fallback-${width}.png`, animations: 'disabled', timeout: 10000 });
    const releaseTime = await page.evaluate(() => performance.now());
    releaseFonts();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const after = await page.evaluate(geometry);
    const shifts = await page.evaluate(releaseTime => window.fontSwapShifts.filter(shift => shift.startTime >= releaseTime), releaseTime);
    const changes = after.flatMap(box => {
      const previous = before.find(prior => prior.index === box.index);
      if (!previous) return [];
      const delta = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number((box[key] - previous[key]).toFixed(3))]));
      return Object.values(delta).some(value => Math.abs(value) > 0.5) ? [{ tag: box.tag, className: box.className, text: box.text, delta }] : [];
    });
    const cls = shifts.reduce((total, shift) => total + shift.value, 0);
    report.swaps.push({ width, heldRequests: requests.length, cls, shifts, changedBoxes: changes });
    await page.screenshot({ path: `${output}/loaded-${width}.png`, fullPage: true });
    if (requests.length === 0) failures.push(`No fonts intercepted at ${width}`);
    if (cls >= 0.01) failures.push(`Font swap CLS ${cls.toFixed(5)} at ${width}`);
    if (changes.some(box => Math.abs(box.delta.height) > 1)) failures.push(`A text block changes height at ${width}`);
    await context.close();
  }
  report.failures = failures;
  await writeFile(`${output}/font-loading.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ faces: report.specimen.faces, digits: report.specimen.digits,
    swaps: report.swaps.map(({ width, heldRequests, cls, changedBoxes }) => ({ width, heldRequests, cls,
      resizedTextBlocks: changedBoxes.filter(box => Math.abs(box.delta.height) > 1),
      changedIntrinsicWidths: changedBoxes.length })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
