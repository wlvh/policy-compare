import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertFixtureResult } from '../long-document/assert-result';

test('the uploaded long PDFs retain their changes and source locations in the export', async ({ page }) => {
  test.skip(process.env.POLICY_ENGINE === 'pdfjs', 'This fixture is calibrated against MuPDF source rows.');
  test.setTimeout(210_000);
  const dir = path.resolve(process.env.POLICY_LONG_DOCUMENT_FIXTURE ?? 'tests/fixtures/long-document/complex-30');
  const truth = JSON.parse(await readFile(path.join(dir, 'truth.json'), 'utf8'));

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
  assertFixtureResult(JSON.parse(await readFile(exported, 'utf8')), truth);
});
