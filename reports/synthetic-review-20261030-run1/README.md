# 独立合成 PDF 首轮执行报告

**执行完成，但不能写成全套符合预期。** 17 对固定 PDF × PDF.js / MuPDF，共 34 次提取、比较及原有 Python 分诊均成功调用；两种浏览器构建成功。14 对当前能力检查中，12 对在两个引擎都符合本项作者预期；P10 的自动记录归属证据不足；P11 已证实一项原文位置错配：没有改动的 789 行 `USD 3000` 的 `USD ` 被标成删除。三类边界观察另列，未计算总准确率。

这是一轮新输入试用发现，**不重开 #2、不推翻其已完成的工程验收**。没有修改产品、PDF、作者预期或原分诊器，也没有将 Draft PR #12 合并或改为待审。本报告不提出新增 OCR、通用表格或跨页系统开发要求。

## 被测版本与完整性

- 被测提交：`6fc78dc77b417fc374f7b5505ae11fa1be1a8afe`；运行前工作区干净。相对基准产品 `33ec5ba4448a686d65490f15e7be8c32d30bd74c` 只增加独立测试物料。
- 核心：`policy-compare/0.1.0+row-identity.36+facts.6+repeat.9+ops.4`；分诊：`renewal-triage/40`；PDF.js：`6.4.299+strict-streams.1`；MuPDF：`1.28.1+scalar-fix.1`。
- 使用 Node `v24.22.1`、pnpm `10.12.1`，依仓库锁文件安装，未升级依赖。执行命令、输入 SHA、退出码、运行目录及原分诊汇总见 [run-summary.json](run-summary.json)。
- 34 份 PDF / 36 页；每例 PDF、changes、identity 的 68 项 SHA 核对一致。作者 ZIP SHA 为 `baa17ee010064c1287346eafa9c951caf75845c7f095b9e4e4871159077b1345`。详细核对及原始证据归档哈希见 [integrity.json](integrity.json)。
- 32 份原生文字 PDF：两引擎在每个作者绘制框内取得的文字，去除空白后均与作者内容一致；此项只检查文字保留和位置对应，不证明阅读顺序、记录归属或用户体验。E03 两份扫描 PDF 均无提取文字，符合物料定义。源数据见 [source-audit.json](source-audit.json)。
- 代表性源 PDF 的 18 页用 Poppler 渲染并目视核对，覆盖 P02、P05、P10、P11、P12、E01、E02、E03；未将作者先前的 36 页物料审阅写成本轮全部重做。渲染在 [source-render/](source-render/)。

## 每项结论

下表的两引擎分诊与人工结论分别列出。分诊中的 `not_evaluable` 不等于产品漏检；`complete_for_scope` 不等于作者预期通过。每个引擎的独立记录与详细理由在 [review.json](review.json) / [review.csv](review.csv)，全部实际卡片与来源摘录在 [raw-cards.md](raw-cards.md)。审阅代价使用实际卡数与核对动作描述，没有伪造人工分钟数或真实使用者计时。

| 样本 / 作者修改 | PDF.js 原分诊 / 卡数 | MuPDF 原分诊 / 卡数 | 人工结论（两引擎） | 实际核对及审阅代价 |
|---|---|---|---|---|
| P01 逐字节相同 | 无事件 / 0 | 无事件 / 0 | 符合该项预期 | 没有变化卡、未决或覆盖缺口；不将无事件解释成评价了移动能力。 |
| P02 1315：100→2000，1760 的1000不变 | correct×1 / 1 | correct×1 / 1 | 符合该项预期 | 完整金额及各自来源正确；点击后只在1315的 Limit 位置高亮，邻行不被借用。1卡即可复核。 |
| P03 两条记录独立100→200 | correct×2 / 2 | correct×2 / 2 | 符合该项预期 | 两卡分别为1315、1760，改变的字符 ID 和绘制位置不同；两次出现均保留。需查2卡。 |
| P04 1315：100→300；1760：400→200 | correct×2 / 2 | correct×2 / 2 | 符合该项预期 | 两条完整原文分别对应，没有100→200的虚构卡。需查2卡。 |
| P05 1315 只改 War Limit | correct×1 / 1 | correct×1 / 1 | 符合该项预期 | 增删来源都在 x=450 起的 War 格，x=320 的同额 Hull 格未作为改变来源。浏览器两侧高亮在 War 列。1卡+表头核对。 |
| P06 删除有两个USD100的1315行 | correct×1 / 1 | correct×1 / 1 | 符合该项预期 | 完整来源含本行两个不同格的金额；其余行保留。显示未配原文，没有确定业务退出身份。1卡，需区分纸面删除与业务含义。 |
| P07 1315/Alpha 换成9999/Orion，同额同位置 | correct×2 / 2 | correct×2 / 2 | 符合该项预期 | 一侧未配旧原文、一侧未配新原文，rowKey为空；没有确定同一业务记录。2卡人工看两侧。 |
| P08 同行 Hull100→200、War300→400 | correct×1 / 1 | correct×1 / 1 | 符合该项预期 | 两项增删分别落在 Hull 和 War 原格，未交叉配对。1卡含2项改变，需看两列。 |
| P09 普通部分格续行 per annum→per month | correct×1 / 1 | correct×1 / 1 | 符合该项预期 | rowKey1315及原文完整，金额未变，续行未成为新身份。1卡。 |
| P10 全格两行、字体分片、另改456金额 | not_evaluable×2 / 11 | not_evaluable×2 / 11 | 证据不足（自动记录归属） | 原文及实际2000/2500均可定位；(a)未成为确定行键，2组未决清楚显示。但456被拆成旧整行和新侧多个无记录卡，不能把本轮写成正常记录自动归属已确认。11卡+2组，明显增加跨卡核对。见下文。 |
| P11 全格三行 annual→monthly、另改456金额 | not_evaluable×2 / 2 | not_evaluable×2 / 2 | 已证实违约（来源位置） | 第三行文字保留、(a)/(b)无确定行键；但未变789行的USD前缀被标删除。另一卡单列新增USD2500，金额自动归属仍不足。两卡还需回看三条记录。见 F1。 |
| P12 第一表删MSN123，第二表增Registration123 | correct×2 / 2 | correct×2 / 2 | 符合该项预期 | 两卡均为单侧未配原文，无跨表row-identity；来源分别位于表一 y=159 和表二 y=291，且各自对应作者表范围。浏览器点击确认两张表。2卡+两张表头核对。 |
| P13 Page3of10→4of10 | correct×1 / 1 | correct×1 / 1 | 符合该项预期 | 原文及数字变化保留；facts为空，作者允许不分类。没有声称实际引用页正确。1卡。 |
| P14 金额、百分比、字面#表达 | correct×3 / 3 | correct×3 / 3 | 符合该项预期 | 三项编辑与原文来源保留，facts均为空，没有虚假页码事实。只证明未作虚假声明，不冒充评分器对反事实的独立拒绝测试。3卡。 |

## F1：P11 未改动的另一条记录出现删除高亮

**直接证据**：P11 的两份 PDF 中，789 / Delta Air / Terms 都是 `USD 3000`，作者位置同为左上坐标框 `[320,281,366.13,294]`，没有纸面改动。真正修改为123行 `annual→monthly`、456行 `USD 2000→USD 2500`。

两引擎实际都输出如下组合：

```text
卡A：空 → USD 2500
卡B：USD 2000 USD 3000 0.10% net annual
  → USD 3000 0.10% net monthly
卡B 的 delete 操作："2000 USD "
  "2000" 来源：456 / Terms
  "USD " 来源：789 / Terms（原本没有修改）
```

卡B的确定增删位置把789行的 `USD ` 标成红色，同时把旧456行的 `USD ` 与新789行的 `USD ` 当作相等文字使用。它并没有声称789的数额变了，也没有把(a)/(b)确定为身份；**这里确认的是跨记录来源错配及错误删除高亮，不夸大成金额漏检、整行身份错误或分诊假通过**。Python保持`not_evaluable`，没有接受这些卡证明两个预期事件。

- PDF.js 卡：`d-8aa3490d88480f5d12b7`；MuPDF卡：`d-4edf27fb7d5291353857`。
- 完整源字符、页码、作者格、操作在 [source-audit.json](source-audit.json)；原始产品JSON和两侧Doc在归档 `P11/<engine>/`。
- 实际点击两引擎卡片，目视确认789行的USD被红色覆盖：[PDF.js截图](browser/P11-pdfjs-combined.jpg)、[MuPDF截图](browser/P11-mupdf-combined.jpg)。对应DOM、SVG点位、界面导出JSON也在同目录，文件前缀相同。
- 原PDF及作者布局没有物料冲突；逐框提取文字核对一致。不是扫描、缺字或错误预期造成。

**根因范围（代码及保存Doc的诊断）**：P11两侧按列提取。`structure.ts` 的行恢复从提取顺序中取有限窗口（约4个字号）；在读到后面较远的456行时，窗口就终止，尚未读到同一基线的其他列。随后段落拼接没有把回到页面较上位置的另一列当成新记录边界，形成如 `789 Alpha Air Holdings Limited`、`Delta Air USD 1000 per annum net` 的混合单元。没有恢复出行的单元进入 `index.ts` 的 `joint-local-alignment` 聚合，文字编辑算法据文本相等对齐重复的USD，导致这次错配。

可审查的诊断结果在 [structure-diagnostic.json](structure-diagnostic.json)，调用入口 [inspect-structure.mts](inspect-structure.mts) 只把已保存Doc传给原产品的`structure()`，未传入作者答案。代码范围：`packages/compare-core/structure.ts` 542–559、699–722；`packages/compare-core/index.ts` 1276–1316及616起的`textOps()`。这定位了故障链条，未声称已选定或验证修复方案。本轮不修改。

## P10 的保留结论与分片覆盖

P10保住了最重要的保守限制：无(a)确定行键，旧侧两条基线有“局部结构与身份未确定”提示，原文未被丢弃。但是新侧按列提取后没恢复出正常456行，实际为11张卡。其中旧 `456 Beta Air USD 2000`、新 `456`、`Beta Air`、`USD 2500` 分开呈现。点击旧整行与新2500可到对应印刷位置：[PDF.js](browser/P10-pdfjs-new2500.jpg)、[MuPDF](browser/P10-mupdf-new2500.jpg)。这证明两侧可供人工核对，**不能据此说产品已独立确认456的金额对应**；也没有证据把它描述成漏掉金额。

本项允许保守拆卡，卡数本身不是违约。因此没有仅凭11卡或`not_evaluable`判失败。整体结论“证据不足”针对正常记录自动归属；原文保留和不误定行键两项已确认符合预期。

实际提取项有引擎差异：PDF.js在P10/P11都保留`Alpha`、空白、`Air`为不同textItems，故覆盖了真实提取分片。MuPDF在同一line内保留Helvetica/Helvetica-Oblique字符，但`Alpha Air`已经合为一条Doc line，不能宣称它也跑到了与PDF.js相同的多提取片段入口。两引擎Doc均完整保存。

## 边界观察，不并入14对能力结论

| 样本 | PDF.js / MuPDF实际结果 | 结论与审阅代价 |
|---|---|---|
| E01 跨页续行，文字未改 | 两引擎均complete_for_scope，2卡，0未决；一张原行替换卡移除Holdings/and war/per annum，另张将三段作为第2页单侧新增原文。没有金额变化卡。空changes使分诊无事件、2卡未解释。 | **证据不足（完整移动/跨页对应）**。文字及跨页来源仍在，但没有完整跨页移动表达；需将第1页删段与第2页新增段人工拼回。沿用R24边界，不要求本轮新增通用跨页支持。 |
| E02 三行重排，数值未改 | 两引擎均complete_for_scope，1张Moved卡：2156/Delta Air，原文相同，旧第3行→新第1行；0未决。其余两行没有单独移动卡。空changes，分诊无事件、1卡未解释。 | **证据不足（完整顺序核验）**。实际发现一个移动且未编造金额变化；不能据此证明三个记录的顺序变化完整评价。1卡，仍需对照整表。沿用R23。 |
| E03 纯扫描图片可见100→2000 | 两引擎均partial，0文字卡，2处image_only覆盖；Doc字符数为0。分诊not_located×1。 | **符合该项预期（覆盖声明）**。两引擎界面明确“此页只有图片，正文文字尚未比较”，两侧整页黄色覆盖，未把0卡写成文档无变化。金额本身不在OCR能力内，需人工阅读。 |

## 浏览器实际核对

同一被测产品源码分别构建，测试页面为PDF.js `http://127.0.0.1:8091/`、MuPDF `http://127.0.0.1:8092/`，没有替换用户原来8081页面的文档状态。通过文件选择器载入固定PDF、点击“开始比较”、实际点击卡片，并保存截图、DOM和高亮SVG、界面导出JSON。必查P02/P05/P10/P12和E03都做了两引擎检查；另增P11以确认上述位置问题，没有替换旧浏览器脚本的目录来冒充验收。

- P02：两侧完整卡片；高亮改变部分位于1315金额，旧100中的1与新2000中的20；未要求把未改变的00也涂色。
- P05：高亮x约473.89的首位数字，确在War Limit，非Hull Limit；[PDF.js](browser/P05-pdfjs.jpg)、[MuPDF](browser/P05-mupdf.jpg)。
- P10：分别点击旧456整行与新2500单侧卡，另一侧无对应高亮是单侧卡的实际表现；未宣称双侧自动配对通过。截图、DOM中保留2组局部未决。
- P12：分别点击旧表一123和新表二123，只有各自一侧的正确表范围高亮；[PDF.js](browser/P12-pdfjs-new-table2.jpg)、[MuPDF](browser/P12-mupdf-new-table2.jpg)。
- E03：[PDF.js](browser/E03-pdfjs.jpg)、[MuPDF](browser/E03-mupdf.jpg)明确覆盖不足。
- CLI与16份界面导出逐字段核对：MuPDF及E03/PDF.js完全一致；其余PDF.js仅有纵向几何值、浏览器文字层范围与提取快照哈希差异，文字、字符ID、操作、匹配和身份字段一致。逐项差异路径见 [browser/cli-correspondence.json](browser/cli-correspondence.json)。未将PDF.js界面与CLI称为整个JSON完全相同。
- 两页面读取到的warn/error日志为空，保留在`browser/*-console.json`。本轮不作设备性能或真实使用者效率验收。

## 复现和证据导航

在固定物料提交上，按[原任务入口](../../validation/synthetic-review-20261030/README.md)运行即可，不需要生成新PDF。保留本轮报告的分支也可复跑；产品/预期字节相同，但runner会如实记录新的Git提交和工作区状态。输出目录需另取未存在名字。

```bash
export PATH=/Users/lyuhongwang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
python3 validation/synthetic-review-20261030/run-pack.py \
  --repo "$PWD" --out /tmp/policy-compare-synthetic-independent-rerun
```

原始证据：[raw-evidence.tar.gz](raw-evidence.tar.gz)，含34次完整两侧Doc、result、比较与分诊日志及根run-summary；归档逐成员读回并核对SHA，[raw-sha256.json](raw-sha256.json)记录全部文件。可解压到独立目录重评，无需重新提取PDF。

```bash
mkdir -p /tmp/policy-compare-synthetic-evidence-readback
tar -xzf reports/synthetic-review-20261030-run1/raw-evidence.tar.gz \
  -C /tmp/policy-compare-synthetic-evidence-readback
python3 reports/synthetic-review-20261030-run1/summarize-evidence.py \
  /tmp/policy-compare-synthetic-evidence-readback
node --import tsx reports/synthetic-review-20261030-run1/inspect-structure.mts \
  /tmp/policy-compare-synthetic-evidence-readback
```

两份辅助脚本仅整理来源及诊断，不给PASS分数、不改原结果，也不代替现有评分器。浏览器点击证据需实际界面操作重做。

本轮到报告发现为止。R16/R18/R23/R24、航空拆卡成本与#91归属限制保持原边界；合成PDF不替代真实客户试用、业务签收、部署或指定设备性能。旧CI和工程结论继续作为各自原范围证据，本轮没有为了报告重复运行既有全套测试，也没有宣称这批合成PDF已经被CI覆盖。
