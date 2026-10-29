# #10 验收断言覆盖登记

对应 [#10](https://github.com/wlvh/policy-compare/issues/10)。本目录交付的是评价工具本身：给出覆盖登记，修复假 PASS，并让工具如实报告尚未覆盖的部分。**这不是业务验收，也不表示全部业务要求已经通过。**

| 项 | 值 |
|---|---|
| 分支 | `fix/scorer-invariant-coverage`，从 `2ff585bce56e5b43a6fb00572ad9d99b98e4fefc`（PR #9 head）建立 |
| 被测代码提交 | **当前联合树 `9d7f266`**（第二十轮最终联合验收：普通合并提交 `42bfc9b` 合入 #2 `943f75b`，评分器读取 R24 声明与重复文字位置集），证据在 [`9d7f266/`](9d7f266/)，见第 0.8 节。本轮此前各步：控制用例只认本例声明 `a705d4c`、CI 保留各项检查的信号 `74693f3`（证据 [`74693f3/`](74693f3/)），事件文字必须出现在卡片自己的编辑处 `a4954a1`（证据 [`a4954a1/`](a4954a1/)）。第十九轮联合树 `3b3fb2e`（结果格式 2 上的事实验收；普通合并提交 `73846aa` 合入 #2 `657f0ca`）在 [`3b3fb2e/`](3b3fb2e/)，见第 R19 节。第十八轮 `df8f579`（按来源判断事实；合并提交 `3a25fea` 同步 #9 `2b29fd8`）在 [`df8f579/`](df8f579/)，见第 R18 节。第十七轮 `dbf73ef`（多格对应的保护也计入币种代码的一部分）在 [`dbf73ef/`](dbf73ef/)，同时包含第十六轮 `23e5372`（删除卡、新增卡把一个格拆到多张卡上时统一判无法评价；同一处编辑报两次判 FAIL）的修复前对照。各轮证据都保留、没有覆盖：第十五轮 `800fe91` 在 [`800fe91/`](800fe91/)；第十四轮 `a5acd50` 在 [`a5acd50/`](a5acd50/)；第十三轮 `a8cb2cc` 在 [`a8cb2cc/`](a8cb2cc/)；第十二轮 `f2e0e10` 在 [`f2e0e10/`](f2e0e10/)；第十一轮 `402e66e` 在 [`402e66e/`](402e66e/)；第十轮 `bb85bc4` 在 [`bb85bc4/`](bb85bc4/)；第九轮 `8ca503f` 在 [`8ca503f/`](8ca503f/)；第八轮 `f2d953f` 在 [`f2d953f/`](f2d953f/)；第七轮 `c5acdb8` 在 [`c5acdb8/`](c5acdb8/)；第六轮 `55e669a`（按几何关系找金额格）在 [`55e669a/`](55e669a/)；第五轮 `28afbd1`（碎片按原文顺序拼接）在 [`28afbd1/`](28afbd1/)；第四轮 `fececbf`（金额单元格以 layout.json 为准）在 [`fececbf/`](fececbf/)；第三轮 `74783d6`（删除/新增卡的金额只在同一记录内抵消）在 [`74783d6/`](74783d6/)；第二轮 `7ea1fb3`（裸整数金额）在 [`7ea1fb3/`](7ea1fb3/)；第一轮 `d61461b` 在 [`verification/`](verification/) 和 [`register.json`](register.json) |
| 被测产品代码 | 第十九、二十轮与 #2 `9ccc044` 相同（分诊第二十轮末为 `renewal-triage/7`）（结果格式 2，经合并提交 `73846aa` 带入）；第十八轮与 #9 `2b29fd8` 相同；第十七轮及以前与 `e313540` 相同。本项没有修改产品文件 |
| 原则与共同处置表 | [`AGENTS.md` @ `3db7f0b`](https://github.com/wlvh/policy-compare/blob/3db7f0b3c225f2fae0a5412819b5f422a3961891/AGENTS.md)（已逐字核对）；处置表在 #2 的 `reports/issue-2-validation/README.md` §D（`2b29fd8`），本项只链接、评论 |
| 改动文件 | `tests/evaluation/scorer.ts`、`tests/scorer.test.ts`、`scripts/acceptance.ts`、`tests/browser/rules.spec.ts`、`.github/workflows/ci.yml` |
| 工具 | Node 以各轮证据目录的 `tool-versions.txt` 为准（第一轮 v24.19.0，第二十轮 v22.22.0）、pnpm 10.12.1；Python 3.13.17（本地）/ 3.12（CI 环境，本地也用 3.12.3 跑过） |
| 机器可读登记 | [`9d7f266/register.json`](9d7f266/register.json)（当前；`74693f3` 的在 [`74693f3/register.json`](74693f3/register.json)，第十九轮的在 [`3b3fb2e/register.json`](3b3fb2e/register.json)）：每种 invariant 的覆盖方式、依据、对应测试、出现的用例，以及四次运行中的实际结果 |

“invariant（验收断言）”指答案 `expected.json` 里除逐事件要求以外的整体要求，例如“不得出现金额变化”。32 对答案中共有 **31 种**（按名称去重计的种数，不是用例数）。

## 0. 第二十轮（当前）：控制用例只认本例声明；CI 保留各项检查的信号（`a705d4c`、`74693f3`）

依据 [#10 顶部指令](https://github.com/wlvh/policy-compare/issues/10)（第十九轮联合版本的有限验收收尾）和[负责人复核](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6499321688)。本轮只改评分器、它的测试和 CI，产品、答案、分诊与 #2 的文件都没动（[`74693f3/diff-from-3b3fb2e.txt`](74693f3/diff-from-3b3fb2e.txt)）。

**`74693f3` 至 `a4954a1` 的 CI 是红的，这是要求的结果；`9d7f266` 合入 R24 的声明后转绿，见第 0.8 节。** R24 的续页标题重新成为未登记的无法评价，规则退出码回到 1，与第十八轮相同。#2 按生成器、输入和版面登记 R24 的真实新增及重复位置、次数后，本项读取这份预期，再做最终联合验收（第 0.6 节）。本项没有为了变绿而登记新缺口，也没有把它直接判 FAIL。

### 0.1 改动

| 项 | 第十九轮（`3b3fb2e`） | 第二十轮（`a705d4c`） |
|---|---|---|
| 事实核验 `factHolds` | 从来源重算卡片陈述的每条事实；被来源否定判 FAIL，无法判定记 `claim_unverifiable` | **不变** |
| 控制用例 `no_material_differences` 的许可 | 声明事件；**或**来源证明“只是形式”（空白、已确认页码、续页标题）的任何未声明变化，在所有控制用例里都放行 | **只有本例声明的事件**放行，每个事件只消费一张卡。来源证明只是形式、但本例没有声明的变化：事实成立，可这个控制是否允许它，预期没有写，所以记 NOT_EVALUATED（`invariant_unverifiable`，退出码 1），原因写明“来源证明是续页标题，但本例没有声明这项变化”。形式无法判定的也记 NOT_EVALUATED。其余未声明的文字变化仍判 FAIL |
| 身份结论 | `pass`、`determined`，汇总里“未按要求呈现”和“错误”有重叠 | 每个事件一个 `outcome`：`determined`（确定归属）、`presented_unresolved`（答案允许的显式未决）、`requirement_unmet`（没有给出身份，或给了答案不允许的未决）、`wrong_statement`（写成别的记录、当事人或字段）。汇总 `identityClaims` 的 `notPresented` 改为 `requirementUnmet`，与 `wrong` 互不包含。**R22 仍要求确定归属**：显式未决是“未满足确定归属要求”，不是“明确身份陈述错误” |
| `repeat` | 失败原因写“来源不支持” | 只叫**引用内计数一致**：两个页数等于两份文档的页数，两侧次数等于卡片自己引用、经来源校验的出现位置数。不查文档里卡片没有引用的出现，所以不说“全文完整”。失败原因改为“与文档页数或卡片引用的出现位置数不一致” |
| CI（`74693f3`） | 两个引擎互相 fail-fast；规则步骤失败后，审核回归和浏览器步骤被跳过 | 见第 0.3 节 |

**为什么是 NOT_EVALUATED，不是 FAIL 或 PASS**：R24 的预期既没有允许、也没有禁止续页标题。来源能证明这一行是“两版都有的标题＋明确续页后缀”，但“形式成立”回答不了“这个控制允许它吗”。按原则 7，适用但无法判断记未评价；把它判 FAIL 等于把预期没写的东西当成已证实违约，判 PASS 等于让一条公共事实替所有控制用例做许可。第十九轮的做法属于后者，本轮撤回。

### 0.2 判定变化：同一组输入在 `4b72b11`（第十九轮）与 `a705d4c` 上的结论

| 输入 | `4b72b11` | `a705d4c` |
|---|---|---|
| 控制用例：未声明、只差空白的变化（陈述或不陈述 `whitespace_only`） | PASS | **NOT_EVALUATED**，退出码 1 |
| 控制用例：未声明、只差已确认页码（`Page 1 of 2` → `Page 1 of 3`） | PASS | **NOT_EVALUATED**，退出码 1 |
| R24 真实数据：未声明的 `SCHEDULE OF AIRCRAFT CONTINUED`（两引擎） | PASS，规则退出码 2 | **NOT_EVALUATED**，规则退出码 1 |
| 控制用例：未声明的内容变化（陈述何种事实都一样） | FAIL | FAIL |
| 被来源否定的事实陈述 | FAIL | FAIL |
| R22：显式未决 | FAIL，汇总记为“未按要求呈现” | FAIL，`outcome = requirement_unmet`，汇总 `requirementUnmet`，`wrong` 为空 |
| R22 / R26：写成别的记录的键 | FAIL | FAIL，`outcome = wrong_statement` |

修复前对照：本轮测试文件在 `4b72b11` 的评分器上 10 项失败、106 项通过：6 项身份测试（旧评分器没有 `outcome`，R22 未决也不在 `requirementUnmet` 中）、2 项控制用例（旧评分器判 PASS）、1 项 `repeat` 失败原因的措辞、1 项登记一致性（登记表引用的新测试名）（[`74693f3/before-fix-4b72b11.log`](74693f3/before-fix-4b72b11.log)）；同一评分器的 MuPDF 规则退出码 2，R24 为 PASS（[`74693f3/before-fix-4b72b11-rules-mupdf.log`](74693f3/before-fix-4b72b11-rules-mupdf.log)）。

### 0.3 CI：独立检查保留信号，最终仍如实失败（`74693f3`）

- `functional`、`linux-container` 两个矩阵都设 `fail-fast: false`：一个引擎失败不再取消另一个。
- 依赖安装、引擎安装、构建是前提。`verify:core` 在引擎安装成功后运行；PDF 机制、规则、审核回归各自只要求构建成功（`if: ${{ !cancelled() && steps.build.outcome == 'success' }}`），不受前一项检查失败的影响；浏览器测试要求浏览器安装成功。前提步骤失败或运行被取消时，后续步骤跳过，跳过不算通过。
- 规则步骤仍是 `pnpm test:rules:<engine> || test $? -eq 2`：只放行已登记缺口的退出码 2，退出码 1 让该步骤失败。任何一步失败，job 都失败。没有使用 `continue-on-error`。

**受控失败**：本轮 R24 的未登记无法评价正好是一次真实的退出码 1，用它验证，没有另造故障。[run 40891788260](https://github.com/wlvh/policy-compare/actions/runs/40891788260)（[`74693f3/ci-40891788260.md`](74693f3/ci-40891788260.md)）：

| 步骤 | functional (mupdf) | functional (pdfjs) |
|---|---|---|
| 安装、`verify:core`（269/269）、构建、PDF 机制 | success | success |
| 规则 | **failure**：严格 NOT_EVALUATED 28/32，事件 32/32，退出码 1（R24） | **failure**：同左 |
| 审核回归 `review-check.ts` | success（规则失败后照常运行；改前按默认条件会被跳过，#2 在 `ee0f0a5` 的 CI 记录过这种情况） | success |
| 浏览器 | **failure**：15 项通过、`rules.spec.ts` 1 项失败（R24 NOT_EVALUATED） | **failure**：同左 |
| 报告上传 | success | success |
| job | **failure** | **failure** |

两个 job 都跑到最后，没有互相取消；其余 4 个 job 成功。

### 0.4 验证（`74693f3`，本地 Linux）

| 检查 | 结果（证据在 [`74693f3/`](74693f3/)） |
|---|---|
| scorer 测试 | 116/116 |
| `verify:core` | 269/269 |
| Python 分诊 | 32/32 |
| 构建（两引擎） | 通过 |
| 规则 MuPDF / PDF.js（Node） | **退出码 1**：严格 NOT_EVALUATED 28/32，事件 32/32；R24 除登记的 `same_logical_row_order` 外，多一项未登记的 `no_material_differences` 无法评价 |
| 浏览器 `rules.spec.ts`（两引擎，重新构建后） | **失败**（同一原因）：严格 NOT_EVALUATED 28/32，事件 32/32，`knownGapsOnly=false`；0 个 FAIL，0 个错误身份陈述 |
| `tsc --noEmit` | 本项文件无错误；#2 的 `tests/row-identity.test.ts` 仍有 17 处类型错误（归 #2） |
| 续保四次比较 | 产品与 `3b3fb2e` 相同，分诊脚本不读评分器，复用第十九轮的结果（[`3b3fb2e/renewal/`](3b3fb2e/renewal/)），没有重跑 |

### 0.5 分项覆盖（两引擎相同）

各项分开报，不相加。分母是 32 个规则用例的答案列出的 30 个事件，其中 R27、R28 两个是覆盖警告事件。

| 项 | 结果 |
|---|---|
| **预期事件**：找到（卡片原文含答案片段） | 30/30 |
| **来源归属**：编辑来源落在事件声明的 layout.json 记录、字段上；`a4954a1` 起还要求答案文字出现在卡片自己的编辑处（第 0.7 节） | 30/30（R27、R28 的两个覆盖事件按区域核对）；表达方式：单卡 28，一删一增 0；`a4954a1` 上不变 |
| **身份**（适用的 16 个事件） | 确定归属 15；按要求呈现的显式未决 1（R25）；**未满足确定归属要求 0；明确身份陈述错误 0**。身份要求本身不适用 12 项（N/A，数目与第十八、十九轮相同） |
| **声明准确**：`hasTextChange`、陈述的事实、身份陈述 | 0 处与来源不符；陈述的事实每引擎 3 条（R08、R32 的日期顺延一年，R24 的续页标题），重算都成立，0 条无法判定 |
| **引用内计数一致**（`repeat`） | 0 处不一致：MuPDF 14 张、PDF.js 18 张次数卡的页数和次数都与文档页数、卡片引用的出现位置一致。文档中未被引用的出现没有搜索 |
| **控制用例** | 未声明的内容变化 0；未声明、来源证明只是形式的变化 1（R24 续页标题）→ NOT_EVALUATED |
| **严格总状态**（完整分母） | PASS 28/32；NOT_EVALUATED 4：R16、R18、R23（各一项登记的尚未支持），R24（登记的 `same_logical_row_order`＋未登记的 `no_material_differences`）；FAIL 0。invariant 出现次数：直接 PASS 16、NOT_EVALUATED 1；间接 PASS 18（只重述事件检查，不计为独立证据）；尚未支持 4 |

### 0.6 待 #2 交付后完成的事项，以及仍不支持的范围

下列 1—4 已在 `42bfc9b`、`9d7f266` 完成，结果见第 0.8 节；最终的不支持清单也在第 0.8 节。

**合入 #2 的固定 SHA 后**：
1. 用普通合并提交合入（不 rebase、不改写 #2 的历史）。
2. 读取 #2 登记的 R24 预期：作为声明事件（沿用 `declaredChange`，每个事件只消费一张卡），或作为明确限定范围的本例声明。评分器不从产品卡片反推，不加全局续页豁免。
3. 用 #2 给出的 R24 固定出现集合核对次数卡是否完整；不开发通用全文扫描。
4. 在联合树上跑 scorer、Python、`verify:core`、两引擎规则、构建、浏览器、审核回归、CI、`tsc`；产品没变则复用续保结果。在 PR #9、#11 公布固定 SHA。

**仍归 #2**：分诊的两项 P1（[r4412433099](https://github.com/wlvh/policy-compare/pull/11#discussion_r4412433099)、[r4412433538](https://github.com/wlvh/policy-compare/pull/11#discussion_r4412433538)，线程保持打开）；格式 2 测试的类型标注；侧车声明的措辞；航空六个费率事件的来源锚点。

**有限的不支持清单**（不随本轮扩大）：
- 4 项登记的尚未支持 invariant（第 4 节）。
- `repeat` 只核对引用内计数；R24 之外不核对全文完整。
- 页码表达跨多页的卡：`page_number_only` 无法判定，记 `claim_unverifiable`（真实数据中没有）。
- 一删一增以外的多卡拼装；没有文字差异的 `result.unresolved` 条目不算事件表达；身份只认 layout.json 中该格的原文。
- 金额检查的可判定范围见第 5 节，没有扩大币种或切分方式。

### 0.7 Codex 复核：事件文字必须出现在卡片自己的编辑处（`a4954a1`）

[r4413651102](https://github.com/wlvh/policy-compare/pull/11#discussion_r4413651102)（P1），已复现。

**问题**：评分器在整张卡的原文里找答案的新旧文字，又只要求卡片在事件的 run 上有任意一处编辑。

例：事件那一行从 `USD 100 included` 改成 `USD 200 excluded`，同一张卡里另带一行没改的 `USD 100 USD 200`。卡片只报告 `included → excluded`，两个金额都取自那行没改的文字，这个金额事件却判 PASS。按原则 2，这是借用同卡另一单元的文字充当本事件的证据。一删一增的路径也有同样的缺口。

**改法**：
- 新旧文字在卡片原文中的出现处，所有字符都必须来自事件的旧侧（新侧）run 上的操作。
- 两侧出现处里，至少一处要包含卡片在这些 run 上的编辑。
- 一删一增的每一半，各自都要包含自己的编辑。

两侧中只要求一侧带编辑，是因为旧文字整段保留在新文字里时（例如句尾追加），旧文字那一侧本来就没有编辑。初稿要求每侧都带编辑，会把这种诚实的卡判 FAIL。初稿见 [`a4954a1/draft-per-side.patch`](a4954a1/draft-per-side.patch)，它在本轮测试上的结果见 [`a4954a1/draft-per-side.log`](a4954a1/draft-per-side.log)。移动事件没有编辑，规则不变。

| 输入 | `f367423` | `a4954a1` |
|---|---|---|
| 只报告 `included → excluded`，金额来自同卡另一行未改的文字（作为上下文） | **PASS**（假通过） | FAIL：找到 PASS，归属 FAIL |
| 同上，但把事件行的金额与另一行相同的金额交叉配成“未改”，金额编辑都落在另一行 | **PASS**（假通过） | FAIL |
| 一删一增，两半的金额都取自另一行未改的文字 | **PASS**（假通过） | FAIL |
| 整行替换；金额内逐字编辑；诚实的一删一增；句尾追加（旧文字整段保留在新文字里） | PASS | PASS |

**验证**（[`a4954a1/`](a4954a1/)）：
- scorer 117/117，`verify:core` 270/270；
- 本轮测试在 `f367423` 的评分器上 1 项失败，三个伪造变体都判 PASS（[`before-fix-f367423.log`](a4954a1/before-fix-f367423.log)）；
- 两引擎的规则报告和浏览器规则报告与 `74693f3` 逐项相同，只差提交号（[`compare-with-74693f3.txt`](a4954a1/compare-with-74693f3.txt)）：真实数据的结论没有变化，退出码仍是 1（R24）。

“找到”仍按整卡原文是否含答案片段计。“归属”现在要求文字出现在卡片自己的编辑处，所以借来的文字只能让“找到”成立，归属不成立，事件 FAIL。

### 0.8 最终联合验收：联合树 `9d7f266`

#2 交付了本轮预期和分诊修复（head `943f75b`，代码 `fa49eca`）。本项用普通合并提交合入，读取新预期，在联合树上完成最终验证。证据在 [`9d7f266/`](9d7f266/)。

| 提交 | 内容 |
|---|---|
| `42bfc9b` | 普通合并提交，合入 #2 的 `943f75b`，没有冲突。包含：<br>• `3f3c5f3`：R24 声明 `R24_table_cross_page:E1`（新增 `SCHEDULE OF AIRCRAFT CONTINUED`），R16、R24 给出 `repeated_text_requirements`；<br>• `cb1e844`、`000253d`：分诊 `renewal-triage/7`；<br>• `fa49eca`：`tests/row-identity.test.ts` 改按格式 2 标注类型；<br>• `943f75b`：#2 的第九轮报告。 |
| `9d7f266` | 评分器读取新预期（下文），**联合验收的固定代码 SHA** |

**评分器读取新预期的方式**：
- **R24 的续页标题**：`R24_table_cross_page:E1` 与 R16:E1 一样，身份要求不适用（页标题没有当事人或记录身份），身份 N/A 精确加一项，共 13 项、12 个用例。这张卡由 `declaredChange` 在 `no_material_differences` 中消费一次。R24 的控制用例重新由它自己的声明判定，没有全局的形式豁免。
- **重复文字位置集**（`repeated_text_requirements`）：凡有一处出现落在某项位置集 run 上的次数卡，都算报告了这项。对这类卡的要求：
  - 两侧所引的 run 集合恰好等于该项的集合，不多不少；
  - 所报次数等于集合的次数；
  - 至少一张默认可见。没有卡报告这项，就是次数变化不可见，判 FAIL。

  展示形式不限：同一行文字拆成几张卡（两引擎都把页眉拆成两张，PDF.js 把页脚拆成三张）时，每张都要满足上面几条。只有这两个用例核对全文完整；其他次数卡仍只核对引用内计数一致。逐项结果写在用例记录和 `summarize().repeatedText` 中。
- **测试**（118 项）：一张卡、拆成两张卡都判 PASS；无卡、漏一处、多一处（同字样但不在集合里的正文行）、拆开的两张卡中有一张不全，都判 FAIL。另把身份 N/A 的数目测试改为 13 项、12 个用例。

**修复前**（`a4954a1` 的评分器读联合树）：
- 本轮测试 2 项失败：N/A 数目，位置集测试；
- 规则退出码 1，事件 NOT_EVALUATED 31/32，原因是 R24:E1 的身份路径不受支持（[`before-a4954a1.log`](9d7f266/before-a4954a1.log)、[`before-a4954a1-rules-mupdf.log`](9d7f266/before-a4954a1-rules-mupdf.log)）。

**联合树验证**（`9d7f266`，本地 Linux；CI）：

| 检查 | 结果 |
|---|---|
| scorer 测试 / `verify:core` / Python 分诊（`/7`） | 118/118、271/271、35/35 |
| `tsc --noEmit` | 0 处错误（#2 的 `fa49eca` 修好了格式 2 测试的类型标注） |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10 |
| 规则 MuPDF / PDF.js（Node） | **退出码 2**：严格 NOT_EVALUATED 28/32（R16、R18、R23、R24，均为登记的尚未支持项），事件 32/32，0 个 FAIL，`knownGapsOnly=true` |
| 浏览器测试（两引擎，完整测试集） | 各 16/16，含 `rules.spec.ts`（严格 28/32、事件 32/32、只剩登记缺口） |
| 续保四次比较 | 产品自 `3b3fb2e` 未变（[`product-unchanged.txt`](9d7f266/product-unchanged.txt)），复用已存结果（与 #2 的 `9ccc044` 逐字节相同）。用 `/7` 和当前身份声明重评，汇总与逐事件结果都与 #2 在 `fa49eca` 上的 `/7` 重评相同（[`renewal/compare-with-2-fa49eca.txt`](9d7f266/renewal/compare-with-2-fa49eca.txt)） |
| CI（`9d7f266`） | 12/12 通过（[run 40898235261](https://github.com/wlvh/policy-compare/actions/runs/40898235261)、[run 40898249856](https://github.com/wlvh/policy-compare/actions/runs/40898249856)） |

**分项覆盖**（两引擎、Node 与浏览器相同；各项分开报，不相加）：

| 项 | 结果 |
|---|---|
| **预期事件**：找到 | 31/31（含 R27、R28 两个覆盖警告事件；R24:E1 是新增的一项） |
| **来源归属**：编辑来源落在事件的 run 上，答案文字出现在卡片自己的编辑处 | 31/31；表达方式：单卡 29，一删一增 0 |
| **身份**（适用的 16 个事件） | 确定归属 15；按要求呈现的显式未决 1（R25）；**未满足确定归属要求 0；明确身份陈述错误 0**；身份要求不适用 13 项 |
| **声明准确**：`hasTextChange`、陈述的事实、身份陈述 | 0 处与来源不符 |
| **引用内计数一致**（全部次数卡） | 0 处不一致 |
| **位置集完整**（只限 R16、R24） | 11/11 项相符，不多不少 |
| **控制用例** | 未声明的文字变化 0；R16、R24 的新增标题都由各自声明的事件消费 |
| **严格总状态**（完整分母） | PASS 28/32；NOT_EVALUATED 4：R16 `all_source_text_preserved`、R18 `ligature_geometry_not_uniformly_guessed`、R23 `all_aircraft_values_attached_to_original_identity`、R24 `same_logical_row_order`，均为登记的尚未支持项；FAIL 0。invariant 出现次数：直接 PASS 17；间接 PASS 18（只重述事件检查，不计为独立证据）；尚未支持 NOT_EVALUATED 4 |

**分诊线程**（`scripts/renewal-triage.py` 归 #2）：
- [r4411510471](https://github.com/wlvh/policy-compare/pull/11#discussion_r4411510471)、[r4411752201](https://github.com/wlvh/policy-compare/pull/11#discussion_r4411752201)、[r4410014301](https://github.com/wlvh/policy-compare/pull/11#discussion_r4410014301)：用原来的输入在 `/7` 上独立复核，已修好，线程关闭。
- [r4413938264](https://github.com/wlvh/policy-compare/pull/11#discussion_r4413938264)（Codex 今天新报，`USD 100` 按子串匹配到 `USD 1000` 的前缀）：在 `/7` 上仍复现，已转告 #2，线程保持打开。它是否改变已存续保结果中的某个结论，本项没有核验；修复前，分诊对这类前缀金额判出的 `correct` 不可靠。

**有限的不支持清单**：
- 4 项登记的尚未支持 invariant（第 4 节）。
- 重复文字：只有 R16、R24 有位置集，核对全文完整；其他次数卡只核对引用内计数一致。
- 页码表达跨多页的卡：`page_number_only` 无法判定，记 `claim_unverifiable`（真实数据中没有）。
- 一删一增以外的多卡拼装不支持；没有文字差异的 `result.unresolved` 条目不算事件表达；身份只认 layout.json 中该格的原文。
- 金额检查的可判定范围见第 5 节，币种和切分方式都没有扩大。
- 分诊的前缀金额问题（上一段），归 #2。

## R19. 第十九轮：结果格式 2 上的事实验收，联合树 `3b3fb2e`

> 第二十轮（第 0 节）收窄了本节 R19.2 中控制用例的许可：来源证明“只是形式”的未声明变化不再在任何控制用例中直接放行，R24 的续页标题回到 NOT_EVALUATED。本节保留第十九轮当时的规则与结果。

依据 [#10 顶部指令](https://github.com/wlvh/policy-compare/issues/10) 第 2、3 步：#2 先发布最小契约提交，本项在同一契约上实施事实验收；产品完成后合入 #2 的固定代码，在联合树上验证并公布 SHA。约定以 #2 处置表 D.0（`657f0ca`）为准；评分器从原始来源重算，不调用产品分类器，也不把产品自报当答案。

### R19.1 联合树

| 提交 | 内容 |
|---|---|
| `73846aa` | 普通合并提交，合入 #2 head `657f0ca`：结果格式 2（`5a542c1`）、退出重要性分类（`9dc5459`）、页码与出现次数（`7161f91`）、正向行身份（`e38cdf1`）、分诊 `renewal-triage/6`（`9ccc044`）。没有冲突。这个提交上评分器仍只读格式 1：scorer 测试 83 项失败，规则两引擎每个用例都因 schema 失败（#2 的 CI 记录的也是这一状态） |
| `3b3fb2e` | 本轮评分器改动（下表），**联合验收的固定 SHA** |

联合树上的产品、分诊脚本、身份声明和答案与 #2 测过的 `9ccc044` 逐字节相同（`packages/contracts/index.ts` 只差一处注释）。本项没有修改 #2 的文件。

### R19.2 本轮改动（`3b3fb2e`）

| 项 | 第十八轮（格式 1） | 第十九轮（格式 2） |
|---|---|---|
| 读取的结果 | `ResultSchema`（格式 1） | 只读 `ResultSchemaV2`。格式 1 的历史结果保持原样，由当时的评分器评过；旧类别的读法删除，不同时维护两套 |
| 类别 | Cosmetic/RollForward 作为声明，对照答案的 `acceptable_categories` | **不再检查**：格式 2 没有类别，答案中旧的 `acceptable_categories` 不读 |
| 事实 `facts` | — | 每条都从卡片经来源校验的原文和两份文档重算：`whitespace_only`（空白串折叠后词语相同）、`page_number_only`（只差 `Page n`、`Page n of N`、`Page n/N` 中“计数等于该行所在页、总数等于该文档页数”的页码）、`continued_heading`（单侧一行＝某行全文加明确续页后缀，且该行全文在两份文档中都有）、`dates_rolled_forward_one_year`（两侧各两个日期，每个恰好推后一个日历年，其余文字相同）。来源否定 → FAIL；无法判定（页码表达跨多页、页码数字无法读取）→ `claim_unverifiable`，退出码 1 |
| `repeat` | — | 两个页数必须等于两份文档的页数；两侧次数必须等于卡片自己引用的出现位置数（这些位置都经来源校验）。文档里是否还有卡片没有引用的出现，不检查 |
| `no_material_differences` | 未声明、说成 Cosmetic 的文字变化 → NOT_EVALUATED | 每处文字变化必须是声明事件，或按共同定义（空白、已确认页码、续页标题）从来源证明只是形式，**不看卡片是否陈述**；其余未声明的文字变化 FAIL；形式无法判定时 NOT_EVALUATED |
| `must_not_classify_as_unchanged_duration_roll_forward` | 自报字段为保险期间且类别为 RollForward | 陈述了 `dates_rolled_forward_one_year` 而来源否定；不读卡片自报字段 |
| 身份、一删一增、`hasTextChange`、来源校验、十七轮金额检查 | 第十八轮 | 不变 |
| `scripts/acceptance.ts` | 格式 1 | 格式 2 |

**“仅形式”的共同定义**：控制用例只允许答案声明的事件，以及评分器从来源独立重算可证的三种形式变化（D.0）。评分器的判定与产品的 `facts` 用同一份文字定义，但各自实现：评分器只用原文、页码和文档行，不用产品的版面角色。差别在于续页标题：产品要求基础标题在两版中都是“标题”角色；评分器要求它是两版中某一行的全文。

### R19.3 测试（116 项）

第十八轮的 112 项中，依赖类别的 7 项：6 项改写为按事实写；1 项（未声明的 Cosmetic 文字变化判 NOT_EVALUATED）删除，因为格式 2 下这种情形已可判定，由下表第一项覆盖。卡片构造函数补上 `facts`、`repeat`，`hasTextChange` 改为与原文一致。新增 5 项，合计 112 − 1 + 5 = 116。主要的新增和改写测试：

| 测试 | 内容 |
|---|---|
| `an undeclared text change in a control fails, whatever fact the card states` | 未声明的金额变化，陈述 `whitespace_only`、`continued_heading` 或不陈述，都 FAIL |
| `a form-only change the sources prove passes a control, stated or not` | 只差空白、只差已确认页码（`Page 1 of 2` → `Page 1 of 3`），陈述与否都 PASS |
| `R24: an undeclared continued schedule heading passes the control by its sources` | 续页标题，陈述与否都 PASS |
| `a change that is not form only fails a control, and a form fact stated on it is false` | 改一个词、两词合并、页码不是本页、续页标题缺基础标题：控制 FAIL，陈述的事实判为虚假 |
| `a page-number fact over several pages cannot be decided: NOT_EVALUATED, exit 1` | 跨两页的页码卡 |
| `repeat counts are checked against the documents' page counts and the occurrences the card cites` | 页数或次数不符 → FAIL |
| `a stated fact its sources disprove fails; discovery and attribution still pass` | 四种事实陈述在内容事件卡上都被否定，发现与归属照常 PASS |
| `format 2 has no category: the answer's old acceptable_categories are not checked` | 答案只列 Cosmetic，内容变化卡 PASS |

### R19.4 联合树验证（`3b3fb2e`，本地 Linux）

| 检查 | 结果（证据在 [`3b3fb2e/`](3b3fb2e/)） |
|---|---|
| scorer 测试 | 116/116 |
| `verify:core` | 269/269（含 #2 的格式 2、页码、行身份测试） |
| Python 分诊 | 32/32（`renewal-triage/6`） |
| 构建（两引擎） | 通过 |
| 规则 MuPDF / PDF.js（Node） | **退出码 2**：严格 NOT_EVALUATED 28/32（R16、R18、R23、R24，均为登记的尚未支持项），事件 32/32 |
| 浏览器 `rules.spec.ts`（两引擎，重新构建后） | 通过：严格 28/32、事件 32/32，只剩登记缺口 |
| 身份声明 | 15 个事件确定归属，R25 按要求呈现为显式未决；0 个错误身份声明 |
| 陈述的事实 | 每个引擎 3 条：R08、R32 的 `dates_rolled_forward_one_year`，R24 的 `continued_heading`，重算均成立；0 条被否定，0 条无法判定 |
| `repeat` 卡 | MuPDF 14 张、PDF.js 18 张（R16、R24 的页边行与重复表头），页数与次数都与来源一致 |
| invariant（32 个用例中的出现次数） | 直接 PASS 17；间接 PASS 18（只重述事件检查，不计为独立证据）；尚未支持 NOT_EVALUATED 4 |
| R24 `no_material_differences` | 第十八轮为 NOT_EVALUATED（Cosmetic 无法核实）；现在 **PASS**：续页标题按共同定义从来源证明（两版都有 `SCHEDULE OF AIRCRAFT` 一行） |
| 续保四次比较（`packages/cli/run.ts` + `renewal-triage.py --identity`） | 结果 JSON 与 #2 在 `9ccc044` 上的四份**逐字节相同**（SHA-256 一致），分诊逐事件结果相同（[`renewal/compare-with-9ccc044.txt`](3b3fb2e/renewal/compare-with-9ccc044.txt)）；状态均为 `complete_for_scope` |
| `tsc --noEmit` | 本项文件无错误；#2 的 `tests/row-identity.test.ts` 有 17 处类型错误（见 R19.5） |
| 修复前：合并提交 `73846aa`（旧评分器） | 本轮测试文件 88 项失败、28 项通过；规则 MuPDF 0/32，每个用例都因结果格式不符失败，退出码 1（[`before-fix-73846aa.log`](3b3fb2e/before-fix-73846aa.log)、[`before-fix-73846aa-rules-mupdf.log`](3b3fb2e/before-fix-73846aa-rules-mupdf.log)） |

旧的 32/32、28/32 不是要维持的数字：严格计数恰好仍是 28/32，原因是 R24 的新无法评价被共同定义消除，四个登记缺口不变；事件回归 32/32。

### R19.5 本轮仍不支持的范围与待 #2 处理的事项

- **`repeat`**：只核对页数和卡片自己引用的出现位置；文档里未被引用的出现不搜索（两个引擎对同一页边行的切分不同，例如 PDF.js 把 `FICTIONAL FIXTURE | PAGE 1` 分成三个单元，按行文字计数不可靠）。
- **页码表达跨多页的卡**：`page_number_only` 无法判定，记 `claim_unverifiable`（退出码 1）；真实数据中没有。
- **第十八轮的范围不变**：没有文字差异的 `result.unresolved` 条目不算事件表达；一删一增以外的多卡拼装不支持；身份只认 layout.json 中该格的原文，不认 `MSN …`、`Reg. …` 前缀写法。
- **分诊（归 #2）**：Codex 的两项 P1 在 `renewal-triage/6` 上仍复现：身份取自未改动的出现处（[r4412433099](https://github.com/wlvh/policy-compare/pull/11#discussion_r4412433099)，按新测试写法声明身份后仍判 `correct`）；分卡段落借用别页上下文（[r4412433538](https://github.com/wlvh/policy-compare/pull/11#discussion_r4412433538)）。
- **类型检查（归 #2）**：`tests/row-identity.test.ts` 用格式 1 的 `CompareResult` 类型标注格式 2 的结果，`tsc --noEmit` 报 17 处错误（#2 的 `657f0ca` 上同样存在）。vitest 不做类型检查，构建用的 `tsconfig.*.json` 不含测试，所以不影响测试结果和 CI。

## R18. 第十八轮：按来源判断事实，与 #9 同步（`3a25fea`、`df8f579`）

依据：[#10 顶部指令（2026-10-29）](https://github.com/wlvh/policy-compare/issues/10) 与 [PR #11 执行通知](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6494697757)。原则以 [`AGENTS.md` @ `3db7f0b`](https://github.com/wlvh/policy-compare/blob/3db7f0b3c225f2fae0a5412819b5f422a3961891/AGENTS.md) 为准（已逐字核对，与 issue 中的文本一致）。共同处置表在 #2 的 [`reports/issue-2-validation/README.md` §D @ `2b29fd8`](https://github.com/wlvh/policy-compare/blob/2b29fd893669d5be48fda2f6b5fbe039eb5d44ac/reports/issue-2-validation/README.md)，由 #2 维护，本项只链接、评论。

**这一轮只改评分器和评分测试，没有改产品、公共契约、生成器、答案或分诊脚本。** #2 的新输出版本和版本化预期还没有发布，所以本轮评的仍是旧输出（带 Material/Review/RollForward/Cosmetic）。对旧类别的读法见下面“类别”一行，是旧版本的只读口径；新输出到来后改为核对它实际给出的具体说明。

### R18.1 同步 #9（普通合并提交 `3a25fea`）

用普通合并提交合入 #9 固定 head `2b29fd893669d5be48fda2f6b5fbe039eb5d44ac`，带入原则文件、处置表、分诊 `renewal-triage/5` 和 R16 的 `declaredChange`。两处冲突都保留了两边：

- `scorer.ts`：本项的 invariant 登记和 `DIRECT` 检查保持不变。#2 的“每个声明事件最多豁免一张卡”移进 `DIRECT.no_material_differences`，`DIRECT` 检查因此多接收 `docs`。第 12 项身份 N/A（R16:E1）原样带入。十七轮金额/币种检查没有改动。
- `scorer.test.ts`：两组测试都保留。#2 的 R16 测试按本分支的报告方式改写了两处断言：直接检查的失败原因带 invariant 名称；精确标题那一例的严格状态是 NOT_EVALUATED，只因为登记为尚未支持的 `all_source_text_preserved`，没有任何失败，`no_material_differences` 为 PASS。

合并后：scorer 95/95，`verify:core` 216/216，Python 分诊 30/30，两引擎规则与合并前相同（严格 NOT_EVALUATED 28/32，事件 32/32，退出码 2）。

### R18.2 本轮改动（`df8f579`）

| 项 | 改前（`3a25fea`） | 改后（`df8f579`） | 测试 |
|---|---|---|---|
| 文字是否改变 | 控制用例里直接用卡片自报的 `hasTextChange` | 只看**经来源校验的两侧原始文字是否不同**（`oldText !== newText`，不做 NFKC 或空白合并）。自报值是一项声明，与原文不符即 FAIL。“存在非 equal 操作”不当作同义：删掉又原样插回，两侧文字仍相同 | `a false hasTextChange flag fails…`、`deleting and re-inserting the same text…` |
| 来源校验失败的卡 | 整例 FAIL，但控制类 invariant 自己可能显示 PASS | 这样的卡直接让 `no_false_text_added_or_removed`、`no_material_differences`、`no_false_row_additions_or_deletions`、`moved_clause_has_no_internal_word_edits` 失败：伪造的文字不能用来算出“没有变化” | `a card that fails source validation cannot show that a control holds` |
| `no_material_differences` | 不得有 Material 卡；Cosmetic 以外不得有文字变化（**Cosmetic 卡直接放过**） | 见下方迁移说明 | `a Cosmetic label does not turn…`、`Review does not excuse…`、R16 各例 |
| 身份 | 产品自报的 `rowKey`/`entity`/`field` 不等于答案路径，卡就不算匹配 | **归属看编辑来源**：卡的删除、插入操作落在事件声明的 layout.json 记录/字段 run 上。自报的身份是对外声明，单独判：确定（答案接受的身份）、显式未决（`rowKey=null`、`confidence=unresolved`）、未给出、错误。**只有“错误”是虚假声明**，单独判 FAIL，严格总评仍为 FAIL；此时发现、归属、位置、可见性照常报 PASS | R22、R26、R25 各例 |
| R22 可接受的身份 | 只认序列号 | 声明的序列号，或该记录的注册号（从 layout.json 读，两侧均可）。答案没有允许显式未决：未决不是错误，但不算按要求呈现，事件 FAIL，原因写明是“未决”而不是“错误” | `R22: …` 四例 |
| R26 可接受的身份 | 只认序列号 | 序列号，或显式未决（算“按要求呈现”，不算“确定归属”）。改名后的注册号、其他记录的键都是错误声明 | `R26: an explicit identity review…`、`…missing row key…`、`…renamed registration…` |
| R25 | 要求 `unresolved` 且无行键 | 同上，另外卡上写了当事人或别的字段也算错误声明 | `R25: asserting a party…` |
| `Added+Removed`（R26、R25） | 只看单张卡，永远匹配不上（潜在错误失败） | 一张 Removed 卡在事件的旧侧 run 上删除旧文字，一张 Added 卡在新侧 run 上插入新文字（两侧都是同一记录、同一字段的来源），事件只计一次；重复的半张不重复计数。新增文字落在别的记录、或者只是把旧文字原样搬走，都不算该事件 | `R26: one delete + one add card…`、`R26: a delete + add pair is not the event…`、`R26: with a delete + add pair, another record's key…` |
| 类别 | 卡片类别必须属于 `acceptable_categories`，否则事件不匹配 | **不再评重要性**：Material 和 Review 都只表示“内容改变”，互不区分。Cosmetic（声称只有形式变化）和 RollForward（声称日期各顺延一年）是事实声明，对照答案对该事件是否允许这种说法；不允许即虚假声明，单独列在 `falseCategoryClaims`，事件 FAIL | `a Cosmetic or RollForward claim…`、`importance is not judged…`、R16 改写的一例 |
| `no_false_row_additions_or_deletions` | 只看卡片自报的 `table` | 自报为表格卡，**或**删除/插入操作落在 layout.json 的表格记录 run 上（不含表头），并且有文字变化 | `R26: a table card that changes a record's text fails the row control by its sources…` |
| 报告 | 事件只有 `correspondence` | 每个事件分开报：`discovery`（找到）、`attribution`（按来源归属）、`representation`（单卡或一删一增）、`identity.pass`（按要求呈现）、`identity.determined`（确定归属）、`identity.claims`、`falseCategoryClaims`（声明准确性）、`position`、`visibility`、`completeness`。汇总新增 `identityClaims` 和按覆盖方式分开的 `invariantResults` | — |

**`no_material_differences` 的迁移说明**（旧名保留，含义改为控制输入真正声明的事实）：

- 旧含义：不得有 Material 卡；Cosmetic 以外不得有文字变化。问题在于它同时依赖重要性标签（Material）和自报的形式标签（Cosmetic），而且 Cosmetic 卡无条件放过。
- 新含义：**控制用例除声明的事件外没有编辑**。每处经来源校验的文字变化都必须恰好是一个声明事件（R16 的 `declaredChange`：完整文字、类型、两侧、身份、可见性、每个来源位置都要对上，每个事件只豁免一张卡；类别不再参与豁免，由事件检查单独判）。
- 未声明的文字变化：
  - 卡片说是内容变化（Material、Review、RollForward）→ **FAIL**。无论这处变化实际是不是形式变化，这个声明都错了：若是形式变化，说成内容变化是错的；若是内容变化，控制用例里本不该有。
  - 卡片说是形式变化（Cosmetic）→ **NOT_EVALUATED**。只有确实不是形式变化时它才是错的，而目前没有共同、已声明的“形式变化”定义可供核对（D.3 要求产品和评分器用同一份定义，由公共规则或答案提供，不各写一套）。新的无法评价不登记为已知缺口，所以退出码是 1，不是 2。
- 没有文字变化的卡（例如原文相同的 Moved 卡）不再由这一条判断：它们由各用例声明的移动、内容类 invariant 判断（R16 的 `no_false_clause_moves`、R01/R17 的 `no_content_differences`）。旧规则里“Material 卡一律失败”这一支依赖重要性标签，已经删除；真实产品从不把原文相同的移动标成 Material，这一支在真实数据上本来就不起作用。R15、R23、R24 没有声明移动类要求，那里的虚假移动卡现在不被任何检查拦截（旧规则也只在标成 Material 时才拦）。

### R18.3 判定变化：同一组输入在 `3a25fea` 与 `df8f579` 上的结论

[`df8f579/verdict-probe.log`](df8f579/verdict-probe.log)（探针补丁 [`verdict-probe.patch`](df8f579/verdict-probe.patch)，只打印结论，不改断言）：

| 输入 | `3a25fea` | `df8f579` | 说明 |
|---|---|---|---|
| 控制用例：卡片自报 `hasTextChange=false`、Cosmetic，原文实际改变 | **PASS**（假通过） | FAIL | 自报值与原文不符 |
| 控制用例：未声明的文字变化标为 Cosmetic | **PASS**（假通过） | NOT_EVALUATED | 无法核实“只是形式” |
| 控制用例：同上，标为 Review | FAIL | FAIL | 不变 |
| 行控制：记录里的文字变化，卡片没写 `table` | **PASS**（假通过） | FAIL | 按来源判断 |
| 内容事件标为 Cosmetic / RollForward | FAIL | FAIL | 原因从“不匹配”变为“虚假类别声明”，发现与归属照常 PASS |
| 答案只列 Review，卡片标 Material | FAIL | **PASS** | 不评重要性 |
| R22：行键写该记录的注册号 | FAIL（比答案严） | **PASS** | 答案允许 |
| R22：行键写别的记录的序列号或注册号 | FAIL | FAIL | 现在是“归属 PASS，身份声明错误” |
| R22：显式未决 | FAIL | FAIL | 原因写明“未决”，不是“错误” |
| R22：标签正确，但旧值取自另一条记录里的相同金额 | FAIL | FAIL | 归属 FAIL |
| R26：显式未决 | FAIL（比答案严） | **PASS** | 按要求呈现，不算确定归属 |
| R26：行键为空、没有标未决 | FAIL | FAIL | 原因写明“未给出”，不是“错误” |
| R26：行键写改名后的注册号 | FAIL | FAIL | 归属 PASS，身份声明错误 |
| R26：一删一增 | FAIL（潜在错误失败） | **PASS** | 答案允许 |
| R26：一删一增，但新增的文字落在别的记录 / 只是旧文字原样搬走 | FAIL | FAIL | 归属 FAIL |

本轮测试文件在合并后的 scorer `3a25fea` 上有 19 项失败（[`df8f579/before-fix-3a25fea.log`](df8f579/before-fix-3a25fea.log)）。其中一部分只是因为旧 scorer 没有新的报告字段（`attribution`、`identity.claims` 等），结论层面的变化以上表为准。原有 95 项（含十七轮金额/币种保护）在 `df8f579` 上全部通过，其中三项改动：R16“Material 仍然失败”一例按裁定 3 改写；R11 一例的测试数据把 `hasTextChange` 改为与原文相符的 `false`（两侧都是 `UU`，旧数据写的 `true` 正是现在要拦的虚假声明）；R26“按改名后的注册号匹配”一例加了断言：归属 PASS，身份声明为“错误”。

### R18.4 真实数据的结果（两引擎相同）

- **身份**：15 个事件确定归属（R02、R03、R04、R07、R08、R10×2、R11、R18、R20、R21、R22、R26、R32×2），R25 按要求呈现为显式未决，**0 个错误身份声明**，0 个未按要求呈现。
- **类别声明**：0 个虚假类别声明。
- **R24 变化**：跨页表的 `SCHEDULE OF AIRCRAFT CONTINUED` 卡（Added/Cosmetic，有文字变化，答案没有声明）原来因 Cosmetic 被放过；现在 `no_material_differences` 判 NOT_EVALUATED（`invariant_unverifiable`）。R24 本来就因 `same_logical_row_order` 无法评价，所以严格计数不变（仍是 28/32，R16、R18、R23、R24 无法评价），**但退出码从 2 变为 1**，CI 的规则步骤和浏览器规则测试因此失败。这是有意的：新的无法评价不得获得退出码 2。
- **invariant 结果分开计**（32 个用例里的出现次数）：直接检查 PASS 16、NOT_EVALUATED 1（R24）；间接 PASS 18；尚未支持 NOT_EVALUATED 4。间接结果只是重述事件检查，不增加独立证据数。
- 事件回归仍为 PASS 32/32。旧的 32/32、28/32 不是要维持的数字。
- **浏览器规则**：第一次运行用的是合并前（10 月 28 日）构建的 `dist/`，产品还是 `7d909f1` 之前的版本，它把 R16 新增的页标题标成 Cosmetic。新的类别声明检查据此判 R16 事件 FAIL（虚假的“仅形式”声明），这次运行保留为 `browser-rules-*.stale-build.{log,json}`。重新构建两个引擎后再跑，结果与 Node 相同（严格 28/32，事件 32/32，0 个错误声明），只因 R24 的新无法评价而失败。

### R18.5 需要 #2 一侧决定的事项

1. **R24 的续页标题**：这行文字是跨页表真实新增的（与 R16 新页标题同类），答案没有登记。可以把它登记为声明事件，或者在共同的形式变化定义里列出“续页后缀”。两者都要放在答案或公共规则里，评分器不另写一套。登记之后，R24 的 `no_material_differences` 会变成可判定。
2. **版本化预期**：现在身份可接受的形式是从答案已有的 invariant 名称推出来的（`match_row_by_registration_or_declared_serial` → 序列号或注册号；`secondary_key_or_explicit_identity_review` → 序列号或显式未决）。#2 若在答案里加入结构化的可接受身份证据，评分器改为读取该字段。R22 是否也允许显式未决，由这份预期决定。
3. **新输出的事实说明**：新输出不再有重要性类别后，评分器只核对它实际给出的说明（例如“仅空白字符变化”“日期各顺延一年”），并从原文重新计算，不调用产品分类器，也不以产品自报为答案。
4. **`hasTextChange` 的定义**写进公共契约（#2 已同意）。

### R18.6 本轮仍不支持的范围

- 未声明、标为 Cosmetic 的文字变化：无法评价，等共同的形式变化定义（见 0.5 第 1 项）。
- `Unresolved` 作为 `result.unresolved` 里的一条（没有文字差异）不算事件的表达；只接受已有的显式未决卡。一删一增以外的多卡拼装不支持，按答案不允许的表达判 FAIL。
- 注册号只认 layout.json 里该格的原文（去掉首尾空白），不认 `Reg. …`、`MSN …` 这类前缀写法。
- 控制用例以外，同一事件的重复卡只计一次，不判失败（金额/币种格的重复编辑仍按第十六轮判 FAIL）。
- `must_not_classify_as_unchanged_duration_roll_forward` 仍读卡片自报的字段；R07 的保险期间卡由事件的来源归属和类别声明检查覆盖。
- 一张卡的类别声明正确，不能证明卡内每个片段都分类正确。

## 1. R26 / R11 假 PASS：先证明失败，再修复

**反例**：
- **R26**：结果里有一张正确的注册号卡（`TEST-C941 → TEST-RENAMED`），行键为序列号，位置、类别、可见性都满足事件要求。另外加入一张错误的 Material 金额卡，把旧侧第一条记录的 `100,000` 和新侧另一条记录的 `200,000` 配在一起。两条记录的金额其实都没变。
- **R11**：在正确的标签卡（`SUMS INSURED: → SUM INSURED:`）之外，分别加入一张错误的金额卡（`USD 2,000,000 → USD 10,000`）和一张错误的币种卡（`USD 2,000,000 → EUR 2,000,000`）。

这些结果都通过真实的 `ResultSchema` 校验；错误卡的每个字符引用都能用 `resolveLocation` 解析到真实输入，没有绕过 schema。

| 测试 | 起点 scorer `2ff585b` | 修复后 `d61461b` |
|---|---|---|
| R26：正确注册号卡 + 错误约定价值卡（精细几何关 / 开） | **PASS**（假通过）/ **PASS** | FAIL（`agreed_value_unchanged`）/ FAIL |
| R11：正确标签卡 + 错误金额卡 | **PASS** | FAIL（`no_amount_or_currency_change`） |
| R11：正确标签卡 + 错误币种卡 | **PASS** | FAIL |
| 只有正确卡（对照） | PASS | PASS |

起点上的失败可以重现：[`verification/before-fix.sh`](verification/before-fix.sh) 会在临时 worktree 里用 `2ff585b` 的 scorer 运行本项的测试，输出见 [`before-fix.log`](verification/before-fix.log)。结果是 4 项失败，原因都是 `expected 'PASS' to be 'FAIL'`。

**修复**：新增直接检查，用于 `agreed_value_unchanged` 和 `no_amount_or_currency_change`。规则是：任何替换卡或移动卡两侧的金额和币种多重集合必须一致；所有删除卡的金额与所有新增卡的金额必须相抵。只有本用例事件本身声明的金额变化可以例外。这样，一张正确的事件卡不再能抵消一张额外的错误卡。

### 第二轮：裸整数金额（`7ea1fb3`）

复核指出：第一轮只把带千分位的数字或紧跟币种代码的数字当作金额。所以同样的错误卡，只要写成 `100000 → 200000`，仍然 PASS，而且 `agreed_value_unchanged` 还被记为直接检查 PASS。

| 测试（schema 合法，来源可解析） | 第一轮 scorer `d61461b` | `7ea1fb3` |
|---|---|---|
| R26：正确注册号卡 + 错误约定价值卡 `100000 → 200000`（精细几何关 / 开） | **PASS / PASS**（假通过） | FAIL / FAIL |
| R11：正确标签卡 + 错误金额卡 `2000000 → 10000` | **PASS** | FAIL |
| 原有的带逗号 / 币种反例 | FAIL | FAIL |
| 看守：只改 MSN `1315 → 1748`，卡片字段为 `msn` | PASS | PASS（不算金额变化） |

修复前的失败可以重现：`verification/before-fix.sh d61461b`，输出见 [`7ea1fb3/before-fix-d61461b.log`](7ea1fb3/before-fix-d61461b.log)。结果是恰好这 3 项失败，其余 7 项通过。

**修法**：卡片或事件如果声明了答案里的金额字段，它上面任何独立的数字都算金额。金额字段包括 `agreed_value`（R22、R26）、`sum_insured`（R02、R03、R11）、`limit`（R09），以及产品用于同类字段的 `header_limit`、`deductible`。其他地方仍然只认带千分位或紧跟币种的数字，所以 MSN 这类纯数字标识不会被误判为金额。R11 与 R26 共用同一个函数，已一并核对。

### 第三轮：删除卡与新增卡之间的金额抵消（`74783d6`）

Codex 复核指出：所有删除卡、新增卡的金额原先在整个结果里一起抵消。因此只要记录 A 删 `100,000`、增 `200,000`，记录 B 反过来删 `200,000`、增 `100,000`，四张卡合起来恰好相抵，结果仍然 PASS；而等价的替换卡会正确判为 FAIL。

**修法**：删除卡和新增卡的金额只能在同一记录（rowKey 或 entity）的同一字段内抵消。
- 同一记录里删、增的金额不同，就是金额变化，判 **FAIL**。
- 只有单边剩余的金额，以及没有标明记录的卡，放进一个公共池。池中仍有净变化则判 FAIL。
- 金额只能在没有记录身份的卡之间抵消时，评分器无法确认它们是同一记录，判 **NOT_EVALUATED**（`invariant_unverifiable`），而不是 PASS。这不是已登记的缺口，退出码为 1，交由人工复核。

| 测试（schema 合法） | 第二轮 scorer `7ea1fb3` | `74783d6` |
|---|---|---|
| R26：正确注册号卡 + A、B 两条记录各一删一增、金额互换（卡上有记录） | **PASS**（假通过） | FAIL |
| 同上，但卡上没有记录身份 | **PASS**（假通过） | NOT_EVALUATED，退出码 1 |
| 同一记录一删一增、金额相同 | PASS | PASS |

修复前的失败可以重现：`verification/before-fix.sh 7ea1fb3`，输出见 [`74783d6/before-fix-7ea1fb3.log`](74783d6/before-fix-7ea1fb3.log)。结果是恰好这 2 项失败。

### 第四轮：卡片自报的字段（`fececbf`）

自查发现：第二轮的修法依据的是**被评分卡片自己声明的字段**。伪造卡只要把同样的错误配对 `100000 → 200000` 标成 `registration`（R26），或者把 R11 的错误金额卡标成 `endorsement`，schema 仍然合法，来源也都能解析，结果仍是 PASS。被评分的输出可以自己决定是否接受检查，这不符合独立评分的要求。带千分位的写法不受影响，因为那种写法不依赖字段。

**修法**：单元格是不是金额，以答案的 `layout.json` 为准。每个文字块都带有 `logical_path`，例如 `aircraft_schedule.SYN-1026-001.agreed_value`。
- 卡片某一侧的位置如果落在末段为金额字段的文字块上，该位置里任何独立的数字都算金额，不管卡片声明的是什么字段。
- 卡片声明了金额字段的，照旧按金额检查。
- MSN 所在文字块的路径末段是 `msn` / `model`，所以纯标识变化仍然不算金额。

| 测试（schema 合法，来源可解析） | 第三轮 scorer `74783d6` | `fececbf` |
|---|---|---|
| R26：正确注册号卡 + 错误配对 `100000 → 200000`，卡片字段写成 `registration` | **PASS**（假通过） | FAIL |
| R11：正确标签卡 + 错误裸整数金额卡，卡片字段写成 `endorsement` | **PASS**（假通过） | FAIL |
| 看守：只改 MSN `1315 → 1748`（文字块路径末段为 `msn`） | PASS | PASS |

修复前的失败可以重现：`verification/before-fix.sh 74783d6`，输出见 [`fececbf/before-fix-74783d6.log`](fececbf/before-fix-74783d6.log)。结果是恰好这 2 项失败。

真实数据上没有变化：32 对答案里所有金额单元格都带千分位（如 `1,500,000`、`USD 2,000,000`），原来的规则已经能识别。所以两个引擎的严格结果与事件回归都和第三轮相同，`fececbf/register.json` 里每个用例的结果也逐项相同。这一轮补上的，是 schema 合法、但用裸整数伪造的输出。

### 第五轮：把一个金额拆成多个位置（`28afbd1`）

Codex 复核第四轮时指出：按单元格认金额时，评分器是对每个位置**分别**取数字。伪造卡如果把金额按单个字符逐一引用，每个位置只剩一个数字。`100020 → 200010` 两侧的数字组成相同（都是一个 1、一个 2、四个 0），比较不出变化，结果仍是 PASS。卡片文字本身改不了：评分器已经要求操作文字必须等于所引用字符拼起来的结果，所以漏洞只在“逐个位置取数”这一步。

**修法**：落在同一个金额单元格上的多个位置，先按原文顺序拼回完整的数，再识别金额。引用的顺序被打乱也一样，因为排序依据的是原文位置。

| 测试（schema 合法，来源可解析，没有其他错误） | 第四轮 scorer `fececbf` | `28afbd1` |
|---|---|---|
| R26：正确注册号卡 + 错误配对 `100020 → 200010`，逐字引用，字段写成 `registration` | **PASS**（假通过） | FAIL |

修复前的失败可以重现：`verification/before-fix.sh fececbf`，输出见 [`28afbd1/before-fix-fececbf.log`](28afbd1/before-fix-fececbf.log)。结果是恰好这 1 项失败。真实数据上同样没有变化。

### 第六轮：整行引用（`55e669a`）

负责人复核时，把报告里写明的边界“一个位置横跨多个单元格”复现成了假 PASS。

**反例**：表里另有两条记录，`1315 Alpha Air 100000` 和 `1748 Alpha Air 200000`，金额各自没有变。一张错误卡把旧的第一行配给新的第二行，字段写成 `registration`。
- 卡片两侧（`d.left` / `d.right`）各引用整行；
- 文字操作（`textOps`）引用的都是单个格子的真实来源：删除 `1315`、新增 `1748`、` Alpha Air ` 不变、删除 `100000`、新增 `200000`。

**修复前**：结果是 PASS、退出码 0，`agreed_value_unchanged` 记为直接检查通过。而同一张卡只要改成逐格引用，就会判 FAIL。原因是第四、五轮的做法只认“整个位置落在某一个金额格之内”，整行位置跨了好几格，这一步就被跳过了。

**修法**：
- **按几何关系找格子**：卡片引用的每个字符坐标框（`d.left` / `d.right` 和全部 `textOps` 的来源）都对到 `layout.json` 的文字块，判定条件是“坐标框大部分在文字块里”，或“文字块大部分在坐标框里”。被引用到的金额格，按答案里该格的值计入金额，不管卡片自称是什么字段，也不管引用的是单个字、单个格还是整行。第四、五轮的情况自然包含在内。
- **坐标框不会被伪造**：`resolveLocation` 已经要求每个引用位置的坐标框和真实字符逐一相同，所以对格子用的几何来自真实输入。
- **对不上就判无法评价**：如果引用的裸数字有数位落在所有文字块之外，评分器就分不清它是不是金额。这时两条金额断言判 **NOT_EVALUATED（`invariant_unverifiable`，退出码 1）**，不判 PASS，也不归入四项可以返回退出码 2 的已登记缺口。

| 测试（schema 合法，所有引用都能解析到真实字符，没有其他错误） | 第五轮 scorer `28afbd1` | `55e669a` |
|---|---|---|
| R26：正确注册号卡 + 上述整行错误卡（精细几何关 / 开） | **PASS / PASS**（假通过，退出码 0） | FAIL / FAIL（退出码 1） |
| 同一张卡改为逐格引用；或者卡片声明 `agreed_value` | FAIL / FAIL | FAIL / FAIL |
| 看守：整行卡，同一条记录只改 MSN（`1315 → 1316`，金额不变） | PASS | PASS |
| 整行引用的那两行 `layout.json` 没有覆盖 | **PASS**（假通过） | NOT_EVALUATED，退出码 1 |

修复前的失败可以重现：`verification/before-fix.sh 28afbd1`，输出见 [`55e669a/before-fix-28afbd1.log`](55e669a/before-fix-28afbd1.log)。结果是恰好 3 项失败：两种精细几何设置下的整行反例，以及 layout 未覆盖的那一项。

**真实数据核查**：两个引擎的 R11、R22、R26、R02 产品卡片中，引用的坐标框全部落在 `layout.json` 的文字块里（MuPDF 50/42/36/52 个，PDF.js 7/6/10/8 个）。R22、R02 识别出的金额格就是事件里的金额（`2,250,000 → 2,500,000`、`USD 2,000,000 → USD 4,000,000`）。所以新的几何判断在真实输入上确实生效，不是因为没有执行才显得“没有变化”。见 [`55e669a/geometry-probe.log`](55e669a/geometry-probe.log)，脚本为同目录下的 `geometry-probe.mts`。两个引擎的严格结果与事件回归都和第五轮相同，每个用例的结果也逐项相同。

### 第七轮：只引用金额格的一部分（`c5acdb8`）

Codex 复核第六轮时指出了一个问题，而且是第六轮自己引入的回退。第六轮用答案里的“整格值”代替卡片实际引用的文字，于是出现了这样的漏洞：一个金额格 `100020` 两侧都没变，伪造卡在左侧引用前缀 `100`，在右侧引用后缀 `020`，声称这个金额里有变化。两侧对到的是同一格、同一个值，比较结果相同，判了 PASS。第四、五轮按卡片文字比较，原本能拦住这种卡。

**修法**：每个被引用的金额格同时记两样东西：
- 整格的值（`all`），用于判断两侧配对的是不是同一金额；
- 卡片实际引用到的字符（`cited`），通过把引用的坐标框对到该格的逐字符坐标得到。

判定规则：整格值有变化时按原规则判断；整格值不变、引用的部分却不同，说明卡片在答案确认未变的金额里声称了变化，判 FAIL。我核对过：真实数据 4172 个文字块的文字与逐字符坐标全部对齐，可以按字符取出引用的部分。

| 测试（schema 合法，引用都能解析，没有其他错误） | `fececbf` / `28afbd1` | 第六轮 `55e669a` | `c5acdb8` |
|---|---|---|---|
| R26：正确注册号卡 + 引用未变金额格的不同部分（`100` → `020`），字段写成 `registration` | FAIL | **PASS**（回退） | FAIL |

修复前的失败可以重现：`verification/before-fix.sh 55e669a`，输出见 [`c5acdb8/before-fix-55e669a.log`](c5acdb8/before-fix-55e669a.log)，恰好这 1 项失败。在各轮 scorer 上，这项测试只在 `2ff585b`、`d61461b`、`7ea1fb3`、`74783d6`、`55e669a` 上失败。第六轮的整行反例、第五轮的逐字拆分等其他测试，结论都不变。真实数据也没有变化：几何核查输出与第六轮逐字相同，每个用例的结果逐项相同。

### 第八轮：引用顺序与只有整行坐标的情况（`f2d953f`）

Codex 复核第七轮，又指出两种伪造方式，都成立：

- **打乱引用顺序**：一个两侧都没变的 `100020` 格，伪造卡在右侧按 `[4,1,2,3,0,5]` 的顺序逐字引用，凑出 `200010`，声称 `100020 → 200010`。第七轮把引用到的字符按格内顺序重排，两侧都还原成 `100020`，结果判 PASS。
- **只有整行坐标**：有些位置只有一个整行共用的坐标框，没有逐字坐标（Node 下的 PDF.js 就是这样）。如果 layout.json 只覆盖了 MSN 格，原来的回退条件“碰到任一文字块就算有解释”会被满足，其中的 `100000` 就漏掉了。

这已经是同一个金额检查连续第八轮被找到漏洞，所以这一轮不再逐个打补丁，而是把可以判定的范围写成明确规则（见第 5 节“金额检查的可判定范围”）：

- **卡片声称了什么**：只读卡片的删除、新增操作。按卡片自己的引用顺序，取出落在金额格里的字符，并按格切分。整格值不变、声称的金额文字却不同，判 FAIL。引用顺序和引用粒度都藏不住卡片的声称。
- **只有整行坐标时**：
  - 位置里的每个裸数字都必须出现在它覆盖的文字块里，否则判无法评价。
  - 删除或新增操作的整行坐标如果同时跨了金额格和其他格，就分不清改的是金额还是 MSN。这时也判无法评价，不判 PASS，也不冤判 FAIL。另外，`resolveLocation` 对整行坐标的字符顺序只核对首尾，中间可以重排，所以这类声称本来也无法核实。
- 以上“无法评价”都是 `invariant_unverifiable`，退出码 1，不归入四项可以返回退出码 2 的已登记缺口。

| 测试（schema 合法，引用都能解析，没有其他错误） | 第七轮 scorer `c5acdb8` | `f2d953f` |
|---|---|---|
| R26：未变的 `100020` 格，逐字乱序引用凑出 `200010` | **PASS**（假通过） | FAIL |
| R26：只有整行坐标、layout.json 只覆盖 MSN 格的整行错误卡 | **PASS**（假通过） | NOT_EVALUATED，退出码 1 |
| R26：只有整行坐标、layout.json 覆盖全部格子的整行错误卡 | FAIL | FAIL |
| R26：只有整行坐标、同一条记录只改 MSN | PASS | NOT_EVALUATED，退出码 1（无法归属） |

修复前的失败可以重现：`verification/before-fix.sh c5acdb8`，输出见 [`f2d953f/before-fix-c5acdb8.log`](f2d953f/before-fix-c5acdb8.log)，恰好 3 项失败。第三、四行在同一项测试里，这项测试失败是因为第四行。真实数据没有变化：Node 下 PDF.js 的位置正是整行坐标，但 R11、R26 的真实卡片不涉及金额格，数字也都能在文字块里找到。两个引擎的严格结果、事件回归和每个用例的结果都逐项相同，几何核查输出与第六轮逐字相同。

### 第九轮：删除卡加新增卡（`8ca503f`）

Codex 复核第八轮时指出：第八轮新增的“声称的金额文字”检查只用在了替换卡（Replaced）和移动卡（Moved）上。同样的伪造如果拆成两张卡，就能绕过：同一记录、同一字段里，一张删除卡引用未变 `100020` 格的 `100`，一张新增卡引用同一格的 `020`。这两张卡按整格值抵消后没有差异，结果判了 PASS。这是第八轮规则没有覆盖到删除/新增路径的遗漏；按卡片文字比较的 `fececbf`、`28afbd1` 本来能拦住这种卡。

**修法**：删除卡和新增卡按记录、字段分组后，组内除了抵消整格值，也比较删除卡与新增卡声称的金额文字。整格值相抵、声称的文字却不同，判 FAIL。没有记录身份、进入公共池而抵消的情况，第三轮起就判无法评价，这次不变。

| 测试（schema 合法，引用都能解析，没有其他错误） | 第八轮 scorer `f2d953f` | `8ca503f` |
|---|---|---|
| R26：同一记录，删除卡引用 `100`、新增卡引用 `020`（未变的 `100020` 格），字段写成 `registration` | **PASS**（假通过） | FAIL |

修复前的失败可以重现：`verification/before-fix.sh f2d953f`，输出见 [`8ca503f/before-fix-f2d953f.log`](8ca503f/before-fix-f2d953f.log)，恰好这 1 项失败。真实数据没有变化。

### 第十轮：拆分这一类问题的根因（`bb85bc4`）

Codex 复核第九轮，又指出一种伪造：把删除、新增操作拆成每个字一个操作。

**根因**：第七轮到第十轮的发现都属于同一类。卡片声称的金额文字，是按卡片自己选的切分方式去比较的，切分单位可以是位置、操作或卡片。只要换一种切分方式，声称的变化就能被拆散：

- 部分引用；
- 打乱引用顺序；
- 删除卡加新增卡；
- 这次的每字一个操作。

**修法**：不再针对这一种路径打补丁，而是统一比较的粒度。
1. 每一侧、每个金额格，把所有删除、新增操作在该格里引用到的字符，按卡片的引用顺序拼成一个字符串。
2. 删除卡和新增卡，再按同一记录、同一字段汇总。
3. 汇总完成后才切成数字比较。

这样，把声称的金额文字拆成几个位置、几个操作或几张卡，都藏不住声称的变化。如果拆到多张替换卡上，每张卡单独比较，拆分只会让各张卡更早判 FAIL。（这里原来写的是“都不会改变结论”，说过头了，后来收窄了两次：第十一轮发现声明了金额字段的卡并没有走这条路径；第十四轮发现整格值按卡计数，切分方式不同会多报 FAIL。这句话只对“声称的文字”成立，不对“整格值的计数”成立。）

| 测试（schema 合法，引用都能解析，没有其他错误） | 第九轮 scorer `8ca503f` | `bb85bc4` |
|---|---|---|
| R26：未变的 `100020` 格，每个字一个删除或新增操作，右侧按 `[4,1,2,3,0,5]` 凑出 `200010` | **PASS**（假通过） | FAIL |

修复前的失败可以重现：`verification/before-fix.sh 8ca503f`，输出见 [`bb85bc4/before-fix-8ca503f.log`](bb85bc4/before-fix-8ca503f.log)，恰好这 1 项失败。在此前所有各轮 scorer 上，这项测试都失败。真实数据没有变化。

### 第十一轮：声明了金额字段的卡（`402e66e`）

Codex 复核第十轮时指出，第十轮的根因修复并不完整。声明了金额字段（例如 `agreed_value`）的卡仍然沿用第二轮留下的捷径：直接把卡片自己的文字切成数字，并且按每张卡分开记录。

反例：一个两侧都没变的 `100020` 格。六张删除卡按原文顺序逐字引用它，六张新增卡逐字拼出 `200010`，所有卡片同属一条记录，都声明 `agreed_value`。两侧切出的数字都是一个 1、一个 2、四个 0，比较不出差别，结果判了 PASS。

所以，第十轮称“拆分这一类问题已经全部封住”，只对没有声明金额字段的卡成立。这里更正。

**修法**：去掉这条捷径，声明了金额字段的卡也按几何关系找格，并按“每侧、每个金额格”汇总后再比较。为了保留“声明了金额字段就算金额”的语义，这类卡引用的每个文字块都当作金额格。另外，整行坐标的位置里如果根本没有数字，它就不可能声称金额，不再因为跨格而判无法评价。

| 测试（schema 合法，引用都能解析，没有其他错误） | 第十轮 scorer `bb85bc4` | `402e66e` |
|---|---|---|
| R26：同一记录，六张声明 `agreed_value` 的删除卡逐字引用未变的 `100020`，六张新增卡拼出 `200010` | **PASS**（假通过） | FAIL |

修复前的失败可以重现：运行 `verification/before-fix.sh bb85bc4`，输出见 [`402e66e/before-fix-bb85bc4.log`](402e66e/before-fix-bb85bc4.log)，恰好这 1 项失败。此前各轮的 scorer 上，这项测试也都失败。真实数据没有变化。

### 第十二轮：拆开货币代码（`f2e0e10`）

Codex 复核第十一轮时，报了一个假 PASS 和一个误报 FAIL。

**假 PASS**：一个没变的 `USD` 货币格，被拆成三张删除卡，分别引用 `U`、`S`、`D`，字段写成 `currency`。不论这几张卡有没有记录身份，都判了 PASS。原因有两个：
- 单看每张卡的文字，都不包含完整的币种代码；
- 货币格的路径末段是 `currency`，没有纳入按格汇总的声称文字。

**修法**：
- 货币格也按格汇总声称文字。币种代码仍只从卡片文字里计数，避免重复计数。
- 没有记录身份、进入公共池的删除卡和新增卡，也要比较声称文字：值没有变化、声称文字却不同，判 FAIL。

| 测试（schema 合法，引用都能解析，没有其他错误） | 第十一轮 scorer `402e66e` | `f2e0e10` |
|---|---|---|
| R26：三张删除卡逐字引用未变的 `USD` 格（有记录身份 / 无记录身份） | **PASS / PASS**（假通过） | FAIL / FAIL |

修复前的失败可以重现：运行 `verification/before-fix.sh 402e66e`，输出见 [`f2e0e10/before-fix-402e66e.log`](f2e0e10/before-fix-402e66e.log)，恰好这 1 项失败。真实数据没有变化。

### 第十三轮：一张卡里交换两个金额格（`a8cb2cc`）

**问题**：Codex 复核第十二轮时指出一个假 PASS。表里有两个未变的金额格，分别是 `100000` 和 `200000`。一张替换卡两侧都引用这两格，但顺序相反，等于声称两格的金额互换了。评分器把每一侧的数字当作一组来比较，不管顺序：左侧是 {100000, 200000}，右侧也是 {100000, 200000}，两侧一样，于是判了 PASS。这个反例在此前每一轮的评分器上都判 PASS。

**为什么不判 FAIL**：只看一组数字，看不出哪个格对应哪个格。要核实对应关系，就得按格的路径逐一配对，这正是负责人暂缓的按单元格评分重写。

**修法**：在可判定范围内如实报告。一张卡、一个记录分组或无记录的公共池，只要某一侧的声称涉及两个以上金额格（或两个以上货币格），而且只有在“不管顺序”时两侧才对得上，就判 NOT_EVALUATED（`invariant_unverifiable`，退出码 1），不判 PASS。

| 测试（schema 合法，引用都能解析） | 第十二轮 scorer `f2e0e10` | `a8cb2cc` |
|---|---|---|
| R26：一张卡以相反顺序引用未变的 `100000`、`200000` 两格 | **PASS**（假通过） | NOT_EVALUATED，退出码 1 |

**复现**：运行 `verification/before-fix.sh f2e0e10`，输出见 [`a8cb2cc/before-fix-f2e0e10.log`](a8cb2cc/before-fix-f2e0e10.log)，恰好这 1 项失败。真实数据没有变化。

**误报 FAIL**：同一记录里，一个未变的 `100020` 格，删除侧用六张逐字卡引用，新增侧用一张整格卡引用。两侧拼出的声称文字相同，但删除侧把整格值计了六次，所以判 FAIL。当时没修，负责人决定后在第十四轮处理。

### 第十四轮：同一个格被多张卡重复计数（`a5acd50`）

**问题**：第十三轮记下的误报 FAIL。同一记录、同一字段里，金额格 `100020` 两侧都没变。删除侧用六张逐字卡引用它，新增侧用一张整格卡（或者反过来）。两侧拼出的声称文字相同，但每张逐字卡都把整格值计入一次，删除侧凭空多出五个 `100020`，结果判 FAIL。

**负责人的决定**：这类输入不要求判 PASS，但不能把重复计数当成已证实的金额错误，应判 `invariant_unverifiable`，退出码 1。确实声称了金额变化的，仍判 FAIL。不做按格对应的重写。

**修法**（只在删除卡、新增卡按记录和字段分组的地方改动）：
- 同一侧被多张卡引用的同一个格只计一次整格值。“同一个格”按 layout.json 的页号和文字块编号识别。不按金额字符串去重，所以不同格、不同记录里的等额金额不会被合并。
- 判定顺序：
  1. 先比较声称的文字，有变化就判 FAIL。
  2. 再看整格值。按格只计一次时两侧相抵、按卡计数时不相抵，说明差额只来自重复计数，判 NOT_EVALUATED（`invariant_unverifiable`，退出码 1），原因写明“同一金额格被多张卡引用，只有每格计一次时两侧才相抵”。
- 每格计一次之后仍然对不上的部分，照旧放进公共池判断。因此其他已证实的错误照样判 FAIL。

| 同一记录、字段，未变的 `100020` 格（schema 合法，引用都能解析，没有其他错误） | 第十三轮 scorer `a8cb2cc` | `a5acd50` |
|---|---|---|
| 整格删除＋整格新增 | PASS | PASS |
| 六张逐字删除＋一张整格新增 | FAIL（误报：凭空删除五个 `100020`） | NOT_EVALUATED，退出码 1 |
| 一张整格删除＋六张逐字新增 | FAIL（误报：凭空新增五个 `100020`） | NOT_EVALUATED，退出码 1 |
| 两侧都逐字引用，顺序与原文相同 | PASS | PASS |
| 整格删除＋新增侧逐字拼成 `200010` | FAIL | FAIL |

**复现**：运行 `verification/before-fix.sh a8cb2cc`，输出见 [`a5acd50/before-fix-a8cb2cc.log`](a5acd50/before-fix-a8cb2cc.log)，恰好这 1 项失败：旧 scorer 在第二种情况上判 FAIL，而不是 NOT_EVALUATED。真实数据没有变化。

**这次修复没有覆盖的切分情况**（第十六轮已按负责人的决定处理，见下）：第 5 节列明。这些情况当时仍然可能误报 FAIL，退出码 1。它们不会被判 PASS，但同样不是已证实的错误。用一个不提交的探针实际跑过，补丁和输出在 [`a5acd50/split-limits-probe.patch`](a5acd50/split-limits-probe.patch)、[`a5acd50/split-limits-probe.log`](a5acd50/split-limits-probe.log)。按“停止扩大探索”的要求，这些只记录，不修。

### 第十五轮：只引用币种代码的一部分（`800fe91`）

**问题**：Codex 复核第十四轮时指出一个假 PASS，这是声称支持范围内的问题，所以修了。R26 表里有一个没变的 `USD` 货币格。一张删除卡只引用其中的 `U`，字段写成 `currency`，结果判 PASS。有没有记录身份都一样；用一张替换卡声称 `U → D` 也一样。

原因：声称的文字在比较前只切出完整的金额和币种记号。`U` 不是完整的记号，切完什么都不剩，于是被当成“没有声称变化”。第十二轮修的是三张卡分别引用 `U`、`S`、`D` 的情况，那时三段能拼回完整的 `USD`；只引用一部分时拼不回来。

我在真实数据的版式上又查到一个同类情况。R11 等用例的 layout.json 里，币种和金额在同一个格里，例如 `sum_insured` 格的文字是 `USD 2,000,000`。只引用这个格里的 `U`，同样判 PASS。

**修法**：完整记号以外剩下的字母或数字（例如 `U`）也算声称的文字，但按格的种类分别处理：
- **layout.json 的币种格**：格里只有代码，剩下的字母只可能是代码的一部分。两侧不同，判 FAIL。
- **金额格**（币种和金额同在一格）：剩下的字母可能是代码的一部分，也可能是 `each loss` 这样的文字，分不清。两侧只在这部分不同时，判 NOT_EVALUATED（`invariant_unverifiable`，退出码 1），不判 PASS，也不判 FAIL。
- **不受影响的格**：卡片声明了金额字段时，它引用的每个文字块都算金额格，例如 R11 的标签 `SUMS INSURED:`。这类格只是因为声明才算金额格，剩下的字母不计入比较。第一次实现没有区分这一点，真实的 R11 标签卡因为删了 `S` 被判 FAIL；所以改为只看 layout.json 自己标的币种格和金额格。

| 测试（schema 合法，引用都能解析，没有其他错误） | 第十四轮 scorer `a5acd50` | `800fe91` |
|---|---|---|
| R26：删除卡只引用未变 `USD` 格的 `U`（字段 `currency` / `agreed_value`，有 / 无记录身份） | **PASS**（假通过） | FAIL |
| R26：一张替换卡在同一格声称 `U → D` | **PASS**（假通过） | FAIL |
| R11：删除卡只引用未变 `USD 2,000,000` 金额格的 `U`；替换卡在该格声称 `U → S` | **PASS**（假通过） | NOT_EVALUATED，退出码 1 |

**复现**：运行 `verification/before-fix.sh a5acd50`，输出见 [`800fe91/before-fix-a5acd50.log`](800fe91/before-fix-a5acd50.log)，恰好这 2 项失败。真实数据没有变化，R11 标签卡仍判 PASS。第十四轮的切分探针在 `800fe91` 上重跑，输出不变，当时第 5 节列出的误报 FAIL 仍然成立（第十六轮已按负责人的决定处理）。

### 第十六轮：一个格拆到多张卡上时的可评价范围（`23e5372`）

**负责人的决定**（#10 顶部第 2、3 节）：第十四轮记录的三种误报情况要分开处理，只用已保存的探针输入，不再找新的切分方式。
- **前两种**：带千分位的金额两侧切分不同；没有记录身份的卡切分不同。这两种的计数不可靠，判 `invariant_unverifiable`，退出码 1，不要求判 PASS。
- **第三种**：同一侧两张卡都删除同一整格，可能确实把同一处编辑报了两次。如果真实的编辑来源能证明这一点，可以判 FAIL，但要写明原因；证明不了就判无法评价。不能把重复引用拼出的 `100020100020` 当成原文里的金额。

**为什么前两种的计数不可靠**：删除卡、新增卡的值有两个来源：
- 每张卡自己的文字，带千分位的金额只从这里读；
- 每张卡引用的整格值，没有记录身份时在公共池里按卡累加。

一个格被拆到多张卡上时，前者会丢掉完整的金额（逐字卡的文字里没有 `100,020`），后者会把同一个格算好几次。两种情况比较出来的“差额”都不是卡片真正声称的东西。

**修法**：在删除卡、新增卡按组汇总（同一记录，或没有记录身份的公共池）时，先判断证据是否可靠，再比较值。每张卡额外记下两样东西：
- 它的编辑碰到了哪些格；
- 编辑引用的源字符身份（`charIds`）。

只看真正声明编辑的 `textOps`，`d.left`、`d.right` 里的上下文引用不算。

| 判断顺序 | 条件 | 结果 |
|---|---|---|
| 1 | 同一侧有两处编辑引用了金额或币种格里的同一个源字符 | FAIL，原因写明“同一处编辑报了两次”，不读拼接出的文字 |
| 2 | 值对不上，组里有格被同一侧多张卡编辑，且按格拼接的声称文字在事件允许之外不同 | FAIL，报出声称的差别 |
| 3 | 值对不上，组里有格被同一侧多张卡编辑，声称文字一致，而且对不上的每个值都是这些格自己的值 | NOT_EVALUATED（`invariant_unverifiable`，退出码 1） |
| 4 | 其余情况 | 按原规则判断 |

互补的逐字片段各自引用不同字符，不会被当成重复编辑。不按金额字符串去重，不同格、不同记录里的等额金额不会被合并。第 3 条只放过“拆分的格自己的值”，对不上的部分里只要有别的值，仍按原规则判 FAIL；一个组判无法评价，也不会影响别的组。

**正式测试**：已保存的 15 种探针组合，加上每种写法各一个“逐字拼成另一个金额”的对照，共 18 项。另加一项隔离对照。全部通过真实 `ResultSchema` 校验，引用都能解析。

| 写法（未变的 `l5` 格） | 整格＋整格 | 逐字＋整格 | 整格＋逐字 | 逐字＋逐字 | 同一整格删两次＋整格 | 整格＋逐字拼成另一金额 |
|---|---|---|---|---|---|---|
| 带千分位 `100,020`，有记录身份 | PASS | NOT_EVALUATED | NOT_EVALUATED | PASS | FAIL（报了两次） | FAIL |
| 裸数 `100020`，无记录身份 | NOT_EVALUATED | NOT_EVALUATED | NOT_EVALUATED | NOT_EVALUATED | FAIL（报了两次） | FAIL |
| 裸数 `100020`，有记录身份 | PASS | NOT_EVALUATED | NOT_EVALUATED | PASS | FAIL（报了两次） | FAIL |

说明：
- 无记录身份时，“整格＋整格”和“逐字＋逐字”判 NOT_EVALUATED，沿用第三轮的规则：只在没有记录身份的卡之间抵消。
- 隔离对照：带千分位的拆分组判无法评价，同时另一条记录 `SYN-1026-003` 里有一个明确的错误配对 `200,010 → 100,020`。结果仍是 FAIL，并指出那条记录。

**复现**：运行 `verification/before-fix.sh 800fe91`，输出见 [`dbf73ef/before-fix-800fe91.log`](dbf73ef/before-fix-800fe91.log)。用第十七轮的测试文件运行，失败的是参数化测试，以及第十七轮新增的两项（它们在 `800fe91` 上同样判 PASS）。参数化测试的第一处失败是“带千分位、逐字＋整格”：旧 scorer 判 FAIL，而不是 NOT_EVALUATED。隔离对照在旧 scorer 上本来就判 FAIL。真实数据没有变化。

第十六轮的证据没有单独成目录：`23e5372` 的证据运行进行到一半时，Codex 报了第十七轮的问题，测试文件要改，所以停掉了那次运行，未完成的输出也删了。两轮的检查都在第十七轮的提交上一起跑，修复前对照分别对 `800fe91` 和 `23e5372` 运行。

### 第十七轮：多格对应的保护也计入币种代码的一部分（`dbf73ef`）

**问题**：Codex 复核 `23e5372` 时指出一个假 PASS，属于声称支持范围，所以修了。两行的币种格都是没变的 `USD`。一张替换卡引用第 1 行的 `U` 和第 3 行的 `D`，左侧顺序是 `UD`，右侧是 `DU`，等于声称两格的代码片段互换。第十三轮已经规定，一侧的声称涉及两个以上金额格或币种格、只能不管顺序才对得上时，判无法评价。但这条保护只数“含完整记号的格”，而第十五轮起，代码的一部分（`U`）也算声称，两条规则的口径不一致，结果判了 PASS。R11 的同类情况是：两个共用的金额格 `USD 2,000,000`、`USD 10,000` 各引用一个 `U`，顺序相反，同样判 PASS。

**修法**：多格保护改用与比较相同的口径。layout.json 的币种格或金额格里，声称含有完整记号以外的字母或数字，也算一个格。所以上面两种情况都判 NOT_EVALUATED（`invariant_unverifiable`，退出码 1），与第十三轮的整格互换一致。

| 测试（schema 合法，引用都能解析，没有其他错误） | `23e5372` | `dbf73ef` |
|---|---|---|
| R26：一张卡以相反顺序引用两个未变 `USD` 格的 `U`、`D` | **PASS**（假通过） | NOT_EVALUATED，退出码 1 |
| R11：一张卡以相反顺序引用两个共用金额格的 `U` | **PASS**（假通过） | NOT_EVALUATED，退出码 1 |

**复现**：运行 `verification/before-fix.sh 23e5372`，输出见 [`dbf73ef/before-fix-23e5372.log`](dbf73ef/before-fix-23e5372.log)，恰好这 2 项失败。真实数据没有变化。

## 2. 31 种 invariant 的覆盖登记

- **直接检查**：评分器里有这一条的专门检查（`DIRECT` 表）。每条都有一个负向测试，构造违反它的结果，并要求失败原因里写着这条 invariant 的名字。
- **间接覆盖**：没有专门检查，但只要违反它，就必然让该用例的事件检查或完整性检查失败。表中列出能证明这一点的负向测试。这些测试大多是已有的，本项只补了 R25 的两个。
- **尚未支持**：结果里没有足够的证据可供判断，记为 `NOT_EVALUATED`。**没有任何一条被记为 N/A**。

| invariant | 用例 | 覆盖 | 依据 | 负向测试 |
|---|---|---|---|---|
| no_content_differences | R01 R17 | 直接 | 不得有任何差异卡 | `direct invariant check rejects a violation: …` |
| no_material_differences | R01 R15 R16 R17 R23 R24 | 直接（既有；第十八轮改为事实要求，第十九轮改到格式 2，第二十轮收窄到本例声明） | 每处经来源校验的文字变化都必须是本例的声明事件（每个事件只消费一张卡）；来源证明只是形式（空白、已确认页码、续页标题）但未声明的变化，以及形式无法判定的变化，记 NOT_EVALUATED；其余未声明的文字变化 FAIL；来源校验失败的卡 FAIL（见第 0.1 节；第十九轮见 R19.2，当时来源证明只是形式的未声明变化直接放行；第十八轮见 R18.2；第十七轮及以前：不得有 Material 卡，Cosmetic 以外不得有文字变化） | 同上；`an undeclared text change in a control fails…`、`an undeclared form-only change the sources prove is not allowed by that fact…`、`R24: …`、`a card that fails source validation…`、R16 各例 |
| no_false_text_added_or_removed | R15 | 直接 | 不得有两侧原文不同的卡（第十八轮起不看自报的 `hasTextChange`），不得有来源校验失败的卡 | 同上；`a false hasTextChange flag fails…` |
| no_false_clause_moves | R16 | 直接 | 不得有 Moved 卡 | 同上 |
| no_false_row_additions_or_deletions | R23 R24 | 直接（既有） | 有文字变化的卡不得自报为表格卡，删除/插入操作也不得落在表格记录的 layout.json run 上（第十八轮起按来源） | 同上；`R26: a table card that changes a record's text fails the row control by its sources…` |
| moved_clause_has_no_internal_word_edits | R12 | 直接 | Moved 卡两侧原文不得不同 | 同上 |
| must_not_classify_as_unchanged_duration_roll_forward | R07 | 直接 | 第十九轮起：不得陈述来源否定的 `dates_rolled_forward_one_year`（不读卡片自报字段）；此前：保险期间卡不得判为 RollForward | 同上；`a stated fact its sources disprove fails…` |
| grouping_allowed_only_with_all_occurrence_locations | R09 | 直接 | 聚合卡必须列出两侧全部重复位置 | 同上 |
| **agreed_value_unchanged** | R26 | **直接（新增）** | 金额/币种不变；卡片声明了金额字段，或者位置落在 layout.json 的金额单元格上时，裸整数也算金额；删除/新增卡只在同一记录同一字段内抵消（见第 1 节） | R26 反例（带逗号、裸整数、字段错标、逐字拆分位置、整行引用、部分引用未变金额格、一删一增互换各一组）；layout 未覆盖时无法评价；MSN 看守（单格与整行）；同记录一删一增对照 |
| **no_amount_or_currency_change** | R11 | **直接（新增）** | 同上 | R11 金额、裸整数金额、字段错标、币种反例 |
| header_role_must_not_exclude_text | R09 | 间接 | 页眉限额事件需要在页眉位置有可见卡；页眉文字被排除就没有卡 | `empty required output` |
| rotation_must_not_exclude_text | R19 | 间接 | 旋转状态事件需要在旋转文字位置有可见卡 | `empty required output` |
| must_not_match_values_across_party_identity | R10 | 间接 | 两个地址事件各自核对当事人和字段 | `wrong subject` |
| same_field_identity | R11 | 间接 | 标签事件核对字段 `sum_insured.label`，并要求类型为 Replaced | `R11: the label change attached to another field fails`、`wrong operation` |
| same_address_identity | R18 | 间接 | 连字事件核对 original_insured 的 address | `wrong subject` |
| exact_move_must_not_be_consumed_by_local_replacement | R13 | 间接 | 移动事件需要 Moved 卡，新增事件需要 Added 卡，各自在自己的位置 | `R13: the exact move and the similar new clause are not interchangeable` |
| match_row_by_registration_or_declared_serial | R22 | 间接 | 金额事件的卡按编辑来源落在该记录的金额格上；行键可以是序列号或该记录的注册号（第十八轮起），别的记录的键是错误声明 | `R22: …` 四例 |
| secondary_key_or_explicit_identity_review | R26 | 间接 | 注册号事件的卡（或一删一增两张卡）按来源落在该记录的注册号格上；行键为序列号，或显式未决（第十八轮起） | `R26: matching the row by the renamed registration…`、`R26: an explicit identity review…`、一删一增各例 |
| duplicate_identity_must_be_reported | R25 | 间接 | 要求状态为 partial，且有 ambiguous_identity 未决组 | `R25: an unreported duplicate identity fails` |
| must_not_assert_unique_row_identity_without_evidence | R25 | 间接 | 卡片必须为 unresolved，且没有行键；写了当事人或别的字段也是错误声明 | `R25: asserting a unique row key without evidence fails`、`R25: asserting a party…` |
| must_not_claim_no_changes | R25 | 间接 | 必须有可见卡 | `duplicate-key warning alone cannot waive amount evidence` |
| old_and_new_amount_delta_must_remain_visible | R25 | 间接 | 新旧金额必须在同一张可见卡上，且位置正确 | 同上；`hidden event` |
| unresolved_identity_does_not_waive_text_change_detection | R25 | 间接 | 未决组不能代替必需的卡 | 同上 |
| duplicate_key_warning_alone_is_not_a_pass | R25 | 间接 | 只有未决组而没有卡，事件失败 | 同上 |
| must_not_claim_complete_or_no_changes | R27 R28 | 间接 | 覆盖事件要求状态为 partial，并有可见的覆盖区域 | `coverage: incorrect complete` |
| text_elsewhere_on_page_does_not_prove_full_coverage | R28 | 间接 | 覆盖区域必须对准图片区域，不能是整页 | `coverage: generic warning`、`wrong region` |
| renewal_classification_must_not_hide_amount_change | R32 | 间接 | 金额事件必须有自己按来源归属的卡；陈述在金额卡上的“日期顺延一年”会被原文否定 | `a stated fact its sources disprove fails…` |
| all_source_text_preserved | R16 | **尚未支持** | 见第 4 节 | — |
| ligature_geometry_not_uniformly_guessed | R18 | **尚未支持** | 见第 4 节 | — |
| all_aircraft_values_attached_to_original_identity | R23 | **尚未支持** | 见第 4 节 | — |
| same_logical_row_order | R24 | **尚未支持** | 见第 4 节 | — |

合计：直接 10 种（原有 8 种 + 新增 2 种）、间接 17 种、尚未支持 4 种。原来没有按名称检查的 23 种，现在的去向是：新增直接检查 2 种、间接覆盖 17 种、尚未支持 4 种。

`tests/scorer.test.ts` 中的登记一致性测试会核对四件事：登记表与 32 对答案里的 31 种完全一致；直接检查的名单与负向测试的名单一致；尚未支持的恰好是这 4 种；表中引用的每个测试名都真实存在。

间接覆盖的结果跟随该用例的事件和完整性：都通过才算 PASS，任一失败即 FAIL，有事件无法评价时则为 NOT_EVALUATED。表中没有出现的新 invariant，一律记为 `NOT_EVALUATED`（`invariant_unknown`）。

## 3. 总状态的两种口径

| 口径 | 含义 | 两引擎（Node / 浏览器） |
|---|---|---|
| **严格总状态** `status` | 事件 + 已执行的检查 + 全部 invariant | **NOT_EVALUATED**：28/32 PASS，R16、R18、R23、R24 无法评价 |
| **事件回归** `eventRegression` | 事件 + 已执行的检查，不含尚未支持的 invariant | PASS 32/32 |

- 结论的优先级是：有失败即 FAIL，否则有无法评价即 NOT_EVALUATED，否则 PASS。CLI、浏览器测试和报告都使用同一个 `summarize()` 计算。
- 报告新增以下字段：
  - `eventStatus`：逐用例的事件回归结论；
  - `invariants[]`：逐用例的 invariant 结果；
  - `coverageGaps`：每条无法评价的原因；
  - `knownGapsOnly`：是否只剩已登记的缺口；
  - `invariantCoverage`：本次运行中各覆盖类型分别出现了哪些 invariant。
- **退出码**：
  - 0：严格 PASS。
  - **2**：没有失败，剩下的只有登记为尚未支持的 invariant。
  - 1：有任何失败，或出现未登记的无法评价（未知 invariant、未支持的身份路径、未知检测分支）。
- 本地 `pnpm test:rules:*` 现在退出码为 **2**，不是 0。`scripts/verify.ts` 会把它当作该步骤失败；这符合严格口径，而该文件不在本项范围内，所以没有改。
- **CI**：规则步骤只接受退出码 2（`|| test $? -eq 2`）。日志里会打印严格状态和缺口用例，报告文件作为 artifact 上传。浏览器测试 `rules.spec.ts` 在以下情况失败：任何失败、事件回归不是 PASS、或出现未登记的缺口；NOT_EVALUATED 会保留在它输出的 JSON 里。这样 CI 仍能拦住回归和新出现的缺口，同时不把“尚未支持”算成通过。第二十轮起两个引擎的 job 不再互相取消；构建成功后，规则、审核回归和浏览器测试各自运行，前一项失败不再让后面的检查被跳过，任一步失败 job 仍失败（见第 0.3 节）。
- 诊断文件（`reports/failures/`）只为会导致退出码 1 的用例写出，已登记的缺口不会每次运行都产生 8 个文件。
- 身份 N/A 第十七轮及以前是 11 项；第十八轮合入 #2 登记的 R16:E1（重分页新增的页标题）后是 12 项，没有其他扩大。N/A 事件的文字、操作、类别声明、位置检查和 R13 负向测试都保留。
- **第十八轮**规则运行的退出码是 **1**：R24 的 `no_material_differences` 新增一项未登记的无法评价（见第 R18.4 节）。**第十九轮**按共同定义从来源核验续页标题后，该项 PASS，退出码回到 **2**，严格计数 28/32。**第二十轮**撤回这项全局放行（来源证明的形式事实不等于本例允许），该项又是未登记的 NOT_EVALUATED，退出码 **1**，严格计数仍为 28/32。#2 在 R24 登记这处新增标题后（`3f3c5f3`），它由本例声明的事件消费，`9d7f266` 上退出码回到 **2**（见第 0.8 节）。
- 第十九轮新增的未评价种类 `claim_unverifiable`（陈述的事实无法判定）不登记为已知缺口，出现时退出码为 1。

## 4. 尚未支持的 4 种：缺的是哪一层证据

判断前先区分三层：

- ① PDF 原文是否被完整提取；
- ② 已提取的字符在比较中是否都被处理；
- ③ 结果中能观察到的对应关系。

一层的检查不能当作另一层的证明。

| invariant | 现有检查能证明什么 | 缺少什么 |
|---|---|---|
| all_source_text_preserved（R16 重分页） | R16 的另外两条直接检查只能排除“误报了变化” | ② 结果只列差异，没有逐字符的对应关系；① 评分器没有把提取结果和 `layout.json` 对照 |
| ligature_geometry_not_uniformly_guessed（R18） | 浏览器里的精细几何检查只要求高亮框落在字形框里、尺寸合理 | 平均切分出来的框同样落在连字字形框内，现有检查分不出来；Node 运行根本不检查最终几何 |
| all_aircraft_values_attached_to_original_identity（R23 行重排） | R23 的直接检查能抓住“报出来的”错误金额变化 | ③ 没变的行不出卡，结果看不出每条新行配的是哪条旧行 |
| same_logical_row_order（R24 跨页表） | 无 | ③ 行对应与顺序在结果中观察不到；按 issue 要求，不以零张卡或行数相等作为证据 |

要支持这几条，需要结果或评价输入带有全量对应关系，或者评分器要直接对照 `layout.json`。这超出了本项不新建产品结构、不改提取引擎的边界，所以没有做。

## 5. 其他已知边界（本项未改，如实列出）

- ~~评分器比答案更严~~、~~`Added+Removed` 未支持~~：第十八轮已按答案接受注册号、显式未决和一删一增，见第 R18.2 节；仍不支持的范围见第 R18.6 节（第十九轮的范围见第 R19.5 节，第二十轮见第 0.6 节）。
- **金额检查的可判定范围**（第八轮起写成明确规则）：
  - 按几何关系找出卡片引用了 layout.json 中的哪些金额格。声明了金额字段的卡，引用的每个文字块都当作金额格。比较两样东西：一是各格的值，看两侧配对的是不是同一金额；二是卡片删除、新增操作按自己的引用顺序声称的金额文字。声称的文字按“每侧、每个金额格”汇总：同一张卡的所有位置和操作合在一起；删除卡、新增卡再按同一记录、同一字段合在一起，汇总后才切成数字比较。替换卡、移动卡在单张卡内比较。能判定的情况下，结论与引用粒度（单个字、单个格、整行）和引用顺序无关；把声称的文字拆成几个位置、几个操作或几张卡，也藏不住声称的变化，不会因此判 PASS。**但这不等于“拆成几张卡都不影响结论”**：删除卡、新增卡的整格值按卡计入，切分方式会影响值的计数，范围见下面“切分方式”一条。
  - 有逐字坐标时，裸数字的每一位都必须落在某个文字块内。只有整行坐标时，裸数字必须出现在它覆盖的文字块里；而且删除、新增操作不能同时跨金额格和其他格。不满足这些条件就判 NOT_EVALUATED（`invariant_unverifiable`，退出码 1），不判 PASS。
  - 代价是：只有整行坐标、又跨格改动的卡片（例如同一条记录只改 MSN）只能判“无法评价”。同一侧的声称涉及多个金额格（或多个货币格；第十七轮起，只含代码一部分的格也算）时，“哪个格对应哪个格”无法用多重集合核实，只要两侧仅在不管顺序时对得上，也判“无法评价”。当前真实数据中没有这两种卡片。
  - 前提是 layout.json 本身正确：如果它把金额格的路径标错了，评分器会跟着错。为了不把 MSN 这类标识误判为金额，本项没有把所有裸整数都当作金额。
  - **部分币种代码**（第十五轮）：声称的文字里，完整的金额、币种记号以外剩下的字母或数字（例如 `USD` 里的 `U`）也算声称。在 layout.json 的币种格里，两侧不同判 FAIL。在金额格里（币种和金额同在一格，例如 `USD 2,000,000`），两侧只在这部分不同时判 NOT_EVALUATED（`invariant_unverifiable`，退出码 1），因为它可能是代码的一部分，也可能是 `each loss` 这样的文字。卡片只因声明金额字段才算作金额格的文字块（例如 R11 的标签）不参加这项比较。
  - **删除卡、新增卡的切分方式**（第十四、十六轮）：
    - **支持的范围**：两侧切分方式相同时（都引用整格，或都按原文顺序逐字引用），值和声称都对得上，有记录身份时判 PASS；声称的文字有变化时判 FAIL。同一记录、同一字段内，同一侧被多张卡引用的同一个格只计一次整格值（按页号和文字块编号识别）。
    - **重复报告**：同一侧有两处编辑引用了金额或币种格里的同一个源字符（按 `charIds`），判 FAIL，原因是“同一处编辑报了两次”。拼接出的重复文字不当作金额读取。
    - **无法评价的条件**（退出码 1）：
      - 只有每格计一次时两侧才相抵，声称文字又没有变化；
      - 组里有格被同一侧多张卡编辑，值对不上，但按格拼接的声称文字一致，且对不上的每个值都是这些格自己的值。

      带千分位的金额两侧切分不同、没有记录身份的卡切分不同，都属于这一类。
    - **仍按原规则 FAIL**：拆分组里声称文字在事件允许之外不同；对不上的部分含有拆分格以外的值；别的组里已证实的错误。
    - 第十四轮的探针输出见 [`a5acd50/split-limits-probe.log`](a5acd50/split-limits-probe.log)。这 15 种组合现在是正式测试 `R26: the saved segmentation inputs`。当前产品不用删除卡、新增卡来表示金额，R11、R26 的真实结果里没有这类卡。
- **多余的卡只在有对应 invariant 时才拦截**：额外的、解释不了的卡，只有在该用例声明了禁止它的 invariant 时才会被拒绝，例如 `no_content_differences`、`no_material_differences` 和金额/币种检查。答案没有声明这类要求的用例，评分器不另做误报检查。

## 6. 验证（当前联合树 `9d7f266`，本地 Linux）

每一轮都在该轮的代码提交上完整重跑，证据各自放在对应目录里。

| 轮次 / 代码提交（证据目录） | scorer 测试 | Python 分诊 | `verify:core` | 两个引擎的规则（Node） | 浏览器 `rules.spec.ts`（两个引擎） | 修复前反例（当轮测试文件） |
|---|---|---|---|---|---|---|
| 第二十轮联合树 `9d7f266`（当前，`9d7f266/`；合并 `42bfc9b`） | 118/118 | 35/35（分诊 `/7`） | 271/271 | **退出码 2**：严格 NOT_EVALUATED 28/32，事件 32/32；位置集 11/11 | 完整浏览器测试各 16/16，`rules.spec.ts` 只剩登记缺口 | `a4954a1` 的评分器读联合树：2 项失败，规则退出码 1（R24:E1 身份路径不受支持） |
| 第二十轮 `a4954a1`（`a4954a1/`） | 117/117 | 未变（32/32） | 270/270 | 退出码 1，与 `74693f3` 逐项相同 | 失败（R24），与 `74693f3` 逐项相同 | `f367423` 上 1 项失败（三个借用文字的伪造卡判 PASS） |
| 第二十轮 `a705d4c`、`74693f3`（`74693f3/`） | 116/116 | 32/32（分诊 `/6`） | 269/269 | **退出码 1**：严格 NOT_EVALUATED 28/32，事件 32/32；R24 多一项未登记的无法评价 | **失败**（同一原因）：严格 28/32，事件 32/32，0 个 FAIL | `4b72b11` 上 10 项失败（身份 `outcome` 6、控制用例 2、`repeat` 措辞 1、登记 1）；同一评分器的规则退出码 2 |
| 第十九轮 `3b3fb2e`（联合树，`3b3fb2e/`；合并 `73846aa`） | 116/116 | 32/32（分诊 `/6`） | 269/269 | 退出码 2：严格 NOT_EVALUATED 28/32，事件 32/32 | 通过：严格 28/32，事件 32/32，只剩登记缺口 | `73846aa`（旧评分器读不了格式 2）上 88 项失败；规则 0/32 |
| 第十八轮 `df8f579`（`df8f579/`；合并 `3a25fea`） | 112/112（95 + 新 17） | 30/30（合入 #2 的分诊 `/5`） | 233/233 | **退出码 1**：严格 NOT_EVALUATED 28/32，事件 32/32；R24 多一项未登记的无法评价 | **失败**（同一原因）：严格 28/32，事件 32/32，0 个错误声明；重新构建前的旧构建运行另存 | `3a25fea` 上 19 项失败，结论层面的变化见 `verdict-probe.log` |
| 第十六、十七轮 `23e5372`、`dbf73ef`（`dbf73ef/`） | 86/86（原 32 + 新 54） | 20/20 | 140/140 | 退出码 2：严格 NOT_EVALUATED 28/32，事件 32/32 | 通过：严格 28/32，事件 32/32，只剩已登记缺口 | `800fe91` 上 3 项（已保存的切分输入，及第十七轮两项）失败；`23e5372` 上恰好 2 项（多格互换代码片段）失败 |
| 第十五轮 `800fe91`（`800fe91/`） | 82/82 | 20/20 | 136/136 | 同上 | 同上 | `a5acd50` 上恰好 2 项（部分币种代码）失败 |
| 第十四轮 `a5acd50`（`a5acd50/`） | 80/80 | 20/20 | 134/134 | 同上 | 同上 | `a8cb2cc` 上恰好 1 项（切分不同的重复计数）失败 |
| 第十三轮 `a8cb2cc`（`a8cb2cc/`） | 79/79 | 20/20 | 133/133 | 同上 | 同上 | `f2e0e10` 上恰好 1 项（单卡交换两格）失败 |
| 第十二轮 `f2e0e10`（`f2e0e10/`） | 78/78 | 20/20 | 132/132 | 同上 | 同上 | `402e66e` 上恰好 1 项（拆开货币代码）失败 |
| 第十一轮 `402e66e`（`402e66e/`） | 77/77 | 20/20 | 131/131 | 同上 | 同上 | `bb85bc4` 上恰好 1 项（声明字段、跨卡拆分）失败 |
| 第十轮 `bb85bc4`（`bb85bc4/`） | 76/76 | 20/20 | 130/130 | 同上 | 同上 | `8ca503f` 上恰好 1 项（逐字操作）失败 |
| 第九轮 `8ca503f`（`8ca503f/`） | 75/75 | 20/20 | 129/129 | 同上 | 同上 | `f2d953f` 上恰好 1 项（删除＋新增声称）失败 |
| 第八轮 `f2d953f`（`f2d953f/`） | 74/74 | 20/20 | 128/128 | 同上 | 同上 | `c5acdb8` 上恰好 3 项（乱序引用、整行坐标）失败 |
| 第七轮 `c5acdb8`（`c5acdb8/`） | 71/71 | 20/20 | 125/125 | 同上 | 同上 | `55e669a` 上恰好 1 项部分引用失败 |
| 第六轮 `55e669a`（`55e669a/`） | 70/70 | 20/20 | 124/124 | 同上 | 同上 | `28afbd1` 上恰好 3 项整行引用失败 |
| 第五轮 `28afbd1`（`28afbd1/`） | 65/65 | 20/20 | 119/119 | 同上 | 同上 | `fececbf` 上恰好 1 项逐字拆分失败 |
| 第四轮 `fececbf`（`fececbf/`） | 64/64 | 20/20 | 118/118 | 同上 | 同上 | `74783d6` 上恰好 2 项字段错标失败 |
| 第三轮 `74783d6`（`74783d6/`） | 62/62 | 20/20 | 116/116 | 同上 | 同上 | `7ea1fb3` 上恰好 2 项一删一增互换失败 |
| 第二轮 `7ea1fb3`（`7ea1fb3/`） | 59/59 | 20/20 | 113/113 | 同上 | 同上 | `d61461b` 上恰好 3 项裸整数变体失败 |
| 第一轮 `d61461b`（`verification/`） | 55/55 | 20/20 | 109/109 | 同上 | 同上 | 起点 `2ff585b` 上 4 项失败 |

前十七轮的身份 N/A 都是 11 项；第十八轮至 `a4954a1` 是 12 项（合入 R16:E1）；`9d7f266` 起是 13 项（R24:E1）。覆盖登记各轮都是直接 10、间接 17、尚未支持 4、未知 0。

用 `dbf73ef` 的测试文件对各轮 scorer 依次重跑，失败数为 33 → 28 → 25 → 22 → 17 → 16 → 15 → 14 → 11 → 10 → 9 → 8 → 7 → 6 → 5 → 3 → 2 → 0。逐字坐标下的整行 MSN 看守在各轮都通过。部分引用的两个反例（单张卡、删除＋新增）在 `fececbf`、`28afbd1` 上本来能拦住，到 `55e669a` 回退，第七、九轮修复。见 [`dbf73ef/before-fix-all-rounds.log`](dbf73ef/before-fix-all-rounds.log)，前几轮的对应记录保留在各自的目录中。`2ff585b` 上的 33 项里包括单格 MSN 看守：那时的 scorer 还不输出 invariant 结果，看守里的断言无从成立；这不是金额误判。

本地浏览器运行使用了 Chromium 1243，通过不提交的 `tmp/playwright.local.config.ts` 设置 `executablePath`。CI 使用自己安装的浏览器，结果见 PR。

```bash
pnpm install --frozen-lockfile && pnpm install:pdfjs && pnpm install:mupdf
pnpm exec vitest run tests/scorer.test.ts
python3 -m unittest discover -s tests -p 'test_renewal_triage.py'
pnpm verify:core
pnpm test:rules:mupdf; echo "exit $?"   # 联合树 9d7f266 预期为 2（74693f3 至 a4954a1 为 1，第十九轮为 2，第十八轮为 1）
pnpm test:rules:pdfjs; echo "exit $?"   # 同上
pnpm build:mupdf && pnpm build:pdfjs     # 浏览器规则前必须重新构建：合并带入了产品改动
reports/invariant-coverage/verification/before-fix.sh           # 起点 2ff585b：33 项失败
reports/invariant-coverage/verification/before-fix.sh d61461b   # 第一轮：28 项失败
reports/invariant-coverage/verification/before-fix.sh 7ea1fb3   # 第二轮：25 项失败
reports/invariant-coverage/verification/before-fix.sh 74783d6   # 第三轮：22 项失败
reports/invariant-coverage/verification/before-fix.sh fececbf   # 第四轮：17 项失败
reports/invariant-coverage/verification/before-fix.sh 28afbd1   # 第五轮：16 项失败
reports/invariant-coverage/verification/before-fix.sh 55e669a   # 第六轮：15 项失败
reports/invariant-coverage/verification/before-fix.sh c5acdb8   # 第七轮：14 项失败
reports/invariant-coverage/verification/before-fix.sh f2d953f   # 第八轮：11 项失败
reports/invariant-coverage/verification/before-fix.sh 8ca503f   # 第九轮：10 项失败
reports/invariant-coverage/verification/before-fix.sh bb85bc4   # 第十轮：9 项失败
reports/invariant-coverage/verification/before-fix.sh 402e66e   # 第十一轮：8 项失败
reports/invariant-coverage/verification/before-fix.sh f2e0e10   # 第十二轮：7 项失败
reports/invariant-coverage/verification/before-fix.sh a8cb2cc   # 第十三轮：6 项失败
reports/invariant-coverage/verification/before-fix.sh a5acd50   # 第十四轮：5 项失败
reports/invariant-coverage/verification/before-fix.sh 800fe91   # 第十五轮：3 项失败
reports/invariant-coverage/verification/before-fix.sh 23e5372   # 第十六轮：只有 2 项（多格互换代码片段）失败
pnpm exec tsx reports/invariant-coverage/55e669a/geometry-probe.mts mupdf   # 真实卡片的坐标框能否全部对到 layout.json
git restore reports/core-tests.json reports/rules-mupdf.json reports/rules-pdfjs.json   # 上面的命令会改写这些已提交的报告
```

## 7. 与 #9 的关系

本分支从 PR #9 的 head `2ff585b` 建立，PR base 为 `feat/policy-compare`。第十八轮按 #10 指令，用普通合并提交 `3a25fea` 同步了 #9 的固定 head `2b29fd8`，不再等 #9 先合入。之后 #2 发布最终固定代码时，再合入本分支，在联合树上验收并公布 SHA，由 #2 合入该已验证 head。本项不自行合并 PR 到 feat/main，不切换默认分支，也不部署。
