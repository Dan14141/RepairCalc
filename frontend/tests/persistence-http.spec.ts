import { test, expect } from '@playwright/test';
import { products, createProject, estimate, guides } from '../src/data';

test('HTTP workspace loads without writes, retries failed saving and serializes new edits', async ({
  page,
}) => {
  let workspace = { projects: [createProject('Серверный проект')], favorites: [] as string[] };
  let writes = 0;
  let active = 0;
  let maxActive = 0;
  await page.addInitScript(() =>
    localStorage.setItem(
      'repaircalc.runtime.v1',
      JSON.stringify({ mode: 'http', baseUrl: 'http://localhost:8914/api/v1', delay: 0, scenario: 'normal' }),
    ),
  );
  await page.route('http://localhost:8914/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/bootstrap')) {
      await route.fulfill({ json: { ...workspace, products, guides, regions: ['Москва'] } });
      return;
    }
    if (path.endsWith('/estimate')) {
      await route.fulfill({ json: estimate(route.request().postDataJSON()) });
      return;
    }
    if (path.endsWith('/workspace')) {
      writes++;
      if (writes === 1) {
        await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
        return;
      }
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 200));
      workspace = route.request().postDataJSON();
      active--;
      await route.fulfill({ json: workspace });
      return;
    }
    await route.fulfill({ status: 404 });
  });
  await page.goto('/');
  await expect(page.getByTestId('budget-total')).not.toHaveText('—');
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Серверный проект', exact: true }).click();
  await page.getByLabel('Название проекта', { exact: true }).fill('Несохранённая правка');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('503');
  await expect(page.getByRole('button', { name: 'Несохранённая правка', exact: true })).toBeVisible();
  await page.getByRole('alert').getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText('Сохранено на сервере', { exact: true })).toBeVisible();
  expect(workspace.projects[0].name).toBe('Несохранённая правка');
  const firstWrite = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().endsWith('/workspace'),
  );
  await page.getByLabel('Длина', { exact: true }).fill('5');
  await firstWrite;
  await page.getByLabel('Длина', { exact: true }).fill('6');
  await expect(page.getByText('Сохранено на сервере', { exact: true })).toBeVisible();
  expect(workspace.projects[0].rooms[0].length).toBe(6);
  expect(maxActive).toBe(1);
});
