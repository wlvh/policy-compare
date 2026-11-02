import {test, expect, type Page} from '@playwright/test';
import path from 'node:path';

async function load(page: Page, left: string, right: string) {
  await page.goto('/');
  await page.getByLabel('基准 PDF', {exact: true}).setInputFiles(path.resolve(left));
  await page.getByLabel('待审 PDF', {exact: true}).setInputFiles(path.resolve(right));
  await page.getByRole('button', {name: '开始比较', exact: true}).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', /complete_for_scope|partial/);
  await expect(page.locator('[data-ready-page]')).toHaveCount(2);
}

const cases = 'validation/dataset/cases/';
for (const reverse of [false, true]) test((reverse ? 'removed' : 'added') + ' text navigates the missing side to reference context only when sync is enabled', async ({page}) => {
  // Author-fixed R29 inserts this complete clause on PDF page 1. Its reverse
  // removes it; common surrounding text still links page 1 in both documents.
  const dir = cases + 'R29_clause_add/';
  await load(page, dir + (reverse ? 'after.pdf' : 'before.pdf'), dir + (reverse ? 'before.pdf' : 'after.pdf'));
  const card = page.locator('.cards .card').filter({hasText: 'Losses arising from unapproved night operations are excluded.'});
  await expect(card).toHaveCount(1);
  await expect(card.locator(reverse ? '.new' : '.old')).toHaveText('（无）');
  const sourceSide = reverse ? 0 : 1, peerSide = 1 - sourceSide;
  const peerName = reverse ? '待审' : '基准';
  const peer = page.locator('.document').nth(peerSide);
  await page.getByRole('button', {name: peerName + '下一页', exact: true}).click();
  await expect(peer.locator('[data-ready-page="1"]')).toBeVisible();
  await card.click();
  await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);
  await expect(peer.locator('.reference-badge')).toHaveText('参考位置');
  await expect(peer.locator('polygon')).toHaveCount(0);
  await expect(page.locator('.document').nth(sourceSide).locator(reverse ? 'polygon.highlight-old' : 'polygon.highlight-new').first()).toBeVisible();
  await expect(page.locator('.location-hint')).toContainText('无直接来源');
  await expect(page.locator('.location-hint')).toContainText('已有文字对应');
  await page.getByRole('checkbox', {name: '同步滚动'}).uncheck();
  await page.getByRole('button', {name: peerName + '下一页', exact: true}).click();
  await expect(peer.locator('[data-ready-page="1"]')).toBeVisible();
  await card.click();
  await expect(peer.locator('[data-ready-page="1"]')).toBeVisible();
  await expect(page.locator('.document').nth(sourceSide).locator('[data-ready-page="0"]')).toBeVisible();
  await expect(page.locator('.location-hint')).toContainText('同步滚动已关闭');
});

test('different page counts do not force equal physical page numbers', async ({page}) => {
  const dir = cases + 'R16_repagination/';
  await load(page, dir + 'before.pdf', dir + 'after.pdf');
  const card = page.locator('.cards .card').filter({has: page.getByText('POLICY WORDING', {exact: true})});
  await card.click();
  // Authored layout: POLICY WORDING is new on after page 2; surrounding
  // wording moved there from before page 1. Page counts are 2 versus 3.
  await expect(page.locator('.document').nth(1).locator('[data-ready-page="1"]')).toBeVisible();
  await expect(page.locator('.document').nth(0).locator('[data-ready-page="0"]')).toBeVisible();
  await expect(page.locator('.document').nth(0).locator('polygon')).toHaveCount(0);
  await expect(page.locator('.document').nth(0).locator('.reference-badge')).toBeVisible();
});

test('an unextractable counterpart uses a labelled page reference, never a claimed text match', async ({page}) => {
  // Existing independent E03 has only a scanned image and no hidden text;
  // existing P13 is native text. No matching text anchors can exist.
  const root = 'validation/synthetic-review-20261030/cases/';
  await load(page, root + 'E03/before.pdf', root + 'P13/after.pdf');
  const card = page.locator('.cards .card').filter({hasText: 'Reference: Page 4 of 10.'});
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);
  await expect(page.locator('.location-hint')).toContainText('本页没有文字对应');
  await expect(page.locator('.location-hint')).toContainText('页码参考，不表示内容对应');
  await expect(page.locator('.document').nth(0).locator('polygon')).toHaveCount(0);
  await expect(page.locator('.document').nth(0).locator('.reference-badge')).toBeVisible();
  await expect(page.locator('.gaps')).toBeVisible();
});

test('a paired paragraph navigates both direct sources even when only one side has edited characters', async ({page}) => {
  const dir = cases + 'R31_punctuation/';
  await load(page, dir + 'before.pdf', dir + 'after.pdf');
  const card = page.locator('.cards .card').filter({hasText: 'Cover includes liability for fire, theft and flood.'});
  await expect(card).toHaveCount(1);
  await page.getByRole('button', {name: '待审下一页', exact: true}).click();
  await expect(page.locator('.document').nth(1).locator('[data-ready-page="1"]')).toBeVisible();
  await card.click();
  await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);
  await expect(page.locator('.document').nth(1).locator('polygon')).toHaveCount(0);
  await expect(page.locator('.reference-badge')).toHaveCount(0);
  // Navigation only: this does not regrade R31's registered Mac position issue.
});
