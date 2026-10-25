import { compare,search } from '../../packages/compare-core/index';
import { parseDoc,type DocInput,type Page } from '../../packages/contracts/index';
import { aviationProfile } from '../../profiles/aviation';
let docs:[DocInput,DocInput];let taskId=0,generation=0;const partial:Partial<DocInput>[]=[{pages:[]},{pages:[]}];const done=[false,false];
onmessage=e=>{
  const m=e.data;if(m.type==='init'){
    taskId=m.taskId;generation=m.generation;const port:MessagePort=m.port;
    port.onmessage=e=>{const x=e.data;if(x.taskId!==taskId||x.generation!==generation)return;
      if(x.type==='meta')partial[x.side]={...x.meta,pages:[]};
      if(x.type==='page')(partial[x.side].pages as Page[]).push(x.page);
      if(x.type==='done'){done[x.side]=true;if(done.every(Boolean)){
        try{const validationStart=performance.now();docs=[parseDoc(partial[0]),parseDoc(partial[1])];partial.length=0;const marks:Record<string,number>={};const result=compare(...docs,aviationProfile,aviationProfile.budget,name=>{marks[name]=performance.now();});
          postMessage({type:'result',taskId,generation,result,timings:{validation:marks.snapshot-validationStart,snapshot:marks.structure-marks.snapshot,structure:marks.matching-marks.structure,matching:marks.diff-marks.matching,diff:marks.done-marks.diff,transferLastPage:Math.max(0,performance.timeOrigin+validationStart-x.sentAt)}});
        }catch{postMessage({type:'error',taskId,generation,message:'比较失败：输入契约或核心计算错误'});}
      }}
    };port.start();
  }
  if(m.type==='search'&&m.taskId===taskId&&docs){const hits=[...(m.side!=='right'?search(docs[0],m.query,'left'):[]),...(m.side!=='left'?search(docs[1],m.query,'right'):[])];postMessage({type:'search',taskId,generation,requestId:m.requestId,hits});}
};
