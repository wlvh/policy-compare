import {test,expect} from '@playwright/test';import {readFileSync,writeFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import path from 'node:path';
import {resolveLocation,snapshotDigest,parseDoc} from '../../packages/contracts/index';
const engine=process.env.POLICY_ENGINE??'mupdf',report=process.env.POLICY_REPORT_DIR??'reports';
const manifest=JSON.parse(readFileSync('validation/issue-24/pdfs/manifest.json','utf8'));
test('three frozen English PDF pairs: visible edits, source rows and actual fine highlights',async({page})=>{
 test.setTimeout(60_000);
 // Capture the actual browser extractor input before it reaches Rust. Node and
 // browser PDF.js use different standard-font ascent metrics; one environment's
 // quads cannot validate another environment's admitted source snapshot.
 await page.addInitScript(()=>{
  const Native=window.Worker;
  window.Worker=class extends Native {
   private coreSurface:boolean;private cleanup=()=>{};
   constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.coreSurface=String(url).includes('core.worker');}
   postMessage(message:any,transfer?:Transferable[]|StructuredSerializeOptions){
    if(this.coreSurface&&message.type==='init'&&message.port){
     const source:MessagePort=message.port,proxy=new MessageChannel();(window as any).__capturedDocs=[null,null];
     source.onmessage=e=>{const m=e.data;if(m.type==='meta')(window as any).__capturedDocs[m.side]={...m.meta,pages:[]};if(m.type==='page')(window as any).__capturedDocs[m.side].pages.push(structuredClone(m.page));proxy.port2.postMessage(m);};
     proxy.port2.onmessage=e=>source.postMessage(e.data);source.start();proxy.port2.start();
     this.cleanup=()=>{source.close();proxy.port2.close();};
     const list=Array.isArray(transfer)?transfer:transfer?.transfer??[];
     super.postMessage({...message,port:proxy.port1},list.map(p=>p===source?proxy.port1:p));
    }else super.postMessage(message,transfer as any);
   }
   terminate(){this.cleanup();super.terminate();}
  };
 });
 await page.goto('./');const records=[];
 for(const pair of manifest.pairs){
  for(const side of ['before','after']){expect(createHash('sha256').update(readFileSync(pair.files[side].file)).digest('hex')).toBe(pair.files[side].sha256);}
  await page.getByLabel('Baseline PDF',{exact:true}).setInputFiles(path.resolve(pair.files.before.file));await page.getByLabel('Revised PDF',{exact:true}).setInputFiles(path.resolve(pair.files.after.file));await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status','complete_for_scope');await expect(page.locator('.cards .card')).toHaveCount(1);const card=page.locator('.cards .card');await expect(card.locator('.old')).toContainText(pair.old);await expect(card.locator('.new')).toContainText(pair.new);await card.click();
  for(const side of [0,1])await expect(page.locator('.document').nth(side).locator(side?'polygon.highlight-new':'polygon.highlight-old').first()).toBeVisible();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON',exact:true}).click();const result=JSON.parse(readFileSync((await(await pending).path())!,'utf8'));const docs=await page.evaluate(()=>(window as any).__capturedDocs);docs.forEach((doc:any)=>parseDoc(doc));expect(result.extractionSnapshotHashes).toEqual(docs.map((doc:any)=>snapshotDigest(doc)));writeFileSync(`${report}/three-pdfs-${pair.id}-actual.json`,JSON.stringify({result,docs},null,2));expect(result.profileVersion).toBe('english-generic/1');
  const context=pair.id==='prose'?'supplier':pair.id==='two-column'?'Archive':'North';
  for(const d of result.differences){for(const loc of [...d.left,...d.right,...d.textOps.flatMap((o:any)=>[...o.left,...o.right])])expect(resolveLocation(loc,docs)).toBe(true);
   for(const o of d.textOps.filter((o:any)=>o.kind!=='equal'))for(const loc of [...o.left,...o.right]){const doc=docs[loc.side==='left'?0:1];const row=doc.pages[0].lines.find((line:any)=>line.charIds.map((id:string)=>doc.pages[0].chars.find((c:any)=>c.id===id).text).join('').includes(context));expect(row).toBeTruthy();if(loc.precision==='run')expect(loc.resolvedGeometry?.method).toBe('text_layer_range');const quads=loc.resolvedGeometry?.quads??loc.quads;expect(quads.length).toBeGreaterThan(0);for(const q of quads){expect(Math.abs(Math.max(q[1],q[3],q[5],q[7])-row.baseline[1])).toBeLessThan(25);expect(Math.max(q[0],q[2],q[4],q[6])-Math.min(q[0],q[2],q[4],q[6])).toBeLessThan(80);}}
  }
  records.push({id:pair.id,status:'PASS',result});if(pair.id==='multi-column')await page.screenshot({path:`${report}/three-pdfs.png`,fullPage:true});
 }
 writeFileSync(`${report}/three-pdfs.json`,JSON.stringify({engine,status:'PASS',records},null,2)+'\n');
});
