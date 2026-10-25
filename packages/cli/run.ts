import { readFileSync,writeFileSync,statSync } from 'node:fs';
import { extractPdf,LIMITS } from '../pdf-adapter/index';
import { compare } from '../compare-core/index';
import { canonical,parseDoc } from '../contracts/index';
const args=process.argv.slice(2),get=(key:string)=>args[args.indexOf(key)+1];
try{
  if(!args.includes('--left')||!args.includes('--right')||!args.includes('--out'))throw new Error('需要 --left、--right 和 --out');
  const l=get('--left'),r=get('--right'),out=get('--out');
  if([l,r].some(p=>statSync(p).size>LIMITS.bytes))throw new Error('文件超过 30 MiB');
  const left=parseDoc(await extractPdf(readFileSync(l),process.env.POLICY_LEFT_PASSWORD)),right=parseDoc(await extractPdf(readFileSync(r),process.env.POLICY_RIGHT_PASSWORD));
  const result=compare(left,right);writeFileSync(out,canonical(result)+'\n');
  console.log(JSON.stringify({status:result.status,differences:result.stats.differenceCount,coverage:result.coverage.length}));
  process.exitCode=result.status==='complete_for_scope'?0:2;
}catch(e){console.error('failed：'+(e instanceof Error?e.message:'比较失败'));process.exitCode=3;}
