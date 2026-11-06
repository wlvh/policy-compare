import {gunzipSync} from 'node:zlib';
import {readFileSync,writeFileSync} from 'node:fs';
import {compare,coreArtifact} from '../packages/compare-core/index';
import {canonical} from '../packages/contracts/index';
const records=[];
function mismatch(a:any,b:any,path=''):string[]{if(canonical(a)===canonical(b))return [];if(!a||!b||typeof a!=='object'||typeof b!=='object')return [path];return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>mismatch(a[k]??null,b[k]??null,path+'/'+k));}
for(const meta of JSON.parse(readFileSync('reports/issue-19/frozen-baseline.json','utf8')).records){const {docs,result:old}=JSON.parse(gunzipSync(readFileSync(meta.file)).toString('utf8'));try{const start=performance.now();const current=compare(docs[0],docs[1]);const coreMs=performance.now()-start;const diff=mismatch({...old,coreVersion:current.coreVersion},current);records.push({...meta,legacyCoreMs:meta.coreMs,rustCoreMs:coreMs,status:diff.length?'FAIL':'PASS',mismatch:diff.slice(0,30)});if(diff.length)writeFileSync(`tmp/issue19-${meta.engine}-${meta.case}.rust.json`,JSON.stringify(current));}catch(e){records.push({...meta,status:'FAIL',error:String(e)});}}
const status=records.every(x=>x.status==='PASS')?'PASS':'FAIL';writeFileSync('reports/issue-19/parity.json',JSON.stringify({status,coreArtifact,allowedDifference:['coreVersion identifies Rust implementation'],records},null,2)+'\n');console.log(status,records.filter(x=>x.status==='FAIL'));process.exitCode=status==='PASS'?0:1;
