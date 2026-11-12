import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root='tests/fixtures/review-flow';
const author=JSON.parse(readFileSync(`${root}/author-input.json`,'utf8'));

async function load(page:Page,options:{mode?:'budget'|'word_diff_budget';notices?:number}={}) {
  await page.addInitScript(({mode,notices})=>{
    const Native=window.Worker;
    window.Worker=class extends Native {
      constructor(url:string|URL,opts?:WorkerOptions){super(url,opts);if(!String(url).includes('core.worker'))return;
        this.addEventListener('message',e=>{
          if(e.data.type!=='result')return;
          const r=e.data.result,d=r.differences.find((d:any)=>d.oldText.includes('USD 1,000,000'));
          if(!d)throw new Error('Independent long-clause fixture not found');
          if(mode){
            r.unresolved.push({reason:mode,message:mode==='budget'?'These ranges have not been matched or compared.':'Full texts retained; word-level highlighting is coarse.',left:structuredClone(d.left),right:structuredClone(d.right),defaultVisible:true});
            if(mode==='budget')r.differences=r.differences.filter((x:any)=>x.id!==d.id);
            else d.textOps=[{kind:'delete',text:d.oldText,left:d.left,right:[]},{kind:'insert',text:d.newText,left:[],right:d.right}];
          }
          if(notices){
            // Presentation-only observations at real source locations. This
            // does not claim the PDF has these layout defects or features.
            const locs=d.left.flatMap((l:any,i:number)=>[l,d.right[i]].filter(Boolean));
            for(let i=0;i<notices;i++){
              const l=locs[i%locs.length],xs=l.quads.flatMap((q:number[])=>[q[0],q[2],q[4],q[6]]),ys=l.quads.flatMap((q:number[])=>[q[1],q[3],q[5],q[7]]);
              r.coverage.push({side:l.side,pageIndex:l.pageIndex,region:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],reason:'unsupported_structure',layoutHint:'repeated_tabular_text',evidence:l.text,message:'Controlled repeated-text observation; local text comparison continued.',defaultVisible:true});
            }
          }
          if(mode||notices)r.status='partial';
          (window as any).__reviewFlowOriginal=structuredClone(r);
        });
      }
    };
  },options);
  await page.goto('./');await expect(page.locator('main')).toHaveAttribute('data-engine-ready','true');
  for(const [side,label] of [['before','Baseline PDF'],['after','Revised PDF']]){
    const file=`${root}/${side}.pdf`;
    expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(author.files[side].sha256);
    await page.getByLabel(label,{exact:true}).setInputFiles(path.resolve(file));
  }
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('[data-status]')).toHaveAttribute('data-status',/partial|complete_for_scope/);
  for(const side of [0,1])await expect(page.locator('.document').nth(side).locator('[data-ready-page="0"] img')).toBeVisible();
}
async function exported(page:Page){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON',exact:true}).click();return JSON.parse(readFileSync((await(await pending).path())!,'utf8'));}
async function readingSpace(page:Page){
  // Explicit navigation reveals the viewer on the next animation frame.
  await expect.poll(async()=>page.locator('.page-scroll').evaluateAll(els=>{
    if(els.length!==2)return false;
    return els.every(el=>{
      const r=el.getBoundingClientRect();
      return Math.min(r.right,innerWidth)-Math.max(0,r.left)>200 &&
        Math.min(r.bottom,innerHeight)-Math.max(0,r.top)>250;
    });
  })).toBe(true);
  expect(await page.locator('.cards').evaluate(el=>el.clientHeight)).toBeGreaterThanOrEqual(150);
}

for(const mode of ['word_diff_budget','budget'] as const)test(`${mode} states its actual unfinished step and preserves the original result`,async({page})=>{
  await load(page,{mode});
  if(mode==='word_diff_budget'){
    const note=page.getByRole('region',{name:'Word-level comparison detail',exact:true});
    await expect(note).toBeVisible();await expect(note).toContainText('Both full source texts are retained');
    await expect(page.getByRole('region',{name:'Comparison coverage',exact:true})).toHaveCount(0);
    await expect(page.locator('.coarse-detail')).toContainText('highlighting is coarse');
    const card=page.locator('.card').filter({hasText:'USD 1,000,000'});
    const original=await page.evaluate(()=>(window as any).__reviewFlowOriginal);
    const d=original.differences.find((d:any)=>d.oldText.includes('USD 1,000,000'));
    await expect(card.locator('.old p')).toHaveText(d.oldText);await expect(card.locator('.new p')).toHaveText(d.newText);
  }else{
    await expect(page.getByRole('region',{name:'Comparison coverage',exact:true})).toContainText('Comparison unfinished');
    await expect(page.getByRole('region',{name:'Word-level comparison detail',exact:true})).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('unfinished comparison');
  }
  const r=await exported(page),original=await page.evaluate(()=>(window as any).__reviewFlowOriginal);
  expect(r.status).toBe('partial');expect(r.unresolved).toEqual(original.unresolved);
  expect(r.differences.map((d:any)=>({old:d.oldText,new:d.newText,ops:d.textOps.map((o:any)=>[o.kind,o.text])}))).toEqual(original.differences.map((d:any)=>({old:d.oldText,new:d.newText,ops:d.textOps.map((o:any)=>[o.kind,o.text])})));
});

test('long clauses highlight all edit groups, preserve complete context and locate both real PDF sources',async({page})=>{
  await load(page);
  const card=page.locator('.card').filter({hasText:'USD 1,000,000'});
  await expect(card.locator('.change-excerpt')).toHaveCount(2);
  await expect(card.locator('.old').first()).toContainText('shall not exceed USD 1,000,000');
  await expect(card.locator('.new').first()).toContainText('provided the written notice has been received');
  await expect(card.locator('.old mark').first()).toBeVisible();await expect(card.locator('.new mark').first()).toBeVisible();
  const original=await page.evaluate(()=>(window as any).__reviewFlowOriginal);
  const d=original.differences.find((d:any)=>d.oldText.includes('USD 1,000,000'));
  const shown=(await card.locator('.change-excerpt').allTextContents()).join('');
  expect(shown.length).toBeLessThan((d.oldText.length+d.newText.length)*0.7);
  await page.getByRole('button',{name:'Review changes',exact:true}).click();
  await card.locator('.change-excerpt').first().getByRole('button',{name:'View both sources',exact:true}).click();
  await page.screenshot({path:test.info().outputPath('compact-edits.png'),fullPage:true});
  await card.locator('.complete-text > summary').click();
  await expect(card.locator('.full-old p')).toHaveText(d.oldText);await expect(card.locator('.full-new p')).toHaveText(d.newText);
  for(const [i,key] of [[0,'amount'],[1,'days']] as const){
    await card.locator('.change-excerpt').nth(i).getByRole('button',{name:'View both sources',exact:true}).click();
    for(const [side,name] of [[0,'before'],[1,'after']] as const){
      const polygons=page.locator('.document').nth(side).locator(side?'polygon.highlight-new':'polygon.highlight-old');
      await expect(polygons.first()).toBeInViewport({ratio:0.9});
      const expected=author.files[name].fragments[key].region;
      const points=await polygons.evaluateAll(els=>els.map(el=>el.getAttribute('points')!.split(/[ ,]+/).map(Number)));
      for(const q of points){const xs=q.filter((_,i)=>i%2===0),ys=q.filter((_,i)=>i%2===1);expect(Math.min(...xs)).toBeGreaterThanOrEqual(expected[0]-5);expect(Math.max(...xs)).toBeLessThanOrEqual(expected[2]+5);expect(Math.min(...ys)).toBeGreaterThanOrEqual(expected[1]-5);expect(Math.max(...ys)).toBeLessThanOrEqual(expected[3]+5);}
    }
  }
  await page.screenshot({path:test.info().outputPath('local-edits.png'),fullPage:true});
});

test('ordinary and numerous notices allow a short-window review, source visit, return and next change',async({page})=>{
  const burdens=[];
  for(const count of [4,48]){
    // Fresh pages keep the presentation wrapper and processing result separate.
    const current=await page.context().newPage();
    await current.setViewportSize({width:1280,height:800});
    expect(await current.evaluate(()=>[innerWidth,innerHeight])).toEqual([1280,800]);
    await load(current,{notices:count});
    const card=current.locator('.card').filter({hasText:'USD 1,000,000'});
    await current.getByRole('button',{name:'Review changes',exact:true}).click();
    await readingSpace(current);
    burdens.push((await current.locator('.gaps').boundingBox())!.height);
    await card.locator('.change-excerpt').nth(1).getByRole('button',{name:'View both sources',exact:true}).click();
    const selected=await card.getAttribute('data-change-id');
    await current.getByLabel('Search source text').fill('notice');await current.getByRole('button',{name:'Search',exact:true}).click();
    await expect(current.locator('.hits button').first()).toBeVisible();
    const repeat=current.getByRole('region',{name:'Repeated text counts',exact:true});
    await repeat.locator('.occurrence-details > summary').first().click();
    await readingSpace(current);
    const scroll=await current.locator('.cards').evaluate(el=>el.scrollTop);
    await current.locator('.structure-notices > summary').click();
    await current.locator('.structure-notices .notice-location').last().click();
    await expect(current.locator('.location-hint')).toContainText('Review area');
    await readingSpace(current);
    await current.getByRole('button',{name:'Return to selected change',exact:true}).click();
    await expect(current.locator(`.card[data-change-id="${selected}"]`)).toHaveClass(/selected/);
    expect(await current.locator('.cards').evaluate(el=>el.scrollTop)).toBeCloseTo(scroll,0);
    for(const [side,name] of [[0,'before'],[1,'after']] as const){
      const polygons=current.locator('.document').nth(side).locator(side?'polygon.highlight-new':'polygon.highlight-old');
      await expect(polygons.first()).toBeInViewport({ratio:0.9});
      const bounds=author.files[name].fragments.days.region;
      await expect.poll(async()=>polygons.evaluateAll((els,b)=>els.length>0 && els.every(el=>{
        const q=el.getAttribute('points')!.split(/[ ,]+/).map(Number);
        return q.every((n,i)=>i%2===0?n>=b[0]-5&&n<=b[2]+5:n>=b[1]-5&&n<=b[3]+5);
      }),bounds)).toBe(true);
    }
    await current.locator('.card').filter({hasText:'Administration charge'}).click();
    for(const side of [0,1])await expect(current.locator('.document').nth(side).locator(side?'polygon.highlight-new':'polygon.highlight-old').first()).toBeInViewport({ratio:0.9});
    const r=await exported(current),original=await current.evaluate(()=>(window as any).__reviewFlowOriginal);
    expect(r.coverage).toEqual(original.coverage);expect(r.status).toBe('partial');
    await current.screenshot({path:test.info().outputPath(`review-${count}.png`),fullPage:true});await current.close();
  }
  expect(burdens[1]).toBeLessThanOrEqual(burdens[0]+10);
});
