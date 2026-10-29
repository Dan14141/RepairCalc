import { test, expect, type Page } from '@playwright/test';
import { createProject, estimate, products, guides } from '../src/data';
import { mockMetrics } from '../src/services/mockMetrics';
import { summarizeEngagement, type StoredEvent } from '../src/services/engagement';
import type { EngagementEvent, EngagementMetrics } from '../src/services/contracts';

async function browserSharing(page: Page, native = false) {
  await page.addInitScript((native) => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: native
        ? async (data: ShareData) => {
            const outcome = localStorage.getItem('test.share-outcome');
            if (outcome === 'cancel') throw new DOMException('Cancelled', 'AbortError');
            if (outcome === 'error') throw new Error('Unavailable');
            localStorage.setItem('test.shared', data.text || '');
          }
        : undefined,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          if (localStorage.getItem('test.clipboard-error')) throw new Error('Denied');
          localStorage.setItem('test.copied', text);
        },
      },
    });
  }, native);
}

async function openShare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Подобрать материалы', exact: true }).click();
  await page.getByRole('button', { name: 'Перейти к смете', exact: true }).click();
  await page.getByRole('button', { name: 'Поделиться сметой', exact: true }).click();
  return page.getByRole('dialog', { name: 'Поделиться сметой' });
}

async function openRating(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: 'Оценка подбора ИИ' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Подобрать материалы', exact: true }).click();
  const prompt = page.getByRole('complementary', { name: 'Оценка подбора ИИ' });
  await expect(prompt.getByRole('heading', { name: 'Как Вам подбор?' })).toBeVisible();
  return prompt;
}

const metric = (page: Page, title: string) =>
  page.getByRole('article', { name: title, exact: true }).locator('.admin-metric-value');

test('copying complete estimates persists shares and counts one unique browser', async ({ page }) => {
  await browserSharing(page);
  await page.goto('/#admin/metrics');
  await expect(metric(page, 'Отправки смет')).toHaveText('0');
  await expect(metric(page, 'Средняя оценка ИИ')).toHaveText('—из 5');
  const dialog = await openShare(page);
  const text = await dialog.getByLabel('Текст сметы').inputValue();
  expect(text).toContain('Смета —');
  expect(text).toContain('MOCK · Демонстрационные цены');
  expect(text).toContain('Запас 10% включён');
  expect(text).toContain('Материалы:');
  expect(text).toContain('Работы (ориентировочно):');
  expect(text).toContain('Итого:');
  expect(text).toContain('Ламинат');
  await dialog.getByRole('button', { name: 'Скопировать смету' }).click();
  await expect(dialog.getByRole('status')).toContainText('Смета скопирована');
  expect(await page.evaluate(() => localStorage.getItem('test.copied'))).toBe(text);
  await expect(dialog.getByRole('button', { name: 'Скопировать смету' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Поделиться сметой', exact: true }).click();
  await page.getByRole('button', { name: 'Скопировать смету' }).click();
  await expect(page.getByRole('status')).toContainText('Смета скопирована');
  await page.goto('/#admin/metrics');
  await expect(metric(page, 'Отправки смет')).toHaveText('2');
  await expect(metric(page, 'Поделились сметой')).toHaveText('1');
  await page.reload();
  await expect(metric(page, 'Отправки смет')).toHaveText('2');
});

test('native cancellation and sharing errors are not counted; a successful retry is counted', async ({
  page,
}) => {
  await browserSharing(page, true);
  const dialog = await openShare(page);
  await page.evaluate(() => localStorage.setItem('test.share-outcome', 'cancel'));
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Отправить', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('repaircalc.mock.engagement.v1'))).toBeNull();
  await page.evaluate(() => localStorage.setItem('test.share-outcome', 'error'));
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Не удалось открыть');
  await page.evaluate(() => localStorage.setItem('test.clipboard-error', '1'));
  await dialog.getByRole('button', { name: 'Скопировать смету' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Буфер обмена недоступен');
  expect(await page.evaluate(() => localStorage.getItem('repaircalc.mock.engagement.v1'))).toBeNull();
  await page.evaluate(() => localStorage.removeItem('test.share-outcome'));
  await dialog.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Смета передана');
  expect(await page.evaluate(() => localStorage.getItem('test.shared'))).toContain('Итого:');
  await page.goto('/#admin/metrics');
  await expect(metric(page, 'Отправки смет')).toHaveText('1');
});

for (const stars of [1, 2, 3, 4, 5]) {
  test(`rating ${stars} stars is saved once and shown in admin metrics`, async ({ page }) => {
    const prompt = await openRating(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Оценить подбор|Отправить оценку/ })).toHaveCount(0);
    await prompt.getByRole('button', { name: `${stars} из 5`, exact: true }).click();
    await expect(prompt.getByRole('button', { name: `${stars} из 5`, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(prompt.getByRole('status')).toContainText(`Оценка ${stars} из 5 сохранена`);
    await expect(prompt.getByRole('button', { name: `${stars} из 5`, exact: true })).toBeDisabled();
    await page.goto('/#admin/metrics');
    await expect(metric(page, 'Средняя оценка ИИ')).toHaveText(`${stars}из 5`);
    await expect(metric(page, 'Оценок подбора')).toHaveText('1');
    await expect(page.getByRole('meter', { name: `${stars} из 5` })).toHaveAttribute('value', '1');
    await page.reload();
    await expect(metric(page, 'Оценок подбора')).toHaveText('1');
  });
}

test('closing the corner prompt is optional and it stays closed when materials change', async ({ page }) => {
  const prompt = await openRating(page);
  await page.mouse.move(400, 350);
  await page.mouse.wheel(0, 450);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const scrollTop = await page.evaluate(() => window.scrollY);
  const height = await page.locator('.app').evaluate((el) => el.getBoundingClientRect().height);
  expect(scrollTop).toBeGreaterThan(0);
  await prompt.getByRole('button', { name: 'Закрыть оценку подбора' }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scrollTop, 0);
  expect(await page.locator('.app').evaluate((el) => el.getBoundingClientRect().height)).toBe(height);
  await page.locator('.ml-recommendation').first().getByRole('button', { name: /Ещё/ }).click();
  await page
    .getByRole('button', { name: /^Выбрать альтернативу:/ })
    .first()
    .click();
  await expect(page.locator('.ml-recommendation')).toHaveCount(2);
  await expect(prompt).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#admin/metrics');
  await expect(metric(page, 'Оценок подбора')).toHaveText('0');
});

async function httpServer(page: Page) {
  const project = createProject('HTTP-смета');
  const events = new Map<string, StoredEvent>();
  const attempts: EngagementEvent[] = [];
  let failFirst = true;
  let metricsOverride: EngagementMetrics | undefined;
  await page.addInitScript(() =>
    localStorage.setItem(
      'repaircalc.runtime.v1',
      JSON.stringify({
        mode: 'http',
        baseUrl: 'http://localhost:8918/api/v1',
        delay: 0,
        scenario: 'normal',
      }),
    ),
  );
  await page.route('http://localhost:8918/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (path === '/bootstrap')
      return route.fulfill({
        json: { projects: [project], products, guides, favorites: [], regions: ['Москва'] },
      });
    if (path === '/estimate')
      return route.fulfill({
        json: { ...estimate(route.request().postDataJSON()), warnings: ['Проверьте толщину слоя.'] },
      });
    if (path === '/ml/recommendations')
      return route.fulfill({
        json: {
          summary: 'Серверный подбор',
          excluded: [],
          groups: [
            {
              category: 'floor',
              candidates: [
                {
                  productId: products[0].id,
                  score: 0.9,
                  reasons: ['Подходит комнате'],
                  tradeoff: '',
                  quantity: 1,
                  total: products[0].price,
                  evidence: [],
                },
              ],
            },
          ],
        },
      });
    if (path === '/engagement/events') {
      expect(route.request().method()).toBe('POST');
      const event: EngagementEvent = route.request().postDataJSON();
      attempts.push(event);
      if (!events.has(event.id)) events.set(event.id, { ...event, createdAt: new Date().toISOString() });
      if (failFirst) {
        failFirst = false;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({ json: { id: event.id } });
    }
    if (path === '/admin/metrics')
      return route.fulfill({
        json: { ...mockMetrics, engagement: metricsOverride ?? summarizeEngagement([...events.values()]) },
      });
    return route.fulfill({ status: 404 });
  });
  return {
    events,
    attempts,
    failNext: () => {
      failFirst = true;
    },
    setMetrics: (metrics: EngagementMetrics) => {
      metricsOverride = metrics;
    },
  };
}

test('HTTP retries preserve event IDs, update server metrics and keep MOCK isolated', async ({ page }) => {
  await browserSharing(page);
  const server = await httpServer(page);
  const dialog = await openShare(page);
  await expect(dialog.getByLabel('Текст сметы')).toContainText('Проверьте толщину слоя.');
  expect(await dialog.getByLabel('Текст сметы').inputValue()).not.toContain('MOCK');
  await dialog.getByRole('button', { name: 'Скопировать смету' }).click();
  await expect(dialog.getByRole('alert')).toContainText('не удалось учесть действие');
  await dialog.getByRole('button', { name: 'Повторить сохранение статистики' }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  expect(server.attempts).toHaveLength(2);
  expect(server.attempts[0]).toEqual(server.attempts[1]);
  server.failNext();
  const prompt = await openRating(page);
  await page.getByRole('button', { name: '4 из 5', exact: true }).click();
  await expect(prompt.getByRole('alert')).toContainText('Не удалось сохранить оценку');
  await expect(page.getByRole('button', { name: '3 из 5', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Повторить отправку' }).click();
  await expect(prompt.getByRole('status')).toContainText('Оценка 4 из 5 сохранена');
  expect(server.attempts[2]).toEqual(server.attempts[3]);
  expect(server.events.size).toBe(2);
  await page.goto('/#admin/metrics');
  await expect(metric(page, 'Отправки смет')).toHaveText('1');
  await expect(metric(page, 'Средняя оценка ИИ')).toHaveText('4из 5');
  expect(await page.evaluate(() => localStorage.getItem('repaircalc.mock.engagement.v1'))).toBeNull();
  await page.getByRole('button', { name: 'Тестовый режим: NOT MOCK', exact: true }).click();
  await page.getByRole('switch', { name: /MOCK — использовать заглушки/ }).click();
  await page.keyboard.press('Escape');
  await expect(metric(page, 'Отправки смет')).toHaveText('0');
  await expect(metric(page, 'Оценок подбора')).toHaveText('0');
});

test('invalid rating distribution is rejected and empty metrics recover', async ({ page }) => {
  const server = await httpServer(page);
  server.setMetrics({
    since: '2026-10-29T00:00:00Z',
    shares: { total: 0, visitors: 0 },
    ratings: { total: 2, distribution: [0, 0, 0, 0, 1] },
  });
  await page.goto('/#admin/metrics');
  await expect(page.getByRole('alert')).toContainText('контракту метрик');
  await expect(metric(page, 'Оценок подбора')).toHaveCount(0);
  server.setMetrics({
    since: null,
    shares: { total: 0, visitors: 0 },
    ratings: { total: 0, distribution: [0, 0, 0, 0, 0] },
  });
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(metric(page, 'Средняя оценка ИИ')).toHaveText('—из 5');
});

test('the corner prompt leaves navigation usable and supports keyboard and accessibility', async ({
  page,
}) => {
  test.setTimeout(60000);
  await browserSharing(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 844 });
    const share = await openShare(page);
    await expect(share).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `.cache/screenshots/share-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Поделиться сметой', exact: true })).toBeFocused();
    const rating = await openRating(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    expect(await rating.evaluate((el) => el.contains(document.activeElement))).toBe(false);
    await page.mouse.move(width > 900 ? 400 : 80, 300);
    await page.mouse.wheel(0, 450);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await page.locator('.app').evaluate((el) => getComputedStyle(el).overflowY)).toBe('visible');
    const next = page.getByRole('button', {
      name: width <= 700 ? 'К смете' : 'Перейти к смете',
      exact: true,
    });
    await next.scrollIntoViewIfNeeded();
    const boxes = await Promise.all([
      rating.boundingBox(),
      next.boundingBox(),
      page.getByRole('button', { name: /^Тестовый режим:/ }).boundingBox(),
    ]);
    const card = boxes[0]!;
    for (const box of boxes.slice(1)) {
      expect(box).not.toBeNull();
      expect(
        card.x < box!.x + box!.width &&
          card.x + card.width > box!.x &&
          card.y < box!.y + box!.height &&
          card.y + card.height > box!.y,
      ).toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    const violations = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: { run: (root: Element, options: unknown) => Promise<{ violations: unknown[] }> };
        }
      ).axe;
      return (
        await axe.run(document.querySelector('.rating-prompt')!, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
        })
      ).violations;
    });
    expect(violations).toEqual([]);
    await page.screenshot({ path: `.cache/screenshots/rating-${width}.png` });
    await next.click();
    await expect(page.getByRole('heading', { name: 'Ваш ремонт в цифрах' })).toBeVisible();
    await expect(rating).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('repaircalc.mock.engagement.v1'))).toBeNull();
  }
  const prompt = await openRating(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await prompt.getByRole('button', { name: '1 из 5', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(prompt.getByRole('status')).toContainText('Оценка 1 из 5 сохранена');
  await page.clock.fastForward(1900);
  await expect(prompt).toBeVisible();
  await page.clock.fastForward(200);
  await expect(prompt).toHaveCount(0);
});
