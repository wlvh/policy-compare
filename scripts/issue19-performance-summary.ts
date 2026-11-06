import {readFileSync,writeFileSync} from 'node:fs';
const source=JSON.parse(readFileSync('reports/issue-19/performance.json','utf8'));
const builds=JSON.parse(readFileSync('reports/issue-19/performance-builds.json','utf8'));
const raw=source.records as any[];
const percentile=(xs:number[],p:number)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.max(0,Math.ceil(p*xs.length)-1)]:null;
const stats=(xs:number[])=>({n:xs.length,p50Ms:percentile(xs,.5),p95Ms:percentile(xs,.95),maxMs:percentile(xs,1)});
const groups:any[]=[];
const expectedRuns=20;
for(const engine of ['mupdf','pdfjs'])for(const workload of source.protocol.workloads)for(const implementation of ['typescript','rust']){
 const rows=raw.filter(x=>x.engine===engine&&x.impl===implementation&&x.workload===workload.name);
 const failures=rows.filter(x=>x.error||!(x.status==='complete_for_scope'||(workload.budget_ms===null&&x.status==='partial'))||x.expectedValueVisible!==true||x.workersAfterClose!==0||(x.status==='complete_for_scope'&&x.differenceCards!==x.expectedCards));
 const totals=rows.filter(x=>Number.isFinite(x.metrics?.total)).map(x=>x.metrics.total);
 const timing=stats(totals);
 const fixtureChecks=failures.length?'FAIL':rows.length===expectedRuns?'PASS':'NOT_EVALUATED';
 const budgetStatus=workload.budget_ms===null?'NOT_APPLICABLE':fixtureChecks!=='PASS'||totals.length!==expectedRuns?'NOT_EVALUATED':timing.p95Ms!>workload.budget_ms?'FAIL':'PASS';
 const baseline=source.loads.find((x:any)=>x.engine===engine&&x.impl===implementation)?.idleRssBytes;
 const validBaseline=Number.isFinite(baseline);
 const artifact=builds[`${engine}-${implementation}`].manifest;
 const artifactMatches=implementation==='rust'?rows.every(x=>x.metrics?.coreArtifact?.sha256===artifact.coreArtifact.sha256):artifact.revision==='6a5f1ef7e3f6997e58a1bf303774419c16cb994b';
 groups.push({engine,implementation,workload:workload.name,attempts:rows.length,fixtureChecks,failures:failures.map(x=>({run:x.run,error:x.error,status:x.status,valueVisible:x.expectedValueVisible,cards:x.differenceCards,expectedCards:x.expectedCards,workersAfterClose:x.workersAfterClose})),timing,budgetMs:workload.budget_ms,localTimeBudgetStatus:budgetStatus,buildBinding:artifactMatches?'PASS':'FAIL',productRevision:artifact.revision,coreArtifact:artifact.coreArtifact??null,peakSampledProcessTreeRssBytes:Math.max(0,...rows.map(x=>x.peakRssBytes??0)),peakIncrementalSampledRssBytes:validBaseline?Math.max(0,...rows.map(x=>x.incrementalSampledRssBytes??0)):null,incrementalRssMeasurement:validBaseline?'SAMPLED_ONLY':'NOT_EVALUATED',maxWorkersAfterClose:rows.length?Math.max(...rows.map(x=>x.workersAfterClose??-1)):null});
}
const comparisons=source.protocol.workloads.flatMap((workload:any)=>['mupdf','pdfjs'].map(engine=>{
 const own=groups.filter(x=>x.engine===engine&&x.workload===workload.name);
 const left=own.find(x=>x.implementation==='typescript')!,right=own.find(x=>x.implementation==='rust')!;
 return {engine,workload:workload.name,legacy:left,rust:right,rustP50ChangePercent:left.timing.p50Ms&&right.timing.p50Ms?(right.timing.p50Ms/left.timing.p50Ms-1)*100:null};
}));
const hasFailure=groups.some(x=>x.fixtureChecks==='FAIL'||x.localTimeBudgetStatus==='FAIL'||x.buildBinding==='FAIL');
const summary={status:hasFailure?'FAIL':'NOT_EVALUATED',subject:'paired local migration measurements and their limits',attempts:raw.length,expectedAttempts:720,benchmarkFixtureChecks:groups.some(x=>x.fixtureChecks==='FAIL')?'FAIL':raw.length===720?'PASS':'NOT_EVALUATED',localTimeBudgetChecks:groups.some(x=>x.localTimeBudgetStatus==='FAIL')?'FAIL':groups.every(x=>['PASS','NOT_APPLICABLE'].includes(x.localTimeBudgetStatus))?'PASS':'NOT_EVALUATED',officeDevice:'NOT_EVALUATED',fullPhysicalPeakMemory:'NOT_EVALUATED',coldLoadP95:'NOT_EVALUATED',percentiles:'nearest rank ceil(n*p)-1, retaining original comparison-benchmark convention',measurementLimits:'20 attempts per group include the first document comparison. Each implementation has one fresh-browser load measurement, insufficient for a cold-load P95. 100 ms process-tree RSS samples can miss peaks and double-count shared pages; they do not establish the 1 GiB incremental physical-peak goal. No time or memory target was relaxed.',protocol:source.protocol,browserVersion:source.browserVersion,loads:source.loads,groups,comparisons};
writeFileSync('reports/issue-19/performance-summary.json',JSON.stringify(summary,null,2)+'\n');
const lines=['# 本机 20 次端到端对照','',`原始尝试 ${raw.length} / 720；工作负载检查 ${summary.benchmarkFixtureChecks}；本地时间目标 ${summary.localTimeBudgetChecks}。目标办公终端、完整物理内存峰值和冷加载 P95 均未评价。`,'','每组20次按耗时排序，P50取第10个、P95取第19个，沿用原比较基准规则。耗时单位为毫秒，涵盖任务开始到首屏可审阅。百分比正值表示本次 Rust 版本更慢，负值表示更快。各行只描述该提取器与输入，保留全部尝试及失败。',''];
for(const engine of ['mupdf','pdfjs']){lines.push(`## ${engine}`,'','| 工作负载 | TS P50 | Rust P50 | TS P95 | Rust P95 | Rust P50 变化 |','|---|---:|---:|---:|---:|---:|');for(const x of comparisons.filter((x:any)=>x.engine===engine)){const fmt=(n:number|null)=>n===null?'未评价':Math.round(n).toString();lines.push(`| ${x.workload} | ${fmt(x.legacy.timing.p50Ms)} | ${fmt(x.rust.timing.p50Ms)} | ${fmt(x.legacy.timing.p95Ms)} | ${fmt(x.rust.timing.p95Ms)} | ${x.rustP50ChangePercent===null?'未评价':x.rustP50ChangePercent.toFixed(1)+'%'} |`)}lines.push('')}
lines.push('进程树 RSS、关闭后 Worker 数、初次加载、逐阶段数据、配置指纹及每个运行所调用的核心哈希见 JSON 原始记录与汇总。Rust 页接收成本与旧 TS 的验证/快照阶段边界不同，阶段列不能直接当成同一操作的速度比。','');
writeFileSync('reports/issue-19/performance-summary.md',lines.join('\n'));
console.log({attempts:summary.attempts,fixtureChecks:summary.benchmarkFixtureChecks,localTimeBudgets:summary.localTimeBudgetChecks,overall:summary.status});
