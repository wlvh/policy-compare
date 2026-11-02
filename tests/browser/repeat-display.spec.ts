import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

async function load(page: Page, caseId: string) {
  await page.goto('/');
  for (const [label, name] of [['基准 PDF', 'before'], ['待审 PDF', 'after']])
    await page.getByLabel(label, {exact: true}).setInputFiles(path.resolve('validation/dataset/cases', caseId, name + '.pdf'));
  await page.getByRole('button', {name: '开始比较', exact: true}).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', /complete_for_scope|partial/);
}

test('unchanged repeated text keeps counts and source navigation without deletion colors', async ({page}) => {
  // Existing author-defined case: this notice occurs on 2 old pages and 3 new
  // pages. Do not infer that page count explains any other repeated content.
  await load(page, 'R16_repagination');
  const text = 'SYNTHETIC TEST - NOT A REAL POLICY';
  const card = page.locator('.card').filter({has: page.locator('.same-text').filter({hasText: text})});
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('文字未变，次数变化');
  await expect(card).toContainText('2 次 → 3 次');
  await expect(card.locator('.old, .new')).toHaveCount(0);
  await expect(card.getByRole('button', {name: '出现位置 2', exact: true})).not.toBeVisible();
  await expect(page.locator('[data-ready-page]')).toHaveCount(2);
  const pagesBefore = await page.locator('[data-ready-page]').evaluateAll(es => es.map(e => e.getAttribute('data-ready-page')));
  await card.locator('summary').click();
  expect(await page.locator('[data-ready-page]').evaluateAll(es => es.map(e => e.getAttribute('data-ready-page')))).toEqual(pagesBefore);
  await card.getByRole('button', {name: '出现位置 2', exact: true}).click();
  await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);
  for (const side of [0, 1])
    await expect(page.locator('.document').nth(side).locator('polygon.highlight-location').first()).toBeVisible();
  await expect(page.locator('polygon.highlight-old, polygon.highlight-new')).toHaveCount(0);
  await card.getByRole('button', {name: '出现位置 3', exact: true}).click();
  await expect(page.locator('.document').nth(1).locator('[data-ready-page="2"]')).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: '导出 JSON', exact: true}).click();
  const result = JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
  const difference = result.differences.find((d: any) => d.oldText === text && d.newText === text);
  expect(difference.hasTextChange).toBe(false);
  expect(difference.repeat).toEqual({left: 2, right: 3, leftPages: 2, rightPages: 3});
  expect(difference.occurrences).toHaveLength(3);
  // Switching to a real addition in the same task must reset the locator tone.
  await page.locator('.card').filter({has: page.getByText('POLICY WORDING', {exact: true})}).click();
  await expect(page.locator('polygon.highlight-new').first()).toBeVisible();
  await expect(page.locator('polygon.highlight-location')).toHaveCount(0);
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
