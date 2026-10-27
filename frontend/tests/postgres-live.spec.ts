import { test, expect } from '@playwright/test';
import { money, type Product } from '../src/data';
import type { Bootstrap, Estimate, CatalogPage } from '../src/services/contracts';

// Opt in with LIVE_API_URL=http://127.0.0.1:8000/api/v1. No routed responses or workspace writes.
const base = process.env.LIVE_API_URL || '';
test.skip(!base, 'Requires the running PostgreSQL backend and imported Maxidom catalog');

test.beforeEach(async ({ page }) => {
  await page.addInitScript((baseUrl) => {
    localStorage.setItem(
      'repaircalc.runtime.v1',
      JSON.stringify({ mode: 'http', baseUrl, delay: 0, scenario: 'normal' }),
    );
  }, base);
});

test('live PostgreSQL catalog supports pagination, search, prices and unavailable coverage', async ({
  page,
  request,
}) => {
  expect((await (await request.get(`${base}/health`)).json()).database).toContain('PostgreSQL');
  const catalog: CatalogPage = await (await request.get(`${base}/catalog?size=48`)).json();
  expect(catalog.total).toBeGreaterThan(80000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#catalog');
  await expect(page.getByRole('button', { name: 'Тестовый режим: NOT MOCK', exact: true })).toBeVisible();
  await expect(page.locator('.product-grid article')).toHaveCount(48);
  await expect(page.getByText(`${catalog.total} позиций`, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: catalog.products[0].name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Следующая страница', exact: true }).click();
  await expect(
    page.getByText(`Страница 2 из ${Math.ceil(catalog.total / 48)}`, { exact: true }),
  ).toBeVisible();
  const second: CatalogPage = await (await request.get(`${base}/catalog?page=1&size=48`)).json();
  await expect(page.getByRole('button', { name: second.products[0].name, exact: true })).toBeVisible();
  const unknown: Product = (await (await request.get(`${base}/catalog?category=other&size=1`)).json())
    .products[0];
  await page.getByRole('textbox', { name: 'Поиск материалов', exact: true }).fill(unknown.id);
  await expect(page.getByRole('button', { name: unknown.name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: unknown.name, exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Для расчёта количества нужны уточнённые характеристики товара',
  );
  await expect(page.getByRole('dialog')).toContainText(money(unknown.price));
  expect(errors).toEqual([]);
});

test('live estimates and recommendations use imported products and consistent decimal totals', async ({
  page,
  request,
}) => {
  const boot: Bootstrap = await (await request.get(`${base}/bootstrap`)).json();
  const project = boot.projects[0];
  const response = await request.post(`${base}/estimate`, { data: project });
  expect(response.ok()).toBeTruthy();
  const estimate: Estimate = await response.json();
  expect(estimate.items.length).toBeGreaterThan(1);
  for (const item of estimate.items) {
    expect(/^\d+$/.test(item.product.id)).toBeTruthy();
    expect(item.cost).toBeCloseTo(item.quantity * item.product.price, 2);
  }
  expect(estimate.materials).toBeCloseTo(
    estimate.items.reduce((sum, item) => sum + item.cost, 0),
    2,
  );
  expect(estimate.total).toBeCloseTo(estimate.materials + estimate.labor, 2);
  const result = await request.post(`${base}/ml/recommendations`, {
    data: { room: project.rooms[0], reserve: project.reserve, priority: 'budget' },
  });
  expect(result.ok()).toBeTruthy();
  expect((await result.json()).groups).toHaveLength(2);
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PUT') writes.push(r.url());
  });
  const firstCalculation = page.waitForResponse(
    (r) => r.url() === `${base}/estimate` && r.request().method() === 'POST',
  );
  await page.goto('/');
  expect((await firstCalculation).ok()).toBeTruthy();
  await expect(page.getByTestId('budget-total')).toHaveText(money(estimate.total));
  for (const warning of estimate.warnings || [])
    await expect(page.getByText(warning, { exact: true })).toBeVisible();
  const reloadedCalculation = page.waitForResponse(
    (r) => r.url() === `${base}/estimate` && r.request().method() === 'POST',
  );
  await page.reload();
  expect((await reloadedCalculation).ok()).toBeTruthy();
  await expect(page.getByTestId('budget-total')).toHaveText(money(estimate.total));
  expect(writes).toEqual([]);
});

test('live catalog fits mobile screens and shows server failures as errors', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#catalog');
  await expect(page.locator('.product-grid article')).toHaveCount(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.getByRole('combobox', { name: 'Сортировка материалов' }).selectOption('price-down');
  const expensive: CatalogPage = await (await request.get(`${base}/catalog?sort=price-down&size=48`)).json();
  await expect(page.getByRole('button', { name: expensive.products[0].name, exact: true })).toBeVisible();
  expect((await request.get(`${base}/catalog?size=101`)).status()).toBe(400);
  expect(
    (
      await request.post(`${base}/product/unknown-test-product/calc`, { data: { surface: 20, reserve: 10 } })
    ).status(),
  ).toBe(404);
});
