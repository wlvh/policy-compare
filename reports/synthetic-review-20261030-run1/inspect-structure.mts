// Read the saved Docs through the unmodified product's structure function.
// Diagnostic only: no expected answers are passed to the product.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {structure} from '../../packages/compare-core/structure.ts';
import {aviationProfile} from '../../profiles/aviation.ts';
const raw=resolve(process.argv[2]);
const records=[];
for(const caseId of ['P10','P11']) for(const engine of ['pdfjs','mupdf']) for(const side of ['left','right']){
  const doc=JSON.parse(readFileSync(join(raw,caseId,engine,`${side}.doc.json`),'utf8'));
  const units=structure(doc,aviationProfile).map(u=>({
    id:u.id,role:u.role,rawText:u.rawText,path:u.path,rowCells:u.rowCells??null,
    structureAmbiguous:u.structureAmbiguous??false,
    sources:u.refs.filter(Boolean).map(r=>({charId:r!.char.id,page:r!.page.pageIndex+1,origin:r!.char.origin,text:r!.char.text}))
  }));
  records.push({case:caseId,engine,side,units});
}
writeFileSync(new URL('structure-diagnostic.json',import.meta.url),JSON.stringify(records,null,2)+'\n');
