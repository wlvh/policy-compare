// Production facade. The retired TypeScript algorithm is isolated in legacy-core
// for migration comparison only; there is no runtime fallback.
import {CoreSession,loadCore,coreArtifact} from '../rust-core/index';
import {coreOptions,type CoreOptions} from './options';
import type {DocInput,CompareResultV2,SourceLocation} from '../contracts/index';
export type Budget=CoreOptions['budget'];
export {coreArtifact};
const module=await loadCore();
export function compare(left:DocInput,right:DocInput,profile:CoreOptions=coreOptions,budget:Budget=profile.budget,phase?:(name:string)=>void,checkpoint?:()=>void):CompareResultV2{
 const session=new CoreSession(module,profile,budget,phase,checkpoint);
 try{session.document(0,left);session.document(1,right);return session.compare();}finally{session.dispose();}
}
export function search(doc:DocInput,query:string,side:'left'|'right',profile=coreOptions):SourceLocation[][]{
 const session=new CoreSession(module,profile);try{session.document(side==='left'?0:1,doc);return session.search(query,side);}finally{session.dispose();}
}
