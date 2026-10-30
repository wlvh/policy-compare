import {chromium,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const value=(key:string,fallback:string)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]??fallback;};
if(args.includes('--help')){
 console.log('pnpm exec tsx scripts/renewal-browser-check.ts --inputs tmp/renewal-inputs --out tmp/renewal-browser-run [--engine both|pdfjs|mupdf] [--browser chrome|chromium] [--pdfjs-url http://127.0.0.1:8081] [--mupdf-url http://127.0.0.1:8082]\nChecks loading, export, selected amounts, local requests and resource release. Does not score all author events or certify performance.');process.exit(0);
}
const inputs=path.resolve(value('--inputs','tmp/renewal-inputs'));
const out=path.resolve(value('--out','tmp/renewal-browser-run'));
if(existsSync(out)&&readdirSync(out).length)throw new Error('Choose an empty --out directory; previous evidence is not overwritten');
const selection=value('--engine','both'),channel=value('--browser','chrome');
if(!['pdfjs','mupdf','both'].includes(selection)||!['chrome','chromium'].includes(channel))throw new Error('Invalid engine or browser');
const urls={pdfjs:value('--pdfjs-url','http://127.0.0.1:8081').replace(/\/$/,''),mupdf:value('--mupdf-url','http://127.0.0.1:8082').replace(/\/$/,'')};
const manifest=JSON.parse(readFileSync(path.join(repo,'reports/renewal-intake/source-manifest.json'),'utf8'));
const reference=JSON.parse(readFileSync(path.join(repo,'reports/renewal-intake/amount-location-reference.json'),'utf8'));
for(const entry of manifest.files.filter((f:any)=>f.path.endsWith('.pdf'))){
 const data=readFileSync(path.join(inputs,entry.path));
 if(createHash('sha256').update(data).digest('hex')!==entry.sha256)throw new Error('Input hash mismatch: '+entry.path);
}
const ab=JSON.parse(readFileSync(path.join(repo,'reports/engine-ab.json'),'utf8'));
let runnerRevision:string|null=null,productSourceMatchesFrozen:boolean|null=null;
try{
 runnerRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
 productSourceMatchesFrozen=execFileSync('git',['diff',ab.commit,'--','apps','packages','engines','profiles','patches','deploy','vite.config.ts','bench'],{cwd:repo,encoding:'utf8'}).trim()==='';
}catch{}
mkdirSync(out,{recursive:true});
const records:any[]=[];
const browser=await chromium.launch({...(channel==='chrome'?{channel:'chrome'}:{}),headless:true,args:['--disable-background-networking']});
const schedule=[['aviation_2024_vs_2025','pdfjs'],['aviation_2024_vs_2025','mupdf'],['bizav_2024_vs_2025','mupdf'],['bizav_2024_vs_2025','pdfjs']] as const;
try{
 for(const [pair,engine] of schedule){
  if(selection!=='both'&&selection!==engine)continue;
  const origin=urls[engine];
  const context=await browser.newContext({viewport:{width:1500,height:1000},deviceScaleFactor:1,acceptDownloads:true});
  const page=await context.newPage();
  const record:any={pair,engine,browserVersion:browser.version(),workflow:'NOT_RUN',fullAuthorEventAcceptance:'NOT_EVALUATED',requestsOutsideSelectedApp:[],logs:[],httpErrors:[],servedResources:[]};
  const pending:Promise<void>[]=[];
  context.on('request',r=>{if(!r.url().startsWith('blob:')&&(!r.url().startsWith(origin+'/')||!['GET','HEAD'].includes(r.method())||(engine==='pdfjs'&&/mupdf/i.test(r.url()))))record.requestsOutsideSelectedApp.push({url:r.url(),method:r.method()});});
  context.on('response',r=>{
   if(!r.url().startsWith(origin+'/'))return;
   const pathname=new URL(r.url()).pathname;
   if(r.status()>=400){record.httpErrors.push({path:pathname,status:r.status()});return;}
   const expected=ab.builds[engine][`dist/${engine}/${pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1))}`];
   if(expected)pending.push(r.body().then(body=>{const actual=createHash('sha256').update(body).digest('hex');record.servedResources.push({path:pathname,sha256:actual,matchesFrozenBuild:actual===expected});}).catch(e=>{record.servedResources.push({path:pathname,error:String(e),matchesFrozenBuild:false});}));
  });
  page.on('console',m=>{if(['warning','error'].includes(m.type()))record.logs.push(m.text());});
  try{
   await page.goto(origin);await expect(page.locator('main')).toHaveAttribute('data-engine-ready','true',{timeout:30000});
   const dir=path.join(inputs,'testdata/renewal',pair);
   await page.getByLabel('基准 PDF',{exact:true}).setInputFiles(path.join(dir,'left.pdf'));
   await page.getByLabel('待审 PDF',{exact:true}).setInputFiles(path.join(dir,'right.pdf'));
   await page.getByRole('button',{name:'开始比较',exact:true}).click();
   await expect(page.locator('[data-status]')).toHaveAttribute('data-status',/complete_for_scope|partial|failed/,{timeout:120000});
   record.status=await page.locator('[data-status]').getAttribute('data-status');record.message=await page.getByRole('status').textContent();
   if(record.status==='failed')throw new Error('Comparison failed');
   await expect.poll(()=>page.evaluate(()=>Number((window as any).__policyMetrics.total??0)),{timeout:30000}).toBeGreaterThan(0);
   record.metrics=await page.evaluate(()=>(window as any).__policyMetrics);
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出 JSON',exact:true}).click();
   const exported=await download,file=path.join(out,`${pair}-${engine}-browser.json`);await exported.saveAs(file);
   const result=JSON.parse(readFileSync(file,'utf8'));
   Object.assign(record,{resultFile:path.basename(file),coreVersion:result.coreVersion,extractors:result.extractors,documentHashes:result.documentHashes,configDigest:result.configDigest,differenceCount:result.differences.length,unresolvedCount:result.unresolved.length,coverageCount:result.coverage.length});
   expect(result.status).toBe(record.status);
   const needle=pair.startsWith('aviation')?'USD 250,000 each':'USD 50,000 each';
   const card=page.locator('.card').filter({has:page.locator('.old',{hasText:needle})});await expect(card).toHaveCount(1);await card.click();
   const refs=reference.cases[pair];await expect(page.locator(`[data-ready-page="${refs.pageIndex}"]`)).toHaveCount(2,{timeout:30000});
   record.amountLocations={};
   for(const [index,side] of ['left','right'].entries()){
    const polygons=page.locator('.document').nth(index).locator('polygon');
    const get=()=>polygons.evaluateAll(els=>els.map(e=>e.getAttribute('points')!.split(/\s+/).map(s=>s.split(',').map(Number))).map(q=>[Math.min(...q.map(p=>p[0])),Math.min(...q.map(p=>p[1])),Math.max(...q.map(p=>p[0])),Math.max(...q.map(p=>p[1]))]));
    const overlap=(a:number[],b:number[])=>a[0]<b[2]+2&&a[2]>b[0]-2&&a[1]<b[3]+2&&a[3]>b[1]-2;
    await expect.poll(async()=>{const actual=await get();return actual.length>0&&refs[side].every((w:any)=>actual.some(a=>overlap(a,w.rect)))&&actual.every(a=>refs[side].some((w:any)=>overlap(a,w.rect)));},{timeout:15000}).toBe(true);
    record.amountLocations[side]={reference:refs[side],actual:await get(),status:'PASS'};
   }
   record.selectedCardText=await card.textContent();await page.screenshot({path:path.join(out,`${pair}-${engine}-deductible.png`),fullPage:true});
   await page.getByRole('button',{name:'关闭任务',exact:true}).click();await expect.poll(()=>page.workers().length).toBe(0);record.workersAfterClose=page.workers().length;
   expect(record.requestsOutsideSelectedApp).toEqual([]);record.workflow='PASS';
  }catch(error){record.workflow='FAIL';record.error=String(error);await page.screenshot({path:path.join(out,`${pair}-${engine}-failed.png`),fullPage:true}).catch(()=>{});}
  finally{
   await Promise.all(pending);record.observedAssetsMatchFrozenBuild=record.servedResources.length>0&&record.servedResources.every((r:any)=>r.matchesFrozenBuild);
   await context.close();records.push(record);
   writeFileSync(path.join(out,'browser-summary.json'),JSON.stringify({purpose:'Loading/export/selected amounts/release checks; not full author-event, human review or performance acceptance',sourceRevision:manifest.ref,runnerRevision,productSourceMatchesFrozen,frozenProductRevision:ab.commit,records},null,2)+'\n');
   console.log(JSON.stringify({pair,engine,workflow:record.workflow,status:record.status,differences:record.differenceCount,unresolved:record.unresolvedCount,observedAssetsMatchFrozenBuild:record.observedAssetsMatchFrozenBuild,error:record.error}));
  }
 }
}finally{await browser.close();}
if(records.some(r=>r.workflow!=='PASS'))process.exitCode=1;
