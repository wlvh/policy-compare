import { test, expect } from '@playwright/test';

test('PDF and Rust downloads can each exceed the former 15 second deadline', async ({ page }) => {
  test.setTimeout(100_000);
  await page.route('**/assets/{pdf.worker-*,core-*.wasm}', async route => {
    await new Promise(resolve => setTimeout(resolve, 20_000));
    await route.continue();
  });
  await page.goto('./');
  await expect(page.getByText('Downloading and initializing the PDF engine. The first visit may take up to 60 seconds…')).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready', 'true', { timeout: 55_000 });
  await page.getByRole('button', { name: 'P02 Amount change', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Downloading and initializing the comparison engine');
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'complete_for_scope', { timeout: 55_000 });
  await expect(page.locator('.cards')).toContainText('USD 2000');
});

test('a stalled PDF startup ends and retry recovers', async ({ page }) => {
  await page.clock.install();
  let releaseDownload!: () => void;
  const held = new Promise<void>(resolve => { releaseDownload = resolve; });
  await page.route('**/assets/pdf.worker-*', () => held);
  await page.goto('./');
  await expect(page.locator('main')).toBeAttached();
  await page.clock.fastForward(60_001);
  await expect(page.getByRole('alert')).toContainText('exceeded 60 seconds');
  await expect.poll(() => page.workers().length).toBe(0);
  releaseDownload();
  await page.unroute('**/assets/pdf.worker-*');
  await page.getByRole('button', { name: 'Retry startup', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'P02 Amount change', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'complete_for_scope');
});

test('a stalled Rust startup ends and a new comparison recovers', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready', 'true');
  await page.clock.install();
  let releaseDownload!: () => void;
  const held = new Promise<void>(resolve => { releaseDownload = resolve; });
  await page.route('**/assets/core-*.wasm', () => held);
  await page.getByRole('button', { name: 'P02 Amount change', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Downloading and initializing the comparison engine');
  await page.clock.fastForward(60_001);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'failed');
  await expect(page.getByRole('status')).toContainText('exceeded 60 seconds');
  await expect.poll(() => page.workers().length).toBe(0);
  releaseDownload();
  await page.unroute('**/assets/core-*.wasm');
  await page.getByRole('button', { name: 'P02 Amount change', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'complete_for_scope');
});

test('cancelling a warming PDF worker releases it and permits another task', async ({ page }) => {
  let releaseDownload!: () => void;
  const held = new Promise<void>(resolve => { releaseDownload = resolve; });
  await page.route('**/assets/pdf.worker-*', () => held);
  await page.goto('./');
  await page.getByLabel('Baseline PDF', { exact: true }).setInputFiles('apps/web/public/samples/P02/before.pdf');
  await page.getByLabel('Revised PDF', { exact: true }).setInputFiles('apps/web/public/samples/P02/after.pdf');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'running');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'cancelled');
  await expect.poll(() => page.workers().length).toBe(0);
  releaseDownload();
  await page.unroute('**/assets/pdf.worker-*');
  await page.getByRole('button', { name: 'P02 Amount change', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'complete_for_scope');
});

test('document processing still terminates after its own 120 second deadline', async ({ page }) => {
  await page.route('**/assets/core.worker-*.js', async route => route.fulfill({
    response: await route.fetch(),
    body: `onmessage = ({data}) => {
      if (data.type === 'init') postMessage({type: 'core-ready', taskId: data.taskId, generation: data.generation});
    };`,
  }));
  await page.goto('./');
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready', 'true');
  await page.clock.install();
  await page.getByRole('button', { name: 'P02 Amount change', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Text extraction complete');
  await page.clock.fastForward(120_001);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'failed');
  await expect(page.getByRole('status')).toContainText('Computation exceeded the 120-second limit');
  await expect.poll(() => page.workers().length).toBe(0);
});
