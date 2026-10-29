import { test, expect, type Page } from '@playwright/test';
import { products, createProject, createRoom, estimate, guides } from '../src/data';

async function settings(page: Page) {
  await page.getByRole('button', { name: /^Тестовый режим:/ }).click();
  return page.getByRole('dialog', { name: 'Тестовый режим', exact: true });
}
test('description extraction requires review, applies edited values and persists', async ({ page }) => {
  await page.goto('/#assistant');
  await page.getByRole('button', { name: 'Санузел 6 м², высокая влажность', exact: true }).click();
  await page.getByRole('button', { name: 'Разобрать описание', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Проверьте, всё ли верно' })).toBeVisible();
  await expect(page.getByLabel('Комната для рекомендаций').locator('option')).toHaveCount(3);
  await page.getByLabel('Распознанное название комнаты').fill('Новый санузел');
  await page.getByLabel('Распознанная длина', { exact: true }).fill('3');
  await page.getByLabel('Распознанная ширина', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Добавить в проект', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Добавлено в проект' })).toBeDisabled();
  await expect(page.getByLabel('Комната для рекомендаций').locator('option')).toHaveCount(4);
  await expect(page.locator('.ml-room-context')).toContainText('Новый санузел');
  await page.reload();
  await expect(page.getByLabel('Комната для рекомендаций').locator('option')).toHaveCount(4);
  await page.getByLabel('Назначение, размеры и особенности').fill('Непонятное описание');
  await page.getByRole('button', { name: 'Разобрать описание', exact: true }).click();
  await expect(page.getByText('Нужно немного больше деталей')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить в проект', exact: true })).toHaveCount(0);
});

test('recommendations have sources, alternatives and recover from empty/error scenarios', async ({
  page,
}) => {
  await page.goto('/#assistant');
  await page.getByLabel('Комната для рекомендаций').selectOption({ label: 'Санузел · 6 м²' });
  await expect(page.locator('.ml-recommendation')).toHaveCount(2);
  await page.getByRole('button', { name: 'Почему этот материал?', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Демонстрационная карточка товара');
  await page.keyboard.press('Escape');
  await page.locator('.ml-recommendation').first().getByRole('button', { name: /Ещё/ }).click();
  await page.getByRole('button', { name: 'Выбрать альтернативу: Кварцвинил Дуб тёплый' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.ml-recommendation').first()).toContainText('Кварцвинил Дуб тёплый');
  const panel = await settings(page);
  await panel.getByLabel('ML-сценарий', { exact: true }).selectOption('ml-error');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alert')).toContainText('Тестовая ошибка ML-сервиса');
  await expect(page.locator('.ml-recommendation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Оценить подбор', exact: true })).toHaveCount(0);
  await settings(page);
  await page.getByLabel('ML-сценарий', { exact: true }).selectOption('ml-empty');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Подбор пока пуст' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Оценить подбор', exact: true })).toHaveCount(0);
  await settings(page);
  await page.getByLabel('ML-сценарий', { exact: true }).selectOption('normal');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ml-recommendation')).toHaveCount(2);
});

test('classification supports multiple bindings, approval, rejection and persistence', async ({ page }) => {
  await page.goto('/#matching');
  await page.getByLabel('Выбрать товар: Ламинат Дуб натуральный', { exact: true }).check();
  await page.getByRole('button', { name: 'Сопоставить выбранные (1)' }).click();
  await expect(page.getByText('Получено предложений: 1. Проверьте их перед подтверждением.')).toBeVisible();
  const row = page.locator('.ml-matching-row').filter({ hasText: 'Ламинат Дуб натуральный' });
  await row.getByRole('button', { name: 'Проверить', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Проверить ML-привязку' });
  await dialog.getByLabel('Подготовка основания', { exact: true }).check();
  await dialog.getByLabel('Детская', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Подтвердить привязку' }).click();
  await expect(row).toContainText('Подтверждено');
  await expect(row).toContainText('Подготовка основания');
  await page.reload();
  await expect(row).toContainText('Подтверждено');
  await expect(row).toContainText('Подготовка основания');
  await row.getByRole('button', { name: 'Изменить', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Отклонить', exact: true }).click();
  await page.getByRole('button', { name: 'Отклонены', exact: true }).click();
  await expect(page.locator('.ml-matching-row')).toHaveCount(1);
  await expect(row).toContainText('Отклонено');
});

test('NOT MOCK sends HTTP for bootstrap, calculations, ML and saving; MOCK data stays separate', async ({
  page,
}) => {
  const serverProject = createProject('Серверный дом');
  const calls: { method: string; path: string; body: unknown }[] = [];
  let serverProjects = [serverProject];
  const assignment = {
    productId: 'oak',
    works: ['flooring'],
    rooms: ['living'],
    score: 0.93,
    explanation: 'Предложение HTTP-сервиса',
    status: 'pending',
  };
  const { id: _id, floor: _floor, wall: _wall, ...parsedDraft } = createRoom('bedroom', 'Комната сервера');
  await page.route('http://localhost:8912/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const body = request.postDataJSON();
    calls.push({ method: request.method(), path, body });
    let data: unknown;
    if (path === '/bootstrap')
      data = { products, projects: serverProjects, favorites: [], regions: ['Серверный регион'], guides };
    else if (path === '/estimate') data = { ...estimate(body), total: 777777 };
    else if (path === '/workspace') {
      serverProjects = body.projects;
      data = body;
    } else if (path === '/ml/recommendations')
      data = { summary: 'Рекомендация настоящего HTTP-транспорта', groups: [], excluded: [] };
    else if (path === '/ml/parse-room')
      data = { draft: parsedDraft, extracted: ['Ответ HTTP-сервиса'], assumptions: [], clarification: null };
    else if (path === '/ml/assignments' || path === '/ml/classify') data = [assignment];
    else if (path === '/ml/assignments/oak') data = body;
    else if (path.startsWith('/product/')) data = { quantity: 42, total: 123456, unit: 'упак.' };
    else {
      await route.fulfill({ status: 404, json: { error: 'Not found' } });
      return;
    }
    await route.fulfill({ json: data });
  });
  await page.goto('/');
  await expect(page.getByTestId('budget-total')).not.toHaveText('—');
  const panel = await settings(page);
  await panel.getByLabel('Адрес API', { exact: true }).fill('http://localhost:8912/api/v1');
  await panel.getByRole('button', { name: 'Применить адрес' }).click();
  await panel.getByRole('switch', { name: /MOCK — использовать заглушки/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Серверный дом', exact: true })).toBeVisible();
  await expect(page.getByTestId('budget-total')).toContainText('777 777');
  await page.getByRole('button', { name: 'Серверный дом', exact: true }).click();
  await page.getByLabel('Название проекта', { exact: true }).fill('Изменение на сервере');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Сохранено на сервере', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Умный помощник', exact: true }).click();
  await expect(page.getByText('Рекомендация настоящего HTTP-транспорта')).toBeVisible();
  await page.getByLabel('Назначение, размеры и особенности').fill('Произвольный текст для проверки HTTP');
  await page.getByRole('button', { name: 'Разобрать описание', exact: true }).click();
  await expect(page.getByLabel('Распознанное название комнаты')).toHaveValue('Комната сервера');
  await page.getByRole('button', { name: 'Админка', exact: true }).click();
  await page.getByLabel('Выбрать товар: Ламинат Дуб натуральный', { exact: true }).check();
  await page.getByRole('button', { name: 'Сопоставить выбранные (1)' }).click();
  await expect(page.getByText('Получено предложений: 1. Проверьте их перед подтверждением.')).toBeVisible();
  await page
    .locator('.ml-matching-row')
    .filter({ hasText: 'Ламинат Дуб натуральный' })
    .getByRole('button', { name: 'Проверить', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить привязку' }).click();
  await expect(page.getByText('Привязка подтверждена и сохранена.')).toBeVisible();
  await page.getByRole('button', { name: 'Каталог материалов', exact: true }).click();
  await page.getByRole('button', { name: 'Рассчитать: Ламинат Дуб натуральный' }).click();
  await expect(page.locator('.product-calc-result')).toContainText('42 упак.');
  await expect(page.locator('.product-calc-result')).toContainText('123 456');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Тестовый режим: NOT MOCK', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Калькулятор ремонта', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Изменение на сервере', exact: true })).toBeVisible();
  await settings(page);
  await page.getByRole('switch', { name: /MOCK — использовать заглушки/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Квартира на Петроградской', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Изменение на сервере', exact: true })).toHaveCount(0);
  expect(
    calls.some(
      (c) =>
        c.path === '/workspace' &&
        c.method === 'PUT' &&
        JSON.stringify(c.body).includes('Изменение на сервере'),
    ),
  ).toBe(true);
  expect(calls.some((c) => c.path === '/ml/recommendations' && c.method === 'POST')).toBe(true);
  expect(calls.some((c) => c.path === '/product/oak/calc' && c.method === 'POST')).toBe(true);
  expect(
    calls.some(
      (c) =>
        c.path === '/ml/parse-room' &&
        c.method === 'POST' &&
        JSON.stringify(c.body).includes('Произвольный текст'),
    ),
  ).toBe(true);
  expect(calls.some((c) => c.path === '/ml/classify' && c.method === 'POST')).toBe(true);
  expect(
    calls.some(
      (c) =>
        c.path === '/ml/assignments/oak' && c.method === 'PUT' && JSON.stringify(c.body).includes('approved'),
    ),
  ).toBe(true);
});

test('unavailable and malformed HTTP responses do not fall back to mocks', async ({ page }) => {
  await page.route('http://localhost:8913/api/v1/**', (route) => route.abort('connectionrefused'));
  await page.goto('/');
  const panel = await settings(page);
  await panel.getByLabel('Адрес API', { exact: true }).fill('http://localhost:8913/api/v1');
  await panel.getByRole('button', { name: 'Применить адрес' }).click();
  await panel.getByRole('switch', { name: /MOCK — использовать заглушки/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить мастерскую' })).toBeVisible();
  await expect(page.getByText('Не удалось связаться с сервером.', { exact: false })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await page.unroute('http://localhost:8913/api/v1/**');
  await page.route('http://localhost:8913/api/v1/**', (route) => route.fulfill({ json: { wrong: true } }));
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(
    page.getByText('Ответ сервера не соответствует контракту API.', { exact: false }),
  ).toBeVisible();
  await settings(page);
  await page.getByRole('switch', { name: /MOCK — использовать заглушки/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tab')).toHaveCount(3);
});

test('editing a prompt cancels an obsolete response and the mobile ML screens fit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#assistant');
  await settings(page);
  await page.getByLabel('Задержка заглушки', { exact: true }).selectOption('1200');
  await page.keyboard.press('Escape');
  await page.getByLabel('Назначение, размеры и особенности').fill('Кухня 4 × 3 м');
  await page.getByRole('button', { name: 'Разобрать описание', exact: true }).click();
  await page.getByLabel('Назначение, размеры и особенности').fill('Спальня 16 м²');
  await page.waitForTimeout(1400);
  await expect(page.getByRole('heading', { name: 'Проверьте, всё ли верно' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Разобрать описание', exact: true }).click();
  await expect(page.getByLabel('Распознанное название комнаты')).toHaveValue('Спальня');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.goto('/#matching');
  await expect(page.locator('.ml-matching-row')).toHaveCount(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await settings(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
