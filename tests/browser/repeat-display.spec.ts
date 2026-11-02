import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

async function load(page: Page, caseId: string, reverse = false, root = 'validation/dataset/cases') {
  await page.goto('/');
  for (const [label, name] of [['基准 PDF', 'before'], ['待审 PDF', 'after']])
    await page.getByLabel(label, {exact: true}).setInputFiles(path.resolve(root, caseId,
      (reverse ? name === 'before' ? 'after' : 'before' : name) + '.pdf'));
  await page.getByRole('button', {name: '开始比较', exact: true}).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', /complete_for_scope|partial/);
}

for (const reverse of [false, true]) test('count-only ' + (reverse ? 'decreases' : 'increases') + ' stay out of change cards and preserve all sources', async ({page}) => {
  // Independent author input: the same notice occurs on 2 old and 3 new pages.
  await load(page, 'R16_repagination', reverse);
  const text = 'SYNTHETIC TEST - NOT A REAL POLICY';
  const sourceSide = reverse ? 0 : 1;
  const summary = page.getByRole('region', {name: '重复文字次数摘要'});
  const row = summary.locator('.repeat-count-item').filter({hasText: text});
  await expect(page.locator('.cards .card').filter({hasText: text})).toHaveCount(0);
  await expect(summary).toBeVisible();
  await expect(summary.locator('details').first()).not.toHaveAttribute('open');
  await expect(row).not.toBeVisible();
  const mainCount = await page.locator('.cards .card').count();
  await expect(page.locator('.list-head h2 span')).toHaveText(String(mainCount));
  const wording = page.locator('.card').filter({has: page.getByText('POLICY WORDING', {exact: true})});
  await wording.click();
  await expect(page.locator(reverse ? 'polygon.highlight-old' : 'polygon.highlight-new').first()).toBeVisible();
  const pagesBefore = await page.locator('[data-ready-page]').evaluateAll(es => es.map(e => e.getAttribute('data-ready-page')));
  await summary.locator('details > summary').first().click();
  await expect(row).toContainText(reverse ? '3 次 → 2 次' : '2 次 → 3 次');
  await expect(row).toContainText(reverse ? '少出现 1 次' : '多出现 1 次');
  await expect(summary).toContainText('具体新增或减少位置未确定');
  // Reading the quantities, including clicking the unchanged text, does not locate it.
  await row.getByText(text, {exact: true}).click();
  expect(await page.locator('[data-ready-page]').evaluateAll(es => es.map(e => e.getAttribute('data-ready-page')))).toEqual(pagesBefore);
  await expect(page.locator('polygon.highlight-location')).toHaveCount(0);
  await expect(row.getByRole('button', {name: '基准来源 1', exact: true})).not.toBeVisible();
  await row.locator('.occurrence-details > summary').click();
  await expect(row.getByRole('button', {name: /^基准来源 /})).toHaveCount(reverse ? 3 : 2);
  await expect(row.getByRole('button', {name: /^待审来源 /})).toHaveCount(reverse ? 2 : 3);
  await row.getByRole('button', {name: reverse ? '基准来源 3' : '待审来源 3', exact: true}).click();
  await expect(page.locator('.document').nth(sourceSide).locator('[data-ready-page="2"]')).toBeVisible();
  await expect(page.locator('.document').nth(sourceSide).locator('polygon.highlight-location').first()).toBeVisible();
  await expect(page.locator('.document').nth(1 - sourceSide).locator('polygon')).toHaveCount(0);
  await expect(page.locator('.location-hint')).toContainText('数量摘要来源');
  await expect(page.locator('.location-hint')).toContainText('不代表该处新增或减少');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: '导出 JSON', exact: true}).click();
  const result = JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
  const difference = result.differences.find((d: any) => d.oldText === text && d.newText === text);
  expect(difference.hasTextChange).toBe(false);
  expect(difference.repeat).toEqual(reverse
    ? {left: 3, right: 2, leftPages: 3, rightPages: 2}
    : {left: 2, right: 3, leftPages: 2, rightPages: 3});
  expect(difference.occurrences).toHaveLength(3);
  // UI totals account for every original comparison record without relabelling the JSON.
  expect(mainCount + await summary.locator('.repeat-count-item').count()).toBe(result.differences.length);
  await wording.click();
  await expect(page.locator(reverse ? 'polygon.highlight-old' : 'polygon.highlight-new').first()).toBeVisible();
  await expect(page.locator('polygon.highlight-location')).toHaveCount(0);
  await expect(page.locator('.location-hint')).toHaveCount(0);
  await page.getByLabel('按变化方式筛选').selectOption('Replaced');
  const filtered = await page.locator('.cards .card').count();
  await expect(page.locator('aside > p.subtle')).toContainText(String(mainCount - filtered) + ' 项');
  await expect(page.locator('.cards .card').filter({hasText: text})).toHaveCount(0);
  await expect(summary).toBeVisible();
});

test('a real page-number text change remains a main card and locates the edited digits', async ({page}) => {
  // Author-fixed P13: "Reference: Page 3 of 10." -> "Reference: Page 4 of 10."
  await load(page, 'P13', false, 'validation/synthetic-review-20261030/cases');
  const card = page.locator('.cards .card').filter({hasText: 'Page 3 of 10'});
  await expect(card).toHaveCount(1);
  await expect(card.locator('.old')).toContainText('Page 3 of 10');
  await expect(card.locator('.new')).toContainText('Page 4 of 10');
  await card.click();
  await expect(page.locator('polygon.highlight-old').first()).toBeVisible();
  await expect(page.locator('polygon.highlight-new').first()).toBeVisible();
  await expect(page.locator('polygon.highlight-location')).toHaveCount(0);
  await expect(page.getByRole('region', {name: '重复文字次数摘要'})).toHaveCount(0);
});

test('optional quantity sources remain visible on a narrow window after explicit navigation', async ({page}) => {
  await page.setViewportSize({width: 650, height: 700});
  await load(page, 'R16_repagination');
  const summary = page.getByRole('region', {name: '重复文字次数摘要'});
  await summary.locator('details > summary').first().click();
  const row = summary.locator('.repeat-count-item').filter({hasText: 'SYNTHETIC TEST - NOT A REAL POLICY'});
  await row.locator('.occurrence-details > summary').click();
  await row.getByRole('button', {name: '待审来源 1', exact: true}).click();
  const target = page.locator('.document').nth(1);
  await expect(target.locator('polygon.highlight-location').first()).toBeInViewport({ratio: 0.99});
  await expect(target.locator('[data-location-focus]')).toBeInViewport({ratio: 0.99});
  await expect(target.locator('.location-marker-label')).toHaveText('文字示例');
  await expect(target.locator('.location-marker-label')).toBeInViewport({ratio: 0.99});
  const border = await target.locator('[data-location-focus]').evaluate(el => parseFloat(getComputedStyle(el).borderTopWidth));
  expect(border).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.cards .card').filter({hasText: 'SYNTHETIC TEST - NOT A REAL POLICY'})).toHaveCount(0);
});

test('unchanged text with an actual move remains a main review item', async ({page}) => {
  await load(page, 'R12_exact_move');
  const moved = page.locator('.cards .card').filter({hasText: '位置移动，文字未变'}).first();
  await expect(moved).toBeVisible();
  await expect(moved.locator('.same-text')).toHaveCount(1);
  await moved.click();
  await expect(page.locator('polygon.highlight-location').first()).toBeVisible();
});

test('changed repeated header remains a red-green main comparison with accessible occurrences', async ({page}) => {
  await load(page, 'R09_header_limit');
  const card = page.locator('.cards .card').filter({hasText: 'USD 4,000,000'});
  await expect(card).toHaveCount(1);
  await expect(card.locator('.old')).toContainText('USD 2,000,000');
  await expect(card.locator('.new')).toContainText('USD 4,000,000');
  await expect(card.locator('.same-text')).toHaveCount(0);
  await card.getByRole('button', {name: '出现位置 2', exact: true}).click();
  await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);
  await expect(page.locator('polygon.highlight-old').first()).toBeVisible();
  await expect(page.locator('polygon.highlight-new').first()).toBeVisible();
  await expect(page.locator('polygon.highlight-location')).toHaveCount(0);
});
