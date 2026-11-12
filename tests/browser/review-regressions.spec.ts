import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {spawn} from 'node:child_process';import {createServer} from 'node:net';import {tmpdir} from 'node:os';import path from 'node:path';
import {createServer as createHttpServer} from 'node:http';
const engine=process.env.POLICY_ENGINE??'mupdf',root=path.resolve('tests/fixtures/review');
const records:any[]=[];
async function load(page:Page,left:string,right:string){
 await page.getByLabel('Baseline PDF',{exact:true}).setInputFiles(left);await page.getByLabel('Revised PDF',{exact:true}).setInputFiles(right);await page.getByRole('button',{name:'Compare',exact:true}).click();
 await expect(page.locator('[data-status]')).toHaveAttribute('data-status',/complete_for_scope|partial|failed/);
}
async function exported(page:Page){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON',exact:true}).click();return JSON.parse(readFileSync((await(await pending).path())!,'utf8'));}
test.afterAll(()=>writeFileSync(`${process.env.POLICY_REPORT_DIR || 'reports'}/browser-review-regressions-${engine}.json`,JSON.stringify({engine,status:records.length===(process.env.POLICY_BASE_URL?9:10)&&records.every(r=>r.status==='PASS')?'PASS':'FAIL',expectedRecords:process.env.POLICY_BASE_URL?9:10,records,excluded:process.env.POLICY_BASE_URL?['F7 independent temporary server; not a target Route test']:[],fullTestEvidence:`${process.env.POLICY_REPORT_DIR || 'reports'}/browser-tests-${engine}.json`},null,2)+'\n'));
test('F1 two changed deductibles retain visible sections and both real source rows',async({page})=>{
 await page.goto('./');
 for(const variant of ['short-top','short-body','long-body','headings-body']){
  await load(page,`${root}/f1-${variant}-before.pdf`,`${root}/f1-${variant}-after.pdf`);await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');await expect(page.locator('.card')).toHaveCount(2);await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);
  const sections=variant==='headings-body'?['HULL','LIABILITY']:['SECTION HULL','SECTION LIABILITY'];
  for(const [section,y] of [[sections[0],variant==='short-top'?60:190],[sections[1],variant==='short-top'?100:230]] as const){
   await page.locator('.card').nth(sections.indexOf(section)).click();
   for(const side of [0,1]){
    const polygons=page.locator('.document').nth(side).locator('polygon');await expect(polygons.first()).toBeVisible();
    // React applies the newly selected locations after the click event. Wait
    // for the actual geometry, keeping the authored row bounds unchanged.
    await expect.poll(async()=>{const points=await polygons.evaluateAll(els=>els.map(el=>el.getAttribute('points')!.split(/\s+/).flatMap(p=>p.split(',').map(Number))));return points.length>0&&points.every(q=>Math.min(...q.filter((_,i)=>i%2===1))>y-16&&Math.max(...q.filter((_,i)=>i%2===1))<y+16);}).toBe(true);
   }
  }
  const result=await exported(page);expect(result.differences.every((d:any)=>d.structurePath.entity===null)).toBe(true);records.push({case:'F1',variant,status:'PASS',result});
 }
 await load(page,`${root}/f1-unclassified-body-before.pdf`,`${root}/f1-unclassified-body-after.pdf`);await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');await expect(page.locator('.card')).toHaveCount(2);const result=await exported(page);for(const d of result.differences){expect(d.hasTextChange).toBe(true);expect(d.structurePath.entity).toBeNull();expect(d.left.length&&d.right.length).toBeTruthy();expect(Math.abs(d.left[0].quads[0][1]-d.right[0].quads[0][1])).toBeLessThan(2);}records.push({case:'F1 local source correspondence without a business owner',status:'PASS',result});
});
test('F2 damaged body produces explicit partial or failed state and clean/mixed controls remain useful',async({page})=>{
 await page.goto('./');const logs:string[]=[];page.on('console',m=>{if(['error','warning'].includes(m.type()))logs.push(m.text());});
 await load(page,`${root}/f2-before.pdf`,`${root}/f2-after.pdf`);
 await expect(page.locator('[data-status]')).toHaveAttribute('data-status',/partial|failed/);await expect(page.getByRole('status')).not.toContainText('No differences found in extractable text');
 records.push({case:'F2 damaged',status:'PASS',uiState:await page.locator('[data-status]').getAttribute('data-status'),message:await page.getByRole('status').textContent(),logs});
 await load(page,`${root}/f2-clean.pdf`,`${root}/f2-clean.pdf`);await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');await expect(page.locator('.card')).toHaveCount(0);
 await load(page,`${root}/f2-mixed-before.pdf`,`${root}/f2-mixed-after.pdf`);await expect(page.locator('[data-status]')).toHaveAttribute('data-status','partial');await expect(page.locator('.card')).toHaveCount(1);await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);await expect(page.locator('.gaps')).toContainText('parsing');
 const result=await exported(page);expect(result.coverage.length).toBeGreaterThanOrEqual(2);expect(result.coverage.every((c:any)=>c.pageIndex===0)).toBe(true);expect(result.differences[0].oldText).toContain('1,000');expect(result.differences[0].newText).toContain('2,000');records.push({case:'F2 mixed and clean controls',status:'PASS',result});
 if(engine==='pdfjs'){
  // The damaged first page is now prefetched beside the useful second page.
  // Its preview failure must stay local, explicit, and leave navigation alive.
  await expect(page.locator('[data-page-error="0"]')).toHaveCount(2);
  await page.getByRole('button',{name:'Baseline previous page',exact:true}).click();
  await expect(page.locator('.document').nth(0).locator('[data-page-error="0"]')).toBeInViewport();
  await expect(page.locator('.document').nth(0)).toContainText('Source page 1 could not be displayed');
  await page.getByRole('button',{name:'Baseline next page',exact:true}).click();
  await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status','partial');
  await expect(page.locator('.card')).toHaveCount(1);
  await load(page,`${root}/f2-clean.pdf`,`${root}/f2-clean.pdf`);
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');
  await expect(page.locator('[data-page-error]')).toHaveCount(0);
 }
});
test('F5 visible image gap regions respect nested Form matrices and restored state',async({page})=>{
 await page.goto('./');
 for(const [name,regions] of [['f5-form.pdf',[[100,452,300,492]]],['f5-nested-restore.pdf',[[140,422,540,462],[10,762,30,782]]]] as const){
  await load(page,`${root}/${name}`,`${root}/${name}`);await expect(page.locator('[data-status]')).toHaveAttribute('data-status','partial');await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);
  for(const side of [0,1]){const rects=page.locator('.document').nth(side).locator('rect[data-coverage="true"]');await expect(rects).toHaveCount(regions.length);const actual=await rects.evaluateAll(els=>els.map(e=>{const x=Number(e.getAttribute('x')),y=Number(e.getAttribute('y'));return [x,y,x+Number(e.getAttribute('width')),y+Number(e.getAttribute('height'))];}));for(const expected of regions)expect(actual.some(r=>r.every((v,i)=>Math.abs(v-expected[i])<.01))).toBe(true);}
  records.push({case:'F5',name,status:'PASS',regions});
 }
});
test('F7 versioned resources escape old immutable cache and fixed paths revalidate',async({page})=>{
 test.skip(!!process.env.POLICY_BASE_URL, 'Independent temporary server; cannot establish external deployment behavior');
 const dir=mkdtempSync(path.join(tmpdir(),'policy-browser-cache-'));for(const sub of ['pdfjs/wasm','pdfjs/6.4.299/wasm'])mkdirSync(path.join(dir,sub),{recursive:true});writeFileSync(path.join(dir,'index.html'),'<html><body>cache regression</body></html>');
 const oldUrl='/pdfjs/wasm/openjpeg.wasm',newUrl='/pdfjs/6.4.299/wasm/openjpeg.wasm';writeFileSync(path.join(dir,oldUrl),'decoder version two');writeFileSync(path.join(dir,newUrl),'decoder version two');
 const legacy=createHttpServer((req,res)=>{res.writeHead(200,{'Content-Type':req.url===oldUrl?'application/wasm':'text/html','Cache-Control':req.url===oldUrl?'public, max-age=31536000, immutable':'no-cache'});res.end(req.url===oldUrl?'decoder version one':'<html>legacy cache seed</html>');});await new Promise<void>(r=>legacy.listen(0,'127.0.0.1',r));const port=(legacy.address() as {port:number}).port,origin=`http://127.0.0.1:${port}`;
 let child:ReturnType<typeof spawn>|undefined;
 const read=(url:string)=>page.evaluate(async path=>{const r=await fetch(path);return {body:await r.text(),cache:r.headers.get('cache-control')};},url);
 try{
  await page.goto(origin);expect((await read(oldUrl)).body).toBe('decoder version one');await new Promise<void>(r=>legacy.close(()=>r()));
  child=spawn(process.execPath,[path.resolve('deploy/server.mjs')],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),STATIC_ROOT:dir},stdio:'ignore'});await expect.poll(async()=>{try{return(await fetch(origin+'/healthz')).status;}catch{return 0;}}).toBe(200);
  expect((await read(oldUrl)).body).toBe('decoder version one'); // proves the legacy cache is still warm
  expect(await read(newUrl)).toEqual({body:'decoder version two',cache:'no-cache'});writeFileSync(path.join(dir,newUrl),'decoder version three');expect(await read(newUrl)).toEqual({body:'decoder version three',cache:'no-cache'});records.push({case:'F7',status:'PASS',legacyCacheRetained:true,versionedPathEscapedLegacyCache:true});
 }finally{if(legacy.listening)await new Promise<void>(r=>legacy.close(()=>r()));if(child&&child.exitCode===null){const stopped=new Promise(r=>child!.once('exit',r));child.kill();await stopped;}rmSync(dir,{recursive:true,force:true});}
});
