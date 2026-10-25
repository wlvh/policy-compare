import { PdfSession } from '../../packages/pdf-adapter/index';
let taskId=0,generation=0;let sessions:PdfSession[]=[];
onmessage=async e=>{
  const m=e.data;
  if(m.type==='open'){
    taskId=m.taskId;generation=m.generation;const port:MessagePort=m.port;const start=performance.now();
    try{
      for(let side=0;side<2;side++){
        const session=new PdfSession(new Uint8Array(m.bytes[side]),m.passwords[side]);sessions.push(session);
        port.postMessage({type:'meta',taskId,generation,side,meta:session.metadata()});
        await session.extract(page=>{port.postMessage({type:'page',taskId,generation,side,page});postMessage({type:'page',taskId,generation,side,pageIndex:page.pageIndex,width:page.width,height:page.height,pageCount:session.pageCount});},undefined,false);
        port.postMessage({type:'done',taskId,generation,side,sentAt:performance.timeOrigin+performance.now()});
      }
      postMessage({type:'extracted',taskId,generation,ms:performance.now()-start});
    }catch(error){sessions.forEach(s=>s.destroy());sessions=[];postMessage({type:'error',taskId,generation,message:error instanceof Error?error.message:'PDF 提取失败'});}
  }
  if(m.type==='render'&&m.taskId===taskId&&m.generation===generation){
    try{const bitmap=sessions[m.side].render(m.pageIndex,m.scale);(postMessage as (message:unknown,transfer:Transferable[])=>void)({type:'render',taskId,generation,side:m.side,pageIndex:m.pageIndex,requestId:m.requestId,...bitmap},[bitmap.png.buffer as ArrayBuffer]);}
    catch{postMessage({type:'error',taskId,generation,message:'页面渲染失败'});}
  }
};
// WASM initialization uses top-level await; do not accept document transfers
// until the handler is installed (early module-worker messages can be lost).
postMessage({type:'ready'});
