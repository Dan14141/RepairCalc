import { test, expect } from '@playwright/test';

test('room edits recalculate the budget and persist after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Хороший ремонт');
  const total = page.getByTestId('budget-total');
  const before = await total.innerText();
  await page.getByLabel('Длина', { exact: true }).fill('6,5');
  await page.getByLabel('Ширина', { exact: true }).click();
  await expect(total).not.toHaveText(before);
  await expect(page.getByRole('tab', { name: /Гостиная/ })).toContainText('26 м²');
  const after = await total.innerText();
  await page.reload();
  await expect(page.getByLabel('Длина', { exact: true })).toHaveValue('6.5');
  await expect(total).toHaveText(after);
  await page.getByLabel('Длина', { exact: true }).fill('-2');
  await expect(page.getByLabel('Длина', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(total).toHaveText(after);
  await page.getByLabel('Ширина', { exact: true }).click();
  await expect(page.getByLabel('Длина', { exact: true })).toHaveValue('6.5');
  expect(errors).toEqual([]);
});

test('wet room filters coverings and material replacement updates selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Санузел/ }).click();
  await expect(page.getByRole('switch', { name: /Повышенная влажность/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Подобрать материалы', exact: true }).click();
  await page.getByRole('button', { name: 'Заменить', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Ламинат Дуб натуральный')).toHaveCount(0);
  await dialog.getByRole('button', { name: /Кварцвинил Дуб тёплый/ }).click();
  await expect(page.getByRole('button', { name: 'Кварцвинил Дуб тёплый', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Перейти к смете', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ваш ремонт в цифрах' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Кварцвинил Дуб тёплый', exact: true })).toBeVisible();
});

test('creating, renaming and duplicating projects preserves independent state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Начать новый проект/ }).click();
  await page.getByRole('textbox', { name: 'Название проекта' }).fill('Дом у озера');
  await page.getByRole('button', { name: 'Создать проект', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Дом у озера', exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(1);
  await page.getByRole('button', { name: 'Добавить помещение', exact: true }).click();
  await page.getByRole('button', { name: 'Санузел', exact: true }).click();
  await page.getByRole('textbox', { name: 'Название помещения' }).fill('Гостевой санузел');
  await page.getByRole('button', { name: 'Добавить помещение', exact: true }).last().click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: /Гостевой санузел/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Дом у озера', exact: true }).click();
  await page.getByRole('textbox', { name: 'Название проекта' }).fill('Наш загородный дом');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByRole('button', { name: 'Все проекты', exact: true }).click();
  await page.getByRole('button', { name: 'Дублировать проект Наш загородный дом' }).click();
  await expect(page.getByRole('heading', { name: 'Наш загородный дом — копия' })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть Квартира на Петроградской' }).click();
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByLabel('Длина', { exact: true })).toHaveValue('4.5');
});

test('catalog search, favorites and product calculator work', async ({ page }) => {
  await page.goto('/#catalog');
  await page.getByRole('textbox', { name: 'Поиск материалов' }).fill('Дуб натуральный');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'В избранное: Ламинат Дуб натуральный', exact: true }).click();
  await page.getByRole('button', { name: 'Рассчитать: Ламинат Дуб натуральный', exact: true }).click();
  await page.getByLabel('Площадь поверхности', { exact: true }).fill('20');
  await expect(page.locator('.product-calc-result')).toContainText('11 упак.');
  await expect(page.locator('.product-calc-result')).toContainText('27 390');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: /Избранное/ })
    .first()
    .click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Убрать из избранного: Ламинат Дуб натуральный' }).click();
  await expect(page.getByRole('heading', { name: 'Сохраните то, что нравится' })).toBeVisible();
});

test('reserve, labor and CSV use consistent final totals', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('budget-total')).not.toHaveText('—');
  const before = await page.getByTestId('budget-total').innerText();
  await page.getByLabel('Запас материалов', { exact: true }).selectOption('15');
  await expect(page.getByTestId('budget-total')).not.toHaveText(before);
  await expect(page.getByTestId('budget-total')).not.toHaveText('—');
  const materials = Number((await page.getByTestId('budget-total').innerText()).replace(/\D/g, ''));
  await page.getByRole('switch', { name: 'Добавить стоимость работ', exact: true }).click();
  await expect(page.getByTestId('budget-total')).not.toHaveText('—');
  const total = Number((await page.getByTestId('budget-total').innerText()).replace(/\D/g, ''));
  expect(total - materials).toBe(36 * 1800);
  await page.getByRole('button', { name: /Ваша смета/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/Смета.*\.csv$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const content = Buffer.concat(chunks).toString('utf8');
  expect(content).toContain(`"Итого";"";"";"";"";"${total}"`);
  expect(content).toContain('15%');
});

test('mobile workflow and pages do not overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'Увеличить план помещения' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Подобрать материалы', exact: true }).click();
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'Перейти к смете', exact: true }).click();
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: 'Каталог материалов', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Найдите идеальные материалы/ })).toBeVisible();
  expect(await overflow()).toBe(false);
  await page.getByRole('button', { name: 'Рассчитать: Ламинат Дуб натуральный' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await overflow()).toBe(false);
});

test('corrupted storage recovers and dialogs trap and return focus', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('repaircalc.projects.v1', '{broken');
    localStorage.setItem('repaircalc.favorites', 'null');
  });
  await page.goto('/');
  await expect(page.getByRole('tab')).toHaveCount(3);
  const opener = page.getByRole('button', { name: 'Добавить помещение', exact: true });
  await opener.click();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Добавить помещение', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Закрыть', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
});
