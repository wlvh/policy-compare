# #2 交接（2026-10-30）

本会话（#2，Claude Code）按用户 2026-10-30 09:58Z 的指令（[PR #9 评论 6519984256](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6519984256)）停止开发，交给统一接手的 Codex 会话。完整历史见 [`reports/issue-2-validation/README.md`](../../reports/issue-2-validation/README.md)（第 0、R11、6 节）；本文只写接手需要的状态。

## 1. 分支与版本

| 项 | 值 |
|---|---|
| 分支 | `fix/issue-2-renewal`（PR #9，目标 `feat/policy-compare`） |
| 本文所在提交 | 见 PR #9 上的“交接完成”评论（推送后的完整 HEAD SHA）；本文之后本会话不再提交 |
| 最后改动产品与分诊的提交 | `01892fded95d4c5317557287abcece0fd40ab0f3`：核心 `policy-compare/0.1.0+row-identity.34+facts.6+repeat.9+ops.4`（`b32b3a4`），分诊 `renewal-triage/37`（`01892fd`） |
| 其后 | `ef77e83`：只加 `01892fd` 的证据与 README；本文所在提交：只加本文与 `reports/issue-2-validation/tools/` |
| #10 一侧 | `fix/scorer-invariant-coverage` 已合入 `ef77e83`（其 `09c3d5a`），其交接见该分支的 `docs/handoff/issue-10.md`（`cef3cad`）。两边不再互相合并，由接手者统一集成 |

## 2. 最近一次完整验证：`01892fd`

命令：`reports/issue-2-validation/tools/chain.sh`（见第 6 节），证据在 `reports/issue-2-validation/01892fded95d4c5317557287abcece0fd40ab0f3/`。

| 检查 | 结果 |
|---|---|
| `pnpm verify:core` | 363/363（含 #10 评分器 144） |
| 分诊 `python3 -m unittest discover -s tests -p 'test_renewal_triage.py'` | 82/82 |
| `pnpm exec tsc --noEmit -p tsconfig.json` | 0 个错误 |
| 两引擎构建、PDF 机制、审核回归、浏览器 | 通过；7/7、10/10、各 16/16（取消循环最长 455 ms、211 ms） |
| 32 对规则（#10 的评分器） | 退出码 2：严格 PASS 28/32，另 4 项登记的 NOT_EVALUATED（R16、R18、R23、R24），FAIL 0；与 #10 在 `50c2ff4` 的报告除提交号外相同 |
| 四次续保比较 | 结果与分诊事件与 `8bf16df` 逐字段相同；correct 航空 77/75、商务航空 66/65（PDF.js/MuPDF），misattributed 0 |
| 32 份已存结果重评 | 182 处变化，与 `8bf16df` 相同 |
| 修复前 | 最终测试配 `437e9f3` 的产品 2 项失败（OOOO、PPPP），配分诊 `/34` 3 项失败（QQQQ、RRRR、SSSS） |
| CI | push run 41033461025、PR run 41033476525，全部成功 |

这些数字**不能**覆盖下面第 3 节的已复现缺口。

## 3. 未完成：用户独立复核的四项（[PR #9 评论 6519680071](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6519680071)）

四项都**未修复**。本会话在交接前用 #10 存的探针在 `01892fd` 上重跑，四项都仍能复现。探针在 #10 的分支上：`git show origin/fix/scorer-invariant-coverage:reports/invariant-coverage/88718d0/probes/<文件>`（`cef3cad`）。TypeScript 探针放回同一相对路径后在仓库根目录用 `pnpm exec tsx <探针>` 运行；Python 探针用 `python3 -I <探针> <含 tests/ 与 scripts/ 的目录>`。

| # | 问题 | 位置 | 探针与 `01892fd` 上的结果 | 下一步最小动作 |
|---|---|---|---|---|
| 1 | 一条记录的**每一格**都折行（三栏、四栏），折行那一行簇数等于格数，被当成独立的一行：卡片 rowKey 写成 `(a)`，未决 0（`8f0e71b` 上是完整行、rowKey `123 (a)`） | `packages/compare-core/structure.ts` 的 `ownRow()`（`b32b3a4` 把条件改为“簇数不少于格数”） | `product-fullwrap-probe.ts`：三栏、四栏都是 `Replaced/row-identity/row=(a)` | 满一行的折行与按列抽取的下一条记录在几何上分不开：无法区分时把这组行的结构或身份标为未决，不把续行确定为另一条记录；保住原先完整行的归属。不加 `(a)` 之类的词表。与第 5 节“按不同次序抽取的表”分开报告 |
| 2 | 分诊 `/37`：格的**次数**（`allocate()`）与**归属**（`reaches()`）分别满足，未绑定同一次出现。增删行 `1315 \| Hull \| USD 100 \| USD 100` 由单元 `1315 Hull USD 100; 1760 Liability USD 100` 判 correct、整行完整；替换行 `1315 \| Alpha \| Alpha \| USD 100` 由 `1315 Alpha USD 100; 1760 Alpha USD 999` 判整行完整 | `scripts/renewal-triage.py` 的 `row_cells()` 与 `triage()` 里的 `whole_row()` | `repeated-cell-other-record-triage-probe.py`：Codex 例与双 Alpha 例都是 `correct`、`fullRowRecovered=True`（应不完整）；正向 `1315 Hull USD 100 USD 100; 1760 ...` 应保持 correct | 先列出每格在单元里通过 `reaches()` 的出现位置，再只在这些出现里做不重叠分配（`allocate()` 改为接收候选位置），增删行与整行两个入口共用。同根：Codex [6519610839](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519610839)；已修的 6518043799、6519018610 是它的单次出现情形 |
| 3 | 两张互相矛盾的替换卡（`100 → 300`、`400 → 200`）被当成作者 `USD 100 → USD 200` 的一删一增，判 `split_attributable`、两卡都接受 | `scripts/renewal-triage.py` 的 `text_atom()` 分卡路径（`el`、`er`） | `contradictory-split-triage-probe.py`：Codex 例 `split_attributable`，接受 a、b；对照“删除卡＋新增卡”也是 `split_attributable`，单张 `100 → 200` 为 `correct` | 分卡的每一半须核实它另一侧的实际编辑：旧侧的半张若在同一位置把文字换成了作者新文字以外的东西（`300`），就不是删除；新侧同理。保留真正的 Removed＋Added 与单卡正向。来源：Codex [6519547955](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519547955) |
| 4 | 分诊的页码事实核验 `fact_check()` 仍把 `per page 100USD → 200USD`、`Page 10% → 20%`、`100€`、`of 10%`、`per page 100 USD` 判为 consistent；产品（`b32b3a4`）与评分器（`733abbe`）已拒绝 | `scripts/renewal-triage.py` 的 `fact_check()` 及其页码表达 | `page-fact-triage-probe.py`：五种写法与对照全部 `consistent` | 照产品 `b32b3a4` 的 `PAGE_NUMBER`（数后面跟 `%`、`‰`、币种代码或货币符号，有无空格都不是页码）改分诊的页码表达；保留 `Page 3 of 10 → Page 4 of 10`。不加新格式或新币种。来源：[PR #9 评论 6519605001](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6519605001)；#10 在 `c9c6e0c` 另把“页码后跟三个大写字母”记为评分器无法判定，接手时一并对照 |

## 4. 交接后新到、只登记未处理的审查

Codex 在 09:15Z 之后的发现，按归属登记（本会话没有逐条复现，除第 3 节已重跑的探针外）：

| 发现 | 位置 | 归属与状态 |
|---|---|---|
| [r4422370013](https://github.com/wlvh/policy-compare/pull/9#discussion_r4422370013)（P1，审 `ef77e83`）：两张相邻的表 `MSN \| Operator \| Value` 与 `Registration \| Model \| 2026 Share %`，`valueFree()` 因表头里的 `%` 不把第二行当表头，带单位标签的表头没有隔开两张表 | `packages/compare-core/index.ts` 第 200 行附近（`valueFree()`、表头判定） | #2 的产品；**未处理、未复现** |
| [r4422177386](https://github.com/wlvh/policy-compare/pull/9#discussion_r4422177386)（P2，审 `437e9f3`）：页码表达把 `per page` 后的金额、百分比当页码 | `packages/compare-core/structure.ts` 第 39 行 | #2 的产品；与 `b32b3a4`（PPPP）同一写法，审的是修复前的提交，线程已 outdated；**未逐条核对** |
| [6519547955](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519547955) | 分诊 | 即第 3 节第 3 项 |
| [6519605001](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6519605001) | 分诊 | 即第 3 节第 4 项 |
| [6519610839](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519610839)、[6519887029](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519887029) | 分诊 | 即第 3 节第 2 项（增删行与整行两个入口；#10 在 [6519921574](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519921574) 也这样归并） |
| 6519387126、6519800754、6520008977 | `tests/evaluation/scorer.ts` | #10 的评分器：前两条已由 #10 在 `30dc09d`、`c9c6e0c` 修复，6520008977 由 #10 的交接登记，见 `docs/handoff/issue-10.md` |

## 5. 已决定的边界与待用户决定的事

- **明确不支持：两版按不同次序抽取同一张表**（`b32b3a4`，`docs/extractor-capabilities.md`、README 第 6 节）：只支持每行各列都有内容、三栏以上的紧凑表；两栏表、稀疏列（PR #9 r4421790337）、按基线抽取的折行不支持。用户在 6519680071 里确认“本次不要求实现任意两栏/稀疏表”，但要求如实保留范围与结构歧义，不能把这些未配项写成已验证正确归属；第 3 节第 1 项要与它分开处理。
- **用户已接受**：航空 #87、#88、#89、#93 为两张可归属卡；#91 自动未评价；4 项登记的 invariant 缺口。
- **没有完成证据**：真实保单试用、业务签收、指定设备性能、生产部署。
- 是否为新反例设截止点：本会话问过用户，未得到回答；交接指令已让本会话停止，由接手者与用户确认。

## 6. 复现入口

| 用途 | 命令 |
|---|---|
| 续保样本 | `node scripts/fetch-renewal-samples.mjs --out tmp/renewal-inputs`（`run-renewal.sh` 也会调用） |
| 单元、分诊、类型 | `pnpm verify:core`；`python3 -m unittest discover -s tests -p 'test_renewal_triage.py'`；`pnpm exec tsc --noEmit -p tsconfig.json` |
| 两引擎门槛 | `bash reports/issue-2-validation/tools/gates.sh <OUT>`：`verify:core`、分诊、`tsc`、两引擎构建、PDF 机制、规则、审核回归、浏览器，结果复制到 `OUT`，再还原被改写的 `reports/` 文件 |
| 四次续保比较（工作区代码） | `bash reports/issue-2-validation/tools/probe.sh <OUT> reports/issue-2-validation/<上一检查点 SHA>`：重提取、分诊，并与已存证据逐字段比较 |
| 正式续保证据（已提交的 HEAD） | `bash reports/issue-2-validation/run-renewal.sh`（产品有未提交改动时拒绝运行），写到 `reports/issue-2-validation/<HEAD>/` |
| 全链 | `bash reports/issue-2-validation/tools/chain.sh`：门槛、续保、文字操作对比、规则格式 2、修复前测试（脚本里列着产品与分诊的旧版本，需按新检查点改）、32 份已存结果重评；运行期间不要改工作区 |
| 比较工具 | `tools/cmp.py OLD NEW`（两个证据目录）、`tools/cmpre.py a.json b.json`（两次重评）、`tools/bfcount.py DIR`（修复前分诊失败数，子测试只计一次） |

Node 需 24（`.nvmrc`）；默认 node 较旧时，设 `NODE_ENV_SH` 指向一个把 Node 24 放到 `PATH` 的脚本。

## 7. 工作区与未入库材料

- 交接时工作区干净；没有 stash，只有一个 worktree。
- 本会话 scratch 里的验证脚本已存入 `reports/issue-2-validation/tools/`（原在会话临时目录，路径改成变量）。README 与 PR 正文的一次性改写脚本没有保存：它们只是对已提交文本做替换，结果都在仓库与 PR 里。
- 由 `.gitignore` 排除、未入库：各证据目录里未压缩的结果 JSON（同名 `.json.gz` 已提交）、`dist/`、`tmp/`（续保样本可用上面的命令重新下载；`tmp/` 下的其他内容是浏览器检查与生成器的临时输出）。
- 没有仍在运行的任务；本会话的定时复查已删除，不再自动跟进。
