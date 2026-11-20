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
  assertFixtureLocations(result, await readFixtureSources(dir, truth));
});

async function appendInspections(source: string, target: string, status: 'Pending' | 'Filed') {
  const resolveEngine = createRequire(new URL('../../engines/mupdf/package.json', import.meta.url));
  const { PDFDocument, Font } = await import(pathToFileURL(resolveEngine.resolve('mupdf')).href);
  const document = new PDFDocument(await readFile(source));
  const font = new Font('Helvetica');
  try {
    const resources = { Font: { F1: document.addSimpleFont(font) } };
    for (let start = 0; start < 142; start += 25) {
      const lines = Array.from({length: Math.min(25, 142 - start)}, (_, row) =>
        `1 0 0 1 50 ${750 - row * 20} Tm (${status} annual inspection record ${start + row + 1}) Tj`);
      document.insertPage(-1, document.addPage([0, 0, 612, 792], 0, resources,
        ['BT /F1 9 Tf', ...lines, 'ET'].join('\n')));
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

if (!override) test('budget exhaustion in the appendix preserves authored changes in the original PDF pages', async ({ page }, info) => {
  test.skip(process.env.POLICY_ENGINE === 'pdfjs', 'This fixture is calibrated against MuPDF source rows.');
  const source = path.resolve('tests/fixtures/long-document/complex-30');
  const dir = info.outputPath('inspection-appendix');
  await mkdir(dir, {recursive: true});
  const truth: FixtureTruth = JSON.parse(await readFile(path.join(source, 'truth.json'), 'utf8'));
  for (const [name, status] of [['baseline.pdf', 'Pending'], ['revised.pdf', 'Filed']] as const) {
    truth.sha256[name] = await appendInspections(path.join(source, name), path.join(dir, name), status);
  }
  const result = await comparisonExport(page, dir);
  expect(result.status).toBe('partial');
  expect(result.stats.candidates).toBe(20_000);
  const budgets = result.unresolved.filter(u => u.reason === 'budget');
  expect(budgets).toHaveLength(1);
  const budget = budgets[0];
  expect(budget.left).toHaveLength(142);
  expect(budget.right).toHaveLength(142);
  expect([...budget.left, ...budget.right].every(loc => loc.pageIndex >= 30)).toBe(true);
  // The appendix work limit has been verified above. Score the original
  // answer key and resolve its references against the uploaded PDFs.
  assertFixtureResult({ ...result, unresolved: result.unresolved.filter(u => u !== budget) }, truth);
  assertFixtureLocations(result, await readFixtureSources(dir, truth));
});
