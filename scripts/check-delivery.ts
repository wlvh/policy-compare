import { chromium, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const project=process.cwd(),manifest=JSON.parse(readFileSync('DELIVERY_MANIFEST.json','utf8'));
const frozen=JSON.parse(readFileSync('reports/engine-ab.json','utf8'));
const root=mkdtempSync(join(tmpdir(),'policy-delivery-'));
const records:any[]=[];
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(join(dir,x.name)):[join(dir,x.name)]);
for(const [index,artifact] of manifest.artifacts.entries()){
 const engine=artifact.engine,archive=resolve(artifact.file),folder=join(root,`policy-compare-${engine}`),origin=`http://127.0.0.1:${18081+index}`;
 let child:ReturnType<typeof spawn>|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{
  expect(sha(archive)).toBe(artifact.sha256);
  execFileSync('tar',['-xzf',archive,'-C',root]);
  const build=JSON.parse(readFileSync(join(folder,'BUILD.json'),'utf8'));
  expect(build.product_revision).toBe(frozen.commit);
  for(const [name,hash] of Object.entries(build.files)){
   expect(sha(join(folder,'dist',name))).toBe(hash);
   expect(hash).toBe(frozen.builds[engine][`dist/${engine}/${name}`]);
  }
  expect(walk(join(folder,'dist')).length).toBe(Object.keys(build.files).length);
  child=spawn(process.execPath,['server.mjs'],{cwd:folder,env:{...process.env,HOST:'127.0.0.1',PORT:String(18081+index),STATIC_ROOT:join(folder,'dist')},stdio:'ignore'});
  await expect.poll(async()=>{try{return (await fetch(origin+'/healthz')).status;}catch{return 0;}},{timeout:10000}).toBe(200);
  const head=await fetch(origin,{method:'HEAD'});
  expect(head.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  expect(head.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
  expect((await fetch(origin,{method:'POST',body:'no document upload'})).status).toBe(405);
  for(const name of Object.keys(build.files).filter(x=>/\.(mjs|wasm)$/.test(x))){
   const response=await fetch(origin+'/'+name,{method:'HEAD'});
   expect(response.status).toBe(200);
   expect(response.headers.get('content-type')).toContain(name.endsWith('.wasm')?'application/wasm':'application/javascript');
  }
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),requests:{url:string;method:string}[]=[];
  page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await page.goto(origin);await page.waitForSelector('main[data-engine-ready="true"]');
  await page.getByLabel('基准 PDF',{exact:true}).setInputFiles(join(folder,'samples/before.pdf'));
  await page.getByLabel('待审 PDF',{exact:true}).setInputFiles(join(folder,'samples/after.pdf'));
  await page.getByRole('button',{name:'开始比较',exact:true}).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');
  await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);
  await expect(page.locator('.card').filter({hasText:'USD 2,500,000'})).toBeVisible();
  await expect(page.locator('.card').filter({hasText:'31 March 2026'})).toBeVisible();
  await expect(page.locator('polygon').first()).toBeVisible();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出 JSON',exact:true}).click();
  const output=join(folder,'actual-result.json');await (await pending).saveAs(output);
  const result=JSON.parse(readFileSync(output,'utf8'));
  expect(result.extractors.every((x:any)=>x.name===(engine==='pdfjs'?'PDF.js':'MuPDF.js'))).toBe(true);
  const reviewCases:any[]=[];
  for(const name of ['f1-long-body','f1-headings-body','f2-mixed','f2']){
   await page.goto(origin);await page.waitForSelector('main[data-engine-ready="true"]');
   await page.getByLabel('基准 PDF',{exact:true}).setInputFiles(join(project,`tests/fixtures/review/${name}-before.pdf`));
   await page.getByLabel('待审 PDF',{exact:true}).setInputFiles(join(project,`tests/fixtures/review/${name}-after.pdf`));
   await page.getByRole('button',{name:'开始比较',exact:true}).click();
   await expect(page.locator('[data-status]')).toHaveAttribute('data-status',name.startsWith('f1')?'complete_for_scope':/partial|failed/);
   if(name.startsWith('f1')){await expect(page.locator('.card')).toHaveCount(2);await expect(page.locator('.card').filter({hasText:'HULL'})).toBeVisible();await expect(page.locator('.card').filter({hasText:'LIABILITY'})).toBeVisible();await expect(page.locator('[data-ready-page="0"]')).toHaveCount(2);}
   if(name==='f2-mixed'){await expect(page.locator('[data-status]')).toHaveAttribute('data-status','partial');await expect(page.locator('.card')).toHaveCount(1);await expect(page.locator('.gaps')).toContainText('解析');await expect(page.locator('[data-ready-page="1"]')).toHaveCount(2);}
   if(name==='f2')await expect(page.getByRole('status')).not.toContainText('可提取文本中未发现差异');
   if(name==='f1-headings-body'||name==='f2-mixed')await page.screenshot({path:join(project,`reports/fix-${name.startsWith('f1')?'f1':'f2'}-${engine}.png`),fullPage:true});
   reviewCases.push({case:name,state:await page.locator('[data-status]').getAttribute('data-status'),message:await page.getByRole('status').textContent(),status:'PASS'});
  }
  for(const side of ['基准 PDF','待审 PDF'])await page.getByLabel(side,{exact:true}).setInputFiles(join(project,'tests/fixtures/review/f2-clean.pdf'));
  await page.getByRole('button',{name:'开始比较',exact:true}).click();await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');
  expect(requests.every(r=>r.method==='GET'&&(r.url.startsWith(origin+'/')||r.url.startsWith('blob:'+origin+'/')))).toBe(true);
  if(engine==='pdfjs')expect(requests.some(r=>/mupdf/i.test(r.url))).toBe(false);
  await page.getByRole('button',{name:'关闭任务',exact:true}).click();await expect.poll(()=>page.workers().length).toBe(0);
  records.push({engine,status:'PASS',archive:artifact.file,sha256:artifact.sha256,staticFiles:Object.keys(build.files).length,productRevision:build.product_revision,checks:['archive hash','test extraction','every static hash equals A/B build','health/COOP/COEP/MIME/POST405','real bundled R32 PDFs','F1/F2 on extracted runtime','clean task after damaged input','both source views and highlights','engine metadata','no uploads or foreign engine requests','workers released'],reviewCases,requests});
 }catch(e){records.push({engine,status:'FAIL',error:String(e)});}
 finally{await browser?.close();if(child){const stopped=new Promise<void>(r=>child!.once('exit',()=>r()));child.kill('SIGTERM');await stopped;}}
}
const report={subject:'extracted_delivery_archives_on_macos',status:records.every(r=>r.status==='PASS')?'PASS':'FAIL',linuxStatus:'NOT_RUN',extractionDirectory:root,productRevision:frozen.commit,records};
writeFileSync(join(project,'reports/delivery-check.json'),JSON.stringify(report,null,2)+'\n');
console.log({status:report.status,linuxStatus:report.linuxStatus,records:records.map(({requests,...rest})=>rest),extractionDirectory:root});
process.exitCode=report.status==='PASS'?0:1;
