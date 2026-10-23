import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1234/chrome-win64/chrome.exe'),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('.cache/screenshots', { recursive: true });
for (const screen of ['assistant', 'matching']) {
  await page.goto(`http://127.0.0.1:4173/#${screen}`);
  await page.waitForSelector(screen === 'assistant' ? '.ml-recommendation' : '.ml-matching-row');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `.cache/screenshots/ml-${screen}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violations = await page.evaluate(async () =>
    (
      await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
    ).violations.map((v) => ({
      id: v.id,
      count: v.nodes.length,
      nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target, message: n.failureSummary })),
    })),
  );
  console.log(screen, JSON.stringify(violations));
}
await page.getByRole('button', { name: 'Тестовый режим: MOCK', exact: true }).click();
await page.screenshot({ path: '.cache/screenshots/ml-settings.png', animations: 'disabled' });
const settingsViolations = await page.evaluate(async () =>
  (
    await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
  ).violations.map((v) => ({
    id: v.id,
    count: v.nodes.length,
    nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target, message: n.failureSummary })),
  })),
);
console.log('settings', JSON.stringify(settingsViolations));
await page.keyboard.press('Escape');
for (const width of [320, 390, 768, 1024]) {
  await page.setViewportSize({ width, height: 900 });
  for (const screen of ['assistant', 'matching']) {
    await page.goto(`http://127.0.0.1:4173/#${screen}`);
    await page.waitForSelector(screen === 'assistant' ? '.ml-recommendation' : '.ml-matching-row');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error(`Overflow at ${width} on ${screen}`);
    if (width === 390)
      await page.screenshot({ path: `.cache/screenshots/ml-${screen}-mobile.png`, fullPage: true });
  }
}
console.log('Runtime errors:', errors);
await browser.close();
