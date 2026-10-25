import { readFileSync,writeFileSync } from 'node:fs';
import { compare } from '../compare-core/index';
import { parseDoc,canonical } from '../contracts/index';
const [a,b,out]=process.argv.slice(2);
if(!a||!b||!out)throw new Error('开发专用：pnpm compare:doc left.doc.json right.doc.json out.json（不计 PDF 验收）');
const result=compare(parseDoc(JSON.parse(readFileSync(a,'utf8'))),parseDoc(JSON.parse(readFileSync(b,'utf8'))));writeFileSync(out,canonical(result)+'\n');process.exitCode=result.status==='complete_for_scope'?0:2;
