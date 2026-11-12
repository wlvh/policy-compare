import {it,expect} from 'vitest';
import {compare} from '../packages/compare-core/index';
import {coreOptions} from '../packages/compare-core/options';
import {changeExcerpts} from '../apps/web/change-excerpts';
import {reviewNotices,noticeStatus,relatedWordDetail} from '../apps/web/review-notices';
import {textDoc} from './helpers';

const padding=(prefix:string,n=9)=>Array.from({length:n},(_,i)=>`${prefix} ${i+1} remains in force during the policy period. `).join('');
function example() {
  const make=(amount:string,days:string)=>textDoc([{text:padding('Condition')+
    `The limit shall not exceed USD ${amount}, provided the written notice has been received. `+
    padding('Requirement')+`The office must receive the report within ${days} days after the event. `+padding('Condition')}]);
  return compare(make('1,000,000','30'),make('1,500,000','45'));
}

it('every actual edit remains visible while only unchanged sentence context can be omitted',()=>{
  const r=example(),d=r.differences.find(d=>d.oldText.includes('1,000,000'))!;
  const before=JSON.stringify(r),display=changeExcerpts(d);
  expect(display.precise).toBe(true);
  expect(display.excerpts).toHaveLength(2);
  expect(display.omitted).toBeGreaterThan(0);
  expect(display.excerpts.flatMap(e=>e.operations)).toEqual(d.textOps.filter(o=>o.kind!=='equal'));
  const old=display.excerpts.map(e=>e.parts.filter(p=>p.kind!=='insert').map(p=>p.text).join(''));
  const next=display.excerpts.map(e=>e.parts.filter(p=>p.kind!=='delete').map(p=>p.text).join(''));
  expect(old[0]).toContain('The limit shall not exceed USD 1,000,000, provided the written notice has been received.');
  expect(next[0]).toContain('The limit shall not exceed USD 1,500,000, provided the written notice has been received.');
  expect(old[1]).toContain('within 30 days');expect(next[1]).toContain('within 45 days');
  expect(JSON.stringify(r)).toBe(before);
});

it('a long edited sentence is preserved whole instead of clipping units, negatives or conditions',()=>{
  const make=(amount:string)=>textDoc([{text:`The limit shall not exceed USD ${amount} for any approved claim and `+
    'the required notice must be received before payment and '.repeat(25)+'the exclusion remains in force.'}]);
  const d=compare(make('100'),make('250')).differences[0];
  const display=changeExcerpts(d);
  expect(display.omitted).toBe(0);
  expect(display.excerpts).toHaveLength(1);
  expect(display.excerpts[0].parts.filter(p=>p.kind!=='insert').map(p=>p.text).join('')).toBe(d.oldText);
});

it('invalid or incomplete operation text falls back to complete sources without fabricated highlights',()=>{
  expect(changeExcerpts({oldText:'Limit: USD 100',newText:'Limit: USD 250',textOps:[]})).toEqual({excerpts:[],omitted:0,precise:false});
});

it('sentence slicing preserves Unicode characters and all edits on either side',()=>{
  const a=padding('Terms')+'José 🚀 shall receive EUR 100 after notice. '+padding('Terms');
  const b=a.replace('EUR 100','EUR 250');
  const d=compare(textDoc([{text:a}]),textDoc([{text:b}])).differences[0];
  const display=changeExcerpts(d);
  expect(display.excerpts.flatMap(e=>e.operations)).toEqual(d.textOps.filter(o=>o.kind!=='equal'));
  expect(display.excerpts[0].parts.map(p=>p.text).join('')).toContain('José 🚀');
});

it('actual word-diff exhaustion retains full text and is separate from matching exhaustion',()=>{
  const a=textDoc([{text:'The service covers all approved operations during the policy period.'}]);
  const b=textDoc([{text:'The service excludes several operations after written notice during the policy period.'}]);
  const r=compare(a,b,coreOptions,{...coreOptions.budget,diffProducts:0});
  expect(r.status).toBe('partial');
  expect(r.unresolved.some(u=>u.reason==='word_diff_budget')).toBe(true);
  expect(reviewNotices(r).wordDetail.length).toBeGreaterThan(0);
  expect(reviewNotices(r).incomplete).toEqual([]);
  expect(noticeStatus(r)).toContain('both full texts are retained');
  expect(noticeStatus(r)).not.toContain('unfinished comparison');
  const d=r.differences[0];
  expect(d.oldText).toContain('covers all');expect(d.newText).toContain('excludes several');
  expect(relatedWordDetail(d,r.unresolved)).toHaveLength(1);
  const unmatched=compare(a,b,coreOptions,{...coreOptions.budget,tokenProducts:0});
  expect(reviewNotices(unmatched).incomplete.length).toBeGreaterThan(0);
  expect(reviewNotices(unmatched).wordDetail).toEqual([]);
});
