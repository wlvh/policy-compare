import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='validation/issue-24/pdfs';
if(existsSync(`${root}/manifest.json`))throw Error('Frozen inputs already exist');
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage();
for(const side of ['before','after']){await page.setContent(readFileSync(`${root}/multi-column-${side}.html`,'utf8'));await page.pdf({path:`${root}/multi-column-${side}.pdf`,format:'A4',printBackground:true});}await browser.close();
const pairs=JSON.parse(readFileSync(`${root}/sources.json`,'utf8'));
for(const pair of pairs){pair.files={};for(const side of ['before','after']){const file=`${root}/${pair.id}-${side}.pdf`;pair.files[side]={file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')};}}
writeFileSync(`${root}/manifest.json`,JSON.stringify({frozenAt:new Date().toISOString(),purpose:'First-run English PDF validation; no comparator has been invoked on these files',pairs},null,2)+'\n');
