import { test, expect } from '@playwright/test';

test('PDF and Rust downloads can each exceed the former 15 second deadline', async ({ page }) => {
  test.setTimeout(100_000);
  await page.route('**/assets/{pdf.worker-*,core-*.wasm}', async route => {
    await new Promise(resolve => setTimeout(resolve, 20_000));
    await route.continue();
  });
  await page.goto('./');
  await expect(page.getByText('正在下载并初始化 PDF 引擎，首次打开可能需要等待，最长 60 秒…')).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready', 'true', { timeout: 55_000 });
  await page.getByRole('button', { name: 'P02 金额变化', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('正在下载并初始化比较引擎');
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
  await expect(page.getByRole('alert')).toContainText('超过 60 秒');
  await expect.poll(() => page.workers().length).toBe(0);
  releaseDownload();
  await page.unroute('**/assets/pdf.worker-*');
  await page.getByRole('button', { name: '重试启动', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready', 'true', { timeout: 20_000 });
  await page.getByRole('button', { name: 'P02 金额变化', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'complete_for_scope');
});

test('a stalled Rust startup ends and a new comparison recovers', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready', 'true');
  await page.clock.install();
  let releaseDownload!: () => void;
  const held = new Promise<void>(resolve => { releaseDownload = resolve; });
  await page.route('**/assets/core-*.wasm', () => held);
  await page.getByRole('button', { name: 'P02 金额变化', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('正在下载并初始化比较引擎');
  await page.clock.fastForward(60_001);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'failed');
  await expect(page.getByRole('status')).toContainText('超过 60 秒');
  await expect.poll(() => page.workers().length).toBe(0);
  releaseDownload();
  await page.unroute('**/assets/core-*.wasm');
  await page.getByRole('button', { name: 'P02 金额变化', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'complete_for_scope');
});

test('cancelling a warming PDF worker releases it and permits another task', async ({ page }) => {
  let releaseDownload!: () => void;
  const held = new Promise<void>(resolve => { releaseDownload = resolve; });
  await page.route('**/assets/pdf.worker-*', () => held);
  await page.goto('./');
  await page.getByLabel('基准 PDF', { exact: true }).setInputFiles('apps/web/public/samples/P02/before.pdf');
  await page.getByLabel('待审 PDF', { exact: true }).setInputFiles('apps/web/public/samples/P02/after.pdf');
  await page.getByRole('button', { name: '开始比较', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'running');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'cancelled');
  await expect.poll(() => page.workers().length).toBe(0);
  releaseDownload();
  await page.unroute('**/assets/pdf.worker-*');
  await page.getByRole('button', { name: 'P02 金额变化', exact: true }).click();
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
  await page.getByRole('button', { name: 'P02 金额变化', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('文字提取完成');
  await page.clock.fastForward(120_001);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', 'failed');
  await expect(page.getByRole('status')).toContainText('计算超过 120 秒');
  await expect.poll(() => page.workers().length).toBe(0);
});
