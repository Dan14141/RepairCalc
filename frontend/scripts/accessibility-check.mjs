import { chromium } from 'playwright';
import path from 'node:path';
const browser = await chromium.launch({
  executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1234/chrome-win64/chrome.exe'),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://127.0.0.1:4173');
await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
const results = await page.evaluate(async () =>
  window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }),
);
console.log(
  JSON.stringify(
    results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      count: v.nodes.length,
      nodes: v.nodes.slice(0, 35).map((n) => ({ target: n.target, message: n.failureSummary })),
    })),
    null,
    2,
  ),
);
await browser.close();
