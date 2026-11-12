import {test, expect, type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

// Controlled presentation input, not a claim about these PDFs' extraction.
// Keep the real workers, PDF rendering and comparison; replace only the review
// records delivered to the UI so the volume and each expected area are fixed.
const notices = (['left', 'right'] as const).flatMap(side => [0, 1].flatMap(pageIndex =>
  Array.from({length: 12}, (_, i) => ({
    side, pageIndex, region: [40, 100 + i * 45, 260, 116 + i * 45],
    reason: 'unsupported_structure',
    layoutHint: i % 2 ? 'varying_cell_boundaries' : 'repeated_tabular_text',
    evidence: `${side} page ${pageIndex + 1}, source area ${i + 1}`,
    message: i % 2 ? 'Nearby lines have different cell counts; cell structure is unverified.' :
      'Tabular text also occurs on another page; a cross-page relationship is unverified.',
    defaultVisible: true,
  })),
));

async function load(page: Page, incomplete = false) {
  await page.addInitScript(({notices, incomplete}) => {
    const Native = window.Worker;
    window.Worker = class extends Native {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (!String(url).includes('core.worker')) return;
        this.addEventListener('message', event => {
          if (event.data.type !== 'result') return;
          const result = event.data.result;
          result.coverage = structuredClone(notices);
          result.unresolved = [];
          if (incomplete) {
            result.coverage.push({side:'left',pageIndex:1,region:[0,0,600,800],reason:'page_failed',
              evidence:'Controlled page failure',message:'Page could not be read.',defaultVisible:true});
            // An unrecognized structure limitation must not be downgraded to a
            // known layout observation just because it shares a broad reason.
            result.coverage.push({side:'right',pageIndex:0,region:[0,0,600,800],reason:'unsupported_structure',
              evidence:'Other structure limitation',message:'Other structure limitation.',defaultVisible:true});
            const d = result.differences.find((d: any) => d.hasTextChange);
            const sources = structuredClone({left:d.left,right:d.right});
            result.unresolved.push({reason:'ambiguous_match',message:'Two source correspondences remain possible.',
              ...sources,defaultVisible:true});
            result.unresolved.push({reason:'budget',message:'Comparison stopped at the work limit.',
              ...structuredClone(sources),defaultVisible:true});
          }
          result.status = 'partial';
          (window as any).__reviewFixture = structuredClone(result);
        });
      }
    };
  }, {notices, incomplete});
  await page.goto('./');
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready', 'true');
  await page.getByLabel('Baseline PDF', {exact:true}).setInputFiles(path.resolve('validation/dataset/cases/R09_header_limit/before.pdf'));
  await page.getByLabel('Revised PDF', {exact:true}).setInputFiles(path.resolve('validation/dataset/cases/R09_header_limit/after.pdf'));
  await page.getByRole('button', {name:'Compare',exact:true}).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'partial');
  for (const side of [0,1]) await expect(page.locator('.document').nth(side).locator('[data-ready-page="0"] img')).toBeVisible();
}

async function exported(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name:'Export JSON',exact:true}).click();
  return JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
}

test('dozens of layout notices leave the changes and source workspace visible by default', async ({page}) => {
  await load(page);
  await page.screenshot({path:test.info().outputPath('notices-default.png'),fullPage:true});
  const panel = page.locator('.structure-notices');
  await expect(panel.locator('summary')).toContainText('48');
  await expect(panel).not.toHaveAttribute('open');
  await expect(panel.locator('.notice-location').first()).not.toBeVisible();
  await expect(page.locator('rect[data-coverage="true"]')).toHaveCount(0);
  await expect(page.locator('.cards .card').first()).toBeInViewport();
  await expect(page.locator('.document-head').first()).toBeInViewport();
  expect((await page.locator('.gaps').boundingBox())!.height).toBeLessThan(140);
  await expect(page.getByRole('status')).not.toContainText('48 coverage gaps');
  const result = await exported(page);
  expect(result.status).toBe('partial');
  expect(result.coverage).toEqual(notices);
});

test('expanded groups keep every side, page and area, navigate to the actual region, and preserve exports', async ({page}) => {
  await load(page);
  const panel = page.locator('.structure-notices');
  await panel.locator('summary').click();
  await expect(panel.locator('.notice-group')).toHaveCount(2);
  await expect(panel.locator('.notice-location')).toHaveCount(48);
  for (const side of ['left','right']) for (const pageIndex of [0,1]) {
    await expect(panel.locator(`.notice-location[data-side="${side}"][data-page="${pageIndex}"]`)).toHaveCount(12);
  }
  const target = notices.at(-1)!;
  await panel.locator('.notice-location[data-notice-index="47"]').click();
  const marker = page.locator('.document').nth(1).locator('rect[data-review-focus="true"]');
  await expect(marker).toBeVisible();
  expect(await marker.evaluate(el => [Number(el.getAttribute('x')),Number(el.getAttribute('y')),
    Number(el.getAttribute('width')),Number(el.getAttribute('height'))])).toEqual([40,595,220,16]);
  await expect(page.locator('.document').nth(1).locator('[data-review-focus-label]')).toBeInViewport();
  await expect(page.locator('.location-hint')).toContainText('Revised PDF page 2');
  await page.screenshot({path:test.info().outputPath('notices-region.png'),fullPage:true});
  const result = await exported(page);
  expect(result.coverage).toEqual(notices);
  expect(result.coverage[47].region).toEqual(target.region);
  expect(result.status).toBe('partial');
  await page.setViewportSize({width:650,height:700});
  await panel.locator('.notice-location[data-notice-index="47"]').click();
  await expect(page.locator('.document').nth(1).locator('[data-review-focus-label]')).toBeInViewport();
  await page.locator('.cards .card').first().click();
  await expect(page.locator('rect[data-review-focus="true"]')).toHaveCount(0);
});

test('page failure and unfinished comparison stay prominent among layout notices, with ambiguity beside its change', async ({page}) => {
  await load(page, true);
  const coverage = page.getByRole('region', {name:'Comparison coverage',exact:true});
  await expect(coverage).toBeVisible();
  await expect(coverage.getByText('Page could not be read', {exact:true})).toBeVisible();
  await expect(coverage.getByRole('button', {name:'Baseline · Page 2',exact:true})).toBeVisible();
  await expect(coverage.getByText('Comparison unfinished', {exact:true})).toBeVisible();
  await expect(coverage.getByText('Structure coverage unconfirmed', {exact:true})).toBeVisible();
  await expect(page.locator('.structure-notices')).not.toHaveAttribute('open');
  await expect(page.locator('.cards .card .match-notice').first()).toBeVisible();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'partial');
  await page.screenshot({path:test.info().outputPath('notices-with-page-failure.png'),fullPage:true});
  const result = await exported(page);
  const original = await page.evaluate(() => (window as any).__reviewFixture);
  expect(result.coverage).toEqual(original.coverage);
  expect(result.unresolved).toEqual(original.unresolved);
  expect(result.status).toBe('partial');
});
