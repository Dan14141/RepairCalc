import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import type { EngagementEvent, MetricsReport } from '../src/services/contracts';

// Explicit opt-in: writes only engagement events to this checkout's local PostgreSQL.
// Cleanup deletes exactly the UUIDs created by this test, including on failure.
const base = 'http://127.0.0.1:8000/api/v1';
test.skip(process.env.LIVE_ENGAGEMENT_E2E !== '1', 'Requires the local Docker PostgreSQL and backend');

test('live sharing and AI rating persist to PostgreSQL and appear in admin metrics', async ({
  page,
  context,
  request,
}) => {
  const events: EngagementEvent[] = [];
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(
    (baseUrl) =>
      localStorage.setItem(
        'repaircalc.runtime.v1',
        JSON.stringify({
          mode: 'http',
          baseUrl,
          delay: 0,
          scenario: 'normal',
        }),
      ),
    base,
  );
  page.on('request', (req) => {
    if (req.url() === `${base}/engagement/events` && req.method() === 'POST') events.push(req.postDataJSON());
  });
  const before: MetricsReport = await (await request.get(`${base}/admin/metrics`)).json();
  expect(before.engagement).toBeDefined();
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Подобрать материалы', exact: true }).click();
    await page.getByRole('button', { name: 'Перейти к смете', exact: true }).click();
    await page.getByRole('button', { name: 'Поделиться сметой', exact: true }).click();
    const text = await page.getByLabel('Текст сметы').inputValue();
    const shareSaved = page.waitForResponse(
      (r) => r.url() === `${base}/engagement/events` && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Скопировать смету' }).click();
    expect((await shareSaved).ok()).toBe(true);
    // Windows clipboard normalizes line endings to CRLF.
    expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(text);
    await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.getByRole('button', { name: 'Изменить материалы', exact: true }).click();
    await page.getByRole('button', { name: '5 из 5', exact: true }).click();
    await expect(
      page.getByRole('complementary', { name: 'Оценка подбора ИИ' }).getByRole('status'),
    ).toContainText('Оценка 5 из 5 сохранена');
    expect(events).toHaveLength(2);
    // Lost acknowledgements can safely be retried against the actual HTTP endpoint.
    for (const event of events)
      expect((await request.post(`${base}/engagement/events`, { data: event })).ok()).toBe(true);
    for (const rating of [0, 6, 2.5])
      expect(
        (
          await request.post(`${base}/engagement/events`, {
            data: { ...events[1], rating },
          })
        ).status(),
      ).toBe(400);
    await page.goto('/#admin/metrics');
    await expect(
      page.getByRole('article', { name: 'Отправки смет', exact: true }).locator('.admin-metric-value'),
    ).toHaveText(String(before.engagement!.shares.total + 1));
    await expect(
      page.getByRole('article', { name: 'Поделились сметой', exact: true }).locator('.admin-metric-value'),
    ).toHaveText(String(before.engagement!.shares.visitors + 1));
    await expect(
      page.getByRole('article', { name: 'Оценок подбора', exact: true }).locator('.admin-metric-value'),
    ).toHaveText(String(before.engagement!.ratings.total + 1));
    await page.reload();
    await expect(page.getByRole('meter', { name: '5 из 5' })).toHaveAttribute(
      'value',
      String(before.engagement!.ratings.distribution[4] + 1),
    );
    const after: MetricsReport = await (await request.get(`${base}/admin/metrics`)).json();
    expect(after.engagement!.shares.total).toBe(before.engagement!.shares.total + 1);
    expect(after.engagement!.ratings.total).toBe(before.engagement!.ratings.total + 1);
  } finally {
    const ids = [...new Set(events.map((event) => event.id))];
    if (ids.length) {
      if (!ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))
        throw new Error('Invalid test event UUID');
      execFileSync(
        'docker',
        [
          'compose',
          '--project-directory',
          '../server',
          'exec',
          '-T',
          'postgres',
          'psql',
          '-X',
          '-v',
          'ON_ERROR_STOP=1',
          '-U',
          'repaircalc_admin',
          '-d',
          'repaircalc',
        ],
        {
          input: `DELETE FROM repaircalc.engagement_events WHERE id IN (${ids.map((id) => `'${id}'::uuid`).join(',')});`,
          timeout: 15000,
        },
      );
    }
  }
});
