import {test, expect, type Page, type Locator} from '@playwright/test';
import path from 'node:path';

async function load(page: Page, caseId: string) {
  await page.goto('./');
  for (const [label, name] of [['Baseline PDF', 'before'], ['Revised PDF', 'after']])
    await page.getByLabel(label, {exact: true}).setInputFiles(path.resolve('validation/dataset/cases', caseId, name + '.pdf'));
  await page.getByRole('button', {name: 'Compare', exact: true}).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', /complete_for_scope|partial/);
  await expect(page.locator('[data-ready-page]')).toHaveCount(2);
  // The first selected item is now a real content change, which may be on a
  // later page. Scroll tests explicitly start at page one on both sides.
  for (const side of ['Baseline', 'Revised']) {
    const previous = page.getByRole('button', {name: side + ' previous page', exact: true});
    while (await previous.isEnabled()) await previous.click();
  }
  await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);
}

async function wheelTo(page: Page, pane: Locator, pageIndex: number, inset = 20) {
  const delta = await pane.evaluate((el, {pageIndex, inset}) =>
    (el.querySelector(`[data-page-index="${pageIndex}"]`) as HTMLElement).offsetTop + inset - el.scrollTop,
  {pageIndex, inset});
  await pane.hover();
  await page.mouse.wheel(0, delta);
}

test('wheel crosses page boundaries in either direction, panes remain independent when sync is off', async ({page}) => {
  await load(page, 'R16_repagination'); // author-defined 2 old pages, 3 new pages
  const activeWorkers = process.env.POLICY_ENGINE === 'pdfjs' ? 3 : 2;
  await expect.poll(() => page.workers().length).toBe(activeWorkers);
  expect(await page.evaluate(() => window.__policyMetrics.activeWorkers)).toBe(activeWorkers);
  await page.getByRole('checkbox', {name: 'Synchronized scrolling'}).uncheck();
  const left = page.getByRole('region', {name: 'Baseline source document'});
  const right = page.getByRole('region', {name: 'Revised source document'});
  await expect(right.locator('[data-page-index]')).toHaveCount(3);
  await expect(right.locator('[data-page-index="1"] img')).toHaveCount(1);
  await wheelTo(page, right, 1, -90);
  // At the boundary, the end of one real page and start of the next coexist.
  await expect.poll(() => right.evaluate(el => [0, 1].every(p => {
    const r = el.querySelector(`[data-page-index="${p}"] img`)!.getBoundingClientRect();
    const viewport = el.getBoundingClientRect();
    return r.top < viewport.bottom && r.bottom > viewport.top;
  }))).toBe(true);
  await wheelTo(page, right, 1);
  await expect(right.locator('[data-ready-page="1"]')).toBeVisible();
  await expect(left.locator('[data-ready-page="0"]')).toBeVisible();
  await wheelTo(page, right, 2);
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  await expect(right.locator('[data-page-index="0"] img')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Revised next page', exact: true})).toBeDisabled();
  await right.hover();
  await page.mouse.wheel(0, 10000);
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  if (process.env.POLICY_ENGINE === 'pdfjs') {
    // Simulate Chromium deferring the main-thread PNG callback after page 1
    // has been evicted. The return scroll must still display the page.
    await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = () => undefined; });
  }
  await wheelTo(page, right, 0, 0);
  await expect(right.locator('[data-ready-page="0"]')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Revised previous page', exact: true})).toBeDisabled();
  await page.mouse.wheel(0, -10000);
  await expect(right.locator('[data-ready-page="0"]')).toBeVisible();
  // A source jump still selects the requested PDF page after scrolling.
  const quantities = page.getByRole('region', {name: 'Repeated text counts'});
  const repeated = quantities.locator('.repeat-count-item').filter({hasText: 'SYNTHETIC TEST - NOT A REAL POLICY'});
  await repeated.locator('.occurrence-details > summary').click();
  await repeated.getByRole('button', {name: 'Revised source 3', exact: true}).click();
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  await expect(right.locator('polygon.highlight-location').first()).toBeVisible();
  expect(await right.locator('.sheet').count()).toBeLessThanOrEqual(3);
  await wheelTo(page, left, 1);
  await expect(left.locator('[data-ready-page="1"]')).toBeVisible();
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
});

test('PDF.js displays source pages when the PNG worker cannot load', async ({page}) => {
  test.skip(process.env.POLICY_ENGINE !== 'pdfjs', 'PDF.js uses a separate PNG encoder.');
  let blocked = false;
  await page.route('**/assets/png.worker-*.js', async route => {
    blocked = true;
    await route.abort('failed');
  });
  await page.addInitScript(() => { HTMLCanvasElement.prototype.toBlob = () => undefined; });
  await load(page, 'R16_repagination');
  expect(blocked).toBe(true);
  await expect.poll(() => page.workers().length).toBe(2);
  expect(await page.evaluate(() => window.__policyMetrics.activeWorkers)).toBe(2);
  await page.getByRole('button', {name: 'Close task', exact: true}).click();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(await page.evaluate(() => window.__policyMetrics.activeWorkers)).toBe(0);
});

test('PDF.js restores both source panes while the PNG worker script is stalled', async ({page}) => {
  test.skip(process.env.POLICY_ENGINE !== 'pdfjs', 'PDF.js uses a separate PNG encoder.');
  let requested = false;
  let releaseScript!: () => void;
  const scriptGate = new Promise<void>(resolve => { releaseScript = resolve; });
  await page.route('**/assets/png.worker-*.js', async route => {
    requested = true;
    await scriptGate;
    await route.continue().catch(() => {}); // The worker may already have terminated.
  });
  try {
    await load(page, 'R16_repagination');
    expect(requested).toBe(true);
    await expect.poll(() => page.workers().length).toBe(2);
    expect(await page.evaluate(() => window.__policyMetrics.activeWorkers)).toBe(2);
  } finally {
    releaseScript();
  }
  await page.getByRole('button', {name: 'Baseline next page', exact: true}).click();
  const baseline = page.getByRole('region', {name: 'Baseline source document'});
  await expect(baseline.locator('[data-ready-page="1"]')).toBeVisible();
  await page.getByRole('button', {name: 'Close task', exact: true}).click();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(await page.evaluate(() => window.__policyMetrics.activeWorkers)).toBe(0);
});

test('PDF.js restores the source pane when the PNG worker cannot receive a render request', async ({page}) => {
  test.skip(process.env.POLICY_ENGINE !== 'pdfjs', 'PDF.js uses a separate PNG encoder.');
  await page.route('**/assets/png.worker-*.js', async route => {
    const response = await route.fetch();
    // Substitute the event the worker sees when it cannot deserialize a request.
    const receiveError = `addEventListener("message", event => {
      event.stopImmediatePropagation();
      event.data.bitmap.close();
      dispatchEvent(new MessageEvent("messageerror"));
    }, { capture: true, once: true });`;
    await route.fulfill({response, body: receiveError + '\n' + await response.text()});
  });
  await load(page, 'R16_repagination');
  await expect.poll(() => page.workers().length).toBe(2);
  expect(await page.evaluate(() => window.__policyMetrics.activeWorkers)).toBe(2);
  await page.getByRole('button', {name: 'Baseline next page', exact: true}).click();
  const baseline = page.getByRole('region', {name: 'Baseline source document'});
  await expect(baseline.locator('[data-ready-page="1"]')).toBeVisible();
});

test('synchronized wheel scrolling follows existing text alignment across pages; buttons still work', async ({page}) => {
  await load(page, 'R09_header_limit');
  const left = page.getByRole('region', {name: 'Baseline source document'});
  const right = page.getByRole('region', {name: 'Revised source document'});
  await wheelTo(page, left, 1, 80);
  await expect(left.locator('[data-ready-page="1"]')).toBeVisible();
  await expect(right.locator('[data-ready-page="1"]')).toBeVisible();
  await page.getByRole('button', {name: 'Baseline previous page', exact: true}).click();
  await expect(left.locator('[data-ready-page="0"]')).toBeVisible();
  await page.getByRole('button', {name: 'Baseline next page', exact: true}).click();
  await expect(left.locator('[data-ready-page="1"]')).toBeVisible();
  // Resizing preserves the active PDF page and its source highlight.
  await page.getByRole('button', {name: 'Source location 2', exact: true}).click();
  await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);
  await page.setViewportSize({width: 1250, height: 900});
  await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);
  await expect(left.locator('polygon.highlight-old').first()).toBeVisible();
  await expect(right.locator('polygon.highlight-new').first()).toBeVisible();
});

test('a page shorter than the viewport still reaches the final page; rapid scrolling keeps the latest view', async ({page}) => {
  await page.setViewportSize({width: 1120, height: 1000});
  await load(page, 'R16_repagination');
  await page.getByRole('checkbox', {name: 'Synchronized scrolling'}).uncheck();
  const right = page.getByRole('region', {name: 'Revised source document'});
  expect(await right.evaluate(el => el.querySelector('[data-page-index="2"]')!.getBoundingClientRect().height < el.clientHeight)).toBe(true);
  await right.hover();
  await page.mouse.wheel(0, 10000);
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Revised next page', exact: true})).toBeDisabled();
  await page.mouse.wheel(0, -10000);
  await page.mouse.wheel(0, 10000);
  await page.mouse.wheel(0, -10000);
  await expect(right.locator('[data-ready-page="0"]')).toBeVisible();
  expect(await right.locator('.sheet').count()).toBeLessThanOrEqual(3);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status', /complete_for_scope|partial/);
});

test('every on-screen page renders when the complete document fits without scrolling', async ({page}) => {
  await page.setViewportSize({width: 1120, height: 2400});
  await load(page, 'R16_repagination');
  const right = page.getByRole('region', {name: 'Revised source document'});
  expect(await right.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  await expect(right.locator('.sheet img')).toHaveCount(3);
  await expect(right.locator('.page-placeholder')).toHaveCount(0);
  await expect.poll(() => right.locator('img').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
  // Navigation must not evict another source page that is still on screen.
  await page.getByRole('button', {name: 'Revised next page', exact: true}).click();
  await page.getByRole('button', {name: 'Revised next page', exact: true}).click();
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  await expect(right.locator('.sheet img')).toHaveCount(3);
});

test('height-only resizing loads newly visible pages and retains visible predecessors at the bottom', async ({page}) => {
  await page.setViewportSize({width: 1120, height: 800});
  await load(page, 'R16_repagination');
  await page.getByRole('checkbox', {name: 'Synchronized scrolling'}).uncheck();
  const right = page.getByRole('region', {name: 'Revised source document'});
  await page.setViewportSize({width: 1120, height: 2400});
  expect(await right.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  await expect(right.locator('.sheet img')).toHaveCount(3);
  await page.setViewportSize({width: 1120, height: 1450});
  await right.hover();
  await page.mouse.wheel(0, 10000);
  await expect(right.locator('[data-ready-page="2"]')).toBeVisible();
  const visible = await right.evaluate(el => Array.from(el.querySelectorAll<HTMLElement>('[data-page-index]'))
    .filter(slot => slot.offsetTop < el.scrollTop + el.clientHeight && slot.offsetTop + slot.offsetHeight > el.scrollTop)
    .map(slot => Number(slot.dataset.pageIndex)));
  expect(visible).toContain(0);
  for (const p of visible) await expect(right.locator(`[data-page-index="${p}"] img`)).toHaveCount(1);
});

// Failure-only diagnostics: rendered DOM plus the viewport's live scheduling
// refs. These are investigation evidence, never an acceptance oracle.
test.afterEach(async({page},info)=>{
  if(info.status===info.expectedStatus)return;
  const state=await page.getByRole('region',{name:'Revised source document'}).evaluate(el=>{
    const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));
    let fiber=key?(el as any)[key]:null;
    while(fiber&&typeof fiber.type?.render!=='function')fiber=fiber.return;
    const hooks:any[]=[];for(let h=fiber?.memoizedState;h;h=h.next)hooks.push(h.memoizedState);
    const ref=(i:number)=>hooks[i]?.current;
    return {scrollTop:el.scrollTop,height:el.clientHeight,scrollHeight:el.scrollHeight,active:ref(2),cachePages:ref(4)instanceof Map?[...ref(4).keys()]:null,inFlight:ref(6),renderWindow:ref(7),mounted:ref(10),programmaticTop:ref(11),slots:[...el.querySelectorAll<HTMLElement>('[data-page-index]')].map(slot=>({page:slot.dataset.pageIndex,top:slot.offsetTop,height:slot.offsetHeight,ready:slot.querySelector('[data-ready-page]')?.getAttribute('data-ready-page'),image:slot.querySelector('img')?.getAttribute('src'),error:slot.querySelector('[data-page-error]')?.textContent}))};
  }).catch(error=>({diagnosticError:String(error)}));
  await info.attach('viewport-at-failure',{body:JSON.stringify(state,null,2),contentType:'application/json'});
});
