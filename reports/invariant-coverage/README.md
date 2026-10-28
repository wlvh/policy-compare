# #10 验收断言覆盖登记

对应 [#10](https://github.com/wlvh/policy-compare/issues/10)。本目录交付的是评价工具本身：给出覆盖登记，修复假 PASS，并让工具如实报告尚未覆盖的部分。**这不是业务验收，也不表示全部业务要求已经通过。**

| 项 | 值 |
|---|---|
| 分支 | `fix/scorer-invariant-coverage`，从 `2ff585bce56e5b43a6fb00572ad9d99b98e4fefc`（PR #9 head）建立 |
| 被测代码提交 | **当前 `55e669a648919b47f9a7629158bd85e087d8745a`**（第六轮，按几何关系找出卡片引用的金额格，不论逐字、单格还是整行），证据在 [`55e669a/`](55e669a/)。各轮证据都保留、没有覆盖：第五轮 `28afbd1`（碎片按原文顺序拼接）在 [`28afbd1/`](28afbd1/)；第四轮 `fececbf`（金额单元格以 layout.json 为准）在 [`fececbf/`](fececbf/)；第三轮 `74783d6`（删除/新增卡的金额只在同一记录内抵消）在 [`74783d6/`](74783d6/)；第二轮 `7ea1fb3`（裸整数金额）在 [`7ea1fb3/`](7ea1fb3/)；第一轮 `d61461b` 在 [`verification/`](verification/) 和 [`register.json`](register.json) |
| 被测产品代码 | 与 `e313540` 相同，本项没有修改产品文件 |
| 改动文件 | `tests/evaluation/scorer.ts`、`tests/scorer.test.ts`、`scripts/acceptance.ts`、`tests/browser/rules.spec.ts`、`.github/workflows/ci.yml` |
| 工具 | Node v24.19.0、pnpm 10.12.1；Python 3.13.17（本地）/ 3.12（CI 环境，本地也用 3.12.3 跑过） |
| 机器可读登记 | [`55e669a/register.json`](55e669a/register.json)（当前）：每种 invariant 的覆盖方式、依据、对应测试、出现的用例，以及四次运行中的实际结果 |

“invariant（验收断言）”指答案 `expected.json` 里除逐事件要求以外的整体要求，例如“不得出现金额变化”。32 对答案中共有 **31 种**（按名称去重计的种数，不是用例数）。

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

## 2. 31 种 invariant 的覆盖登记

- **直接检查**：评分器里有这一条的专门检查（`DIRECT` 表）。每条都有一个负向测试，构造违反它的结果，并要求失败原因里写着这条 invariant 的名字。
- **间接覆盖**：没有专门检查，但只要违反它，就必然让该用例的事件检查或完整性检查失败。表中列出能证明这一点的负向测试。这些测试大多是已有的，本项只补了 R25 的两个。
- **尚未支持**：结果里没有足够的证据可供判断，记为 `NOT_EVALUATED`。**没有任何一条被记为 N/A**。

| invariant | 用例 | 覆盖 | 依据 | 负向测试 |
|---|---|---|---|---|
| no_content_differences | R01 R17 | 直接 | 不得有任何差异卡 | `direct invariant check rejects a violation: …` |
| no_material_differences | R01 R15 R16 R17 R23 R24 | 直接（既有） | 不得有 Material 卡，Cosmetic 以外不得有文字变化 | 同上；另有 `Review does not excuse false text in control` |
| no_false_text_added_or_removed | R15 | 直接 | 不得有带文字变化的卡 | 同上 |
| no_false_clause_moves | R16 | 直接 | 不得有 Moved 卡 | 同上 |
| no_false_row_additions_or_deletions | R23 R24 | 直接（既有） | 表格卡不得有文字变化 | 同上 |
| moved_clause_has_no_internal_word_edits | R12 | 直接 | Moved 卡不得有文字变化 | 同上 |
| must_not_classify_as_unchanged_duration_roll_forward | R07 | 直接 | 保险期间卡不得判为 RollForward | 同上 |
| grouping_allowed_only_with_all_occurrence_locations | R09 | 直接 | 聚合卡必须列出两侧全部重复位置 | 同上 |
| **agreed_value_unchanged** | R26 | **直接（新增）** | 金额/币种不变；卡片声明了金额字段，或者位置落在 layout.json 的金额单元格上时，裸整数也算金额；删除/新增卡只在同一记录同一字段内抵消（见第 1 节） | R26 反例（带逗号、裸整数、字段错标、逐字拆分位置、整行引用、一删一增互换各一组）；layout 未覆盖时无法评价；MSN 看守（单格与整行）；同记录一删一增对照 |
| **no_amount_or_currency_change** | R11 | **直接（新增）** | 同上 | R11 金额、裸整数金额、字段错标、币种反例 |
| header_role_must_not_exclude_text | R09 | 间接 | 页眉限额事件需要在页眉位置有可见卡；页眉文字被排除就没有卡 | `empty required output` |
| rotation_must_not_exclude_text | R19 | 间接 | 旋转状态事件需要在旋转文字位置有可见卡 | `empty required output` |
| must_not_match_values_across_party_identity | R10 | 间接 | 两个地址事件各自核对当事人和字段 | `wrong subject` |
| same_field_identity | R11 | 间接 | 标签事件核对字段 `sum_insured.label`，并要求类型为 Replaced | `R11: the label change attached to another field fails`、`wrong operation` |
| same_address_identity | R18 | 间接 | 连字事件核对 original_insured 的 address | `wrong subject` |
| exact_move_must_not_be_consumed_by_local_replacement | R13 | 间接 | 移动事件需要 Moved 卡，新增事件需要 Added 卡，各自在自己的位置 | `R13: the exact move and the similar new clause are not interchangeable` |
| match_row_by_registration_or_declared_serial | R22 | 间接 | 金额事件核对行键（序列号）和字段 | `R26: matching the row by the renamed registration…` |
| secondary_key_or_explicit_identity_review | R26 | 间接 | 注册号事件要求行键为序列号 | 同上 |
| duplicate_identity_must_be_reported | R25 | 间接 | 要求状态为 partial，且有 ambiguous_identity 未决组 | `R25: an unreported duplicate identity fails` |
| must_not_assert_unique_row_identity_without_evidence | R25 | 间接 | 卡片必须为 unresolved，且没有行键 | `R25: asserting a unique row key without evidence fails` |
| must_not_claim_no_changes | R25 | 间接 | 必须有可见卡 | `duplicate-key warning alone cannot waive amount evidence` |
| old_and_new_amount_delta_must_remain_visible | R25 | 间接 | 新旧金额必须在同一张可见卡上，且位置正确 | 同上；`hidden event` |
| unresolved_identity_does_not_waive_text_change_detection | R25 | 间接 | 未决组不能代替必需的卡 | 同上 |
| duplicate_key_warning_alone_is_not_a_pass | R25 | 间接 | 只有未决组而没有卡，事件失败 | 同上 |
| must_not_claim_complete_or_no_changes | R27 R28 | 间接 | 覆盖事件要求状态为 partial，并有可见的覆盖区域 | `coverage: incorrect complete` |
| text_elsewhere_on_page_does_not_prove_full_coverage | R28 | 间接 | 覆盖区域必须对准图片区域，不能是整页 | `coverage: generic warning`、`wrong region` |
| renewal_classification_must_not_hide_amount_change | R32 | 间接 | 金额事件必须有自己的 Material/Review 卡，RollForward 卡不算 | `wrong category` |
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
- **CI**：规则步骤只接受退出码 2（`|| test $? -eq 2`）。日志里会打印严格状态和缺口用例，报告文件作为 artifact 上传。浏览器测试 `rules.spec.ts` 在以下情况失败：任何失败、事件回归不是 PASS、或出现未登记的缺口；NOT_EVALUATED 会保留在它输出的 JSON 里。这样 CI 仍能拦住回归和新出现的缺口，同时不把“尚未支持”算成通过。
- 诊断文件（`reports/failures/`）只为会导致退出码 1 的用例写出，已登记的缺口不会每次运行都产生 8 个文件。
- 身份 N/A 仍是原来的 11 项，没有扩大；N/A 事件的文字、操作、类别、位置检查和 R13 负向测试都保留。

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

- **评分器比答案更严**：R22 答案允许按注册号或序列号匹配行，R26 允许按序列号匹配或显式标为身份待审，但评分器只接受序列号作为行键。当前产品用的正是序列号，所以没有影响。
- **`Added+Removed` 未支持**：R25、R26 的事件把它列为可接受的类型，但事件匹配只看单张卡。如果产品真的输出一删一增，评分器会判 FAIL，而不是“无法评价”。这是潜在的错误失败；当前产品没有这样输出。
- **金额格以 layout.json 为准**：卡片没有声明金额字段时，裸整数是不是金额，取决于它的坐标落在 layout.json 的哪个文字块。不论引用的是单个字、单个格还是整行，结论都一样（第六轮之前，整行引用会被漏判为 PASS，已修复）。引用的裸数字有数位落在所有文字块之外时，判 NOT_EVALUATED、退出码 1，不判 PASS。剩下的前提是 layout.json 本身：如果它把金额格的路径标错了，评分器就会跟着错。为了不把 MSN 这类标识误判为金额，本项没有把所有裸整数都当作金额。
- **多余的卡只在有对应 invariant 时才拦截**：额外的、解释不了的卡，只有在该用例声明了禁止它的 invariant 时才会被拒绝，例如 `no_content_differences`、`no_material_differences` 和金额/币种检查。答案没有声明这类要求的用例，评分器不另做误报检查。

## 6. 验证（当前代码提交 `55e669a`，本地 Linux）

每一轮都在该轮的代码提交上完整重跑，证据各自放在对应目录里。

| 轮次 / 代码提交（证据目录） | scorer 测试 | Python 分诊 | `verify:core` | 两个引擎的规则（Node） | 浏览器 `rules.spec.ts`（两个引擎） | 修复前反例（当轮测试文件） |
|---|---|---|---|---|---|---|
| 第六轮 `55e669a`（当前，`55e669a/`） | 70/70（原 32 + 新 38） | 20/20 | 124/124 | 退出码 2：严格 NOT_EVALUATED 28/32，事件 32/32 | 通过：严格 28/32，事件 32/32，只剩已登记缺口 | `28afbd1` 上恰好 3 项整行引用失败 |
| 第五轮 `28afbd1`（`28afbd1/`） | 65/65 | 20/20 | 119/119 | 同上 | 同上 | `fececbf` 上恰好 1 项逐字拆分失败 |
| 第四轮 `fececbf`（`fececbf/`） | 64/64 | 20/20 | 118/118 | 同上 | 同上 | `74783d6` 上恰好 2 项字段错标失败 |
| 第三轮 `74783d6`（`74783d6/`） | 62/62 | 20/20 | 116/116 | 同上 | 同上 | `7ea1fb3` 上恰好 2 项一删一增互换失败 |
| 第二轮 `7ea1fb3`（`7ea1fb3/`） | 59/59 | 20/20 | 113/113 | 同上 | 同上 | `d61461b` 上恰好 3 项裸整数变体失败 |
| 第一轮 `d61461b`（`verification/`） | 55/55 | 20/20 | 109/109 | 同上 | 同上 | 起点 `2ff585b` 上 4 项失败 |

六轮的身份 N/A 都是 11 项。覆盖登记都是直接 10、间接 17、尚未支持 4、未知 0。

用 `55e669a` 的测试文件对各轮 scorer 依次重跑，失败数为 17 → 12 → 9 → 7 → 4 → 3 → 0，每一轮新增的反例在之前各轮的 scorer 上都会失败；整行 MSN 看守在各轮都通过。见 [`55e669a/before-fix-all-rounds.log`](55e669a/before-fix-all-rounds.log)（上一轮的对应记录在 `28afbd1/` 中保留）。`2ff585b` 上的 17 项里包括单格 MSN 看守：那时的 scorer 还不输出 invariant 结果，看守里的断言无从成立；这不是金额误判。

本地浏览器运行使用了 Chromium 1243，通过不提交的 `tmp/playwright.local.config.ts` 设置 `executablePath`。CI 使用自己安装的浏览器，结果见 PR。

```bash
pnpm install --frozen-lockfile && pnpm install:pdfjs && pnpm install:mupdf
pnpm exec vitest run tests/scorer.test.ts
python3 -m unittest discover -s tests -p 'test_renewal_triage.py'
pnpm verify:core
pnpm test:rules:mupdf; echo "exit $?"   # 预期为 2
pnpm test:rules:pdfjs; echo "exit $?"   # 预期为 2
reports/invariant-coverage/verification/before-fix.sh           # 起点 2ff585b：17 项失败
reports/invariant-coverage/verification/before-fix.sh d61461b   # 第一轮：12 项失败（裸整数、字段错标、逐字拆分、整行、一删一增互换）
reports/invariant-coverage/verification/before-fix.sh 7ea1fb3   # 第二轮：9 项失败（字段错标、逐字拆分、整行、一删一增互换）
reports/invariant-coverage/verification/before-fix.sh 74783d6   # 第三轮：7 项失败（字段错标、逐字拆分、整行）
reports/invariant-coverage/verification/before-fix.sh fececbf   # 第四轮：4 项失败（逐字拆分、整行）
reports/invariant-coverage/verification/before-fix.sh 28afbd1   # 第五轮：只有 3 项整行引用失败
pnpm exec tsx reports/invariant-coverage/55e669a/geometry-probe.mts mupdf   # 真实卡片的坐标框能否全部对到 layout.json
git restore reports/core-tests.json reports/rules-mupdf.json reports/rules-pdfjs.json   # 上面的命令会改写这些已提交的报告
```

## 7. 与 #9 的关系

本分支从 PR #9 的 head `2ff585b` 建立，PR base 为 `feat/policy-compare`。#9 合入之前，PR 的差异里会带上 #9 的提交；#9 合入后，同步 feat，让最终差异只包含本项。本项不自行合并，不切换默认分支，也不部署。
