// Issue #24: expectations remain the source mutations and generator locations.
// No product category, business key or current result is used to make answers.
import {resolveLocation,type CompareResultV2,type DocInput} from '../../packages/contracts/index';
import {located,type Expected,type Layout} from './scorer';
const clean=(s:string)=>s.replace(/\s+/gu,' ').trim();
export function gradeGeneric(result:CompareResultV2,expected:Expected,layout:Layout,docs:[DocInput,DocInput],requireFineGeometry=false){
 const faults:string[]=[];
 if(requireFineGeometry)for(const d of result.differences)for(const o of d.textOps.filter(o=>o.kind!=='equal'))for(const loc of [...o.left,...o.right])if(loc.precision==='run'&&!loc.resolvedGeometry)faults.push('fine geometry was not resolved');
 for(const d of result.differences){
  for(const loc of [...d.left,...d.right,...d.textOps.flatMap(o=>[...o.left,...o.right]),...d.occurrences.flatMap(o=>[...o.left,...o.right])])if(!resolveLocation(loc,docs))faults.push(`invalid source ${d.id}`);
  for(const side of ['left','right'] as const){const ops=d.textOps.filter(o=>o.kind!==(side==='left'?'insert':'delete'));if(ops.map(o=>o.text).join('')!==(side==='left'?d.oldText:d.newText))faults.push(`ops do not reconstruct ${side} ${d.id}`);for(const o of ops)if(clean(o.text).replaceAll(' ','')!==clean(o[side].map(l=>l.text).join('')).replaceAll(' ',''))faults.push(`operation without its own source ${d.id}`);}
  if(!d.defaultVisible||d.hasTextChange!==(d.oldText!==d.newText))faults.push(`false display ${d.id}`);
 }
 // An expected edit cannot excuse a second edit on an unrelated source run.
 for(const d of result.differences)for(const o of d.textOps.filter(o=>o.kind!=='equal'&&o.text.trim()))for(const side of ['left','right'] as const){
  const s=side==='left'?'before':'after';const refs=[...Object.values(expected.evidence_locations).flatMap(e=>e[s]),...(expected.repeated_text_requirements??[]).flatMap(req=>req.occurrences[s])];
  for(const loc of o[side])if(!located([loc],refs,layout[s].pages,side))faults.push(`undeclared edit outside source events ${d.id}`);
 }
 // A legacy grouped card can be equivalent: each occurrence must independently
 // quote the card's full before/after text and carry its own source pair. This
 // does not let the first occurrence's operations prove another occurrence.
 const expanded=result.differences.flatMap(d=>[d,...d.occurrences.filter(o=>!o.context).map((o,i)=>({...d,id:`${d.id}/occurrence-${i}`,left:o.left,right:o.right,textOps:[],sourceComparisonWitness:d.oldText!==d.newText&&(!d.oldText||o.left.map(l=>l.text).join(' ').includes(d.oldText))&&(!d.newText||o.right.map(l=>l.text).join(' ').includes(d.newText))}))]);
 const events=expected.events.map(e=>{
  if(e.detection_requirement==='coverage_warning_required')return {id:e.event_id,pass:expected.coverage_requirements.every(req=>(req.side==='both'?['left','right']:[req.side]).every(side=>result.coverage.some(c=>c.side===side&&c.pageIndex===req.page_index&&c.reason===req.reason))),cards:[]};
  const refs=expected.evidence_locations[e.event_id];
  const candidates=expanded.filter(d=>d.defaultVisible&&(e.operation==='move'||d.hasTextChange));
  const sides=(['left','right'] as const).map((side,i)=>{
   const text=i?e.new:e.old;if(text===null||text==='')return {pass:true,cards:[] as string[]};
   const s=i?'after':'before';
   const cards=candidates.filter(d=>clean(i?d.newText:d.oldText).includes(clean(text))&&located(d[side],refs[s],layout[s].pages,side));
   // The source cited for this edit must itself contain a deletion/insertion,
   // except a declared move. An unchanged amount elsewhere cannot supply it.
   const changed=cards.filter(d=>e.operation==='move'||('sourceComparisonWitness' in d&&d.sourceComparisonWitness)||d.textOps.some(o=>o.kind!=='equal'&&(['left','right'] as const).some(os=>located(o[os],refs[os==='left'?'before':'after'],layout[os==='left'?'before':'after'].pages,os))));
   const relevant=refs[s].filter(ref=>{const run=layout[s].pages[ref.page_index]?.text_runs.find(r=>r.run_id===ref.run_id);return run&&(clean(run.text).includes(clean(text))||clean(text).includes(clean(run.text)));});
   const allRuns=relevant.every(ref=>changed.some(d=>located(d[side],[ref],layout[s].pages,side)));
   return {pass:changed.length>0&&allRuns,cards:changed.map(d=>d.id)};
  });
  const joint=candidates.filter(d=>sides.every(s=>s.cards.includes(d.id)));
  const allowSeparate=e.acceptable_kinds.includes('Added+Removed')||e.acceptable_kinds.includes('Unresolved')||!e.old||!e.new;
  const pass=sides.every(s=>s.pass)&&(allowSeparate||joint.length>0);
  return {id:e.event_id,pass,cards:[...new Set(sides.flatMap(s=>s.cards))]};
 });
 // Enforce anti-mispairing by source run ownership, not product rowKey. A paired
 // changed card may not borrow old/new records with different declared paths.
 for(const d of expanded.filter(d=>d.hasTextChange&&d.left.length&&d.right.length)){
  const owners=(side:'left'|'right')=>{const s=side==='left'?'before':'after';return new Set(layout[s].pages.flatMap((p,page_index)=>p.text_runs.filter(run=>run.logical_path&&located(d[side],[{page_index,run_id:run.run_id}],layout[s].pages,side)).map(run=>run.logical_path!.replace(/\.[^.]+$/,''))));};
  const a=owners('left'),b=owners('right');
  if(a.size&&b.size&&[...a].some(x=>!b.has(x)))faults.push(`cross-record pairing ${d.id}: ${[...a]} -> ${[...b]}`);
 }
 for(const e of events)if(!e.pass)faults.push(`event ${e.id} missing or wrongly sourced`);
 for(const req of expected.repeated_text_requirements??[]){
  const count=(side:'left'|'right')=>{const s=side==='left'?'before':'after';return req.occurrences[s].filter(ref=>result.differences.some(d=>{
   const compact=(t:string)=>t.replace(/\s/gu,'');
   const locs=[...d[side],...d.occurrences.flatMap(o=>o[side])];
   const quote=compact(side==='left'?d.oldText:d.newText);
   if(!compact(locs.map(l=>l.text).join('')).includes(compact(ref.text))&&(!quote||!compact(ref.text).includes(quote)))return false;
   return locs.some(loc=>loc.charIds.some(id=>{const c=docs[side==='left'?0:1].pages[loc.pageIndex].chars.find(c=>c.id===id)!;return located([{...loc,text:c.text,charIds:[c.id],rawRange:c.rawRange,quads:[c.quad],precision:c.precision,resolvedGeometry:undefined}], [ref],layout[s].pages,side);}));
  })).length;};
  if(count('right')-count('left')!==req.counts.after-req.counts.before)faults.push(`missing repeated-text occurrence delta ${req.requirement_id}`);
 }
 if(expected.events.length===0&&result.differences.some(d=>d.hasTextChange&&!d.facts.includes('whitespace_only')))faults.push('false text edit in unchanged control');
 if(expected.case_id!=='R25_duplicate_keys'&&result.unresolved.length)faults.push('unnecessary unresolved correspondence');
 if(expected.coverage_requirements.length&&result.status==='complete_for_scope')faults.push('coverage gap called complete');
 return {caseId:expected.case_id,status:faults.length?'FAIL':'PASS',eventStatus:events.every(e=>e.pass)?'PASS':'FAIL',events,faults,notEvaluated:[] as {kind:string;reason:string;eventId?:string;invariant?:string}[],evaluationScope:'source events, anti-mispairing, repeats, raw operations and display; no aviation business labels'};
}

export function summarize(records:{caseId:string;status:string;eventStatus?:string}[]){const failed=records.filter(r=>r.status!=='PASS').map(r=>r.caseId);return {status:failed.length?'FAIL':'PASS',total:records.length,passed:records.length-failed.length,failed,notEvaluated:[] as string[],eventRegression:{status:failed.length?'FAIL':'PASS',total:records.length,passed:records.length-failed.length}};}
export const exitCode=(s:ReturnType<typeof summarize>)=>s.status==='PASS'?0:1;
