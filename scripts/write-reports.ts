import {readFileSync,writeFileSync,statSync,readdirSync,existsSync} from 'node:fs';
const load=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const ab=load('reports/engine-ab.json'),engines=['pdfjs','mupdf'];
const mib=(bytes:number)=>`${(bytes/2**20).toFixed(1)}`;
const sec=(ms:number)=>`${(ms/1000).toFixed(3)}`;
const median=(xs:number[])=>[...xs].sort((a,b)=>a-b)[Math.max(0,Math.ceil(xs.length/2)-1)];
const files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
const allDone=ab.attempts.length===360&&ab.cold.length===6&&ab.summary.every((s:any)=>s.attempts===20);
if(!allDone)throw new Error('The formal A/B is incomplete; do not publish a completed report.');
const ci=existsSync('reports/ci-review-fixes.json')?load('reports/ci-review-fixes.json'):null;
const ciBound=ci?.productRevision===ab.commit&&ci?.treeEquality==='PASS';
const containerStatus=ciBound&&engines.every(e=>ci.containerStatus[e]==='PASS')?'PASS':'BLOCKED';
const containerEvidence=containerStatus==='PASS'?`GitHub Linux CI 实际构建、只读非 root 启动与健康检查通过；${ci.runUrl}`:'本机 Docker 不可用；尚无与当前产品绑定的 Linux CI 通过证据';
const browserCounts=Object.fromEntries(engines.map(e=>[e,load(`reports/browser-tests-${e}.json`).stats.expected]));
const reviewStatus=engines.every(e=>{const r=load(`reports/review-regressions-${e}.json`);return r.status==='PASS'&&r.revision===ab.commit&&load(`reports/browser-review-regressions-${e}.json`).status==='PASS';})?'PASS':'FAIL';
const dataStatus=allDone&&ab.attempts.every((a:any)=>a.status==='PASS')&&ab.cold.every((a:any)=>a.status==='PASS')?'PASS':'FAIL';
const budgetStatus=ab.summary.some((s:any)=>s.developmentBudgetStatus==='FAIL')?'FAIL':ab.summary.every((s:any)=>s.developmentBudgetStatus==='PASS')?'PASS':'BLOCKED';
const timingStatus=ab.summary.every((s:any)=>s.timingBudgetStatus==='PASS')?'PASS':'FAIL';
const interactions=load('reports/interaction-profile.json');
if(interactions.productRevision!==ab.commit)throw new Error('Interaction evidence must use the same product revision as A/B');
if(load('reports/delivery-check.json').productRevision!==ab.commit)throw new Error('Delivery evidence must match the current measured product.');
const interactionRows=interactions.summary.map((s:any)=>`| ${s.engine} | ${s.attempts-s.failures}/${s.attempts} | ${s.responseP95.toFixed(1)} | ${s.responseMax.toFixed(1)} | ${s.jumpCompleteP95.toFixed(1)} | ${s.cancelP95.toFixed(1)} | ${s.status} |`);
const rows=ab.summary.map((s:any)=>`| ${s.workload} | ${s.engine} | ${s.successes}/${s.attempts} | ${s.attempts-s.successes} | ${sec(s.successfulTiming.median)} | ${sec(s.successfulTiming.p95)} | ${sec(s.successfulTiming.max)} | ${mib(s.peakIncrementalBytes)} | ${s.timingBudgetStatus} | ${s.fullMemoryAcceptance} |`);
const coldRows=engines.map(engine=>{const xs=ab.cold.filter((c:any)=>c.engine===engine&&c.status==='PASS').map((c:any)=>c.initializationMs);const bytes=ab.cold.filter((c:any)=>c.engine===engine).map((c:any)=>c.requests.reduce((n:number,r:any)=>n+(r.responseBodySize??0),0));return `| ${engine} | ${xs.length}/3 | ${sec(median(xs))} | ${sec(Math.min(...xs))}–${sec(Math.max(...xs))} | ${mib(median(bytes))} |`;});
const diagnosticRows=ab.summary.filter((s:any)=>s.size==='standard').map((s:any)=>{const rs=ab.attempts.filter((a:any)=>a.workload===s.workload&&a.engine===s.engine);const fields=['pdfOpen','nativeTextExtraction','sourceAdaptation','transferQueueMax','coverageAnalysis','validation','snapshot','structure','matching','diff','renderMs','locationMs'];return `| ${s.workload} | ${s.engine} | ${fields.map(k=>Math.round(median(rs.map((r:any)=>r.metrics[k]??0)))).join(' | ')} |`;});
const paired=ab.summary.filter((s:any)=>s.engine==='pdfjs').map((s:any)=>{const a=ab.attempts.filter((x:any)=>x.engine==='pdfjs'&&x.workload===s.workload);const b=ab.attempts.filter((x:any)=>x.engine==='mupdf'&&x.workload===s.workload);const ds=a.map((x:any)=>x.metrics.total-b.find((y:any)=>y.iteration===x.iteration).metrics.total);return {name:s.workload,medianDeltaMs:median(ds),mupdfFaster:ds.filter((n:number)=>n>0).length,total:ds.length};});
writeFileSync('docs/engine-comparison.md',`# PDF.js / MuPDF.js 实测对照

日期：2026-10-26。产品冻结提交：\`${ab.commit}\`。两版使用同一公共核心、profile、预算与 UI；正式报告里的 build 哈希锁定实际产物。原始逐轮记录：reports/engine-ab.json。

这是 F1–F7 修复后的新测量。原 f81aebd/2847b56 报告保存在 reports/baseline-review-2847b56；它们只代表旧产品和原评分器的结果，不替代本次测量。

当前状态：完整路径时间与正确性采集 **${dataStatus}**；时间预算 **${timingStatus}**；包含完整内存的开发机验收 **${budgetStatus}**；普通 16 GiB 参考设备 **BLOCKED**。已保存的第一批测量中，标准表格的 Chrome helper 在采集时退出；因此不能保证短寿命子进程的历史峰值都被回收。本批统一将完整内存验收标为 BLOCKED；已测物理峰值与 RSS 仍如实报告。诊断原件在 reports/diagnostics。这份报告不能替代业务试点验收。

## 正确性先决条件

两引擎分别通过原 32 对业务规则、六个控制用例与真实浏览器精细位置评分。产品不读 source/expected/layout。R25 金额与双侧来源保留；R27/R28 用具体区域和 partial 表达图片未覆盖，未声称读出图片金额。Node PDF.js 的 run 来源与浏览器 DOM Range 测量分别记录，不混为一项通过。

审核回归 ${reviewStatus}：两个 P1 在真实 PDF 和浏览器中验证；每版 10 项真实 PDF 回归，补充章节归属、坏页/好页、嵌套 Form 和诊断隔离。F6 评分器修复后重新执行了原 32 对精细定位；仅一侧正确不能代表替换双方通过。新测量保留同样的输入 PDF 字节、性能预算和样本次数。

MuPDF 使用原生字符 quad。PDF.js 先保留提取项与标量/UTF-16 区间，显示时核对同样的 TextContent 并用真实加载字体的 DOM 范围测量。默认通用文字层字体曾造成标点偏移，修复与失败证据在 reports/failures。没有均分段落框，也没有修改标准答案。

## 条件与口径

- 设备：${ab.environment.cpu}，${ab.environment.logicalCpu} 逻辑 CPU，${mib(ab.environment.memoryBytes)} MiB RAM；macOS 开发机，Chrome ${ab.browserVersion}，接交流电。
- 浏览器：独立 headless Chrome，1500×1000，DPR 1；两侧各一页、同样的 1.35 渲染尺度。仅被测引擎运行，另一引擎浏览器已关闭。
- 三类原始 PDF 各有 8、45、100 页版本；每个版本、每个引擎 **20 次热比较**。按 A/B、B/A 平衡交替；原始 PDF SHA-256 和顺序逐轮保存。每次都重新读文件、打开、提取和比较，无 DocInput/结果复用。
- 热运行先完成应用与选定引擎预热；计时从点击开始，到完整差异和约定的首个原文位置可操作。正式热比较共 360 次，冷启动每引擎 3 次，共 6 次。
- 经验 p95 用 nearest-rank：20 次排序后第 19 项。它不是精确的总体尾延迟。所有失败尝试都保留；成功耗时统计同时列成功数/总数。
- 内存使用独立 Chrome 进程树的 macOS footprint：逐进程实际物理占用/历史峰值，包含 Worker、WASM、原生分配与 GPU；先记录 about:blank 基线，再报告各进程峰值之和减基线。不同进程峰值可能不同步，求和偏保守。同时保存总物理内存和 100 ms RSS 样本；RSS 可能重复计算共享页。JSON 导出在测量峰值之后执行，导出额外内存不计入比较预算。
- 小型 p95 ≤3 秒、标准 p95 ≤20 秒；标准文档可归因峰值 ≤1 GiB。100 页容量组只按事先定义的完整或明确预算降级合同验收；不能拿降级当速度优势。

## 热比较结果

时间单位秒；内存是上述已采集进程口径的增量峰值 MiB，存在短寿命进程覆盖缺口，不能据此确认完整内存达标。

| 工作负载 | 引擎 | 成功/总数 | 失败数 | 中位数 | 经验 p95 | 最大值 | 已测峰值 MiB | 时间预算 | 完整内存 |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
${rows.join('\n')}

每轮还核对所有已知变化、默认可见性、输入哈希、完整状态、约定首个位置的实际多边形与独立作者几何预期。模板组分别检查 82、452、1002 个已知事件，不以卡片数相等定义两引擎正确性。

## 冷启动

干净浏览器上下文/缓存，从导航到引擎就绪；OS 文件缓存未强行清理。只报 3 次的中位数和范围，不报冷 p95。资源字节仅为 Playwright 返回了非零大小的响应体之和。两版顶层 Worker 请求的 responseBodySize 均返回 0，虽然 Worker 已实际初始化，因此该列是可计数字节的下界，不是完整下载量；不能据此判定总下载体积优势。完整静态文件大小另列。

| 引擎 | 成功/总数 | 中位数秒 | 范围秒 | 已计数响应体下界 MiB |
|---|---:|---:|---:|---:|
${coldRows.join('\n')}

## 分项诊断

以下是标准组各阶段中位数，单位 ms。异步阶段会重叠，不能把分项直接相加当总耗时。MuPDF 的 nativeTextExtraction 是 toStructuredText，walk 的原生回调成本包含在 sourceAdaptation；PDF.js 是 getTextContent，覆盖算子遍历另列。因此这一列不能单独用来判定纯解析器胜负。传递列是逐页发送时间戳到核心 Worker 收取的最大延迟，包含克隆/排队/调度；不是纯复制 CPU 时间，也不能将各页延迟相加当串行总耗时。

| 工作负载 | 引擎 | 打开 | 文字提取 | 来源适配 | 传递队列最大延迟 | 覆盖 | 契约检查 | 快照 | 结构 | 对应 | 差异 | 渲染 | 定位 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${diagnosticRows.join('\n')}

传递队列尾延迟、读取、首次可审阅、逐轮交互响应和工作量在原始 JSON 中。主 A/B 记录中的交互是比较初期两次分类切换；额外的标准模板交互测试覆盖整个计算期间、完整列表筛选、滚动、跳转反馈和晚期取消，见 reports/interaction-profile.json。跳转反馈与新页全部定位就绪分别计时，后者不混入反馈指标。

以下单位 ms；每引擎 20 次独立任务，来自同一产品冻结提交。响应 p95 预算 100 ms，取消每次须在 1000 ms 内停止且剩余 Worker 为 0。

| 引擎 | 成功/总数 | 响应 p95 | 响应最大值 | 跳页全部定位 p95 | 取消 p95 | 状态 |
|---|---:|---:|---:|---:|---:|---|
${interactionRows.join('\n')}

## 差异与选择

按同轮配对计算，MuPDF 比 PDF.js 少用的总时间中位数：

${paired.map((p:any)=>`- ${p.name}：${p.medianDeltaMs.toFixed(1)} ms；MuPDF 较快 ${p.mupdfFaster}/${p.total} 轮。`).join('\n')}

这些差异属于完整产品路径，包含数据结构、提取、渲染和定位，不能全部归因于解析库本身。两条路线在这套合成材料上的正确性都通过；真实模板、字体和编码噪声仍需留出样本。即使某路线在每轮都略快，标准组绝对差距和用户流程的意义仍应分开判断，不为制造冠军继续扩到 100 次。

静态目录体积：${engines.map(e=>e+' '+mib(files('dist/'+e).reduce((n,p)=>n+statSync(p).size,0))+' MiB').join('；')}（未压缩，含各自资源与许可）。PDF.js 路线已在未安装/下载 MuPDF 的独立目录与独立缓存中构建通过，产物/请求无 MuPDF；MuPDF 原生字符几何路径更直接。PDF.js 精细定位需要维护文字层、字体与来源关系。

本地试用可优先选择 PDF.js 的 Apache-2.0 路线，同时保留 MuPDF 原生字符几何版本。该建议考虑分发材料与接入成本，不等于忽略 MuPDF 的实测优势，也不构成生产许可或业务质量批准。两版均保留，生产默认版本应在真实人工审阅、未调参留出、目标设备与实际许可范围落实后确定。

## 未完成条件

Linux 两个容器变体：${containerStatus}。${containerEvidence}。旧本机 Docker BLOCKED 记录保留，不覆盖为通过。普通 16 GiB 参考设备及真实业务/留出材料未提供。OpenShift/Harness 没有部署，它们属于可选组织接入。完整内存统计仍受短寿命子进程覆盖缺口限制。
`);
const fixture=load('validation/dataset/fixture_check_report.json'),core=load('reports/core-tests.json');
writeFileSync('docs/acceptance-report.md',`# 验收报告

日期：2026-10-26。性能冻结产品提交：${ab.commit}。

**工程验收状态：BLOCKED；业务试点状态：BLOCKED。** 两个本地可运行构建已经交付；缺失条件不能用通过的功能测试抵消。

| 证据层 | 状态 | 已实际执行的内容 |
|---|---|---|
| 样本构造 | PASS | 原 32 对、64 PDF、130 页，${fixture.assertions} 项断言；不是产品通过率 |
| 公共核心/契约/评分器 | PASS | ${core.numPassedTests} 项测试；保真映射、身份、移动、拆合、预算、反例与产品不读答案边界 |
| PDF.js 产品规则 | ${load('reports/rules-pdfjs.json').status} | 32 对独立评分，Node 来源精度为 run；精细位置另测 |
| MuPDF 产品规则 | ${load('reports/rules-mupdf.json').status} | 32 对独立评分及原生字符位置 |
| PDF.js 浏览器精细定位 | ${load('reports/browser-rules-pdfjs.json').status} | 32 对，以原作者字符/页面/方向/合理区域核验 |
| MuPDF 浏览器精细定位 | ${load('reports/browser-rules-mupdf.json').status} | 同一位置标准，无引擎专属放宽 |
| 浏览器流程 | PASS | ${engines.map(e=>`${e} ${browserCounts[e]} 组`).join('；')}：包括新审核回归及原搜索、移动、导出、20 完整任务/20 取消 |
| F1–F7 审核回归 | ${reviewStatus} | 两个 P1 均在实际浏览器验证；每版 10 项真实 PDF；F3/F4/F6 核心反例及 F7 浏览器缓存升级检查 |
| CLI | ${load('reports/cli-checks.json').status} | 两引擎实际 0/2/3/130 退出状态；原文来源同公共契约 |
| PDF.js 独立构建 | ${load('reports/pdfjs-independent-build.json').status} | 无 MuPDF 安装、目录、下载依赖或产物代码；独立包缓存验证 |
| 两个交付包解压运行 | ${load('reports/delivery-check.json').status} | 独立目录启动、包内 R32 比较/定位/导出/释放；全部静态文件与 A/B 哈希一致；macOS 验证 |
| 浏览器 A/B 时间与正确性数据 | ${dataStatus} | 360 热比较 + 6 冷启动；逐轮原始数据与失败数 |
| 开发机时间/交互/取消预算 | ${timingStatus==='PASS'&&interactions.summary.every((s:any)=>s.status==='PASS')?'PASS':'FAIL'} | 九组时间预算；每引擎另 20 次全程交互和晚期取消 |
| 开发机性能预算 | ${budgetStatus} | 详见 engine-comparison.md，不代替参考机 |
| 普通 16 GiB 参考设备 | BLOCKED | 当前实测机为 M4 Max / 128 GiB |
| Linux 容器构建启动 | ${containerStatus} | ${containerEvidence} |
| 真实开发样本/独立留出 | BLOCKED | 未获得至少 3 对真实开发样本、3–5 对完整审阅及另 3 对不同来源留出 |
| 组织生产接入 | NOT_RUN | 没有执行发布、合并、OpenShift/Harness 部署；属于可选接入 |

许可：双引擎开发和本地比较已由用户明确授权，不因未购买商业许可中止。本地评估、对外分发、共享部署、生产及商业采购分别记录在 license-status.json；没有虚构组织批准。PDF.js/字体/解码器与 MuPDF 许可材料随包保留。

原 validation 的 PDF、source、expected、layout 未改变。既有失败保留在 reports/failures；样本编码修复只作用于新增机制 PDF。报告不以“Review”豁免控制用例的假变化，也不把 R25 的 must_detect=false 当作跳过。

已知边界：合成集属于单一受控模板族，不是独立真实留出；三类长文档有可用编号/键信息，不能代表所有混乱 PDF。图片无 OCR，表单/批注及未知编码按覆盖缺口提示；通用多栏、任意表格、签名有效性与矢量语义不作已验证承诺。PDF.js 的未渲染页面在 CLI/JSON 中可保持 run 精度，浏览器按需解析范围；这与文本比较完成状态分开。

另有一项测量缺口：物理统计不能回收采集前已经退出的短寿命 helper 的全部历史峰值；因此完整内存保持 BLOCKED。第一批缺失记录保留，未被后续测量覆盖。

解除剩余阻塞的最小条件：提供能覆盖短寿命浏览器进程的完整内存采集；提供普通参考设备或明确的目标设备验收环境；提供获准真实样本与封存留出及审阅结果；在实际公开分发/共享/生产范围确定后落实相应许可条件。私有 GitHub 审核仓库和上传已由用户授权；Draft PR 保留，未合并或生产部署，未上传真实保单。Linux CI 为独立补验证据，不能代替浏览器目标设备测量。
`);
writeFileSync('docs/pr-description.md',`# 同一审阅产品的 PDF.js / MuPDF 独立构建

实现从真实 PDF 提取到公共比较核心、双栏原文定位、覆盖提示与 JSON/CLI 导出。可靠主体/字段与表格键先绑定，所有内容变化默认可见；重复键金额和图像覆盖缺口保留。PDF.js 采用提取项与真实文字层范围，MuPDF 保留原生字符 quad，两侧必须使用同一明确引擎。

验证：两版各 32 对规则与浏览器位置通过，公共 ${core.numPassedTests} 项测试，CLI 状态及连续任务/取消通过；正式 A/B ${dataStatus}、开发机预算 ${budgetStatus}。PDF.js 在不安装 MuPDF 的独立环境构建通过。原标准答案未改，失败证据保留。

审核修复：F1–F7 ${reviewStatus}。章节内字段身份优先；严重内容解码错误传为缺口/失败；局部歧义保留独立增删；混合修改不误归续期；Form 矩阵、分侧精细定位评分及缓存升级均有回归。旧失败与旧性能保留，新产品以本报告 SHA 为准。

Linux 两变体 ${containerStatus}，证据见 reports/ci-review-fixes.json。普通参考设备、完整内存及真实业务/留出验收仍有缺口。私有审核仓库已获授权；保留 Draft，未合并、未生产部署。
`);
for(const engine of engines){
 const rules=load(`reports/rules-${engine}.json`),browser=load(`reports/browser-rules-${engine}.json`),interaction=interactions.summary.find((s:any)=>s.engine===engine),stats=ab.summary.filter((s:any)=>s.engine===engine);
 writeFileSync(`docs/acceptance-${engine}.md`,`# ${engine} 独立版本验收\n\n产品冻结提交：${ab.commit}。共用核心/UI/profile/评分器，单个任务两侧固定使用本引擎。\n\n| 项目 | 状态 | 证据 |\n|---|---|---|\n| 32 对原规则 | ${rules.status} | reports/rules-${engine}.json |\n| 32 对浏览器精细来源位置 | ${browser.status} | reports/browser-rules-${engine}.json |\n| 浏览器全流程 | PASS | reports/browser-tests-${engine}.json；${browserCounts[engine]} 组，含新审核回归及连续 20 次任务/取消 |\n| 6 项机制 PDF | PASS | reports/pdf-checks-${engine}.json |\n| 审核真实 PDF 回归 | ${load(`reports/review-regressions-${engine}.json`).status} | 每版 10 项，reports/review-regressions-${engine}.json |\n| CLI 0/2/3/130 | PASS | reports/cli-checks.json |\n| 热比较 | ${stats.every((s:any)=>s.successes===20)?'PASS':'FAIL'} | 180/180；9 组 × 20 次，reports/engine-ab.json |\n| 时间预算 | ${stats.every((s:any)=>s.timingBudgetStatus==='PASS')?'PASS':'FAIL'} | 同上逐轮原始记录 |\n| 全程交互/晚期取消 | ${interaction.status} | 20 次，reports/interaction-profile.json |\n| 完整内存 | BLOCKED | 短寿命子进程历史峰值覆盖不完整 |\n| 目标/普通参考设备 | BLOCKED | 当前为 M4 Max / 128 GiB 开发机 |\n| Linux 容器 | ${containerStatus} | reports/ci-review-fixes.json；旧本机 BLOCKED 另存 |\n\n${engine==='pdfjs'?'PDF.js 独立安装与构建 PASS：独立缓存和目录内没有 MuPDF 依赖、资源或运行时请求。CLI 位置为 run/提取项范围，浏览器实际文字层范围另行测量；未以段框冒充字符位置。':'MuPDF 保留原生字符 quad；非 BMP 的 fromCharCode 问题由随包版本化补丁修复。实际包许可为 AGPL-3.0-or-later，本轮本地开发评估已授权；未声称外部分发/共享/生产许可已落实。'}\n\n可运行产物：delivery/policy-compare-${engine}.tar.gz；解压执行 Node 24 的 node server.mjs。源码开发/构建/验收入口分别为 pnpm dev:${engine}、pnpm build:${engine}、pnpm verify:${engine}。\n\n本版本功能与本地时间测量通过，**工程综合验收 BLOCKED；业务试点 BLOCKED**。限制、第三方范围及最小缺失条件见 acceptance-report.md 和 engine-comparison.md。\n`);
}
console.log({dataStatus,timingStatus,budgetStatus,attempts:ab.attempts.length,productRevision:ab.commit});
