import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const browser = await chromium.launch({
  executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1234/chrome-win64/chrome.exe'),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message));
await page.goto('http://127.0.0.1:4173');
await page.evaluate(() => document.fonts.ready);
await mkdir('.cache/screenshots', { recursive: true });
await page.screenshot({ path: '.cache/screenshots/desktop.png', fullPage: true });
console.log('Desktop screenshot captured');
await page.getByRole('button', { name: 'Подобрать материалы', exact: true }).click();
await page.screenshot({ path: '.cache/screenshots/materials.png', fullPage: true });
await page.getByRole('button', { name: 'Перейти к смете', exact: true }).click();
await page.screenshot({ path: '.cache/screenshots/estimate.png', fullPage: true });
await page.goto('http://127.0.0.1:4173/#catalog');
await page.screenshot({ path: '.cache/screenshots/catalog.png', fullPage: true });
await page.getByRole('button', { name: 'Рассчитать: Ламинат Дуб натуральный' }).click();
await page.screenshot({ path: '.cache/screenshots/product.png', fullPage: true });
await page.keyboard.press('Escape');
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:4173');
await page.screenshot({ path: '.cache/screenshots/mobile.png', fullPage: true });
for (const width of [320, 360, 768, 1024, 1920]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.waitForTimeout(100);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error(`Layout overflow at ${width}px`);
}
console.log('All visual states captured; no overflow from 320px to 1920px');
await browser.close();
