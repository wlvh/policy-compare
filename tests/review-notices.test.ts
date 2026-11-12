import {it, expect} from 'vitest';
import {compare} from '../packages/compare-core/index';
import {CoverageSchema, type CoverageIssue} from '../packages/contracts/index';
import {reviewNotices, relatedUncertainty} from '../apps/web/review-notices';
import {textDoc} from './helpers';

it('actual WASM identifies layout observations without asserting a continued table or merged cells', () => {
  const make = (value: string) => textDoc([0,1].flatMap(page => [
    ...[['Reference','Description','Value'],[`A${page}`,'short',page ? 'USD 800' : value]]
      .flatMap((row,j) => row.map((text,i) => ({text,x:30+i*160,y:180+j*30,page}))),
    {text:'continued cell',x:190,y:224,page},
    {text:'Clear: unchanged',y:350,page},
  ]));
  const result = compare(make('USD 100'),make('USD 250'));
  const observations = result.coverage.filter(c => c.reason === 'unsupported_structure');
  expect(new Set(observations.map(c => c.layoutHint))).toEqual(new Set(['repeated_tabular_text','varying_cell_boundaries']));
  for (const c of observations) {
    expect(CoverageSchema.parse(c)).toEqual(c);
    expect(c.message).toContain('This alone does not establish');
    expect(c.message).toContain('Original text is still compared locally');
    expect(c.region[3]-c.region[1]).toBeLessThan(30);
    expect(c.evidence).not.toBe('');
  }
  expect(result.status).toBe('partial');
  expect(result.differences.some(d => d.hasTextChange && d.oldText.includes('100') && d.newText.includes('250'))).toBe(true);
});

it('an ordinary simple table is not labelled as an unverified layout observation', () => {
  const doc = textDoc([['Reference','Value'],['A','100'],['B','200']].flatMap((row,j) =>
    row.map((text,i) => ({text,x:40+i*160,y:180+j*30}))));
  const result = compare(doc, doc);
  expect(result.coverage).toEqual([]);
  expect(result.status).toBe('complete_for_scope');
});

it('only known tagged observations collapse; other structure limits, page failures and work limits remain coverage notices', () => {
  const doc = textDoc([{text:'Terms remain unchanged.'}]);
  const result = compare(doc,doc);
  const make = (extra: Partial<CoverageIssue>): CoverageIssue => ({side:'left',pageIndex:0,region:[10,20,200,40],
    reason:'unsupported_structure',evidence:'Source text',message:'Check this area',defaultVisible:true,...extra});
  result.coverage = [make({layoutHint:'repeated_tabular_text'}),make({layoutHint:'varying_cell_boundaries'}),
    make({reason:'page_failed'}),make({})];
  result.unresolved = [{reason:'budget',message:'Work limit',left:[],right:[],defaultVisible:true},
    {reason:'ambiguous_match',message:'Two alternatives',left:[],right:[],defaultVisible:true}];
  result.status='partial';
  const before = JSON.stringify(result);
  const display = reviewNotices(result);
  expect(display.layout).toHaveLength(2);
  expect(display.coverage.map(e => e.issue.reason)).toEqual(['page_failed','unsupported_structure']);
  expect(display.incomplete).toHaveLength(1);
  expect(display.uncertain).toHaveLength(1);
  expect(JSON.stringify(result)).toBe(before);
});

it('correspondence uncertainty belongs to its source characters, not every change on the same page', () => {
  const make = (a:string,b:string) => textDoc([{text:'First: '+a,y:180},{text:'Separate: '+b,y:400}]);
  const result = compare(make('100','old'),make('250','new'));
  expect(result.differences).toHaveLength(2);
  const first = result.differences.find(d => d.oldText.includes('100'))!;
  const other = result.differences.find(d => d.oldText.includes('old'))!;
  const unresolved = [{reason:'ambiguous_match' as const,message:'Two alternatives',left:first.left,right:first.right,defaultVisible:true as const}];
  expect(relatedUncertainty(first,unresolved)).toHaveLength(1);
  expect(relatedUncertainty(other,unresolved)).toEqual([]);
});
