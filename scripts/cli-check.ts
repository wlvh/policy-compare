import {spawn} from 'node:child_process';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const records:any[]=[];mkdirSync('tmp',{recursive:true});
async function run(engine:string,name:string,left:string,right:string,expected:number,cancel=false){
 const out=`tmp/cli-${engine}-${name}.json`,args=['--import','tsx','packages/cli/main.ts','--engine',engine,'--left',left,'--right',right,'--out',out];
 const child=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',x=>{log+=x});child.stderr.on('data',x=>{log+=x});const timer=cancel?setTimeout(()=>child.kill('SIGINT'),200):undefined;
 const exit=await new Promise<number>(resolve=>child.on('exit',(code,signal)=>resolve(code??(signal==='SIGINT'?130:3))));if(timer)clearTimeout(timer);
 let valid=true;if(expected===0||expected===2){try{const result=JSON.parse(readFileSync(out,'utf8'));valid=result.scope==='extracted_text'&&result.extractors.every((x:any)=>x.name===(engine==='pdfjs'?'PDF.js':'MuPDF.js'));}catch{valid=false;}}
 records.push({engine,name,status:exit===expected&&valid?'PASS':'FAIL',exit,expected,log});
}
for(const engine of ['pdfjs','mupdf']){
 await run(engine,'complete','validation/dataset/cases/R02_amount/before.pdf','validation/dataset/cases/R02_amount/after.pdf',0);
 await run(engine,'partial','validation/dataset/cases/R27_mixed_scan_page/before.pdf','validation/dataset/cases/R27_mixed_scan_page/after.pdf',2);
 await run(engine,'failed','tests/fixtures/mechanisms/corrupt.pdf','tests/fixtures/mechanisms/unicode.pdf',3);
 await run(engine,'cancelled','bench/generated/template_change-capacity/before.pdf','bench/generated/template_change-capacity/after.pdf',130,true);
}
const report={status:records.every(r=>r.status==='PASS')?'PASS':'FAIL',records};writeFileSync('reports/cli-checks.json',JSON.stringify(report,null,2)+'\n');console.log(report);process.exitCode=report.status==='PASS'?0:1;
