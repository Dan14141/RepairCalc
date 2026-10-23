import { test, expect, type Page } from '@playwright/test';
import { products, createProject, estimate, guides } from '../src/data';
import type { MetricsReport } from '../src/services/contracts';

function serverReport(): MetricsReport {
  return {
    generatedAt: '2026-10-23T10:00:00Z',
    period: { from: '2026-10-01T00:00:00Z', to: '2026-10-23T00:00:00Z' },
    modelVersion: 'server-model-42',
    dataset: 'Контрольный набор сервера',
    labeledProducts: 100,
    matching: [
      { id: 'floor', name: 'Пограничная категория', tp: 8, fp: 2, fn: 2 },
      { id: 'walls', name: 'Ошибочная категория', tp: 0, fp: 2, fn: 4 },
      { id: 'prep', name: 'Нет наблюдений', tp: 0, fp: 0, fn: 0 },
    ],
    consumption: [{ id: 'floor', name: 'Серверный материал', unit: 'упак.', samples: 4, absoluteError: 3 }],
    automation: { automatic: 1, eligible: 4 },
    estimates: { completed: 4, totalSeconds: 14, p95Seconds: 5 },
    journey: { started: 10, completed: 4, totalClicks: 18 },
    requests: { total: 40, failed: 2 },
  };
}

async function useServer(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'repaircalc.runtime.v1',
      JSON.stringify({
        mode: 'http',
        baseUrl: 'http://localhost:8915/api/v1',
        delay: 0,
        scenario: 'normal',
      }),
    ),
  );
  await page.route('http://localhost:8915/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/bootstrap'))
      await route.fulfill({
        json: {
          products,
          projects: [createProject('API-проект')],
          favorites: [],
          guides,
          regions: ['Москва'],
        },
      });
    else if (path.endsWith('/estimate'))
      await route.fulfill({ json: estimate(route.request().postDataJSON()) });
    else await route.fulfill({ status: 404 });
  });
}

test('admin navigation, history, keyboard tabs and saved matching decisions work together', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('navigation', { name: 'Основная навигация' }).getByText('ML-мастерская'),
  ).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Ресурсы персонала' })
    .getByRole('button', { name: 'Админка' })
    .click();
  await expect(page).toHaveURL(/#admin\/matching$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Админка.' })).toBeVisible();
  const row = page.locator('.ml-matching-row').filter({ hasText: 'Ламинат Дуб натуральный' });
  await row.getByRole('button', { name: 'Проверить', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить привязку' }).click();
  await expect(row).toContainText('Подтверждено');
  await page.getByRole('tab', { name: 'Метрики успеха' }).click();
  await expect(page).toHaveURL(/#admin\/metrics$/);
  await expect(page.getByRole('tabpanel', { name: 'Метрики успеха' })).toBeVisible();
  await expect(page.locator('.ml-matching-row')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('tab', { name: 'ML-мастерская' })).toHaveAttribute('aria-selected', 'true');
  await expect(row).toContainText('Подтверждено');
  await page.getByRole('tab', { name: 'ML-мастерская' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Метрики успеха' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Метрики успеха' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Метрики успеха' }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'ML-мастерская' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Метрики успеха' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'ML-мастерская' })).toBeFocused();
});

test('legacy matching URL opens the admin workshop', async ({ page }) => {
  await page.goto('/#matching');
  await expect(page).toHaveURL(/#admin\/matching$/);
  await expect(page.locator('.ml-matching-row')).toHaveCount(12);
  await expect(page).toHaveTitle('Админка — RepairCalc');
});

test('mock report identifies sample data, shows category goals, MAE and business/UX metrics', async ({
  page,
}) => {
  await page.goto('/#admin/metrics');
  await expect(page.getByText(/Демонстрационный отчёт/)).toBeVisible();
  await expect(page.getByRole('article', { name: 'Качество матчинга', exact: true })).toContainText('0,75');
  await expect(page.getByRole('article', { name: 'Качество матчинга', exact: true })).toContainText('2 из 3');
  await expect(page.getByRole('article', { name: 'Автоматические привязки' })).toContainText('72%');
  await expect(page.getByRole('article', { name: 'Время формирования сметы' })).toContainText('2,4');
  await expect(page.getByRole('article', { name: 'Клики до готовой корзины' })).toContainText('6');
  await expect(
    page.getByRole('region', { name: 'Отклонение расхода' }).getByRole('row', { name: /Напольные покрытия/ }),
  ).toContainText('0,25');
  await page.getByText('Как измерять и читать показатели', { exact: true }).click();
  await expect(page.getByText(/Просмотр сметы и экспорт CSV не считаются корзиной/)).toBeVisible();
  await page.getByRole('button', { name: 'Обновить метрики' }).click();
  await expect(page.getByText('demo-matcher-v1', { exact: true })).toBeVisible();
});

test('HTTP report uses server counters, handles the F1 threshold and missing denominators', async ({
  page,
}) => {
  await useServer(page);
  const calls: string[] = [];
  await page.route('**/admin/metrics', async (route) => {
    calls.push(route.request().method());
    await route.fulfill({ json: serverReport() });
  });
  await page.goto('/#admin/metrics');
  await expect(page.getByText('server-model-42', { exact: true })).toBeVisible();
  await expect(page.getByText('demo-matcher-v1', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('row', { name: /Пограничная категория/ })).toContainText('Цель достигнута');
  await expect(page.getByRole('row', { name: /Ошибочная категория/ })).toContainText('Ниже цели');
  await expect(page.getByRole('row', { name: /Нет наблюдений/ })).toContainText('Нет данных');
  await expect(page.getByRole('article', { name: 'Качество матчинга', exact: true })).toContainText(
    'Нет данных',
  );
  await expect(page.getByRole('article', { name: 'Автоматические привязки' })).toContainText('25%');
  await expect(page.getByRole('article', { name: 'Время формирования сметы' })).toContainText('3,5');
  await expect(page.getByRole('article', { name: 'Клики до готовой корзины' })).toContainText('4,5');
  await expect(page.getByRole('article', { name: 'Завершённые сценарии' })).toContainText('40%');
  await expect(page.getByRole('article', { name: 'Ошибки запросов' })).toContainText('5%');
  await expect(page.getByRole('row', { name: /Серверный материал/ })).toContainText('0,75');
  const before = calls.length;
  await page.getByRole('button', { name: 'Обновить метрики' }).click();
  await expect.poll(() => calls.length).toBeGreaterThan(before);
  expect(calls.every((method) => method === 'GET')).toBe(true);
});

test('HTTP errors and invalid metrics clear the report, retry and empty observations recover without mock fallback', async ({
  page,
}) => {
  await useServer(page);
  let response: unknown = serverReport();
  let status = 200;
  await page.route('**/admin/metrics', (route) => route.fulfill({ status, json: response }));
  await page.goto('/#admin/metrics');
  await expect(page.getByText('server-model-42', { exact: true })).toBeVisible();
  status = 503;
  await page.getByRole('button', { name: 'Обновить метрики' }).click();
  await expect(page.getByRole('alert')).toContainText('503');
  await expect(page.locator('.admin-metric-card')).toHaveCount(0);
  status = 200;
  response = { ...serverReport(), automation: { automatic: 5, eligible: 4 } };
  await page.getByRole('alert').getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByRole('alert')).toContainText('контракту метрик');
  await expect(page.getByText('demo-matcher-v1', { exact: true })).toHaveCount(0);
  response = {
    ...serverReport(),
    labeledProducts: 0,
    matching: [],
    consumption: [],
    automation: { automatic: 0, eligible: 0 },
    estimates: { completed: 0, totalSeconds: 0, p95Seconds: null },
    journey: { started: 0, completed: 0, totalClicks: 0 },
    requests: { total: 0, failed: 0 },
  };
  await page.getByRole('alert').getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText(/Нет размеченной выборки/)).toBeVisible();
  await expect(page.getByText('Нет эталонных смет для сравнения.')).toBeVisible();
  await expect(
    page.getByRole('article', { name: 'Автоматические привязки' }).locator('.admin-metric-value'),
  ).toHaveText('—');
  await expect(page.locator('.admin-metrics')).not.toContainText(/NaN|Infinity/);
  await page.getByRole('button', { name: 'Тестовый режим: NOT MOCK', exact: true }).click();
  await page.getByRole('switch', { name: /MOCK — использовать заглушки/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('demo-matcher-v1', { exact: true })).toBeVisible();
  await expect(page.getByText('server-model-42', { exact: true })).toHaveCount(0);
});

test('admin tabs fit mobile and tablet screens and pass accessibility checks', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/#admin/matching');
    await expect(page.locator('.ml-matching-row')).toHaveCount(12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.getByRole('tab', { name: 'Метрики успеха' }).click();
    await expect(page.getByText('demo-matcher-v1', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    if (width === 390 || width === 1440) {
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const violations = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: { run: (root: Document, options: unknown) => Promise<{ violations: unknown[] }> };
          }
        ).axe;
        return (
          await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
        ).violations;
      });
      expect(violations).toEqual([]);
      await page.screenshot({ path: `.cache/screenshots/admin-metrics-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: 'Админка', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'ML-мастерская' })).toHaveAttribute('aria-selected', 'true');
});
