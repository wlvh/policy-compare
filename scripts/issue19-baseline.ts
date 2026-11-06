import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadEngine} from '../packages/pdf-adapter/node';
import {compare} from '../packages/legacy-core/index';
import {aviationProfile} from '../profiles/aviation';
const data:any[]=[];mkdirSync('validation/migration/issue-19',{recursive:true});
for(const engine of ['mupdf','pdfjs'] as const){const {extractPdf}=await loadEngine(engine);for(const meta of JSON.parse(readFileSync('validation/dataset/manifest.json','utf8')).cases){const docs=await Promise.all(['before','after'].map(s=>extractPdf(readFileSync(`validation/dataset/cases/${meta.case_id}/${s}.pdf`))));const start=performance.now();const stages:any={};const result=compare(docs[0],docs[1],aviationProfile,aviationProfile.budget,n=>stages[n]=performance.now()-start);const file=`validation/migration/issue-19/${engine}-${meta.case_id}.json.gz`;const raw=JSON.stringify({docs,result});writeFileSync(file,gzipSync(raw));data.push({engine,case:meta.case_id,file,coreMs:performance.now()-start,stages,status:result.status,inputAndLegacyResultSha256:createHash('sha256').update(raw).digest('hex')});}}
writeFileSync('reports/issue-19/frozen-baseline.json',JSON.stringify({revision:'6a5f1ef7e3f6997e58a1bf303774419c16cb994b',records:data},null,2)+'\n');
