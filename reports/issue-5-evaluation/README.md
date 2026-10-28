# #5 评分器与共同分诊：交付说明

对应 [#5](https://github.com/wlvh/policy-compare/issues/5)。本目录交付**评价工具**（独立评分器 + 续保分诊脚本）及其对冻结 v3 结果的重评，不是产品验收，也不是业务验收：没有修改产品核心、界面或作者答案，冻结 v3 中的产品问题照实报告。

| 项 | 值 |
|---|---|
| 分支 | `fix/issue-5-evaluation`（从 `85dae9820651ae82a216a18efc0da4db8522045e` 建立） |
| 代码提交（本目录所有结果都由它产生） | `47d4b503eab1f33b906edcbf589ae67af187cc4a` |
| 被评价的冻结产品结果 | `reports/v3-review/results/*.json.gz`，产品提交 `4330c1b`，核心 `policy-compare/0.1.0+row-identity.1` |
| 输入样本 | `jiehuan/falcon-mini@0eef67d`，`scripts/fetch-renewal-samples.mjs` 校验大小、Git blob SHA-1、SHA-256 |
| 工具 | Node v24.19.0、pnpm 10.12.1、Python 3.13.17（分诊只用标准库）、@playwright/test 1.64.1 |
| 机器可读的环境、哈希、退出码 | [`environment.json`](environment.json) |

**4 份 v3 结果解压后的 SHA-256 全部与 `reports/v3-review/environment.json` 一致**（[`verification/result-sha256.txt`](verification/result-sha256.txt)）。

## 1. 评分器：身份检查的适用范围

“身份检查”指核对变化挂在正确的主体上：哪一方当事人的哪个字段，或表格里的哪一条记录。改动在 `tests/evaluation/scorer.ts`。

每个事件的身份检查现在明确属于三类之一，写在 `events[].identity.applicability`：

| 类别 | 事件 | 处理 |
|---|---|---|
| `checked`（已检查） | `risk_details.*`（主体/字段）、`aircraft_schedule.*`（行键/字段）、R25 重复身份 | 原有检查不变，全部条件满足才通过 |
| `not_applicable`（N/A） | 11 个已知事件、10 个用例：R05、R06、R12、R13 E1/E2、R14、R29、R30、R31（条款），R09（重复页眉限额），R19（文档状态） | 只免除身份一项；文字、操作类型、类别、位置、可见性、完整性照查 |
| `unsupported`（无法评价） | 不在上表、也没有检查能力的路径；或 N/A 登记的路径与事件不符 | 事件为 `NOT_EVALUATED`，不进入通过数 |

- N/A 名单按**事件 ID + 逻辑路径**逐条登记（`IDENTITY_NOT_APPLICABLE`），不按 `clauses.` 前缀放行。同一事件换成别的路径，就是无法评价。
- R27/R28 是覆盖警告事件，走单独分支（`branch: "coverage_warning"`，`identity: null`），不计入身份事件。
- 未知的检测要求（`detection_requirement`）从原来的 FAIL 改为 `NOT_EVALUATED`：这是工具缺覆盖，不是产品已被证实出错。
- 不管身份检查属于哪一类，其他检查只要有一项失败，事件就是 FAIL。这类失败是已证实的产品错误，不会因为身份无法评价而被掩盖。

**总状态改为三值**：`PASS` / `FAIL` / `NOT_EVALUATED`。CLI（`scripts/acceptance.ts`）和浏览器（`tests/browser/rules.spec.ts`）共用 `summarize()`：

- `passed` 只数 PASS；`failed`、`notEvaluated` 分别列出用例；其他任何未知状态都算失败；
- 运行总状态：有失败即 FAIL，否则有无法评价即 NOT_EVALUATED，全部通过才 PASS；
- 退出码只有 PASS 时为 0；浏览器测试断言“非 PASS 列表为空”，所以 NOT_EVALUATED 也会让测试失败；
- 报告新增 `identityApplicability`：`checked`、`notApplicable`、`unsupported`、`coverageWarningEvents`、`unknownDetectionBranch` 五个事件 ID 清单。

### 在固定提交上的结果

| 检查 | MuPDF | PDF.js |
|---|---|---|
| 原 32 对规则（Node，`pnpm test:rules:*`） | PASS 32/32 | PASS 32/32 |
| 原 32 对规则（真实浏览器精细位置，`rules.spec.ts`） | PASS 32/32 | PASS 32/32 |
| 身份：已检查 / N/A / 无法评价 / 覆盖警告 | 16 / 11 / 0 / 2 | 16 / 11 / 0 / 2 |

证据：`verification/rules-*.json`、`verification/browser-rules-*.json` 及对应 `.log`。浏览器两次都显式设置 `POLICY_BROWSER_CHANNEL=bundled`，并分别设置 `POLICY_ENGINE=mupdf` 和 `POLICY_ENGINE=pdfjs`。本机预装的是 Chromium 1243，而 Playwright 1.64.1 默认要 1248，所以本地用了一个不提交的 `tmp/playwright.local.config.ts`，它只多设置了 `launchOptions.executablePath`。CI 用自己安装的浏览器，在同一代码上跑同一个测试（链接见 PR）。

### 新增评分器测试（`tests/scorer.test.ts`，原 19 项保留，新增 13 项，共 32 项）

- 用真实 32 对的 `expected.json` 核对：恰好 11 个 N/A 事件、分布在 10 个用例，与登记表完全一致；没有 unsupported；R27/R28 不在 N/A 名单。
- N/A 只免除身份：主体写错仍通过；错页、隐藏、操作类型错、类别错、无输出、无理由的 partial，各自都判 FAIL（6 项）。
- 未知路径为 NOT_EVALUATED 而不是 PASS；同一个未知路径如果没有输出，判 FAIL。
- N/A 登记的事件换了路径，判 NOT_EVALUATED。
- 未知检测分支判 NOT_EVALUATED。
- 汇总：PASS + NOT_EVALUATED 汇总为 NOT_EVALUATED；含 FAIL 为 FAIL；未知状态字符串算失败。
- R13 的原样移动与相似新增不混淆：把移动“吃成”局部替换，两个事件都 FAIL；把新增误报为移动，E2 FAIL；新增放到移动段的位置，E2 FAIL。

另外做了反向验证：把“未知路径”的处理临时改回默认放行，新增测试中有 2 项变红，确认这些测试能抓住旧行为。

`row-identity.test.ts` 的 9 个身份反例 + 3 个看守未改动，`pnpm verify:core` 共 73/73 通过（原 60 + 新 13）。

## 2. 续保分诊：修了什么

`scripts/renewal-triage.py` 仍是同一个 CLI、同一个文件，只依赖标准库：

```bash
python3 scripts/renewal-triage.py CHANGES_JSON RESULT_JSON --events OUT_EVENTS_JSON > OUT_SUMMARY_JSON
```

**术语**：
- **原子**：作者一个事件里的一处具体修改。替换事件的每条 edit 是一个原子；新增/删除表格行的每一格是一个原子；移动事件是段首片段加上段内每条 edit。
- **卡片**：产品输出里的一条差异（`differences[]`）。
- **单元**：产品来源位置上的 `unitId`，即产品切出的一行或一段。

| issue 盲点 | 现在的做法 |
|---|---|
| 1 新增/删除的各格可能来自不同记录 | 所有格必须落在**同一个单元**里，这个单元带有预期记录标识，所在卡片的类型与事件相同（新增对新增、删除对删除）。格子只出现在别的单元记为 `outside_record`；落进邻行的替换卡记为 `merged_into_neighbour_card`；和另一条记录配成替换记为 `paired_with_other_record`（归属错误）。 |
| 2 未决组的左右命中合成一个布尔 | 按组、按侧、按事件页分别判断，每次命中都记下 `{group, side, page, unitId}`。只命中一侧就是 `one_side_only`，不会报成双侧找到。 |
| 3 把前两个未变格当身份 | 预期标识只取自作者答案：先取作者 block ID 点名的格（`ac_1315`→`1315`、`rate_1_1`→`1.1`、`cp_M-FNKB_Selwyn`→`M-FNKB`、`Selwyn…`）；没有时取第一个未变的名称类格，不取金额、百分比、日期。标识必须与变化在**同一来源单元**中出现，两侧都要。 |
| 4 用同事件最高类别代替各原子 | 逐原子记录接受卡片的类别（`productCategories`、`category`）和类别核对（`categoryCheck`：`consistent`/`review`/`upgraded`/`downgraded`/`outside_product_roll_forward_definition`）。`bestProductCategory` 保留，但只按接受的卡片计算。 |
| 5 候选卡被提前标 used | 先列出候选卡（文字和页码对上），身份核对后才算接受卡。只有接受卡才从“未解释卡片”中扣除；被拒的候选卡仍算未解释，另计 `unexplainedCandidateCards`。 |
| 6 页面附属被无声过滤 | 事件文件现在含 177 项正文 + 5 项附属（`scope: page_furniture`）。产品结果的数据格式里没有“页面附属”这一角色，所以附属事件全部记为无法评价。附属项只统计带有作者原文的正文卡片数量和类别，比较时忽略空白，因为条码文字被提取成了逐字符带空格。 |
| 7 排除事件与顺延 | 排除事件保留 ID、block、原始 edit 文字和原因，不计入成功；计分事件里个别被排除的 edit 也单独列出。作者标的 RollForward（14 项正文）与产品定义的保期顺延（每对 1 项：航空 #3、商务航空 #5）分开列。 |

**归属矛盾如何判**：
- 卡片的 `rowKey` 不是本行任何一格，判为矛盾；
- 变化所在单元里出现同表（同一 block 前缀）另一行的主标识、却没有本行标识，也判为矛盾；
- 但如果这张卡正是那一行自己的事件接受的卡，就不算矛盾。这一步靠两遍计算：第一遍收集每个事件接受的卡，第二遍再判归属错误。原因是不同行常有相同的 old→new，例如保费表每行都是 `0.38%→0.40%`，承保人行的日期也相同。在 v3 数据里，每个引擎第一遍都有 54 条矛盾候选（按原子计，几乎全在商务航空保费表），第二遍全部被各自所属的行事件认领，最终没有一项被误判为归属错误。

**分散展示**（删除和新增分在两张卡上）：只有在两侧都能核对到同一记录时才算 `split_attributable`。表格行要求两侧单元都带本行标识；段落要求卡片显示了作者段落里变化之外至少 10 个字符的上下文。只因文字分别出现，记为 `separate_cards`（无法评价）。

## 3. 字段说明（供 #2 直接集成）

### 逐事件 `*.events.json`（数组）

| 字段 | 含义 |
|---|---|
| `id`、`block`、`kind`、`authorCategory`、`authorExpect`、`pages` | 作者答案原样 |
| `scope` | `body` / `page_furniture` |
| `verdict` | 见下表 |
| `outcome`（**语义已收紧**） | 旧字段。`complete` 现在要求 `verdict=correct`；`partly_complete` 表示至少一个原子正确；`not_found` 表示全部原子未定位；附属事件为 `page_furniture` |
| `atoms`（**取值已扩充**） | 旧字段，仍是逐原子状态字符串。`same_card_without_record_cells` 改名为 `same_card_identity_unconfirmed`；表格行格子由 `found` 改为 `in_record`/`outside_record`/… |
| `atomEvidence[]` | 每个原子的作者旧/新内容、作者类别、`state`、`verdict`、`reason`；候选卡 `candidates[]`（卡片 ID、类型、类别、`table`/`rowKey`/`confidence`、身份状态及理由、`identityCells` 即每侧所在单元和找到的标识、左右来源引用 `{page, unitId, rawRange, text}`）；接受卡 `accepted[]`；未决组命中 `unresolved[]`；表格格子命中 `cellHits[]`；`productCategories`、`category`、`categoryCheck` |
| `row` | 表格行事件才有：`expectedIdentity {cells, source}`、`acceptedRecord`（接受卡及其来源引用）、`fullRowRecovered`（作者整行各格是否都在接受的记录单元中）、`primaryIdentityOnRecord`、作者两侧格数 |
| `acceptedCards`、`bestProductCategory`、`excludedAtoms`、`policyPeriodRollForward`、`note` | 如名 |

来源引用只记页码、`unitId`、`rawRange` 和截短的文字，不复制字符 ID 或坐标数组。

| `verdict` | issue 中的类别 |
|---|---|
| `correct` | 已检出且归属正确 |
| `misattributed` | 归属错误（含“一个正确结果外加错误归属”） |
| `one_side_only` | 只找到一侧 |
| `split_attributable` | 可归属的分散展示 |
| `not_evaluable` | 无法评价（找到了，但归属无法核对：身份不在单元中、分卡缺上下文、只在未决组、格子散在别的单元、并入邻行卡） |
| `not_located` | 分诊未定位（是脚本没找到，不等于产品漏掉） |
| `partly_located` | 部分原子正确、其余原子未定位 |
| `excluded` | 明确排除 |

### 汇总 `*.summary.json`（stdout）

保留旧字段 `bodyEvents`、`excluded`、`scored`、`outcomes`、`sameCardWithoutRecordCells`、`authorMaterial`、`authorMaterialShownOnlyAsCosmetic`、`cards`、`cardsOver600Chars`、`unexplainedCards`、`unexplainedMaterialCards`、`unresolvedGroups`、`status`、`coreVersion`、`extractor`。其中三项语义有变化：

- `unexplainedCards`：既不是任何正文事件的接受卡、也不带附属原文的卡片。旧语义是“没被当作候选命中过的卡片”。这个数字仍是噪声估计，**不是误报率**。
- `sameCardWithoutRecordCells`：同卡但身份未确认的事件。
- `excluded[]`：多了 `block` 和 `edits`（原始文字）。

新增：`tool`、`inputs`（两个输入的路径和 SHA-256）、`authorEvents`、`pageFurnitureEvents`、`excludedAtomsInScoredEvents`、`verdicts`、`verdictEvents`、`atoms`、`atomVerdicts`、`atomCategoryChecks`、`tableRowEvents`（`changeCorrectlyAttributed` 与 `fullRowRecovered` 分开列，另有 `acceptedWithoutPrimaryIdentity`）、`rollForward`、`pageFurniture`、`acceptedCards`、`pageFurnitureCards`、`unexplainedCandidateCards`、`limitations`。

## 4. 冻结 v3 重评结果

完整逐事件证据见 `{aviation,bizav}_2024_vs_2025-{mupdf,pdfjs}.{events,summary}.json`。正文共 177 项（航空 93 + 商务航空 84），附属 5 项（1 + 4）。

| 运行 | 计分 | 正确归属 | 可归属分散 | 只找到一侧 | 无法评价 | 部分定位 | 分诊未定位 | 归属错误 | 排除 |
|---|---|---|---|---|---|---|---|---|---|
| 航空 MuPDF | 92 | 79 | 1 | 1 | 4 | 3 | 4 | 0 | 1 |
| 航空 PDF.js | 92 | 81 | 1 | 1 | 4 | 2 | 3 | 0 | 1 |
| 商务航空 MuPDF | 82 | 73 | 3 | 1 | 2 | 1 | 2 | 0 | 2 |
| 商务航空 PDF.js | 82 | 74 | 3 | 1 | 2 | 0 | 2 | 0 | 2 |

| 表格行事件 | 航空（两引擎相同） | 商务航空（两引擎相同） |
|---|---|---|
| 行事件数 | 55 | 46 |
| 变化归属正确 | 51 | 43 |
| 其中整行各格全部恢复 | 44 | 36 |
| 变化正确但整行未恢复 | #19、#20、#55、#56、#61、#70、#71 | #43、#47、#49、#50、#51、#69、#71 |
| 接受卡上没有主标识（靠作者 block 中的第二个名字确认） | 无 | #69（卡上有 Selwyn 全名，没有 `M-FNKB`） |

**未通过的事件**（PDF.js；MuPDF 另有航空 #28、#82 的段首片段未定位，以及商务航空 #19 部分定位）：

| 事件 | 结论 | 证据要点 |
|---|---|---|
| 航空 #3 保险期间 | 分诊未定位 | 序数上标被提取成 `16 th`。人工线索：卡片 `d-306b47ea840fb21e9ecf` 显示该期间变化，类别 Material（未被识别为保期顺延） |
| 航空 #4、#15 新增 1.8 | 分诊未定位 | 条目编号单独成卡。人工线索：`d-09aa5e136f5a58e261cb`、`d-70ea01b89131b2202afe` 为单独的 `1.8`（Cosmetic），正文分别在 `d-81784344…`/`d-43bd24c5…`、`d-c9b951ab…` |
| 航空 #6 `HOWEVER:`→`However:` | 无法评价 | 删、增分在两张卡，作者段落就是这一个词，没有可核对的上下文 |
| 航空 #7 (b) 总限额 | 可归属分散 | 删卡、增卡都显示了作者整句 |
| 航空 #32、#34 | 部分定位 | 含序数上标的日期原子未定位，其余原子同卡正确 |
| 航空 #50、#67 删除的飞机/发动机行 | 无法评价 | 整行被拆散。#50：MSN、注册号、年份、座位、金额在同一单元，机型名在另一单元，承租人跨行未定位。#67：型号和 ESN 在同一单元，存放地跨行未定位，金额和状态在另一单元 |
| 航空 #60 转租 | 只找到一侧 | 旧承租人 `Aurora Regional Airways` 跨行；卡 `d-e4ce9055…` 左侧只有 `Aurora Regional` |
| 航空 #91 费率表 2.1 | 无法评价 | 三个金额同卡，但卡所在单元没有行号 `2.1` |
| 商务航空 #9 医疗费用段 | 可归属分散 | 作者 `expect` 就是删除 + 新增 |
| 商务航空 #16、#17 条款表删 AVN2000A、增 AVN124 | 无法评价（`merged_into_neighbour_card`） | 删除行并入 LMA5219 的替换卡 `d-76ccb299…`，新增行并入 AVN111→AVN111A 的替换卡 `d-b7c98236…`。**旧脚本把这两项算作完整** |
| 商务航空 #23 付款日、#35 门槛金额 | 分诊未定位 | 日期或币种跨行。人工线索：`d-c06f87a2…`（`2024.`→`2025.`）、`d-7a60b620…`（`50,000,000`→`70,000,000`） |
| 商务航空 #24 承保前提 | 只找到一侧 | 新句跨行，分成 `d-272585e1…` 和 `d-b384cc47…` 两张卡，脚本找不到整句 |
| 商务航空 #27、#73 | 可归属分散 | #73 两侧卡片都带 `Dubai (OMDW)` |

**类别与顺延**：
- 作者 Material 被显示为 Cosmetic 的：0 项。
- 保期顺延（产品定义）：航空 #3 未定位（见上，卡片为 Material）；商务航空 #5 定位成功，显示为 Material，`categoryCheck=upgraded`，即产品没有把它判为顺延。
- 其余 12 项作者 RollForward（UMR、参考号、付款日）不在产品的顺延定义内，只标注，不判对错。

**页面附属**（全部无法评价）：

| 运行 | 附属事件及带原文的正文卡片 |
|---|---|
| 航空 H1（UMR） | 34（MuPDF）/ 35（PDF.js）张，全部 Cosmetic |
| 商务航空 H1 UMR | 38 张 Material |
| 商务航空 H2 条码 | 35 张 Cosmetic |
| 商务航空 H3 Draft 水印 | 38 张 Cosmetic |
| 商务航空 H4 页码 | 0 张。作者写的是模式 `Page n of N`，无法按原文匹配；页码与 UMR 在同一单元，已含在 H1 的卡片里 |

**剩余卡片**：商务航空 198 张卡中，81 张被正文事件接受，107 张带附属原文，剩 10 张未解释（其中 6 张 Material）。航空 PDF.js 140 张卡中，89 张接受，34 张附属，剩 17 张。剩余卡片主要是上表“分诊未定位”事件的卡片，以及被拒的候选卡。

一个值得 #2 注意的点：商务航空 #6 只把弯撇号改成直撇号，脚本按规范化把它排除了，但产品给了一张 **Material** 卡（`d-ab561a73…`）。这张卡计入未解释的 Material 卡。

### 与旧分诊（`reports/v3-review/triage`）的差别

- **算作正确的增加**：航空 #55、#56、#61，商务航空 #43、#47、#49、#50、#51、#69。原因是身份标识从“前两个未变格”（机型名会跨行）改为作者点名的 MSN/注册号/当事人。这些事件的变化确实挂在正确的行上，但整行未恢复，已在 `fullRowRecovered=false` 中单列。
- **不再算作正确**：商务航空 #16、#17（并入邻行卡）。
- **旧版只给出“不完整”的，现在给出具体类别**：航空 #6/#7、#50、#67、#91，商务航空 #9、#27、#73 等。
- v3 README 中的人工核对结论只当作线索。上表各项都给出了脚本自己的结论，加上可追溯的卡片 ID，没有因为“人工称安全”就自动判通过。

## 5. 分诊反例（`tests/test_renewal_triage.py`，20 项）

| 场景 | 期望 |
|---|---|
| 身份来自作者 block，未变的百分比/日期不当身份；多标识按 block 顺序 | 标识正确 |
| 未变值格相同、但卡片是另一承保人行 | 不判正确 |
| 正确金额挂在错误记录上（rowKey 矛盾；或单元里只有另一行的标识） | 归属错误；对应的删除行也不算被删除 |
| 一张正确卡 + 一张错误归属卡 | 归属错误，正确卡仍被接受，错误卡留在未解释 |
| 两行有相同的 old→new | 各自接受自己的卡，都正确 |
| 金额正确但整行缺格 | 正确，`fullRowRecovered=false` |
| 新增行各格在同一记录 / 散在两条记录 / 没有任何标识 / 并入邻行卡 / 与另一记录配对 | 正确 / 不完整 / 无法评价 / 无法评价 / 归属错误 |
| 未决组只有一侧在事件页 | 只找到一侧，命中只记录左侧 |
| 两侧都只在未决组 | 无法评价 |
| 只在卡片中找到一侧 | 只找到一侧 |
| 段落分卡有作者上下文 / 只有变化本身 | 可归属分散 / 无法评价 |
| 表格行分卡两侧都有标识 / 一侧没有 | 可归属分散 / 无法评价 |
| 两个原子一个 Material 一个 Cosmetic | 逐原子类别不被最高类别覆盖 |
| 排除事件 | 保留原文和原因，不计分 |
| 作者 RollForward 与保期顺延 | 分开列 |
| 附属事件（含逐字空格的条码） | 列出、无法评价、不算未解释 |
| CLI 兼容调用 | stdout 为汇总，`--events` 为数组，来源引用不含字符 ID |

[`verification/old-vs-new.py`](verification/old-vs-new.py) 把其中 5 个反例分别交给 `85dae98` 的旧脚本和新脚本（输出见 [`old-vs-new.txt`](verification/old-vs-new.txt)）。旧脚本把其中 3 个判为 `complete`；对只命中一侧的未决组，旧脚本报告 `separate_cards`，即虚构了两侧都已找到。

## 6. 局限和未覆盖范围

- **分诊不检查高亮几何**，不能当作浏览器精细位置的验收。精细位置只由 32 对规则的浏览器评分覆盖。
- 匹配基于规范化后的子串。序数上标、跨行单元格、条目编号单独成行时，脚本找不到（`not_located`），这不等于产品漏报。表 4 中给了这些项的人工线索卡片 ID。
- 新增/删除段落只核对前 40 个字符，移动段只核对段首 40 个字符加段内各 edit；没有核对整段。
- 身份标识的规则是“作者 block 点名，否则第一个名称类未变格”。这是根据作者答案的命名习惯定的；换一套答案格式时，应先看 `tableRowEvents.identityFromNameLikeCell` 和 `noExpectedIdentity`。
- 附属事件全部无法评价，因为结果的数据格式里没有页面附属角色。附属判定要等 #2 在数据格式中加入相应角色后才能做。
- **评分器的另一个盲点（本项没有改，建议另行决定）**：32 对的 `expected.json` 共有 31 种不变量，评分器只按名字直接检查其中 8 种（`no_content_differences` 等）。其余 23 种中，有的已经被事件检查隐含覆盖，例如 R13 的 `exact_move_must_not_be_consumed_by_local_replacement`，本次新增的 R13 测试证明了这一点；有的可能没有任何检查，例如 R16 `all_source_text_preserved`、R24 `same_logical_row_order`、R26 `agreed_value_unchanged`。如果把未直接检查的不变量都改成“无法评价”，32 对都会退出通过名单，这正是 issue 要避免的“机械改变适用性”。所以这里只报告，没有改。建议另开一项，逐条把这些不变量标为“已直接检查 / 由事件检查隐含覆盖 / 不支持”。

## 7. 复现与交接

```bash
node --version   # v24.x
pnpm --version   # 10.12.1
pnpm install --frozen-lockfile && pnpm install:pdfjs && pnpm install:mupdf
node scripts/fetch-renewal-samples.mjs --out tmp/renewal-inputs

policy_report=reports/issue-5-evaluation
for e in mupdf pdfjs; do
  for c in aviation_2024_vs_2025 bizav_2024_vs_2025; do
    gzip -dc "reports/v3-review/results/$c-$e.json.gz" > "$policy_report/$c-$e.input.json"
    python3 scripts/renewal-triage.py \
      "tmp/renewal-inputs/testdata/renewal/$c/changes.json" \
      "$policy_report/$c-$e.input.json" \
      --events "$policy_report/$c-$e.events.json" \
      > "$policy_report/$c-$e.summary.json"
  done
done

pnpm exec vitest run tests/scorer.test.ts
python3 -m unittest discover -s tests -p 'test_renewal_triage.py'
pnpm verify:core
pnpm test:rules:pdfjs
pnpm test:rules:mupdf
pnpm build:mupdf && POLICY_ENGINE=mupdf POLICY_BROWSER_CHANNEL=bundled pnpm exec playwright test tests/browser/rules.spec.ts
pnpm build:pdfjs && POLICY_ENGINE=pdfjs POLICY_BROWSER_CHANNEL=bundled pnpm exec playwright test tests/browser/rules.spec.ts
python3 reports/issue-5-evaluation/verification/old-vs-new.py
git checkout -- reports/   # 上面几条测试会改写 reports/ 下的历史报告文件；本目录是新增的，不受影响
```

`*.input.json` 是 `.gz` 解压出来的副本，没有提交（见本目录 `.gitignore`），SHA-256 记录在 `environment.json` 中。

**交给 #2**：
- 集成提交 `47d4b50`。改动范围是 `tests/evaluation/scorer.ts`、`tests/scorer.test.ts`、`scripts/renewal-triage.py`、`tests/test_renewal_triage.py`、`scripts/acceptance.ts`、`tests/browser/rules.spec.ts`，以及本目录。
- 产品重评时用同一组命令。逐事件看 `verdict`、`atomEvidence[].reason` 和 `row.fullRowRecovered`；评分器看 `status`、`notEvaluated`、`identityApplicability`。
- 如果新增了验证用例，要么给它的逻辑路径加上身份检查能力，要么在 `IDENTITY_NOT_APPLICABLE` 里按事件 ID 和路径登记 N/A 并写明理由；否则它会如实显示为 NOT_EVALUATED。
- 本项只交付评价工具，不代表产品整体或真实业务已经验收。
