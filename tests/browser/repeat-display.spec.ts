import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

async function load(page: Page, caseId: string, reverse = false) {
  await page.goto('/');
  for (const [label, name] of [['基准 PDF', 'before'], ['待审 PDF', 'after']])
    await page.getByLabel(label, {exact: true}).setInputFiles(path.resolve('validation/dataset/cases', caseId,
      (reverse ? name === 'before' ? 'after' : 'before' : name) + '.pdf'));
  await page.getByRole('button', {name: '开始比较', exact: true}).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', /complete_for_scope|partial/);
}

for (const reverse of [false, true]) test(`repeated text shows only the ${reverse ? 'decrease' : 'increase'} and does not invent a changed location`, async ({page}) => {
  // Existing author-defined case: this notice occurs on 2 old pages and 3 new
  // pages. Do not infer that page count explains any other repeated content.
  await load(page, 'R16_repagination', reverse);
  const text = 'SYNTHETIC TEST - NOT A REAL POLICY';
  const sourceSide = reverse ? 0 : 1;
  const card = page.locator('.card').filter({has: page.locator('.same-text').filter({hasText: text})});
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('文字未变，次数变化');
  await expect(card.locator('.repeat-delta')).toHaveText(reverse
    ? '少出现 1 次具体减少位置未确定点击卡片定位文字示例' : '多出现 1 次具体新增位置未确定点击卡片定位文字示例');
  await expect(card.getByText(/这段文字出现次数/)).not.toBeVisible();
  await expect(card.locator('.old, .new')).toHaveCount(0);
  await expect(card.getByRole('button', {name: '基准来源 1', exact: true})).not.toBeVisible();
  // A real change can have an existing highlight. Clicking the count summary
  // must locate one clearly labelled example, including by keyboard. Prefer
  // the already displayed page; do not claim the final occurrence was added.
  const wording = page.locator('.card').filter({has: page.getByText('POLICY WORDING', {exact: true})});
  await wording.click();
  await expect(page.locator(reverse ? 'polygon.highlight-old' : 'polygon.highlight-new').first()).toBeVisible();
  await expect(page.locator('[data-ready-page]')).toHaveCount(2);
  const pagesBefore = await page.locator('[data-ready-page]').evaluateAll(es => es.map(e => e.getAttribute('data-ready-page')));
  await card.press('Enter');
  await expect(page.locator('.document').nth(sourceSide).locator('polygon.highlight-location').first()).toBeVisible();
  await expect(page.locator('.document').nth(1 - sourceSide).locator('polygon')).toHaveCount(0);
  await expect(page.locator('.location-hint')).toContainText('文字示例');
  await expect(page.locator('.location-hint')).toContainText('不代表这里是新增或减少的位置');
  await expect(page.locator('polygon.highlight-old, polygon.highlight-new')).toHaveCount(0);
  expect(await page.locator('[data-ready-page]').evaluateAll(es => es.map(e => e.getAttribute('data-ready-page')))).toEqual(pagesBefore);
  await card.locator('summary').click();
  expect(await page.locator('[data-ready-page]').evaluateAll(es => es.map(e => e.getAttribute('data-ready-page')))).toEqual(pagesBefore);
  await expect(card).toContainText(reverse ? '3 次 → 2 次' : '2 次 → 3 次');
  await expect(card).toContainText('不表示哪一处新增或减少');
  await expect(card.getByRole('button', {name: /^基准来源 /})).toHaveCount(reverse ? 3 : 2);
  await expect(card.getByRole('button', {name: /^待审来源 /})).toHaveCount(reverse ? 2 : 3);
  await card.getByRole('button', {name: reverse ? '基准来源 3' : '待审来源 3', exact: true}).click();
  await expect(page.locator('.document').nth(sourceSide).locator('[data-ready-page="2"]')).toBeVisible();
  await expect(page.locator('.document').nth(sourceSide).locator('polygon.highlight-location').first()).toBeVisible();
  await expect(page.locator('.document').nth(1 - sourceSide).locator('polygon')).toHaveCount(0);
  await expect(page.locator('polygon.highlight-old, polygon.highlight-new')).toHaveCount(0);
  await card.locator('.same-text').click();
  await expect(page.locator('.document').nth(sourceSide).locator('polygon.highlight-location').first()).toBeVisible();
  await expect(page.locator('.location-hint')).toContainText('文字示例');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: '导出 JSON', exact: true}).click();
  const result = JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
  const difference = result.differences.find((d: any) => d.oldText === text && d.newText === text);
  expect(difference.hasTextChange).toBe(false);
  expect(difference.repeat).toEqual(reverse
    ? {left: 3, right: 2, leftPages: 3, rightPages: 2}
    : {left: 2, right: 3, leftPages: 2, rightPages: 3});
  expect(difference.occurrences).toHaveLength(3);
  // Switching back to a real addition/deletion resets the locator tone.
  await wording.click();
  await expect(page.locator(reverse ? 'polygon.highlight-old' : 'polygon.highlight-new').first()).toBeVisible();
  await expect(page.locator('polygon.highlight-location')).toHaveCount(0);
  await expect(page.locator('.location-hint')).toHaveCount(0);
});

test('two count cards locate their own text examples on the same PDF page', async ({page}) => {
  await load(page, 'R16_repagination');
  const notice = page.locator('.card').filter({has: page.locator('.same-text').filter({hasText: 'SYNTHETIC TEST - NOT A REAL POLICY'})});
  const header = page.locator('.card').filter({has: page.locator('.same-text').filter({hasText: 'USD 2,000,000'})});
  await expect(header).toHaveCount(1);
  const target = page.locator('.document').nth(1);
  await notice.locator('.same-text').click();
  await expect(target.locator('polygon.highlight-location').first()).toBeVisible();
  const noticePoint = await target.locator('polygon.highlight-location').first().getAttribute('points');
  await header.locator('.same-text').click();
  await expect(target.locator('polygon.highlight-location').first()).toBeVisible();
  await expect.poll(() => target.locator('polygon.highlight-location').first().getAttribute('points')).not.toBe(noticePoint);
  await expect(target.locator('[data-ready-page="0"]')).toBeVisible();
  await expect(page.locator('.document').nth(0).locator('polygon')).toHaveCount(0);
  await expect(header.locator('details')).not.toHaveAttribute('open');
  await expect(page.locator('.location-hint')).toContainText('不代表这里是新增或减少的位置');
});

test('changed repeated header remains a visible red-green comparison with accessible occurrences', async ({page}) => {
  await load(page, 'R09_header_limit');
  const card = page.locator('.card').filter({hasText: 'USD 4,000,000'});
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
