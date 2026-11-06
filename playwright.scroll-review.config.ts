import {defineConfig} from '@playwright/test';
const root=process.cwd(),dir=process.env.POLICY_REPORT_DIR!;
if(!dir||!process.env.POLICY_SCROLL_SITE)throw new Error('Set evidence directory and frozen site');
export default defineConfig({testDir:'tests/browser',testMatch:/(deployment|lifecycle|review|review-regressions|scroll|one-sided-navigation|repeat-display)\.spec\.ts$/,workers:1,retries:0,timeout:60000,outputDir:dir+'/test-results',use:{baseURL:'http://127.0.0.1:4180/',headless:true,viewport:{width:1500,height:1000},trace:'retain-on-failure'},webServer:{command:'node deploy/server.mjs',cwd:root,url:'http://127.0.0.1:4180/healthz',env:{PORT:'4180',HOST:'127.0.0.1',STATIC_ROOT:process.env.POLICY_SCROLL_SITE}},reporter:[['list'],['json',{outputFile:dir+'/browser-tests-pdfjs.json'}]]});
