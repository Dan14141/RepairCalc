import { test, expect, type Locator } from '@playwright/test';
import { createProject, createRoom, roomTypes } from '../src/data';

test.beforeEach(async ({ page }) => {
  const project = createProject();
  project.rooms = roomTypes.map((type) => createRoom(type.id));
  await page.addInitScript((project) => {
    localStorage.setItem('repaircalc.projects.v1', JSON.stringify([project]));
    localStorage.setItem(
      'repaircalc.runtime.v1',
      JSON.stringify({ mode: 'mock', baseUrl: 'http://127.0.0.1:8000/api/v1', delay: 0, scenario: 'normal' }),
    );
  }, project);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.room-plan')).toBeVisible();
});

async function measurements(plan: Locator) {
  return plan.evaluate((svg) => {
    const floor = svg.querySelector<SVGRectElement>('.plan-floor')!;
    const room = svg.querySelector<SVGGElement>('.plan-room')!;
    const sofa = svg.querySelector<SVGGElement>('[data-fixture="sofa"]')!;
    const meter = svg.querySelector<SVGPathElement>('.plan-scale path')!;
    const floorBox = floor.getBoundingClientRect();
    const sofaBox = sofa.getBoundingClientRect();
    const matrix = room.getCTM()!;
    const pixelsPerMeter = meter.getBoundingClientRect().width;
    return {
      aspect: floorBox.width / floorBox.height,
      scaleX: matrix.a,
      scaleY: matrix.d,
      scaleLength: pixelsPerMeter / (floorBox.width / Number(floor.getAttribute('width'))),
      sofaWidth: sofaBox.width / pixelsPerMeter,
      sofaLength: sofaBox.height / pixelsPerMeter,
      stroke: getComputedStyle(sofa.querySelector('rect')!).strokeWidth,
      vectorEffect: getComputedStyle(sofa.querySelector('rect')!).vectorEffect,
    };
  });
}

test('room proportions, furniture sizes and metre ruler stay accurate after resizing', async ({ page }) => {
  const plan = page.locator('.room-plan');
  const before = await measurements(plan);
  expect(before.aspect).toBeCloseTo(4.5 / 4, 3);
  await page.getByLabel('Длина', { exact: true }).fill('9');
  await page.getByLabel('Ширина', { exact: true }).fill('6');
  await expect(plan).toHaveAccessibleName('План комнаты Гостиная: 9 на 6 метра');
  await expect(plan.locator('.plan-area')).toHaveText('54');
  const after = await measurements(plan);
  expect(after.aspect).toBeCloseTo(9 / 6, 3);
  for (const value of [before, after]) {
    expect(value.scaleX).toBeCloseTo(value.scaleY, 4);
    expect(value.scaleLength).toBeCloseTo(1, 4);
    expect(value.sofaWidth).toBeCloseTo(0.95, 3);
    expect(value.sofaLength).toBeCloseTo(2.2, 3);
    expect(value.vectorEffect).toBe('non-scaling-stroke');
  }
  expect(after.stroke).toBe(before.stroke);
});

test('all room types keep fixtures and door swings inside narrow and small rooms', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const plan = page.locator('.room-plan');
  for (const type of roomTypes) {
    await page.getByRole('tab', { name: new RegExp(type.name) }).click();
    expect(await plan.locator('.plan-item').count()).toBeGreaterThan(0);
    for (const [length, width] of [
      [3, 2],
      [1, 5],
      [5, 1],
      [0.5, 0.5],
      [30, 30],
      [0.5, 30],
      [30, 0.5],
    ]) {
      await page.getByLabel('Длина', { exact: true }).fill(String(length));
      await page.getByLabel('Ширина', { exact: true }).fill(String(width));
      const issues = await plan.evaluate((svg) => {
        const floor = svg.querySelector<SVGRectElement>('.plan-floor')!;
        const L = Number(floor.getAttribute('width'));
        const W = Number(floor.getAttribute('height'));
        const room = svg.querySelector<SVGGElement>('.plan-room')!;
        const inverse = room.getCTM()!.inverse();
        const issues: string[] = [];
        for (const element of svg.querySelectorAll<SVGGraphicsElement>('.plan-item, .plan-door')) {
          const box = element.getBBox();
          const matrix = element.getCTM()!;
          const start = new DOMPoint(box.x, box.y).matrixTransform(matrix).matrixTransform(inverse);
          const end = new DOMPoint(box.x + box.width, box.y + box.height)
            .matrixTransform(matrix)
            .matrixTransform(inverse);
          if (start.x < -0.001 || start.y < -0.001 || end.x > L + 0.001 || end.y > W + 0.001)
            issues.push(element.getAttribute('data-fixture') || 'door');
        }
        for (const rect of svg.querySelectorAll('rect')) {
          for (const name of ['width', 'height']) {
            const value = Number(rect.getAttribute(name));
            if (!Number.isFinite(value) || value <= 0) issues.push(`Invalid ${name}: ${value}`);
          }
        }
        return issues;
      });
      expect(issues, `${type.id} ${length} × ${width}`).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});

test('dimension lines track the room throughout resizing and reduced motion skips interpolation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByLabel('Длина', { exact: true }).fill('9');
  const samples = await page.locator('.room-plan').evaluate(async (svg) => {
    const samples: { length: number; difference: number }[] = [];
    const until = performance.now() + 550;
    while (performance.now() < until) {
      await new Promise(requestAnimationFrame);
      const floor = svg.querySelector<SVGRectElement>('.plan-floor')!;
      const dimension = svg.querySelector<SVGPathElement>('.plan-dimensions path')!;
      const svgScale = (svg as unknown as SVGSVGElement).getCTM()!.a;
      samples.push({
        length: Number(floor.getAttribute('width')),
        difference:
          dimension.getBoundingClientRect().width - floor.getBoundingClientRect().width - 6 * svgScale,
      });
    }
    return samples;
  });
  expect(samples.some((sample) => sample.length > 4.5 && sample.length < 9)).toBe(true);
  expect(samples.at(-1)!.length).toBe(9);
  for (const sample of samples) expect(Math.abs(sample.difference)).toBeLessThan(0.01);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByLabel('Длина', { exact: true }).fill('6');
  await expect(page.locator('.plan-floor')).toHaveAttribute('width', '6');
  expect(
    await page.locator('.room-plan').evaluate((svg) => svg.getAnimations({ subtree: true }).length),
  ).toBe(0);
});

test('openings update and the expanded plan has its own pattern and matching paper colour', async ({
  page,
}) => {
  const plan = page.locator('.plan-wrap .room-plan');
  await page.getByRole('button', { name: 'Уменьшить: Окна', exact: true }).click();
  await expect(plan.locator('.plan-window')).toHaveCount(0);
  await page.getByRole('button', { name: 'Уменьшить: Двери', exact: true }).click();
  await expect(plan.locator('.plan-door')).toHaveCount(0);
  await page.getByRole('button', { name: 'Увеличить: Окна', exact: true }).click();
  await page.getByRole('button', { name: 'Увеличить: Двери', exact: true }).click();
  await expect(plan.locator('.plan-window')).toHaveCount(1);
  await expect(plan.locator('.plan-door')).toHaveCount(1);
  await page.getByRole('button', { name: 'Увеличить план помещения' }).click();
  const expanded = page.getByRole('dialog').locator('.room-plan');
  await expect(expanded).toBeVisible();
  const patterns = await page
    .locator('.room-plan pattern')
    .evaluateAll((patterns) => patterns.map((pattern) => pattern.id));
  expect(new Set(patterns).size).toBe(2);
  expect(await expanded.locator('.plan-floor-pattern').getAttribute('fill')).toBe(`url(#${patterns[1]})`);
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const image of [plan, expanded]) {
    const colours = await image.evaluate((svg) => ({
      paper: getComputedStyle(svg).backgroundColor,
      label: getComputedStyle(svg.querySelector('.plan-measure')!).stroke,
    }));
    expect(colours.label).toBe(colours.paper);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Увеличить план помещения' })).toBeFocused();
});
