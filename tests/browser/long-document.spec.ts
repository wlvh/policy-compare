import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashBytes, ResultSchemaV2 } from '../../packages/contracts/index';
import { assertFixtureResult, type FixtureTruth } from '../long-document/assert-result';
import { assertFixtureLocations, readFixtureSources } from '../long-document/mupdf-sources';

const override = process.env.POLICY_LONG_DOCUMENT_FIXTURE;
const fixtures = override ? [override] : ['admission', 'complex-30'].map(name => path.join('tests/fixtures/long-document', name));

async function comparisonExport(page: Page, dir: string) {
  await page.goto('./');
  await page.getByLabel('Baseline PDF', { exact: true }).setInputFiles(path.join(dir, 'baseline.pdf'));
  await page.getByLabel('Revised PDF', { exact: true }).setInputFiles(path.join(dir, 'revised.pdf'));
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  const status = page.locator('[role="status"][data-status]');
  await expect(status).toHaveAttribute('data-status', /^(complete_for_scope|partial|failed)$/, { timeout: 185_000 });
  expect(await status.getAttribute('data-status'), await status.innerText()).not.toBe('failed');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const exported = await (await download).path();
  if (!exported) throw new Error('Comparison JSON download failed');
  return ResultSchemaV2.parse(JSON.parse(await readFile(exported, 'utf8')));
}

for (const fixture of fixtures) test(`the uploaded ${path.basename(fixture)} PDFs retain their changes and source locations in the export`, async ({ page }) => {
  test.skip(process.env.POLICY_ENGINE === 'pdfjs', 'This fixture is calibrated against MuPDF source rows.');
  test.setTimeout(210_000);
  const dir = path.resolve(fixture);
  const truth: FixtureTruth = JSON.parse(await readFile(path.join(dir, 'truth.json'), 'utf8'));
  const result = await comparisonExport(page, dir);
  assertFixtureResult(result, truth);
  if (!override && path.basename(fixture) === 'complex-30') {
    // The original b13e3fc key predates both optional C03 fields.
    const original = structuredClone(truth);
    const columns = original.cases.find(c => c.id === 'C03')!;
    delete columns.moved_cells;
    delete columns.column_notice_text;
    assertFixtureResult(result, original);
  }
  assertFixtureLocations(result, await readFixtureSources(dir, truth));
});

async function writeBudgetFixture(source: string, target: string, revised: boolean, aroundBody: boolean) {
  const resolveEngine = createRequire(new URL('../../engines/mupdf/package.json', import.meta.url));
  const { PDFDocument, Font } = await import(pathToFileURL(resolveEngine.resolve('mupdf')).href);
  const document = new PDFDocument(await readFile(source));
  const font = new Font('Helvetica');
  try {
    const resources = { Font: { F1: document.addSimpleFont(font) } };
    const addPage = (rows: string[], at: number) => {
      const lines = rows.map((text, row) => `1 0 0 1 50 ${750 - row * 20} Tm (${text}) Tj`);
      document.insertPage(at, document.addPage([0, 0, 612, 792], 0, resources,
        ['BT /F1 9 Tf', ...lines, 'ET'].join('\n')));
    };
    const status = revised ? 'Filed' : 'Pending';
    for (let start = 0; start < 142; start += 25) {
      const rows = Array.from({length: Math.min(25, 142 - start)}, (_, row) =>
        `${status} annual inspection record ${start + row + 1}`);
      addPage(rows, aroundBody ? start / 25 : -1);
    }
    if (aroundBody) {
      const permit = revised ? 'Final' : 'Provisional';
      addPage([1, 2].map(row => `${permit} berth license authorization ${row}`), -1);
    }
    const buffer = document.saveToBuffer();
    try {
      const bytes: Uint8Array = buffer.asUint8Array();
      await writeFile(target, bytes);
      return hashBytes(bytes);
    } finally {
      buffer.destroy();
    }
  } finally {
    font.destroy();
    document.destroy();
  }
}

if (!override) for (const aroundBody of [false, true]) test(
  aroundBody ? 'preserves authored changes between two unfinished registers'
    : 'budget exhaustion in the appendix preserves authored changes in the original PDF pages',
  async ({ page }, info) => {
  test.skip(process.env.POLICY_ENGINE === 'pdfjs', 'This fixture is calibrated against MuPDF source rows.');
  const source = path.resolve('tests/fixtures/long-document/complex-30');
  const dir = info.outputPath('budget-fixture');
  await mkdir(dir, {recursive: true});
  const truth: FixtureTruth = JSON.parse(await readFile(path.join(source, 'truth.json'), 'utf8'));
  for (const name of ['baseline.pdf', 'revised.pdf']) {
    truth.sha256[name] = await writeBudgetFixture(path.join(source, name), path.join(dir, name), name === 'revised.pdf', aroundBody);
  }
  const firstBodyPage = aroundBody ? 6 : 0;
  for (const check of truth.cases) {
    if (check.baseline) check.baseline.page += firstBodyPage;
    if (check.revised) check.revised.page += firstBodyPage;
  }
  const result = await comparisonExport(page, dir);
  expect(result.status).toBe('partial');
  expect(result.stats.candidates).toBe(20_000);
  const budgets = result.unresolved.filter(u => u.reason === 'budget');
  expect(budgets).toHaveLength(1);
  const budget = budgets[0];
  expect(budget.left).toHaveLength(aroundBody ? 144 : 142);
  expect(budget.right).toHaveLength(aroundBody ? 144 : 142);
  expect([...budget.left, ...budget.right].every(loc =>
    loc.pageIndex < firstBodyPage || loc.pageIndex >= firstBodyPage + 30)).toBe(true);
  // The register work limits have been verified above. Score the original
  // answer key and resolve its references against the uploaded PDFs.
  assertFixtureResult({ ...result, unresolved: result.unresolved.filter(u => u !== budget) }, truth);
  assertFixtureLocations(result, await readFixtureSources(dir, truth));
});
