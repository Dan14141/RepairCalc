/**
 * Scripted visual/accessibility audit of the real application with its built-in demo data.
 * Start Vite first, then: node scripts/typography-check.mjs
 * Optional: --base-url=http://127.0.0.1:4173 --widths=375 --states=catalog,product-dialog
 * Screenshots and JSON go to .cache/typography; violations make the process exit nonzero.
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const baseUrl = options['base-url'] || 'http://127.0.0.1:4173';
const outputDirectory = path.resolve(projectRoot, options.output || '.cache/typography');
const widths = (options.widths || '1440,375').split(',').map(Number);
if (widths.some((width) => !Number.isInteger(width) || width < 320)) throw new Error('Invalid --widths');
const selectedStates = options.states?.split(',');
const localChromium = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const axeSource = await readFile(path.join(projectRoot, 'node_modules/axe-core/axe.min.js'), 'utf8');
await mkdir(outputDirectory, { recursive: true });

const states = [
  { id: 'calculator', hash: '', ready: '[data-testid="budget-total"]' },
  { id: 'projects', hash: 'projects', ready: '.project-card' },
  { id: 'catalog', hash: 'catalog', ready: '.product-card' },
  { id: 'favorites', hash: 'favorites', ready: '.empty-state' },
  { id: 'guide', hash: 'guide', ready: '.guide-item', open: async (page) => page.locator('.guide-item > button').first().click() },
  { id: 'assistant', hash: 'assistant', ready: '.ml-recommendation' },
  { id: 'admin-matching', hash: 'admin/matching', ready: '.ml-matching-row' },
  { id: 'admin-metrics', hash: 'admin/metrics', ready: '.admin-metric-card' },
  { id: 'materials', hash: '', ready: '[data-testid="budget-total"]', open: async (page) => {
    await page.getByRole('button', { name: 'Подобрать материалы', exact: true }).click();
    await page.locator('.selected-material').first().waitFor();
  } },
  { id: 'estimate', hash: '', ready: '[data-testid="budget-total"]', open: async (page) => {
    await page.getByRole('button', { name: 'Подобрать материалы', exact: true }).click();
    await page.getByRole('button', { name: 'Перейти к смете', exact: true }).click();
    await page.locator('.estimate-row').first().waitFor();
  } },
  { id: 'product-dialog', hash: 'catalog', ready: '.product-card', open: async (page) => {
    await page.getByRole('button', { name: 'Рассчитать: Ламинат Дуб натуральный', exact: true }).click();
    await page.getByRole('dialog').waitFor();
  } },
  { id: 'plan-dialog', hash: '', ready: '[data-testid="budget-total"]', open: async (page) => {
    await page.getByRole('button', { name: 'Увеличить план помещения', exact: true }).click();
    await page.getByRole('dialog').waitFor();
  } },
];
if (selectedStates?.some((id) => !states.some((state) => state.id === id))) throw new Error('Unknown --states');

async function inspectLayout(page) {
  return page.evaluate(() => {
    const tolerance = 1.5;
    const width = innerWidth;
    const styleCache = new Map();
    const style = (element) => {
      if (!styleCache.has(element)) styleCache.set(element, getComputedStyle(element));
      return styleCache.get(element);
    };
    const selector = (element) => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const parts = [];
      for (let current = element; current && current !== document.body && parts.length < 4; current = current.parentElement) {
        let part = current.tagName.toLowerCase();
        const classes = [...current.classList].slice(0, 3);
        if (classes.length) part += classes.map((name) => `.${CSS.escape(name)}`).join('');
        if (current.parentElement) {
          const siblings = [...current.parentElement.children].filter((sibling) => sibling.tagName === current.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
      }
      return parts.join(' > ');
    };
    const isVisible = (element) => {
      if (element.closest('[hidden], [aria-hidden="true"], .skip-link, .product-visual')) return false;
      if (width <= 900 && element.closest('.sidebar:not(.is-open)')) return false;
      const css = style(element);
      const rect = element.getBoundingClientRect();
      return css.display !== 'none' && css.visibility === 'visible' && Number(css.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const scrollingAncestor = (element) => {
      for (let current = element.parentElement; current && current !== document.body; current = current.parentElement) {
        if (/auto|scroll/.test(style(current).overflowX) && current.scrollWidth > current.clientWidth + tolerance) return current;
      }
      return null;
    };
    const boxOverflows = [];
    const textOverflows = [];
    const clippedText = [];
    const fontStyles = new Map();
    const textStyles = [];
    const scrollingRegions = [];
    const elements = [...document.querySelectorAll('body *')].filter((element) => element instanceof HTMLElement && isVisible(element));
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const css = style(element);
      const textNodes = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (/auto|scroll/.test(css.overflowX) && element.scrollWidth > element.clientWidth + tolerance) {
        scrollingRegions.push({ selector: selector(element), width: element.clientWidth, contentWidth: element.scrollWidth });
      }
      if (!scrollingAncestor(element) && (rect.left < -tolerance || rect.right > width + tolerance)) {
        boxOverflows.push({ selector: selector(element), text: element.textContent.trim().slice(0, 100), left: rect.left, right: rect.right });
      }
      if (textNodes.length || /INPUT|TEXTAREA|SELECT/.test(element.tagName)) {
        const key = `${css.fontFamily} | ${css.fontWeight} | ${css.fontStyle}`;
        fontStyles.set(key, (fontStyles.get(key) || 0) + 1);
        if (/^(H1|H2|H3|P)$/.test(element.tagName)) textStyles.push({ selector: selector(element), text: element.textContent.trim().slice(0, 80), family: css.fontFamily, weight: css.fontWeight, size: css.fontSize, lineHeight: css.lineHeight, tracking: css.letterSpacing });
      }
      for (const node of textNodes) {
        if (scrollingAncestor(element)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter((item) => item.width > 0 && item.height > 0);
        const outside = rects.find((item) => item.left < -tolerance || item.right > width + tolerance);
        if (outside) textOverflows.push({ selector: selector(element), text: node.textContent.trim().slice(0, 100), left: outside.left, right: outside.right });
        for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
          const ancestorStyle = style(ancestor);
          if (!/hidden|clip/.test(ancestorStyle.overflowX)) continue;
          const bounds = ancestor.getBoundingClientRect();
          if (rects.some((item) => item.left < bounds.left - tolerance || item.right > bounds.right + tolerance)) {
            clippedText.push({ selector: selector(element), clippedBy: selector(ancestor), text: node.textContent.trim().slice(0, 100), intentionalEllipsis: ancestorStyle.textOverflow === 'ellipsis' });
            break;
          }
        }
      }
    }
    // Axe cannot read SVG text backgrounds, single-character avatars, or a select with a
    // chevron image. These annotations have known solid surfaces; check their CSS pairs.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const painter = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = (color) => {
      painter.clearRect(0, 0, 1, 1);
      painter.fillStyle = color;
      painter.fillRect(0, 0, 1, 1);
      return [...painter.getImageData(0, 0, 1, 1).data];
    };
    const luminance = (color) => color.slice(0, 3).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const supplementalContrast = [];
    for (const element of document.querySelectorAll('.profile-button > span, .room-plan text, select')) {
      if (!isVisible(element)) continue;
      const css = style(element);
      let backgroundElement = element;
      while (backgroundElement && rgba(style(backgroundElement).backgroundColor)[3] === 0) backgroundElement = backgroundElement.parentElement;
      if (!backgroundElement) continue;
      const background = rgba(style(backgroundElement).backgroundColor);
      const foregroundColor = element instanceof SVGElement ? css.fill : css.color;
      const foreground = rgba(foregroundColor);
      if (background[3] < 255 || foreground[3] < 255) continue;
      const ratio = (Math.max(luminance(foreground), luminance(background)) + 0.05) / (Math.min(luminance(foreground), luminance(background)) + 0.05);
      const size = Number.parseFloat(css.fontSize);
      const minimum = size >= 24 || (size >= 18.66 && Number(css.fontWeight) >= 700) ? 3 : 4.5;
      supplementalContrast.push({ selector: selector(element), text: element.textContent.trim().slice(0, 80), foreground: foregroundColor, background: style(backgroundElement).backgroundColor, ratio, minimum, passes: ratio >= minimum, basis: 'Computed opaque text/solid-surface pair; select chevron is outside the text area' });
    }
    const faces = [...document.fonts].filter((face) => face.status === 'loaded').map((face) => ({ family: face.family, weight: face.weight, style: face.style }));
    return {
      viewport: { width, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      documentOverflow: document.documentElement.scrollWidth > width + tolerance,
      boxOverflows,
      textOverflows,
      clippedText,
      scrollingRegions,
      supplementalContrast,
      fontStyles: [...fontStyles].map(([style, nodes]) => ({ style, nodes })),
      loadedFaces: faces.filter((face, index) => faces.findIndex((other) => JSON.stringify(face) === JSON.stringify(other)) === index),
      headingAndParagraphStyles: textStyles,
    };
  });
}

async function inspectPlatformFonts(page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const fonts = [];
    for (const selector of ['h1', '.page-heading p', '.nav-item', '[data-testid="budget-total"]', '.admin-metric-value', '.modal-heading h2']) {
      const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      if (!nodeId) continue;
      const result = await session.send('CSS.getPlatformFontsForNode', { nodeId });
      fonts.push({ selector, fonts: result.fonts });
    }
    return fonts;
  } finally {
    await session.detach();
  }
}

const browser = await chromium.launch({ headless: true, ...(existsSync(localChromium) ? { executablePath: localChromium } : {}) });
const results = [];
try {
  for (const width of widths) {
    for (const state of states.filter((state) => !selectedStates || selectedStates.includes(state.id))) {
      const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      await context.addInitScript(() => localStorage.setItem('repaircalc.runtime.v1', JSON.stringify({ mode: 'mock', baseUrl: 'http://127.0.0.1:8000/api/v1', delay: 0, scenario: 'normal' })));
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const errors = [];
      const fontRequests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => { if (/\.(woff2?|ttf)(\?|$)/.test(response.url())) fontRequests.push({ url: response.url(), status: response.status() }); });
      const result = { state: state.id, width, errors, fontRequests };
      try {
        await page.goto(`${baseUrl}/#${state.hash}`, { waitUntil: 'networkidle' });
        await page.locator(state.ready).first().waitFor();
        if (state.open) await state.open(page);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: path.join(outputDirectory, `${state.id}-${width}.png`), fullPage: true, animations: 'disabled' });
        result.layout = await inspectLayout(page);
        result.platformFonts = await inspectPlatformFonts(page);
        await page.addScriptTag({ content: axeSource });
        const accessibility = await page.evaluate(async () => {
          const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
          const summarize = (item) => ({ id: item.id, impact: item.impact, help: item.help, nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary, html: node.html })) });
          return { violations: result.violations.map(summarize), incomplete: result.incomplete.map(summarize), passes: result.passes.map((item) => item.id) };
        });
        result.accessibility = accessibility;
        const meaningfulClipping = result.layout.clippedText.filter((item) => !item.intentionalEllipsis);
        const supplementalContrastFailures = result.layout.supplementalContrast.filter((pair) => !pair.passes);
        result.failed = Boolean(errors.length || accessibility.violations.length || supplementalContrastFailures.length || result.layout.documentOverflow || result.layout.boxOverflows.length || result.layout.textOverflows.length || meaningfulClipping.length || fontRequests.some((request) => request.status !== 200));
        console.log(JSON.stringify({ state: state.id, width, violations: accessibility.violations.map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) })), contrastFailures: supplementalContrastFailures, reviewRequired: accessibility.incomplete.map((item) => item.id), overflow: { document: result.layout.documentOverflow, boxes: result.layout.boxOverflows, text: result.layout.textOverflows, clipped: meaningfulClipping }, errors }));
      } catch (error) {
        result.failed = true;
        result.error = error.stack || String(error);
        console.error(`${state.id} ${width}: ${error.message}`);
      } finally {
        results.push(result);
        await writeFile(path.join(outputDirectory, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, dataSource: 'Application built-in demo service in a fresh browser context per state', results }, null, 2));
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
const failed = results.filter((result) => result.failed).map(({ state, width }) => `${state}@${width}`);
console.log(JSON.stringify({ statesChecked: results.length, failed, report: path.join(outputDirectory, 'report.json') }));
if (failed.length) process.exitCode = 1;
