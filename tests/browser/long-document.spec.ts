import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ResultSchemaV2 } from '../../packages/contracts/index';
import { assertFixtureResult, type FixtureTruth } from '../long-document/assert-result';
import { assertFixtureLocations, readFixtureSources } from '../long-document/mupdf-sources';

const override = process.env.POLICY_LONG_DOCUMENT_FIXTURE;
const fixtures = override ? [override] : ['admission', 'complex-30'].map(name => path.join('tests/fixtures/long-document', name));

for (const fixture of fixtures) test(`the uploaded ${path.basename(fixture)} PDFs retain their changes and source locations in the export`, async ({ page }) => {
  test.skip(process.env.POLICY_ENGINE === 'pdfjs', 'This fixture is calibrated against MuPDF source rows.');
  test.setTimeout(210_000);
  const dir = path.resolve(fixture);
  const truth: FixtureTruth = JSON.parse(await readFile(path.join(dir, 'truth.json'), 'utf8'));

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
  const result = ResultSchemaV2.parse(JSON.parse(await readFile(exported, 'utf8')));
  assertFixtureResult(result, truth);
  assertFixtureLocations(result, await readFixtureSources(dir, truth));
});
