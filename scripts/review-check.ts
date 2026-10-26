import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadEngine,type EngineName} from '../packages/pdf-adapter/node';
import {compare} from '../packages/compare-core/index';
import {parseDoc} from '../packages/contracts/index';
const chosen=process.argv[2],engines:EngineName[]=chosen?[chosen as EngineName]:['pdfjs','mupdf'];
if(engines.some(e=>!['pdfjs','mupdf'].includes(e)))throw new Error('Unknown engine');
const root='tests/fixtures/review';
for(const engine of engines){
 const {extractPdf}=await loadEngine(engine),checks:any[]=[];
 async function check(name:string,fn:()=>Promise<unknown>){try{const evidence=await fn();checks.push({name,status:'PASS',evidence});}catch(e){checks.push({name,status:'FAIL',error:String(e)});}}
 for(const variant of ['short-top','short-body','long-body'])await check('F1 real PDF section-field ownership '+variant,async()=>{
  const docs=await Promise.all(['before','after'].map(async s=>parseDoc(await extractPdf(readFileSync(`${root}/f1-${variant}-${s}.pdf`))))),r=compare(docs[0],docs[1]);assert.equal(r.status,'complete_for_scope');assert.equal(r.differences.length,2);
  for(const [section,oldValue,newValue] of [['SECTION HULL','1,000','2,000'],['SECTION LIABILITY','2,000','1,000']]){const d=r.differences.find(d=>d.structurePath?.section===section);assert(d);assert.equal(d.structurePath?.field,'deductible');assert(d.oldText.includes(oldValue)&&d.newText.includes(newValue));assert.equal(d.category,'Material');assert(d.defaultVisible&&d.left.length&&d.right.length);}
  return {status:r.status,differences:r.differences.map(d=>({path:d.structurePath,old:d.oldText,new:d.newText}))};
 });
 await check('F2 malformed content stream cannot become complete zero differences',async()=>{
  const bytes=['before','after'].map(s=>readFileSync(`${root}/f2-${s}.pdf`));let docs;
  try{docs=await Promise.all(bytes.map(async b=>parseDoc(await extractPdf(b))));}catch(e){return {status:'failed',extractionError:String(e)};}
  const r=compare(docs[0],docs[1]);assert.equal(r.status,'partial');assert(r.coverage.some(c=>c.reason==='page_failed'));return {status:r.status,coverage:r.coverage};
 });
 await check('F2 diagnostics are scoped; subsequent clean document stays complete',async()=>{
  await extractPdf(readFileSync(`${root}/f2-before.pdf`)).catch(()=>null);
  const clean=parseDoc(await extractPdf(readFileSync('validation/dataset/cases/R01_identical/before.pdf')));const r=compare(clean,clean);assert.equal(r.status,'complete_for_scope');assert.equal(r.coverage.length,0);return {status:r.status};
 });
 await check('F5 image inside translated Form has authored region',async()=>{
  const doc=parseDoc(await extractPdf(readFileSync(`${root}/f5-form.pdf`))),regions=doc.pages[0].issues.filter(x=>x.reason==='unverified_image_text_region').map(x=>x.region);assert.equal(regions.length,1);assert(regions[0].every((v,i)=>Math.abs(v-[100,452,300,492][i])<0.01));return {regions};
 });
 const report={subject:'independent_review_real_pdf_regressions',engine,revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),status:checks.every(x=>x.status==='PASS')?'PASS':'FAIL',checks};writeFileSync(`reports/review-regressions-${engine}.json`,JSON.stringify(report,null,2)+'\n');console.log(report);if(report.status!=='PASS')process.exitCode=1;
}
