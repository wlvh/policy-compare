import { readFileSync } from 'node:fs';
import { extractPdf } from '../packages/pdf-adapter/index';
import { structure,compare } from '../packages/compare-core/index';
import { aviationProfile } from '../profiles/aviation';
const dir=process.argv[2]??'validation/dataset/cases/R02_amount';
const left=await extractPdf(readFileSync(dir+'/before.pdf')),right=await extractPdf(readFileSync(dir+'/after.pdf'));
console.log(JSON.stringify({units:structure(left,aviationProfile).map(u=>({role:u.role,raw:u.rawText,path:u.path,identity:u.identity,title:u.title})),result:compare(left,right)},null,2));
