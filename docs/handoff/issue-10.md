# #10 评价工具交接（Claude Code 会话 → 单一 Codex 会话）

依据用户在 PR #11 的交接指令（评论 6519990102）。本文件只写交接需要的事实；各轮经过都在 [`reports/invariant-coverage/README.md`](../../reports/invariant-coverage/README.md) 里。

## 1. 提交与分支

- **保存分支**：`fix/scorer-invariant-coverage`，对应 PR #11，base 是 `feat/policy-compare`（`fbc207a`）。
- **读取交接指令时的 HEAD**：`09c3d5a0abf5201522c313bbff39e2107e644129`。交接提交在它之上只加了本文件和 `reports/invariant-coverage/tools/`，推送后的完整 HEAD 写在 PR #11 的“交接完成”评论里。
- **最后验证过的代码**：
  - 评分器是 `c9c6e0c8c18751656eee6fd1a281aa424cace17c`。
  - 产品与分诊和联合树 `88718d0ed2bc70fb98790ad3f9f8fc01386dbb8b` 相同：产品 `policy-compare/0.1.0+row-identity.34+facts.6+repeat.9+ops.4`，分诊 `renewal-triage/37`。
  - `88718d0` 之后，报告以外只改了 `tests/evaluation/scorer.ts` 和 `tests/scorer.test.ts`，都在 `c9c6e0c` 里。
- **与 #9 的实际关系**：
  - PR #9 的 head `ef77e836a8c60c439464aae846833292068b510d`（`fix/issue-2-renewal`）是本分支的祖先，`git log HEAD..origin/fix/issue-2-renewal` 为空，两个 PR 的 base 相同。
  - 反过来，#9 缺本分支 `88718d0` 之后的提交。其中带代码的只有 `c9c6e0c`，其余只改 `reports/invariant-coverage/`，外加本交接提交。#9 可以直接快进到本分支的 HEAD。
  - 没有任何 PR 合并到 feat/main。没有切换默认分支，也没有部署。
- **未提交或未推送的成果**：没有。
  - 工作区干净，没有 stash。
  - 临时目录有两个 worktree（`8f0e71b`、`409e4e2`，用来跑修复前对照）。里面只有已提交探针的副本和 `node_modules`，已经逐个比对过。
  - 临时目录里各轮的证据脚本，最新版本已改成参数化放进 [`reports/invariant-coverage/tools/`](../../reports/invariant-coverage/tools/README.md)。其余都是已提交证据的中间文件。

## 2. 检查

| 检查 | 提交 | 结果 |
|---|---|---|
| 本地快速检查 | `c9c6e0c` | 评分器 144/144，分诊 82/82，`verify:core` 363/363，`tsc` 0 个错误；两引擎构建和 `rules.spec.ts` 通过；4 份规则报告与 `88718d0` 除提交号外相同（证据在 [`c9c6e0c/`](../../reports/invariant-coverage/c9c6e0c/)） |
| 本地全套 | `88718d0` | 上面各项，加上 PDF 机制、审核回归、浏览器各 16/16；续保在两个引擎上重新提取，卡片与 `081f370` 除 `coreVersion` 外相同；分诊结论没有变化（证据在 [`88718d0/`](../../reports/invariant-coverage/88718d0/)） |
| 严格验收 | `c9c6e0c` | 32 对规则中 PASS 28；R16、R18、R23、R24 这 4 项是登记的 NOT_EVALUATED，不是 N/A；FAIL 0；事件 32/32；位置集 11/11。有 NOT_EVALUATED 时规则命令按设计以退出码 2 结束 |
| CI | `09c3d5a` | push [run 41036515022](https://github.com/wlvh/policy-compare/actions/runs/41036515022)、PR [run 41036523663](https://github.com/wlvh/policy-compare/actions/runs/41036523663)，共 12 个作业全部成功；`1fa0ec7` 的 [41036469099](https://github.com/wlvh/policy-compare/actions/runs/41036469099)、[41036480051](https://github.com/wlvh/policy-compare/actions/runs/41036480051) 也全部成功 |
| 交接时重跑（代码未改） | `09c3d5a` | `tools/triage-probes.sh`：52 个分诊探针的输出与已提交日志相同。产品全格折行探针：输出与 `88718d0` 的日志相同。`compare-rules.py` 与 `register.mts` 生成的比较和登记与已提交的相同 |
| 没有跑 | — | `c9c6e0c` 上的全套（只改了评分器，续保分诊不读评分器）；`tools/` 的两个链脚本改成参数后只做了 `bash -n`；交接提交的 CI 推送后才开始，链接见交接评论 |
| 交接时仍在运行 | `09c3d5a` | Codex 的审查 |
| 没有证明 | — | 真实保单试用、业务签收、设备性能 |

## 3. 没有解决的问题（#2 的四项，接手清单）

这四项来自 [PR #9 评论 6519680071](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6519680071)。截至 #9 的 head `ef77e83`，**一项都没有修复**，在 HEAD `09c3d5a` 上仍能复现。此前“#2 没有未决项”的说法不能当作交接事实。探针及修复前后的日志都在 [`reports/invariant-coverage/88718d0/probes/`](../../reports/invariant-coverage/88718d0/probes/README.md)。

1. **产品：一条记录的每一格（含第一列）都折行时，丢掉记录身份。**
   - 现象：折行那一行被当成独立的一行，报成行键 `(a)`，而不是记录 `123`。`8f0e71b` 上这里是对的。
   - 来源：#2 在 `b32b3a4` 定的规则是“簇数达到这一行的格数的行不算折行”。“簇”指同一基线上连在一起的文字块。全格折行时，折行那一行的簇数也达到了格数。
   - 口径：PR #9 正文把它列为代价，但产品此时断言了一个错误的身份，而不是标成未决。用户的要求是修复，或明确标成局部未决。
   - 复现：`pnpm exec tsx reports/invariant-coverage/88718d0/probes/product-fullwrap-probe.ts`。对照日志是 `product-fullwrap-88718d0.log`（错）和 `product-fullwrap-8f0e71b.log`（对）。
2. **分诊：矛盾的拆分被接受**（Codex [6519547955](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519547955)）。
   - 现象：作者只改了一处 `USD 100 → USD 200`，两张替换卡分别报 `100 → 300` 和 `400 → 200`，分诊仍判 `split_attributable`。
   - 推断的根因（没有在代码里逐行确认）：拆分只看旧值、新值是否各落在某张卡上，没有核对每张卡自己的配对与作者的编辑是否相容。
   - 复现：`python3 -I reports/invariant-coverage/88718d0/probes/contradictory-split-triage-probe.py .`
3. **分诊：重复格借用另一条记录。** 下面三条是同一个根因：
   - Codex [6519610839](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519610839)：新增或删除的行 `1315 | Hull | USD 100 | USD 100`；
   - 用户补充的替换行两份 `Alpha`；
   - Codex [6519887029](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6519887029)：与用户补充的输入相同。

   出现次数在整个单元上计数，身份核实却可以让每一份重复都用同一处合法的出现。按用户的要求，次数分配和身份核实必须落在同一个被选中的出现上。复现：`repeated-cell-other-record-triage-probe.py`，用法同上。
4. **分诊：页码事实的口径与评分器、产品不一致**（用户的 [PR #9 评论 6519605001](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6519605001)）。
   - 现象：分诊的 `fact_check` 把 `per page 100USD`、`Page 10%`、`100€`、`of 10%`、`per page 100 USD` 读成“只差页码”。
   - 评分器（`733abbe`、`c9c6e0c`）和产品（`b32b3a4`）现在的口径：
     - 后面跟 `%`、`‰`，或紧跟币种代码、货币符号的数，不是页码；
     - 改变的数后面隔一个空格才是币种，或跟着三个未列为币种代码的大写字母，记为无法判定。
   - 分诊应改成同一口径，同时保留真实页码表达为正例，例如 `Page 3 of 10` → `Page 4 of 10`。
   - 复现：`page-fact-triage-probe.py`。

所有 Python 分诊探针可以一次跑完：`reports/invariant-coverage/tools/triage-probes.sh .`

## 4. 交接期间新到、只登记的审查发现

按交接指令，下面这条只登记，没有复现、修复或重新验证，由接手的 Codex 处理：

- **Codex [6520008977](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6520008977)**：评分器 `tests/evaluation/scorer.ts`，审的是 `09c3d5a`。
  - Codex 声称：两张替换卡报告同一处、有来源支持的金额改动（引用完全相同的旧、新字符）时，`moneyChanges()` 分别给每张卡同一个声明事件的豁免，两条金额不变量都通过。
  - Codex 的解释：替换卡从不进入删除卡、新增卡用的 `spread()` 重复检查。
  - 相关的旧修复是 `786aefc`：同一处编辑报两次，不论卡片所称的记录都判失败。Codex 说替换卡不在这项检查范围内；这一点和整条发现是否成立，都未经核实。

## 5. 不变的范围与口径

README 顶部的“当前状态”一节分开写了以下几项，接手后沿用：

- 严格结果；
- 续保已评价范围（分诊 `/37`）；
- 未评价范围，包括 #91 的口径和四个费率事件拆卡的代价；
- 明确不支持的格式：两栏表、稀疏表、逐行抽取的折行格。这些格式里未配上的卡不算已确认的记录身份。

## 6. 下一步（建议给接手的 Codex）

1. **先修第 3 节的四项。** 每项先用 `88718d0/probes/` 下的探针写一个修复前会失败的正式测试，再改代码。正例和反例对照都要通过，例如 `Page 3 of 10` → `Page 4 of 10` 仍算页码，1315 自己的两份 `Alpha` 仍算整行恢复。
2. **再处理第 4 节的 6520008977。** 先复现。如果成立，就在评分器的替换卡路径上加重复编辑检查，照旧保留修复前日志并写测试；如果不成立，在 PR 上说明理由。
3. **统一集成。** #9 快进或合并到本分支，然后跑 `tools/full-chain.sh`，包括用两个引擎重新提取续保结果。用 `tools/compare-rules.py` 和 `tools/renewal-compare.py` 与 `88718d0` 对照，再更新 README 顶部的“当前状态”。
4. **写最终报告。** 严格结果、续保已评价范围、未评价范围分开写，并写明真实试用、签收、设备性能都没有证明。

## 7. 入口

- 评分器 `tests/evaluation/scorer.ts`，测试 `tests/scorer.test.ts`。
- 验收命令行 `scripts/acceptance.ts`，浏览器规则 `tests/browser/rules.spec.ts`，CI `.github/workflows/ci.yml`。
- 覆盖登记 [`reports/invariant-coverage/c9c6e0c/register.json`](../../reports/invariant-coverage/c9c6e0c/register.json)。
- 报告 [`reports/invariant-coverage/README.md`](../../reports/invariant-coverage/README.md)：顶部的“当前状态”，§0.42–§0.65 是最近各提交，§5 是支持范围，§6 是验证。
- 工具 [`reports/invariant-coverage/tools/README.md`](../../reports/invariant-coverage/tools/README.md)。
