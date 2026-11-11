import {createHash} from 'node:crypto';
import {digest} from '../packages/contracts/index';
import {aviationProfile} from '../profiles/aviation';
import {chromium} from '@playwright/test';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const exec=promisify(execFile);
const runs=process.argv.includes('--formal')?20:process.argv.includes('--memory-check')?1:3;
const output=process.env.POLICY_PERFORMANCE_REPORT||'reports/issue-19/performance.json';
const manifest=JSON.parse(readFileSync('bench/generated/manifest.json','utf8'));
for(const w of manifest)for(let i=0;i<w.paths.length;i++)if(createHash('sha256').update(readFileSync(w.paths[i])).digest('hex')!==w.sha256[i])throw new Error('Benchmark input hash mismatch');
const protocol={configDigest:digest({profile:aviationProfile,budget:aviationProfile.budget}),scope:'local paired migration measurement, not office-device performance acceptance',runsPerWorkload:runs,workloads:manifest.map((x:any)=>({name:x.name,paths:x.paths,sha256:x.sha256,budget_ms:x.budget_ms})),device:{cpu:os.cpus()[0].model,memoryBytes:os.totalmem(),os:os.release()},unchangedTargets:{timing:'existing per-workload budget_ms; original formal run count 20 remains required',memory:'existing standard incremental peak 1 GiB; this RSS sampling alone does not establish full physical peak',cancellation:'existing max 1000 ms'},method:'Same bundled Chromium, viewport 1500x1000, selected PDF extractor and inputs for old TS and Rust. Dedicated browser process tree RSS sampled every 100 ms, includes workers, WASM and GPU but can double-count shared pages and miss short-lived peaks. First navigation/load, each task stages (Rust inputAdmission includes page validation/hash before compare; TS validation/snapshot happen after full input, so individual phase columns have different boundaries) and full display completion, sequential tasks, close workers, query/search, and cancel latency recorded. OS release does not imply immediate memory return. No performance target relaxed.'};
writeFileSync(output.replace(/\.json$/,'-protocol.json'),JSON.stringify(protocol,null,2)+'\n');
const records:any[]=[];const loads:any[]=[];
const save=()=>writeFileSync(output,JSON.stringify({protocol,browserVersion,loads,records,status:'NOT_EVALUATED',reason:'Local measurements only; original office-device and full-peak acceptance remains open'},null,2)+'\n');
let browserVersion='';
for(const engine of ['mupdf','pdfjs'])for(const impl of ['typescript','rust']){
 const port=impl==='rust'?4191:4190;const server=spawn(process.execPath,['deploy/server.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',STATIC_ROOT:path.resolve(impl==='rust'?`dist/${engine}`:`tmp/issue19-baseline/${engine}`)},stdio:'ignore'});
 const chrome=await chromium.launchServer({headless:true,args:['--disable-background-networking']});const browser=await chromium.connect(chrome.wsEndpoint());browserVersion=browser.version();const context=await browser.newContext({viewport:{width:1500,height:1000}});const page=await context.newPage();const pid=chrome.process().pid!;let peak=0,pendingSample:Promise<number>|null=null;const sample=():Promise<number>=>{
  if(pendingSample)return pendingSample;
  pendingSample=(async()=>{const {stdout}=await exec('/bin/ps',['-axo','pid=,ppid=,rss=']);const rows=stdout.trim().split('\n').map(l=>l.trim().split(/\s+/).map(Number));const ps=new Set([pid]);for(let change=true;change;){change=false;for(const [p,pp]of rows)if(ps.has(pp)&&!ps.has(p)){ps.add(p);change=true}}const rss=rows.filter(r=>ps.has(r[0])).reduce((n,r)=>n+r[2]*1024,0);peak=Math.max(peak,rss);return rss;})().finally(()=>pendingSample=null);
  return pendingSample;
 };
 const sampler=setInterval(()=>void sample(),100);
 try{
  for(let n=0;n<100;n++){try{if((await fetch(`http://127.0.0.1:${port}/healthz`)).ok)break}catch{}await new Promise(r=>setTimeout(r,50));}
  const load=performance.now();await page.goto(`http://127.0.0.1:${port}/`);await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('data-engine-ready')==='true');const idle=await sample();loads.push({engine,impl,firstPageEngineLoadMs:performance.now()-load,idleRssBytes:idle});
  for(const w of manifest){for(let run=0;run<runs;run++){
   await page.getByLabel(/^(?:Baseline PDF|基准 PDF)$/,{exact:true}).setInputFiles(path.resolve(w.paths[0]));await page.getByLabel(/^(?:Revised PDF|待审 PDF)$/,{exact:true}).setInputFiles(path.resolve(w.paths[1]));peak=0;const start=performance.now();let result:any={engine,impl,workload:w.name,run};
   try{await page.getByRole('button',{name:/^(?:Compare|开始比较)$/,exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-status]')?.getAttribute('data-status')==='failed'||typeof window.__policyMetrics.total==='number',null,{timeout:125000});const metrics=await page.evaluate(()=>window.__policyMetrics);const status=await page.locator('[data-status]').getAttribute('data-status');const cards=await page.locator('.cards').textContent();await sample();const differenceCards=await page.locator('.card').count();const expectedCards=w.family==='template_change'?w.pages_per_document*10+2:w.family==='renewal'?2:1;result={...result,status,metrics,differenceCards,expectedCards,wallMs:performance.now()-start,peakRssBytes:peak,incrementalSampledRssBytes:Math.max(0,peak-idle),expectedValueVisible:cards?.includes(w.assertion.new_visible_value)};
   await page.getByRole('button',{name:/^(?:Close task|关闭任务)$/,exact:true}).click();await page.waitForFunction(()=>window.__policyMetrics.activeWorkers===0);result.workersAfterClose=page.workers().length;result.rssAfterClose=await sample();
   }catch(e){result.error=String(e)}records.push(result);save();console.log(engine,impl,w.name,run,result.status,Math.round(result.metrics?.total??result.wallMs??0),Math.round(peak/1048576));
  }}
 }finally{clearInterval(sampler);await browser.close();await chrome.close();server.kill();}
}
save();
