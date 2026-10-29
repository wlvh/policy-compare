# #10 验收断言覆盖登记

对应 [#10](https://github.com/wlvh/policy-compare/issues/10)。本目录交付的是评价工具本身：给出覆盖登记，修复假 PASS，并让工具如实报告尚未覆盖的部分。**这不是业务验收，也不表示全部业务要求已经通过。**

| 项 | 值 |
|---|---|
| 分支 | `fix/scorer-invariant-coverage`，从 `2ff585bce56e5b43a6fb00572ad9d99b98e4fefc`（PR #9 head）建立 |
| 被测代码提交 | **当前 `800fe91`**（第十五轮：只引用币种代码一部分的声称不再被丢掉），证据在 [`800fe91/`](800fe91/)。各轮证据都保留、没有覆盖：第十四轮 `a5acd50` 在 [`a5acd50/`](a5acd50/)；第十三轮 `a8cb2cc` 在 [`a8cb2cc/`](a8cb2cc/)；第十二轮 `f2e0e10` 在 [`f2e0e10/`](f2e0e10/)；第十一轮 `402e66e` 在 [`402e66e/`](402e66e/)；第十轮 `bb85bc4` 在 [`bb85bc4/`](bb85bc4/)；第九轮 `8ca503f` 在 [`8ca503f/`](8ca503f/)；第八轮 `f2d953f` 在 [`f2d953f/`](f2d953f/)；第七轮 `c5acdb8` 在 [`c5acdb8/`](c5acdb8/)；第六轮 `55e669a`（按几何关系找金额格）在 [`55e669a/`](55e669a/)；第五轮 `28afbd1`（碎片按原文顺序拼接）在 [`28afbd1/`](28afbd1/)；第四轮 `fececbf`（金额单元格以 layout.json 为准）在 [`fececbf/`](fececbf/)；第三轮 `74783d6`（删除/新增卡的金额只在同一记录内抵消）在 [`74783d6/`](74783d6/)；第二轮 `7ea1fb3`（裸整数金额）在 [`7ea1fb3/`](7ea1fb3/)；第一轮 `d61461b` 在 [`verification/`](verification/) 和 [`register.json`](register.json) |
| 被测产品代码 | 与 `e313540` 相同，本项没有修改产品文件 |
| 改动文件 | `tests/evaluation/scorer.ts`、`tests/scorer.test.ts`、`scripts/acceptance.ts`、`tests/browser/rules.spec.ts`、`.github/workflows/ci.yml` |
| 工具 | Node v24.19.0、pnpm 10.12.1；Python 3.13.17（本地）/ 3.12（CI 环境，本地也用 3.12.3 跑过） |
| 机器可读登记 | [`800fe91/register.json`](800fe91/register.json)（当前）：每种 invariant 的覆盖方式、依据、对应测试、出现的用例，以及四次运行中的实际结果 |

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

**这次修复没有覆盖的切分情况**：第 5 节列明。这些情况仍然可能误报 FAIL，退出码 1。它们不会被判 PASS，但同样不是已证实的错误。用一个不提交的探针实际跑过，补丁和输出在 [`a5acd50/split-limits-probe.patch`](a5acd50/split-limits-probe.patch)、[`a5acd50/split-limits-probe.log`](a5acd50/split-limits-probe.log)。按“停止扩大探索”的要求，这些只记录，不修。

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

**复现**：运行 `verification/before-fix.sh a5acd50`，输出见 [`800fe91/before-fix-a5acd50.log`](800fe91/before-fix-a5acd50.log)，恰好这 2 项失败。真实数据没有变化，R11 标签卡仍判 PASS。第十四轮的切分探针在 `800fe91` 上重跑，输出不变，第 5 节列出的误报 FAIL 仍然成立。

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
| **agreed_value_unchanged** | R26 | **直接（新增）** | 金额/币种不变；卡片声明了金额字段，或者位置落在 layout.json 的金额单元格上时，裸整数也算金额；删除/新增卡只在同一记录同一字段内抵消（见第 1 节） | R26 反例（带逗号、裸整数、字段错标、逐字拆分位置、整行引用、部分引用未变金额格、一删一增互换各一组）；layout 未覆盖时无法评价；MSN 看守（单格与整行）；同记录一删一增对照 |
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
- **金额检查的可判定范围**（第八轮起写成明确规则）：
  - 按几何关系找出卡片引用了 layout.json 中的哪些金额格。声明了金额字段的卡，引用的每个文字块都当作金额格。比较两样东西：一是各格的值，看两侧配对的是不是同一金额；二是卡片删除、新增操作按自己的引用顺序声称的金额文字。声称的文字按“每侧、每个金额格”汇总：同一张卡的所有位置和操作合在一起；删除卡、新增卡再按同一记录、同一字段合在一起，汇总后才切成数字比较。替换卡、移动卡在单张卡内比较。能判定的情况下，结论与引用粒度（单个字、单个格、整行）和引用顺序无关；把声称的文字拆成几个位置、几个操作或几张卡，也藏不住声称的变化，不会因此判 PASS。**但这不等于“拆成几张卡都不影响结论”**：删除卡、新增卡的整格值按卡计入，切分方式会影响值的计数，范围见下面“切分方式”一条。
  - 有逐字坐标时，裸数字的每一位都必须落在某个文字块内。只有整行坐标时，裸数字必须出现在它覆盖的文字块里；而且删除、新增操作不能同时跨金额格和其他格。不满足这些条件就判 NOT_EVALUATED（`invariant_unverifiable`，退出码 1），不判 PASS。
  - 代价是：只有整行坐标、又跨格改动的卡片（例如同一条记录只改 MSN）只能判“无法评价”。同一侧的声称涉及多个金额格（或多个货币格）时，“哪个格对应哪个格”无法用多重集合核实，只要两侧仅在不管顺序时对得上，也判“无法评价”。当前真实数据中没有这两种卡片。
  - 前提是 layout.json 本身正确：如果它把金额格的路径标错了，评分器会跟着错。为了不把 MSN 这类标识误判为金额，本项没有把所有裸整数都当作金额。
  - **部分币种代码**（第十五轮）：声称的文字里，完整的金额、币种记号以外剩下的字母或数字（例如 `USD` 里的 `U`）也算声称。在 layout.json 的币种格里，两侧不同判 FAIL。在金额格里（币种和金额同在一格，例如 `USD 2,000,000`），两侧只在这部分不同时判 NOT_EVALUATED（`invariant_unverifiable`，退出码 1），因为它可能是代码的一部分，也可能是 `each loss` 这样的文字。卡片只因声明金额字段才算作金额格的文字块（例如 R11 的标签）不参加这项比较。
  - **删除卡、新增卡的切分方式**（第十四轮）：
    - **支持的范围**：在同一记录、同一字段内，同一侧被多张卡引用的同一个金额格（按页号和文字块编号识别）只计一次整格值。两侧切分方式相同时（都引用整格，或都按原文顺序逐字引用），值和声称都对得上，判 PASS。声称的文字有变化时判 FAIL。
    - **无法评价的条件**：只有每格计一次时两侧才相抵、声称的文字又没有变化，判 NOT_EVALUATED（`invariant_unverifiable`，退出码 1）。例如同一个裸整数金额格，一侧六张逐字卡、另一侧一张整格卡。
    - **仍会误报 FAIL 的情况**（只记录、未修，退出码 1，不会判 PASS）：
      - 没有记录身份的卡：在公共池里仍按卡计数，切分方式不同时判 FAIL。
      - 带千分位的金额（例如 `100,020`）：值从每张卡自己的文字里读，不按格去重；逐字卡的文字里没有完整金额。所以一侧逐字、一侧整格时判 FAIL；两侧切分相同时判 PASS。
      - 同一侧两张卡都引用同一整格（重复的卡）：声称的文字按卡拼接成两遍；带千分位的金额还会从两张卡的文字里各读一次值。结果判 FAIL。
    - 以上探针输出见 [`a5acd50/split-limits-probe.log`](a5acd50/split-limits-probe.log)。当前产品不输出删除卡、新增卡来表示金额，R11、R26 的真实结果里没有这类卡。
- **多余的卡只在有对应 invariant 时才拦截**：额外的、解释不了的卡，只有在该用例声明了禁止它的 invariant 时才会被拒绝，例如 `no_content_differences`、`no_material_differences` 和金额/币种检查。答案没有声明这类要求的用例，评分器不另做误报检查。

## 6. 验证（当前代码提交 `800fe91`，本地 Linux）

每一轮都在该轮的代码提交上完整重跑，证据各自放在对应目录里。

| 轮次 / 代码提交（证据目录） | scorer 测试 | Python 分诊 | `verify:core` | 两个引擎的规则（Node） | 浏览器 `rules.spec.ts`（两个引擎） | 修复前反例（当轮测试文件） |
|---|---|---|---|---|---|---|
| 第十五轮 `800fe91`（当前，`800fe91/`） | 82/82（原 32 + 新 50） | 20/20 | 136/136 | 退出码 2：严格 NOT_EVALUATED 28/32，事件 32/32 | 通过：严格 28/32，事件 32/32，只剩已登记缺口 | `a5acd50` 上恰好 2 项（部分币种代码）失败 |
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

十五轮的身份 N/A 都是 11 项。覆盖登记都是直接 10、间接 17、尚未支持 4、未知 0。

用 `800fe91` 的测试文件对各轮 scorer 依次重跑，失败数为 29 → 24 → 21 → 19 → 14 → 13 → 12 → 11 → 8 → 7 → 6 → 5 → 4 → 3 → 2 → 0。逐字坐标下的整行 MSN 看守在各轮都通过。部分引用的两个反例（单张卡、删除＋新增）在 `fececbf`、`28afbd1` 上本来能拦住，到 `55e669a` 回退，第七、九轮修复。见 [`800fe91/before-fix-all-rounds.log`](800fe91/before-fix-all-rounds.log)，前几轮的对应记录保留在各自的目录中。`2ff585b` 上的 29 项里包括单格 MSN 看守：那时的 scorer 还不输出 invariant 结果，看守里的断言无从成立；这不是金额误判。

本地浏览器运行使用了 Chromium 1243，通过不提交的 `tmp/playwright.local.config.ts` 设置 `executablePath`。CI 使用自己安装的浏览器，结果见 PR。

```bash
pnpm install --frozen-lockfile && pnpm install:pdfjs && pnpm install:mupdf
pnpm exec vitest run tests/scorer.test.ts
python3 -m unittest discover -s tests -p 'test_renewal_triage.py'
pnpm verify:core
pnpm test:rules:mupdf; echo "exit $?"   # 预期为 2
pnpm test:rules:pdfjs; echo "exit $?"   # 预期为 2
reports/invariant-coverage/verification/before-fix.sh           # 起点 2ff585b：29 项失败
reports/invariant-coverage/verification/before-fix.sh d61461b   # 第一轮：24 项失败
reports/invariant-coverage/verification/before-fix.sh 7ea1fb3   # 第二轮：21 项失败
reports/invariant-coverage/verification/before-fix.sh 74783d6   # 第三轮：19 项失败
reports/invariant-coverage/verification/before-fix.sh fececbf   # 第四轮：14 项失败
reports/invariant-coverage/verification/before-fix.sh 28afbd1   # 第五轮：13 项失败
reports/invariant-coverage/verification/before-fix.sh 55e669a   # 第六轮：12 项失败
reports/invariant-coverage/verification/before-fix.sh c5acdb8   # 第七轮：11 项失败
reports/invariant-coverage/verification/before-fix.sh f2d953f   # 第八轮：8 项失败
reports/invariant-coverage/verification/before-fix.sh 8ca503f   # 第九轮：7 项失败
reports/invariant-coverage/verification/before-fix.sh bb85bc4   # 第十轮：6 项失败
reports/invariant-coverage/verification/before-fix.sh 402e66e   # 第十一轮：5 项失败
reports/invariant-coverage/verification/before-fix.sh f2e0e10   # 第十二轮：4 项失败
reports/invariant-coverage/verification/before-fix.sh a8cb2cc   # 第十三轮：3 项失败
reports/invariant-coverage/verification/before-fix.sh a5acd50   # 第十四轮：只有 2 项（部分币种代码）失败
pnpm exec tsx reports/invariant-coverage/55e669a/geometry-probe.mts mupdf   # 真实卡片的坐标框能否全部对到 layout.json
git restore reports/core-tests.json reports/rules-mupdf.json reports/rules-pdfjs.json   # 上面的命令会改写这些已提交的报告
```

## 7. 与 #9 的关系

本分支从 PR #9 的 head `2ff585b` 建立，PR base 为 `feat/policy-compare`。#9 合入之前，PR 的差异里会带上 #9 的提交；#9 合入后，同步 feat，让最终差异只包含本项。本项不自行合并，不切换默认分支，也不部署。
