import {test, expect, type Page, type Locator} from '@playwright/test';
import path from 'node:path';

async function load(page: Page, caseId: string) {
  await page.goto('/');
  for (const [label, name] of [['基准 PDF', 'before'], ['待审 PDF', 'after']])
    await page.getByLabel(label, {exact: true}).setInputFiles(path.resolve('validation/dataset/cases', caseId, name + '.pdf'));
  await page.getByRole('button', {name: '开始比较', exact: true}).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', /complete_for_scope|partial/);
  await expect(page.locator('[data-ready-page]')).toHaveCount(2);
  // The first selected item is now a real content change, which may be on a
  // later page. Scroll tests explicitly start at page one on both sides.
  for (const side of ['基准', '待审']) {
    const previous = page.getByRole('button', {name: side + '上一页', exact: true});
    while (await previous.isEnabled()) await previous.click();
  }
  await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);
}

async function wheelTo(page: Page, pane: Locator, pageIndex: number, inset = 20) {
  const delta = await pane.evaluate((el, {pageIndex, inset}) =>
    (el.querySelector(`[data-page-index="${pageIndex}"]`) as HTMLElement).offsetTop + inset - el.scrollTop,
  {pageIndex, inset});
  await pane.hover();
  await page.mouse.wheel(0, delta);
}

test('wheel crosses page boundaries in either direction, panes remain independent when sync is off', async ({page}) => {
  await load(page, 'R16_repagination'); // author-defined 2 old pages, 3 new pages
  await page.getByRole('checkbox', {name: '同步滚动'}).uncheck();
  const left = page.getByRole('region', {name: '基准原文连续浏览'});
  const right = page.getByRole('region', {name: '待审原文连续浏览'});
  await expect(right.locator('[data-page-index]')).toHaveCount(3);
  await expect(right.locator('[data-page-index="1"] img')).toHaveCount(1);
  await wheelTo(page, right, 1, -90);
  // At the boundary, the end of one real page and start of the next coexist.
  await expect.poll(() => right.evaluate(el => [0, 1].every(p => {
    const r = el.querySelector(`[data-page-index="${p}"] img`)!.getBoundingClientRect();
    const viewport = el.getBoundingClientRect();
    return r.top < viewport.bottom && r.bottom > viewport.top;
  }))).toBe(true);
  await wheelTo(page, right, 1);
  await expect(right.locator('[data-ready-page="1"]')).toBeVisible();
  await expect(left.locator('[data-ready-page="0"]')).toBeVisible();
  await wheelTo(page, right, 2);
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  await expect(right.locator('[data-page-index="0"] img')).toHaveCount(0);
  await expect(page.getByRole('button', {name: '待审下一页', exact: true})).toBeDisabled();
  await right.hover();
  await page.mouse.wheel(0, 10000);
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  await wheelTo(page, right, 0, 0);
  await expect(right.locator('[data-ready-page="0"]')).toBeVisible();
  await expect(page.getByRole('button', {name: '待审上一页', exact: true})).toBeDisabled();
  await page.mouse.wheel(0, -10000);
  await expect(right.locator('[data-ready-page="0"]')).toBeVisible();
  // A source jump still selects the requested PDF page after scrolling.
  const quantities = page.getByRole('region', {name: '重复文字次数摘要'});
  await quantities.locator('details > summary').first().click();
  const repeated = quantities.locator('.repeat-count-item').filter({hasText: 'SYNTHETIC TEST - NOT A REAL POLICY'});
  await repeated.locator('.occurrence-details > summary').click();
  await repeated.getByRole('button', {name: '待审来源 3', exact: true}).click();
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  await expect(right.locator('polygon.highlight-location').first()).toBeVisible();
  expect(await right.locator('.sheet').count()).toBeLessThanOrEqual(3);
  await wheelTo(page, left, 1);
  await expect(left.locator('[data-ready-page="1"]')).toBeVisible();
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
});

test('synchronized wheel scrolling follows existing text alignment across pages; buttons still work', async ({page}) => {
  await load(page, 'R09_header_limit');
  const left = page.getByRole('region', {name: '基准原文连续浏览'});
  const right = page.getByRole('region', {name: '待审原文连续浏览'});
  await wheelTo(page, left, 1, 80);
  await expect(left.locator('[data-ready-page="1"]')).toBeVisible();
  await expect(right.locator('[data-ready-page="1"]')).toBeVisible();
  await page.getByRole('button', {name: '基准上一页', exact: true}).click();
  await expect(left.locator('[data-ready-page="0"]')).toBeVisible();
  await page.getByRole('button', {name: '基准下一页', exact: true}).click();
  await expect(left.locator('[data-ready-page="1"]')).toBeVisible();
  // Resizing preserves the active PDF page and its source highlight.
  await page.getByRole('button', {name: '出现位置 2', exact: true}).click();
  await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);
  await page.setViewportSize({width: 1250, height: 900});
  await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);
  await expect(left.locator('polygon.highlight-old').first()).toBeVisible();
  await expect(right.locator('polygon.highlight-new').first()).toBeVisible();
});

test('a page shorter than the viewport still reaches the final page; rapid scrolling keeps the latest view', async ({page}) => {
  await page.setViewportSize({width: 1120, height: 1000});
  await load(page, 'R16_repagination');
  await page.getByRole('checkbox', {name: '同步滚动'}).uncheck();
  const right = page.getByRole('region', {name: '待审原文连续浏览'});
  expect(await right.evaluate(el => el.querySelector('[data-page-index="2"]')!.getBoundingClientRect().height < el.clientHeight)).toBe(true);
  await right.hover();
  await page.mouse.wheel(0, 10000);
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  await expect(page.getByRole('button', {name: '待审下一页', exact: true})).toBeDisabled();
  await page.mouse.wheel(0, -10000);
  await page.mouse.wheel(0, 10000);
  await page.mouse.wheel(0, -10000);
  await expect(right.locator('[data-ready-page="0"]')).toBeVisible();
  expect(await right.locator('.sheet').count()).toBeLessThanOrEqual(3);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', /complete_for_scope|partial/);
});

test('every on-screen page renders when the complete document fits without scrolling', async ({page}) => {
  await page.setViewportSize({width: 1120, height: 2400});
  await load(page, 'R16_repagination');
  const right = page.getByRole('region', {name: '待审原文连续浏览'});
  expect(await right.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  await expect(right.locator('.sheet img')).toHaveCount(3);
  await expect(right.locator('.page-placeholder')).toHaveCount(0);
  await expect.poll(() => right.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  // Navigation must not evict another source page that is still on screen.
  await page.getByRole('button', {name: '待审下一页', exact: true}).click();
  await page.getByRole('button', {name: '待审下一页', exact: true}).click();
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  await expect(right.locator('.sheet img')).toHaveCount(3);
});

test('height-only resizing loads newly visible pages and retains visible predecessors at the bottom', async ({page}) => {
  await page.setViewportSize({width: 1120, height: 800});
  await load(page, 'R16_repagination');
  await page.getByRole('checkbox', {name: '同步滚动'}).uncheck();
  const right = page.getByRole('region', {name: '待审原文连续浏览'});
  await page.setViewportSize({width: 1120, height: 2400});
  expect(await right.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  await expect(right.locator('.sheet img')).toHaveCount(3);
  await page.setViewportSize({width: 1120, height: 1450});
  await right.hover();
  await page.mouse.wheel(0, 10000);
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  const visible = await right.evaluate(el => Array.from(el.querySelectorAll<HTMLElement>('[data-page-index]'))
    .filter(slot => slot.offsetTop < el.scrollTop + el.clientHeight && slot.offsetTop + slot.offsetHeight > el.scrollTop)
    .map(slot => Number(slot.dataset.pageIndex)));
  expect(visible).toContain(0);
  for (const p of visible) await expect(right.locator(`[data-page-index="${p}"] img`)).toHaveCount(1);
});
