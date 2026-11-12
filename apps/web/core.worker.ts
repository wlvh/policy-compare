import {CoreSession,loadCore,coreArtifact} from '../../packages/rust-core/index';
import {coreOptions} from '../../packages/compare-core/options';
let session:CoreSession|undefined;
let taskId=0,generation=0,initialized=false;
let port:MessagePort|undefined;
const done=[false,false];
let transferQueueMax=0,transferQueueSum=0,inputAdmission=0;
onmessage=(e)=>{
 const m=e.data;
 if(m.type==='init'){
  if(initialized)return;initialized=true;taskId=m.taskId;generation=m.generation;
  const abort=m.abortBuffer?new Int32Array(m.abortBuffer):null;
  const checkpoint=()=>{if(abort&&Atomics.load(abort,0))throw new Error('CANCELLED')};
  const fail=()=>{port?.close();session?.dispose();session=undefined;postMessage({type:'error',taskId,generation,message:'Rust core initialization, input validation, or comparison failed. Please start again.'});};
  const marks:Record<string,number>={};
  const loading=performance.now();
  // Handler is installed synchronously. PDF transmission starts only after core-ready.
  port=m.port;port!.onmessage=e=>{
   const x=e.data;if(x.taskId!==taskId||x.generation!==generation)return;
   try{
    if(!session)throw new Error('Core not ready');
    if(x.type==='meta'){const start=performance.now();session.meta(x.side,x.meta);inputAdmission+=performance.now()-start;}
    if(x.type==='page'){
     const lag=Math.max(0,performance.timeOrigin+performance.now()-x.sentAt);transferQueueMax=Math.max(transferQueueMax,lag);transferQueueSum+=lag;
     const admissionStart=performance.now();session.page(x.side,x.page);inputAdmission+=performance.now()-admissionStart;
    }
    if(x.type==='done'){
     const admissionStart=performance.now();session.done(x.side);inputAdmission+=performance.now()-admissionStart;done[x.side]=true;
     if(done.every(Boolean)){
      const validationStart=performance.now();const result=session.compare();port?.close();
      postMessage({type:'result',taskId,generation,result,timings:{inputAdmission,coreInputBytes:session.inputBytes,coreInputCalls:session.inputCalls,coreMaxInputBytes:session.maxInputBytes,transferQueueMax,transferQueueSum,validation:marks.snapshot-validationStart,snapshot:marks.structure-marks.snapshot,structure:marks.matching-marks.structure,matching:marks.diff-marks.matching,diff:marks.done-marks.diff,transferLastPage:Math.max(0,performance.timeOrigin+validationStart-x.sentAt),wasmMemoryBytes:session.memoryBytes,coreArtifact}});
     }
    }
   }catch{fail()}
  };port!.start();
  void loadCore().then(module=>{
   checkpoint();session=new CoreSession(module,coreOptions,coreOptions.budget,name=>{checkpoint();marks[name]=performance.now();postMessage({type:'phase',taskId,generation,name});},checkpoint);
   postMessage({type:'core-ready',taskId,generation,coreArtifact,initialization:performance.now()-loading});
  }).catch(fail);
 }
 if(m.type==='search'&&m.taskId===taskId&&m.generation===generation&&session){
  try{postMessage({type:'search',taskId,generation,requestId:m.requestId,hits:session.search(m.query,m.side)});}catch{postMessage({type:'error',taskId,generation,message:'Source text search failed. Please start again.'});}
 }
};
