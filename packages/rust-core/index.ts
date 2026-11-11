import {hashBytes,ResultSchemaV2,type DocInput,type Page,type CompareResultV2,type SourceLocation} from '../contracts/index';
import info from './generated/core-info.json' with {type:'json'};
import {aviationProfile,type Profile} from '../../profiles/aviation';
export const coreArtifact = info;
const phases=['snapshot','structure','matching','diff','done'];
type Exports={memory:WebAssembly.Memory;input_ptr(n:number):number;call():void;output_ptr():number;output_len():number;clear_output():void};
let compiled:Promise<WebAssembly.Module>|undefined;
export function loadCore():Promise<WebAssembly.Module>{
 return compiled??=(async()=>{
  const url=new URL('./generated/core.wasm',import.meta.url);
  let bytes:Uint8Array;
  if(url.protocol==='file:'){
   const fsModule='node:fs/promises'; const fs=await import(/* @vite-ignore */ fsModule);bytes=await fs.readFile(url);
  }else{
   const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw new Error('Failed to load Rust WASM');bytes=new Uint8Array(await response.arrayBuffer());
  }
  if(hashBytes(bytes)!==info.sha256)throw new Error('Rust WASM artifact hash mismatch');
  return WebAssembly.compile(bytes as Uint8Array<ArrayBuffer>);
 })().catch(e=>{compiled=undefined;throw e});
}
export class CoreSession{
 private exports:Exports;private disposed=false;
 inputBytes=0;inputCalls=0;maxInputBytes=0;
 constructor(module:WebAssembly.Module,profile:Profile=aviationProfile,budget=profile.budget,phase?:(name:string)=>void,checkpoint?:()=>void){
  this.exports=new WebAssembly.Instance(module,{host:{phase:(n:number)=>phase?.(phases[n]),check:()=>checkpoint?.()}}).exports as unknown as Exports;
  const version=this.invoke('version');if(version.abi!==info.abi||version.coreVersion!==info.coreVersion||version.result!=='policy-compare-result/2')throw new Error('Incompatible Rust core version or format');
  this.invoke('reset',{profile,budget});
 }
 private invoke(op:string,args:Record<string,unknown>={}):any{
  if(this.disposed)throw new Error('Core session disposed');
  const bytes=new TextEncoder().encode(JSON.stringify({op,...args}));
  this.inputBytes+=bytes.length;this.inputCalls++;this.maxInputBytes=Math.max(this.maxInputBytes,bytes.length);
  const ptr=this.exports.input_ptr(bytes.length);new Uint8Array(this.exports.memory.buffer,ptr,bytes.length).set(bytes);
  try{this.exports.call();}catch(error){this.disposed=true;throw error;}
  try{const out=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(this.exports.memory.buffer,this.exports.output_ptr(),this.exports.output_len())));if(out.error)throw new Error(out.error);return out.ok;}finally{this.exports.clear_output();}
 }
 meta(side:number,meta:Omit<DocInput,'pages'>){this.invoke('meta',{side,meta})}
 page(side:number,page:Page){this.invoke('page',{side,page})}
 done(side:number){this.invoke('done',{side})}
 document(side:number,doc:DocInput){const {pages,...meta}=doc;this.meta(side,meta);for(const page of pages)this.page(side,page);this.done(side);}
 compare():CompareResultV2{return ResultSchemaV2.parse(this.invoke('compare'))}
 search(query:string,side='both'):SourceLocation[][]{return this.invoke('search',{query,side})}
 get memoryBytes(){return this.exports.memory.buffer.byteLength}
 dispose(){if(this.disposed)return;this.invoke('dispose');this.disposed=true;}
}
