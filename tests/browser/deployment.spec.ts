import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function expectComparison(page: Page, expected: string | RegExp) {
  const status = page.locator('[data-status]');
  await expect(status).toHaveAttribute('data-status', /complete_for_scope|partial|failed/, { timeout: 185_000 });
  await expect(status).toHaveAttribute('data-status', expected);
}

test('three allowlisted samples, source highlight, search, export and private diagnostic',async({page,baseURL})=>{
  test.setTimeout(630_000);
  const outgoing:string[]=[];
  const origin = new URL(baseURL!).origin;
  await page.context().route('**/*',route=>{
    const request = route.request(), url = request.url();
    if (!url.startsWith('blob:') && (new URL(url).origin !== origin || !['GET','HEAD'].includes(request.method()))) {outgoing.push(url); return route.abort();}
    return route.continue();
  });
  await page.goto('./');
  expect(await page.evaluate(()=>crossOriginIsolated)).toBe(true);
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready','true',{timeout:65_000});
  await page.getByRole('button',{name:'P02 金额变化',exact:true}).click();
  await expectComparison(page, /complete_for_scope|partial/);
  await expect(page.locator('.cards')).toContainText('USD 2000');
  await page.locator('.card').filter({hasText:'2000'}).first().click();
  await expect(page.locator('polygon').first()).toBeVisible();
  await page.getByLabel('搜索原文').fill('1315');
  await page.getByRole('button',{name:'搜索',exact:true}).click();
  await expect(page.locator('.hits button').first()).toBeVisible();
  const exported = page.waitForEvent('download');
  await page.getByRole('button',{name:'导出 JSON',exact:true}).click();
  const result = JSON.parse(readFileSync((await(await exported).path())!,'utf8'));
  expect(result.differences.some((d:any)=>d.oldText.includes('USD 100') && d.newText.includes('USD 2000'))).toBe(true);
  await page.getByText('使用说明与版本信息',{exact:true}).click();
  const diagnostic = page.waitForEvent('download');
  await page.getByRole('button',{name:'下载诊断',exact:true}).click();
  const info = JSON.parse(readFileSync((await(await diagnostic).path())!,'utf8'));
  expect(Object.keys(info).sort()).toEqual(['browser','engine','engineVersion','errorCode','phase','releaseId']);
  expect(JSON.stringify(info)).not.toMatch(/1315|USD|before\.pdf|after\.pdf/);
  await page.getByRole('button',{name:'P01 相同文件',exact:true}).click();
  await expectComparison(page, 'complete_for_scope');
  await expect(page.locator('.card')).toHaveCount(0);
  await page.getByRole('button',{name:'E03 扫描图片',exact:true}).click();
  await expectComparison(page, 'partial');
  await expect(page.locator('.gaps')).toContainText('只有图片');
  await page.getByRole('button',{name:'关闭任务',exact:true}).click();
  await expect.poll(()=>page.workers().length).toBe(0);
  await expect(page.getByLabel('基准 PDF',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('搜索原文')).toHaveValue('');
  expect(outgoing).toEqual([]);
});

test('missing isolation is actionable and comparison cannot start',async({page})=>{
  await page.route('**/*',async route=>{
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const headers = response.headers();
    delete headers['cross-origin-opener-policy']; delete headers['cross-origin-embedder-policy'];
    await route.fulfill({response,headers});
  });
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('网站安全配置不完整');
  await expect(page.getByRole('button',{name:'重试启动',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'P02 金额变化',exact:true})).toBeDisabled();
});

test('engine bundle download failure leaves a reload screen',async({page})=>{
  test.setTimeout(90_000);
  await page.route('**/assets/main-*.js',route=>route.abort());
  await page.goto('./');
  await expect(page.getByText('程序资源加载失败。',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'重新加载',exact:true})).toBeVisible();
  await page.unroute('**/assets/main-*.js');
  await page.getByRole('button',{name:'重新加载',exact:true}).click();
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready','true',{timeout:65_000});
});

test('failed engine worker initialization can be retried',async({page})=>{
  test.setTimeout(140_000);
  await page.route('**/assets/pdf.worker-*',route=>route.abort());
  await page.goto('./');
  await expect(page.getByRole('alert')).toBeVisible({timeout:65_000});
  await page.unroute('**/assets/pdf.worker-*');
  await page.getByRole('button',{name:'重试启动',exact:true}).click();
  await expect(page.locator('main')).toHaveAttribute('data-engine-ready','true',{timeout:65_000});
  await expect(page.getByRole('alert')).toHaveCount(0);
});
