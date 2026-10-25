import { VERSION, digest, type CompareResult, type Difference, type DocInput, type SourceLocation } from '../contracts/index';
import { aviationProfile, type Profile } from '../../profiles/aviation';
import { structure, type Unit } from './structure';
import { normalize, sourceLocations, tokenize, lcsLength } from './text';
import { monotone,jointAlign } from './alignment';
export { structure } from './structure';
export type Budget = Profile['budget'];
type Pair = {a:Unit;b:Unit;method:string;score:number|null};
const locations=(u:Unit|undefined,side:'left'|'right')=>u?sourceLocations(u.refs,side,u.id):[];

function aggregate(units:Unit[],id:string,ambiguous=false):Unit {
  const refs=units.flatMap((u,i)=>i?[null,...u.refs]:u.refs);
  return {...units[0],...normalize(units.map(u=>u.rawText).join(' '),refs),id,identity:ambiguous?null:units[0].identity,path:{...units[0].path,confidence:ambiguous?'unresolved':units[0].path.confidence,rowKey:ambiguous?null:units[0].path.rowKey,entity:ambiguous?null:units[0].path.entity}};
}
function tablePairs(left:Unit[],right:Unit[],pairs:Pair[],usedL:Set<Unit>,usedR:Set<Unit>,result:CompareResult){
  const rows=(us:Unit[])=>{const m=new Map<string,Unit[]>();for(const u of us.filter(u=>u.role==='cell')){const v=m.get(u.tableRow!)??[];v.push(u);m.set(u.tableRow!,v);}return [...m.values()];};
  const a=rows(left),b=rows(right);const doneA=new Set<Unit[]>(),doneB=new Set<Unit[]>();
  const unique=(rs:Unit[][],key:'primary'|'secondary',v:string|undefined)=>v?rs.filter(r=>r[0][key]===v):[];
  for(const row of a){const p=unique(b,'primary',row[0].primary),s=unique(b,'secondary',row[0].secondary);
    const ownP=unique(a,'primary',row[0].primary),ownS=unique(a,'secondary',row[0].secondary);
    if(p.length===1&&s.length===1&&p[0]!==s[0])continue;
    const other=ownP.length===1&&p.length===1?p[0]:ownS.length===1&&s.length===1?s[0]:undefined;
    if(!other||doneB.has(other))continue;doneA.add(row);doneB.add(other);
    for(const u of row){const v=other.find(x=>x.path.field===u.path.field);if(v){u.path.confidence=v.path.confidence='reliable';pairs.push({a:u,b:v,method:'declared-table-key',score:null});usedL.add(u);usedR.add(v);}}
  }
  const ra=a.filter(r=>!doneA.has(r)),rb=b.filter(r=>!doneB.has(r));
  const duplicate=ra.some(r=>unique(a,'primary',r[0].primary).length>1||unique(a,'secondary',r[0].secondary).length>1)||rb.some(r=>unique(b,'primary',r[0].primary).length>1||unique(b,'secondary',r[0].secondary).length>1);
  if(ra.length&&rb.length){
    const fields=[...new Set(ra.flat().map(u=>u.path.field))];
    for(const field of fields){const aa=ra.flat().filter(u=>u.path.field===field),bb=rb.flat().filter(u=>u.path.field===field);if(!aa.length||!bb.length)continue;
      const x=aggregate(aa,`ambiguous-left-${field}`,true),y=aggregate(bb,`ambiguous-right-${field}`,true);
      pairs.push({a:x,b:y,method:'unresolved-table-group',score:null});aa.forEach(u=>usedL.add(u));bb.forEach(u=>usedR.add(u));
      result.unresolved.push({reason:'ambiguous_identity',message:duplicate?'表格主键或次级键重复；金额变化仍展示，无法确定唯一实体':'表格主次键冲突或缺少可靠对应',left:locations(x,'left'),right:locations(y,'right'),defaultVisible:true});
    }
  }
  // Unmatched rows with unambiguous keys are additions/removals, not fuzzy text candidates.
}
function datePeriod(text:string):[number,number]|null{
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const matches=[...text.matchAll(/(\d{1,2}) ([A-Za-z]+) (\d{4})/g)];if(matches.length!==2)return null;
  const dates=matches.map(m=>{const mo=months.indexOf(m[2]),d=+m[1],y=+m[3];const t=Date.UTC(y,mo,d);const out=new Date(t);return mo>=0&&out.getUTCDate()===d&&out.getUTCMonth()===mo?t:NaN;});
  return dates.every(Number.isFinite)&&dates[1]>=dates[0]?dates as [number,number]:null;
}
function category(a:Unit|undefined,b:Unit|undefined):Difference['category']{
  const u=b??a!;if(['label','page_heading','footer','heading','table_header','whitespace'].includes(u.role))return 'Cosmetic';
  if(a&&b&&a.matchText===b.matchText)return 'Cosmetic';
  if(a&&b&&u.path.field==='policy_period'){
    const old=datePeriod(a.rawText),now=datePeriod(b.rawText);
    if(old&&now){const oneDay=86400000;const annual=(v:[number,number])=>{const s=new Date(v[0]),e=new Date(v[1]+oneDay);return e.getUTCFullYear()===s.getUTCFullYear()+1&&e.getUTCMonth()===s.getUTCMonth()&&e.getUTCDate()===s.getUTCDate();};
      if(annual(old)&&annual(now)&&now[0]===old[1]+oneDay)return 'RollForward';}
    return 'Material';
  }
  if(u.path.confidence==='unresolved')return 'Review';
  if(u.path.field||/\b(?:not|cover|exclud|loss|liability|and|or)\b|\d|[±☑☐]/i.test((a?.rawText??'')+(b?.rawText??'')))return 'Material';
  return 'Review';
}
function textOps(a:Unit|undefined,b:Unit|undefined,budget:Budget,result:CompareResult):Difference['textOps']{
  const aa=Array.from(a?.rawText??''),bb=Array.from(b?.rawText??'');
  let prefix=0;while(prefix<aa.length&&prefix<bb.length&&aa[prefix]===bb[prefix])prefix++;
  let suffix=0;while(suffix<aa.length-prefix&&suffix<bb.length-prefix&&aa[aa.length-1-suffix]===bb[bb.length-1-suffix])suffix++;
  const x=aa.slice(prefix,aa.length-suffix),y=bb.slice(prefix,bb.length-suffix);
  const ops:{kind:'equal'|'delete'|'insert';i:number;j:number;text:string}[]=[];
  for(let i=0;i<prefix;i++)ops.push({kind:'equal',i,j:i,text:aa[i]});
  if(x.length*y.length>budget.diffProducts){result.unresolved.push({reason:'word_diff_budget',message:'词级差异工作量超过上限；保留双方完整原文，定位降级',left:locations(a,'left'),right:locations(b,'right'),defaultVisible:true});for(let i=0;i<x.length;i++)ops.push({kind:'delete',i:prefix+i,j:prefix,text:x[i]});for(let j=0;j<y.length;j++)ops.push({kind:'insert',i:prefix,j:prefix+j,text:y[j]});}
  else {
    const width=y.length+1,dp=new Uint32Array((x.length+1)*width);
    for(let i=x.length-1;i>=0;i--)for(let j=y.length-1;j>=0;j--)dp[i*width+j]=x[i]===y[j]?1+dp[(i+1)*width+j+1]:Math.max(dp[(i+1)*width+j],dp[i*width+j+1]);
    let i=0,j=0;while(i<x.length||j<y.length){if(i<x.length&&j<y.length&&x[i]===y[j]){ops.push({kind:'equal',i:prefix+i,j:prefix+j,text:x[i]});i++;j++;}else if(i<x.length&&(j===y.length||dp[(i+1)*width+j]>=dp[i*width+j+1])){ops.push({kind:'delete',i:prefix+i++,j:prefix+j,text:x[i-1]});}else{ops.push({kind:'insert',i:prefix+i,j:prefix+j++,text:y[j-1]});}}
  }
  for(let k=suffix;k>0;k--)ops.push({kind:'equal',i:aa.length-k,j:bb.length-k,text:aa[aa.length-k]});
  const groups:typeof ops[]=[];for(const op of ops){if(groups.at(-1)?.[0].kind===op.kind)groups.at(-1)!.push(op);else groups.push([op]);}
  return groups.map(g=>({kind:g[0].kind,text:g.map(o=>o.text).join(''),left:a&&g[0].kind!=='insert'?sourceLocations(g.map(o=>a.refs[o.i]),'left',a.id):[],right:b&&g[0].kind!=='delete'?sourceLocations(g.map(o=>b.refs[o.j]),'right',b.id):[]}));
}
export function compare(left:DocInput,right:DocInput,profile:Profile=aviationProfile,budget:Budget=profile.budget,phase?:(name:string)=>void):CompareResult {
  phase?.('snapshot');
  const result:CompareResult={schemaVersion:VERSION,engineVersion:VERSION,tokenizerVersion:'unicode-tokens/1',profileVersion:profile.version,documentHashes:[left.contentHash,right.contentHash],extractionSnapshotHashes:[digest(left),digest(right)],configDigest:digest({profile,budget}),scope:'extracted_text',status:'complete_for_scope',differences:[],coverage:[],unresolved:[],alignment:[],stats:{leftScalars:left.pages.reduce((n,p)=>n+(p.chars.at(-1)?.rawRange[1]??0),0),rightScalars:right.pages.reduce((n,p)=>n+(p.chars.at(-1)?.rawRange[1]??0),0),candidates:0,tokenProducts:0,differenceCount:0,occurrenceCount:0},diagnostics:[]};
  for(const [doc,side] of [[left,'left'],[right,'right']] as const)for(const p of doc.pages)result.coverage.push(...p.issues.map(i=>({...i,side})));
  phase?.('structure');
  const la=structure(left,profile),rb=structure(right,profile),pairs:Pair[]=[],usedL=new Set<Unit>(),usedR=new Set<Unit>();
  phase?.('matching');
  const bind=(a:Unit,b:Unit,method:string,score:number|null=null)=>{pairs.push({a,b,method,score});usedL.add(a);usedR.add(b);};
  tablePairs(la,rb,pairs,usedL,usedR,result);
  const map=(us:Unit[],used:Set<Unit>,key:(u:Unit)=>string|null)=>{const m=new Map<string,Unit[]>();for(const u of us){if(used.has(u))continue;const k=key(u);if(k===null)continue;const list=m.get(k)??[];list.push(u);m.set(k,list);}return m;};
  const il=map(la,usedL,u=>u.identity),ir=map(rb,usedR,u=>u.identity);
  for(const [key,as] of il){const bs=ir.get(key);if(!bs)continue;if(as.length===1&&bs.length===1)bind(as[0],bs[0],'reliable-field-identity');else if(as.every(u=>u.path.section==='repeated_header'||u.role==='table_header')&&bs.every(u=>u.path.section==='repeated_header'||u.role==='table_header')){
    // Repeated headers retain all locations; differing content is never discarded.
    const a=aggregate(as,'repeat-left-'+key),b=aggregate(bs,'repeat-right-'+key);
    if(new Set(as.map(u=>u.rawText)).size===1&&new Set(bs.map(u=>u.rawText)).size===1){a.rawText=as[0].rawText;a.refs=as[0].refs;b.rawText=bs[0].rawText;b.refs=bs[0].refs;Object.assign(a,normalize(a.rawText,a.refs));Object.assign(b,normalize(b.rawText,b.refs));}
    bind(a,b,'repeated-header');as.forEach(u=>usedL.add(u));bs.forEach(u=>usedR.add(u));
    (a as Unit&{repeats?:Unit[]}).repeats=as;(b as Unit&{repeats?:Unit[]}).repeats=bs;
  }}
  const eligible=(u:Unit)=>!u.identity&&u.role!=='cell';
  const rawKey=(u:Unit)=>eligible(u)?`${u.role}/${u.rawText}`:null;
  const el=map(la,usedL,rawKey),er=map(rb,usedR,rawKey);
  for(const [key,as] of el){const bs=er.get(key);if(!bs)continue;
    if(as.length===1&&bs.length===1)bind(as[0],bs[0],'unique-exact');
    else if(as.every(u=>['page_heading','footer','heading'].includes(u.role))){const a=aggregate(as,'repeat-left-'+as[0].id),b=aggregate(bs,'repeat-right-'+bs[0].id);a.rawText=b.rawText=as[0].rawText;bind(a,b,'repeat-role');as.forEach(u=>usedL.add(u));bs.forEach(u=>usedR.add(u));}
    else {for(const a of as){const candidates=bs.filter(b=>!usedR.has(b)&&a.path.section===b.path.section&&a.title===b.title);if(candidates.length===1&&as.filter(x=>x.path.section===a.path.section&&x.title===a.title).length===1)bind(a,candidates[0],'exact-context');}}
  }
  // Adjacent split/merge candidates are evaluated before fuzzy 1:1 locks.
  for(const [source,target,su,tu,reverse] of [[la,rb,usedL,usedR,false],[rb,la,usedR,usedL,true]] as const){
    for(const a of source.filter(u=>!su.has(u)&&u.role==='body'))for(let j=0;j<target.length-1;j++){const b=target[j],c=target[j+1];if(tu.has(b)||tu.has(c)||b.role!=='body'||c.role!=='body'||b.path.section!==c.path.section||b.title!==c.title)continue;const merged=aggregate([b,c],b.id+'+'+c.id);if(a.rawText===merged.rawText){reverse?bind(merged,a,'adjacent-merge'):bind(a,merged,'adjacent-split');su.add(a);tu.add(b);tu.add(c);break;}}
  }
  const candidates:{a:Unit;b:Unit;score:number}[]=[];let exhausted=false;
  const tokenCache=new Map<Unit,string[]>(),countCache=new Map<Unit,Map<string,number>>();
  const tokens=(u:Unit)=>{let t=tokenCache.get(u);if(!t){t=tokenize(u.matchText);tokenCache.set(u,t);}return t;};
  const counts=(u:Unit)=>{let c=countCache.get(u);if(!c){c=new Map();for(const t of tokens(u))c.set(t,(c.get(t)??0)+1);countCache.set(u,c);}return c;};
  const score=(a:Unit,b:Unit,threshold:number):number|null=>{
    const at=tokens(a),bt=tokens(b);if(!at.length||!bt.length)return null;
    if(2*Math.min(at.length,bt.length)/(at.length+bt.length)<threshold)return null;
    let intersection=0;for(const [token,n] of counts(a))intersection+=Math.min(n,counts(b).get(token)??0);
    if(2*intersection/(at.length+bt.length)<threshold)return null;
    if(result.stats.candidates>=budget.candidates||result.stats.tokenProducts+at.length*bt.length>budget.tokenProducts){exhausted=true;return null;}
    result.stats.candidates++;result.stats.tokenProducts+=at.length*bt.length;
    const value=2*lcsLength(at,bt)/(at.length+bt.length);return value>=threshold?value:null;
  };
  const anchors=monotone(pairs.filter(p=>la.includes(p.a)&&rb.includes(p.b)&&p.a.role!=='cell'),p=>p.a.order,p=>p.b.order,p=>p.method==='reliable-field-identity'?4:2);
  const boundaries=[{a:{order:-1},b:{order:-1}},...anchors,{a:{order:la.length},b:{order:rb.length}}];
  for(let k=1;k<boundaries.length&&!exhausted;k++){
    const lo=boundaries[k-1],hi=boundaries[k];
    const as=la.filter(u=>!usedL.has(u)&&u.role==='body'&&u.order>lo.a.order&&u.order<hi.a.order),bs=rb.filter(u=>!usedR.has(u)&&u.role==='body'&&u.order>lo.b.order&&u.order<hi.b.order);
    if(!as.length||!bs.length||as.length*bs.length>4096)continue;
    const joined=new Map<string,Unit>();const get=(us:Unit[])=>{if(us.length===1)return us[0];const id=us.map(u=>u.refs.find(Boolean)?.char.id??u.id).join('+');let u=joined.get(id);if(!u){u=aggregate(us,id);joined.set(id,u);}return u;};
    const matches=jointAlign(as,bs,(aa,bb)=>{const a=get(aa),b=get(bb);if(a.title!==b.title||a.path.section!==b.path.section)return null;if(as.filter(u=>u.rawText===a.rawText&&u.title===a.title).length>1||bs.filter(u=>u.rawText===b.rawText&&u.title===b.title).length>1)return null;return score(a,b,profile.thresholds.local);},(a,b)=>a.order+1===b.order&&a.title===b.title&&a.path.section===b.path.section);
    if(!exhausted)for(const m of matches){bind(get(m.a),get(m.b),'joint-local-alignment',m.score);m.a.forEach(u=>usedL.add(u));m.b.forEach(u=>usedR.add(u));}
  }
  for(const a of la.filter(u=>!usedL.has(u)&&u.role!=='cell')){
    for(const b of rb.filter(u=>!usedR.has(u)&&u.role!=='cell')){
      if(a.role!==b.role||a.identity!==b.identity)continue;
      const sameContext=a.path.section===b.path.section&&a.title===b.title;
      const at=tokens(a),bt=tokens(b),threshold=sameContext?profile.thresholds.local:profile.thresholds.global;
      if(!at.length||!bt.length||(!sameContext&&Math.min(at.length,bt.length)<profile.thresholds.globalMinTokens))continue;
      const value=score(a,b,threshold);if(exhausted)break;if(value!==null)candidates.push({a,b,score:value});
    }if(exhausted)break;
  }
  candidates.sort((x,y)=>y.score-x.score||x.a.order-y.a.order||x.b.order-y.b.order);
  for(const c of candidates){if(usedL.has(c.a)||usedR.has(c.b))continue;const tied=candidates.some(o=>o!==c&&o.score===c.score&&((o.a===c.a&&!usedR.has(o.b))||(o.b===c.b&&!usedL.has(o.a))));if(!tied)bind(c.a,c.b,'contextual-token-lcs',c.score);}
  const unmatchedL=la.filter(u=>!usedL.has(u)),unmatchedR=rb.filter(u=>!usedR.has(u));
  const ambiguous=unmatchedL.some(a=>unmatchedR.some(b=>a.role==='body'&&b.role==='body'&&a.matchText===b.matchText));
  if(exhausted||ambiguous){result.unresolved.push({reason:exhausted?'budget':'ambiguous_match',message:exhausted?'对应工作量预算耗尽；以下范围未完成，不能宣称无变化':'重复原文的身份不唯一；保留双方证据待复核',left:unmatchedL.flatMap(u=>locations(u,'left')),right:unmatchedR.flatMap(u=>locations(u,'right')),defaultVisible:true});}
  phase?.('diff');
  const bodyPairs=pairs.filter(p=>p.a.role==='body'&&p.a.path.section===p.b.path.section);
  const stable=new Set(monotone(bodyPairs,p=>p.a.order,p=>p.b.order,p=>Math.min(p.a.rawText.length,p.b.rawText.length)));
  function emit(a:Unit|undefined,b:Unit|undefined,method:string,score:number|null,moved=false){
    if(a&&b&&a.rawText===b.rawText&&!moved)return;
    const kind:Difference['kind']=moved?'Moved':a&&b?'Replaced':a?'Removed':'Added';
    const d:Difference={id:'',kind,category:moved&&a?.rawText===b?.rawText?'Review':category(a,b),structurePath:(a??b!).path,left:locations(a,'left'),right:locations(b,'right'),oldText:a?.rawText??'',newText:b?.rawText??'',textOps:textOps(a,b,budget,result),hasTextChange:a?.rawText!==b?.rawText,defaultVisible:true,matchEvidence:{method,score,details:[method==='reliable-field-identity'?'主体与字段身份一致':method]},reviewReasons:(a??b!).path.confidence==='unresolved'?['无法确定唯一表格行身份']:[],occurrences:[]};
    const ar=(a as (Unit&{repeats?:Unit[]})|undefined)?.repeats,br=(b as (Unit&{repeats?:Unit[]})|undefined)?.repeats;
    if(ar||br){for(let i=0;i<Math.max(ar?.length??0,br?.length??0);i++)d.occurrences.push({left:locations(ar?.[i],'left'),right:locations(br?.[i],'right')});}
    d.id='d-'+digest({kind,old:d.oldText,new:d.newText,left:d.left.map(x=>x.charIds),right:d.right.map(x=>x.charIds)}).slice(0,20);result.differences.push(d);
  }
  for(const p of pairs){const moved=p.a.role==='body'&&(p.a.path.section!==p.b.path.section||!stable.has(p));emit(p.a,p.b,p.method,p.score,moved);}
  if(!exhausted&&!ambiguous){for(const u of unmatchedL)emit(u,undefined,'unmatched',null);for(const u of unmatchedR)emit(undefined,u,'unmatched',null);}
  const position=(u:Unit)=>{const r=u.refs.find(Boolean)!;return r.page.pageIndex*1_000_000+r.char.origin[1];};
  const anchorPairs=monotone(pairs.filter(p=>p.a.refs[0]&&p.b.refs[0]&&p.a.path.confidence!=='unresolved'),p=>position(p.a),p=>position(p.b),p=>p.method==='reliable-field-identity'?4:1);
  for(const p of anchorPairs){const a=p.a.refs.find(Boolean)!,b=p.b.refs.find(Boolean)!;result.alignment.push({leftPage:a.page.pageIndex,leftY:a.char.origin[1],rightPage:b.page.pageIndex,rightY:b.char.origin[1]});}
  result.differences.sort((a,b)=>({Material:0,Review:1,RollForward:2,Cosmetic:3}[a.category]-{Material:0,Review:1,RollForward:2,Cosmetic:3}[b.category])||(a.id<b.id?-1:1));
  result.stats.differenceCount=result.differences.length;result.stats.occurrenceCount=result.differences.reduce((n,d)=>n+Math.max(1,d.occurrences.length),0);
  if(result.coverage.length||result.unresolved.length)result.status='partial';phase?.('done');return result;
}
export function search(doc:DocInput,query:string,side:'left'|'right',profile=aviationProfile):SourceLocation[][] {
  if(!query)return [];const hits:SourceLocation[][]=[];const needle=Array.from(query.normalize('NFKC'));
  for(const u of structure(doc,profile)){const hay=Array.from(u.matchText);for(let i=0;i<=hay.length-needle.length;i++)if(needle.every((c,j)=>c===hay[i+j]))hits.push(sourceLocations(u.mapping.slice(i,i+needle.length).flatMap(indexes=>indexes.map(n=>u.refs[n])),side,u.id));}
  return hits;
}
