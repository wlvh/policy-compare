# #10 验收断言覆盖登记

对应 [#10](https://github.com/wlvh/policy-compare/issues/10)。本目录交付的是评价工具本身：给出覆盖登记，修复假 PASS，并让工具如实报告尚未覆盖的部分。**这不是业务验收，也不表示全部业务要求已经通过。**

| 项 | 值 |
|---|---|
| 分支 | `fix/scorer-invariant-coverage`，从 `2ff585bce56e5b43a6fb00572ad9d99b98e4fefc`（PR #9 head）建立 |
| 被测代码提交 | **当前 `78182e1`**（评分器：只引用小数点或千位分隔符的卡也是对金额的声称；产品、分诊同 `67f5c44`；见第 0.61 节，证据在 [`78182e1/`](78182e1/)）。此前 `8ffff71`（评分器：一张卡的两侧不能把不同已声明事件的金额配成一对；产品、分诊同 `67f5c44`；见第 0.60 节，证据在 [`8ffff71/`](8ffff71/)）。此前 `733abbe`（评分器：跟在 page 后面的百分比或金额不是页码，货币隔一个空格时无法判定；产品、分诊同 `67f5c44`；见第 0.59 节，证据在 [`733abbe/`](733abbe/)）。此前 `67f5c44`（普通合并提交，合入 #2 的 `8bf16df`：产品 `+row-identity.33`、分诊 `/34`；评分器同 `8906d05`；只跑了快速检查与探针，产品有一处回退未修，见第 0.58 节，证据在 [`67f5c44/`](67f5c44/)）。此前 `8906d05`（评分器：声明的金额变化只豁免编辑了其证据位置的卡；产品、分诊同 `081f370`；见第 0.56 节，证据在 [`8906d05/`](8906d05/)）。此前 `f6d0ea0`（评分器：声明的金额变化只豁免引用其证据位置的卡；产品、分诊同 `081f370`；之前普通合并提交 `f46ec7a` 合入 #2 只含报告的 `0a93e69`；见第 0.55 节，证据在 [`f6d0ea0/`](f6d0ea0/)）。此前联合树 `081f370`（#2 的 head：分诊 `/32`、产品 `+row-identity.32`；本项快进到这里，全套联合验收，见第 0.54 节，证据在 [`081f370/`](081f370/)）。此前 `81e065a`（评分器：卡片文字显示了声明的金额变化，其他格里的声称仍要比较；产品、分诊同 `8e638cb`；见第 0.53 节，证据在 [`81e065a/`](81e065a/)）。此前 `d16ed68`（评分器：声明变化的豁免只覆盖按声明变化的那几个格，其中的声称记“无法评价”；见第 0.52 节，证据在 [`d16ed68/`](d16ed68/)）。此前 `8a178d5`（评分器：按声明变化的金额格里的声称不再报成“值未变”，豁免过宽，由 `d16ed68` 收窄；之前 `48a5887`：单侧只引用正负号的卡也是对金额的声称；产品、分诊同 `8e638cb`；普通合并提交 `1c09dfc` 再合入 #2 只含报告的 `5c6dab6`；见第 0.51 节，证据在 [`8a178d5/`](8a178d5/)、[`48a5887/`](48a5887/)）。此前联合树 `8e638cb`（普通合并提交，合入 #2 的 `5888e7d`：产品 `+row-identity.31`、分诊 `/29`；评分器：币种代码后的正负号属于金额 `ea444a0`；全套联合验收，见第 0.50 节，证据在 [`8e638cb/`](8e638cb/)）。此前 `933ea5b`（评分器：没有记录的删除卡与新增卡也比较所编辑金额格的整格金额；产品、分诊同 `61e4add`；见第 0.49 节，证据在 [`933ea5b/`](933ea5b/)）。此前 `498cd4a`（评分器：重复行的一处出现按卡片引用的顺序逐个位置读取；产品、分诊同 `61e4add`；见第 0.48 节，证据在 [`498cd4a/`](498cd4a/)）。此前联合树 `61e4add`（#2 的 head，已合入本项 `8003bb5`；产品 `+row-identity.30`、分诊 `/28`；本项快进到这里，全套联合验收，见第 0.47 节，证据在 [`61e4add/`](61e4add/)）。此前 `786aefc`（评分器：单独的正负号也算格内声称；同一处编辑报两次不论声称哪条记录都判失败；产品、分诊同 `3feb37d`；见第 0.46 节，证据在 [`786aefc/`](786aefc/)）。此前联合树 `3feb37d`（普通合并提交，合入 #2 的 `c5a5330`：产品 `+row-identity.29`、分诊 `/27`；全套联合验收，见第 0.45 节，证据在 [`3feb37d/`](3feb37d/)）。此前 `ed11a5f`（评分器：删除卡与新增卡的金额只在来源显示为同一记录时才算抵消；产品、分诊同 `b85a1bd`；之前快进到 #2 的 `3527ab2`、`565480c`，与 `0a327e7` 同一棵树；见第 0.44 节，证据在 [`ed11a5f/`](ed11a5f/)）。此前联合树 `b85a1bd`（普通合并提交，合入 #2 的 `b8a9b55`：产品 `+row-identity.28`；全套联合验收，见第 0.43 节，证据在 [`b85a1bd/`](b85a1bd/)）。此前联合树 `211a705`（普通合并提交，合入 #2 的 `9b57000`：分诊 `/26`、契约注释；评分器：未决标记不让正确标签算作已确定 `af046a3`；全套联合验收，见第 0.42 节，证据在 [`211a705/`](211a705/)）。此前 `1e44d4d`（快进到 #2 的 `cb27454`，分诊 `/25`，产品 `+row-identity.27`；评分器：页码事实只看文字形式；全套联合验收，见第 0.42 节，证据在 [`1e44d4d/`](1e44d4d/)）。此前联合树 `9e9104f`（#2 的 head，已合入本项 `26052ad`；分诊 `/24`，产品 `+row-identity.26+facts.5`；本项快进到这里，全套联合验收，见第 0.41 节，证据在 [`9e9104f/`](9e9104f/)）。此前 `4a12cd0`（评分器：日期的日和年必须是完整数字；产品、分诊同 `509b088`；见第 0.40 节，证据在 [`4a12cd0/`](4a12cd0/)）。此前 `bae0f9e`（评分器：货币符号和币种代码一样算币种；见第 0.39 节，证据在 [`bae0f9e/`](bae0f9e/)）。此前联合树 `509b088`（#2 的 head，已合入本项 `c211a31`；分诊 `/23`，产品 `+row-identity.24`；本项快进到这里，全套联合验收，见第 0.38 节，证据在 [`509b088/`](509b088/)）。此前 `259d797`（评分器：重复行的文字只取它自己那几行的字符；产品、分诊同 `cedf563`；之前普通合并提交 `c4c5c0b` 合入 #2 只含报告的 `ba4bbdd`；见第 0.37 节，证据在 [`259d797/`](259d797/)）。此前联合树 `cedf563`（合并 #2 `72eb95f`，分诊 `/21`，产品 `+row-identity.22`；全套联合验收，见第 0.36 节，证据在 [`cedf563/`](cedf563/)）。此前 `16ae858`（评分器：金额格内的编辑按整格金额比较；产品同 `91aa884`；见第 0.35 节，证据在 [`16ae858/`](16ae858/)）。此前联合树 `91aa884`（合并 #2 `6060f6c`，分诊 `/20`，产品 `+row-identity.20+repeat.9`；全套联合验收，见第 0.34 节，证据在 [`91aa884/`](91aa884/)）。此前联合树 `9354b84`（合并 #2 `7847d7d`，分诊 `/19`，产品 `+row-identity.18`；全套联合验收，见第 0.33 节，证据在 [`9354b84/`](9354b84/)）。此前联合树 `b3e84c8`（合并 #2 `441a81d`，只改分诊；见第 0.32 节，证据在 [`b3e84c8/`](b3e84c8/)）。此前联合树 `8d1f1ea`（合并 #2 `be1ed04`，分诊 `/18`，产品 `+row-identity.16`；全套联合验收，见第 0.31 节，证据在 [`8d1f1ea/`](8d1f1ea/)）。此前联合树 `630a2af`（合并 #2 `c14276c`，分诊 `/17`；产品与评分器代码同 `7d47980`；见第 0.30 节，证据在 [`630a2af/`](630a2af/)）。此前联合树 `7d47980`（合并 #2 `9582515`，产品 `+row-identity.15`；全套联合验收，见第 0.29 节，证据在 [`7d47980/`](7d47980/)）。此前联合树 `74707bd`（合并 #2 `8f63087`，分诊 `/16`；评分器：事件数字的正负号、页码事实保留空白、每侧自己读页码计数；见第 0.28 节，证据在 [`74707bd/`](74707bd/)；中间树 `a2dbe21`、`b6aa2c8` 的证据在 [`a2dbe21/`](a2dbe21/)、[`b6aa2c8/`](b6aa2c8/)）。此前联合树 `9ed97f2`（合并 #2 `5989361`，分诊 `/15`；评分器：同一处出现列两次判 FAIL，页码事实须是重复的页面行；见第 0.27 节，证据在 [`9ed97f2/`](9ed97f2/)）。此前联合树 `33f0cdb`（合并 #2 `d6e1837`，页码计数只按常规印法读，见第 0.26 节，证据在 [`33f0cdb/`](33f0cdb/)）。此前联合树 `4d6b086`（合并 #2 `0e34d77`，重复行的变体按原文保留空白，见第 0.25 节，证据在 [`4d6b086/`](4d6b086/)；其前 `f0173ed` 金额的正负号，见第 0.24 节，证据在 [`f0173ed/`](f0173ed/)）。此前联合树 `d5de336`（普通合并 #2 `2f180a7`：整数页码、不含数字的记录，见第 0.23 节，证据在 [`d5de336/`](d5de336/)；其前 `680914f` 页码表达式中的数字须为完整数字，见第 0.22 节，证据在 [`680914f/`](680914f/)）。此前联合树 `8c48dac`（普通合并 #2 `6b29460`：分诊 `/13`、画像声明的重复页眉，见第 0.21 节，证据在 [`8c48dac/`](8c48dac/)）。此前联合树 `72b87c4`（普通合并 #2 `3b991a0`：分诊 `/12`、非 ASCII 页码，见第 0.20 节，证据在 [`72b87c4/`](72b87c4/)）。此前 `3c9876f`（事件的旧、新出现在卡片编辑中对得上，见第 0.19 节，证据在 [`3c9876f/`](3c9876f/)）。此前联合树 `948c3a1`（#2 的分诊 `/10`、身份预览与产品文字操作，全套联合验收，见第 0.18 节，证据在 [`948c3a1/`](948c3a1/)）。此前 `7e9a760`（次数陈述覆盖卡片自己展示的文字、位置集逐侧核对，见第 0.17 节，证据在 [`7e9a760/`](7e9a760/)）。此前 `12ebf01`（合入 #2 `367020b` 的三个根因修复，评分器与变体定义对齐、移动事件与数字边界，见第 0.16 节，证据在 [`dcc549e/`](dcc549e/)、[`12ebf01/`](12ebf01/)）。此前 `e0ed816`：评分器的三个共同根因，见第 0.15 节，证据在 [`e0ed816/`](e0ed816/)。此前联合树 `09cf6e4`（评分器按字符核对事件文字的来源位置，见第 0.13 节，证据在 [`09cf6e4/`](09cf6e4/)）。`842b0ff` 是普通合并提交，合入 #2 `31f07ed` 的日期事实修复，最终联合验收见第 0.12 节，证据在 [`842b0ff/`](842b0ff/)。此前 `b4f97b6` 事件改动的每一侧都要带卡片的编辑，见第 0.11 节；`9d6de76` 事件中的数字只按整数匹配，见第 0.10 节；此前 `95b5f8a` 合入 #2 的分诊 `/8`，见第 0.9 节）。第二十轮最终联合验收在 `9d7f266`（普通合并提交 `42bfc9b` 合入 #2 `943f75b`，评分器读取 R24 声明与重复文字位置集），证据在 [`9d7f266/`](9d7f266/)，见第 0.8 节。本轮此前各步：控制用例只认本例声明 `a705d4c`、CI 保留各项检查的信号 `74693f3`（证据 [`74693f3/`](74693f3/)），事件文字必须出现在卡片自己的编辑处 `a4954a1`（证据 [`a4954a1/`](a4954a1/)）。第十九轮联合树 `3b3fb2e`（结果格式 2 上的事实验收；普通合并提交 `73846aa` 合入 #2 `657f0ca`）在 [`3b3fb2e/`](3b3fb2e/)，见第 R19 节。第十八轮 `df8f579`（按来源判断事实；合并提交 `3a25fea` 同步 #9 `2b29fd8`）在 [`df8f579/`](df8f579/)，见第 R18 节。第十七轮 `dbf73ef`（多格对应的保护也计入币种代码的一部分）在 [`dbf73ef/`](dbf73ef/)，同时包含第十六轮 `23e5372`（删除卡、新增卡把一个格拆到多张卡上时统一判无法评价；同一处编辑报两次判 FAIL）的修复前对照。各轮证据都保留、没有覆盖：第十五轮 `800fe91` 在 [`800fe91/`](800fe91/)；第十四轮 `a5acd50` 在 [`a5acd50/`](a5acd50/)；第十三轮 `a8cb2cc` 在 [`a8cb2cc/`](a8cb2cc/)；第十二轮 `f2e0e10` 在 [`f2e0e10/`](f2e0e10/)；第十一轮 `402e66e` 在 [`402e66e/`](402e66e/)；第十轮 `bb85bc4` 在 [`bb85bc4/`](bb85bc4/)；第九轮 `8ca503f` 在 [`8ca503f/`](8ca503f/)；第八轮 `f2d953f` 在 [`f2d953f/`](f2d953f/)；第七轮 `c5acdb8` 在 [`c5acdb8/`](c5acdb8/)；第六轮 `55e669a`（按几何关系找金额格）在 [`55e669a/`](55e669a/)；第五轮 `28afbd1`（碎片按原文顺序拼接）在 [`28afbd1/`](28afbd1/)；第四轮 `fececbf`（金额单元格以 layout.json 为准）在 [`fececbf/`](fececbf/)；第三轮 `74783d6`（删除/新增卡的金额只在同一记录内抵消）在 [`74783d6/`](74783d6/)；第二轮 `7ea1fb3`（裸整数金额）在 [`7ea1fb3/`](7ea1fb3/)；第一轮 `d61461b` 在 [`verification/`](verification/) 和 [`register.json`](register.json) |
| 被测产品代码 | `f6d0ea0`、`8906d05` 的产品、契约、分诊与联合树 `081f370` 相同；联合树 `081f370` 就是 #2 当时的 head（核心版本 `+row-identity.32+facts.5+repeat.9+ops.4`，分诊 `renewal-triage/32`）；`48a5887`、`8a178d5`、`1c09dfc`、`d16ed68` 与 `81e065a` 的产品、契约、分诊与联合树 `8e638cb` 相同；联合树 `8e638cb` 的产品、契约、分诊与 #2 的 `5888e7d` 相同（核心版本 `+row-identity.31+facts.5+repeat.9+ops.4`，分诊 `renewal-triage/29`）；`933ea5b` 与 `498cd4a` 的产品、契约、分诊与联合树 `61e4add` 相同；`61e4add` 就是 #2 当时的 head（核心版本 `+row-identity.30+facts.5+repeat.9+ops.4`，分诊 `renewal-triage/28`）；`786aefc` 与联合树 `3feb37d` 的产品、契约、分诊与 #2 的 `c5a5330` 相同（核心版本 `+row-identity.29+facts.5+repeat.9+ops.4`，分诊 `renewal-triage/27`）；`ed11a5f` 与联合树 `b85a1bd` 的产品、契约、分诊与 #2 的 `b8a9b55` 相同（核心版本 `+row-identity.28+facts.5+repeat.9+ops.4`，分诊 `renewal-triage/26`）；`211a705` 与 #2 的 `9b57000` 相同（核心版本 `+row-identity.27+facts.5+repeat.9+ops.4`，分诊 `renewal-triage/26`；`9b57000` 相对 `cb27454` 只改注释和分诊）；`1e44d4d` 与 #2 的 `cb27454` 相同（同一核心版本，分诊 `renewal-triage/25`）；`9e9104f` 就是 #2 当时的 head（核心版本 `+row-identity.26+facts.5+repeat.9+ops.4`，分诊 `renewal-triage/24`）；`509b088` 至 `4a12cd0` 的产品与 #2 的 `509b088` 相同（核心版本 `+row-identity.24+facts.4+repeat.9+ops.4`，分诊 `renewal-triage/23`）；`cedf563` 至 `259d797` 与 #2 `72eb95f`、`ba4bbdd` 相同（核心版本 `+row-identity.22+facts.4+repeat.9+ops.4`，分诊 `renewal-triage/21`）；`91aa884`、`16ae858` 与 #2 `6060f6c` 相同（核心版本 `+row-identity.20+facts.4+repeat.9+ops.4`，分诊 `renewal-triage/20`）；`9354b84` 与 #2 `7847d7d` 相同（核心版本 `+row-identity.18+facts.4+repeat.8+ops.4`，分诊 `renewal-triage/19`）；`8d1f1ea`、`b3e84c8` 与 #2 `be1ed04`、`441a81d` 相同（核心版本 `+row-identity.16+facts.4+repeat.8+ops.4`，分诊 `renewal-triage/18`）；`630a2af` 与 #2 `c14276c` 相同（核心版本 `+row-identity.15+facts.4+repeat.8+ops.4`，分诊 `renewal-triage/17`）；`7d47980` 与 #2 `9582515` 相同（同一核心版本，分诊 `renewal-triage/16`）；`74707bd` 与 #2 `8f63087` 相同（核心版本 `+row-identity.14+facts.4+repeat.8+ops.4`，分诊 `renewal-triage/16`）；`a2dbe21` 与 #2 `91366d2` 相同（核心版本 `+row-identity.13+facts.4+repeat.8+ops.4`，分诊 `/15`）；`9ed97f2`、`b6aa2c8` 与 #2 `5989361` 相同（核心版本 `+row-identity.13+facts.4+repeat.7+ops.4`，分诊 `renewal-triage/15`）；`33f0cdb` 与 #2 `d6e1837` 相同（核心版本 `+row-identity.12+facts.4+repeat.6+ops.4`，分诊 `renewal-triage/14`）；`4d6b086` 与 #2 `0e34d77` 相同（核心版本 `+row-identity.12+facts.4+repeat.5+ops.4`，分诊 `renewal-triage/14`）；`d5de336` 至 `f0173ed` 与 #2 `2f180a7` 相同（核心版本 `+row-identity.10+facts.4+repeat.4+ops.4`，分诊 `renewal-triage/13`）；`8c48dac` 至 `680914f` 与 #2 `6b29460` 相同（核心版本 `+row-identity.9+facts.3+repeat.4+ops.4`，分诊 `renewal-triage/13`）；`72b87c4` 与 #2 `3b991a0` 相同（核心版本 `+row-identity.9+facts.3+repeat.3+ops.4`，分诊 `renewal-triage/12`）；`948c3a1` 至 `ef0d1a2` 与 #2 `948c3a1` 相同（核心版本 `+row-identity.9+facts.3+repeat.2+ops.4`，分诊 `renewal-triage/10`）；`285f993` 至 `978ced3` 与 #2 `367020b` 相同（核心版本 `+row-identity.9+facts.3+repeat.2`，分诊 `renewal-triage/9`）；`842b0ff` 至 `e0ed816` 与 #2 `dabc8c2` 相同（核心版本 `+facts.3`，分诊 `renewal-triage/8`）；第十九、二十轮（至 `b4f97b6`）与 #2 `9ccc044` 相同（结果格式 2，经合并提交 `73846aa` 带入）；第十八轮与 #9 `2b29fd8` 相同；第十七轮及以前与 `e313540` 相同。本项没有修改产品文件 |
| 原则与共同处置表 | [`AGENTS.md` @ `3db7f0b`](https://github.com/wlvh/policy-compare/blob/3db7f0b3c225f2fae0a5412819b5f422a3961891/AGENTS.md)（已逐字核对）；处置表在 #2 的 `reports/issue-2-validation/README.md` §D（`2b29fd8`），本项只链接、评论 |
| 改动文件 | `tests/evaluation/scorer.ts`、`tests/scorer.test.ts`、`scripts/acceptance.ts`、`tests/browser/rules.spec.ts`、`.github/workflows/ci.yml` |
| 工具 | Node 以各轮证据目录的 `tool-versions.txt` 为准（第一轮 v24.19.0，第二十轮 v22.22.0）、pnpm 10.12.1；Python 3.13.17（本地）/ 3.12（CI 环境，本地也用 3.12.3 跑过） |
| 机器可读登记 | [`8906d05/register.json`](8906d05/register.json)（当前；`f6d0ea0` 的在 [`f6d0ea0/register.json`](f6d0ea0/register.json)，`081f370` 的在 [`081f370/register.json`](081f370/register.json)，`81e065a` 的在 [`81e065a/register.json`](81e065a/register.json)，`d16ed68` 的在 [`d16ed68/register.json`](d16ed68/register.json)，`8a178d5` 的在 [`8a178d5/register.json`](8a178d5/register.json)，`48a5887` 的在 [`48a5887/register.json`](48a5887/register.json)，`8e638cb` 的在 [`8e638cb/register.json`](8e638cb/register.json)，`933ea5b` 的在 [`933ea5b/register.json`](933ea5b/register.json)，`498cd4a` 的在 [`498cd4a/register.json`](498cd4a/register.json)，`61e4add` 的在 [`61e4add/register.json`](61e4add/register.json)，`786aefc` 的在 [`786aefc/register.json`](786aefc/register.json)，`3feb37d` 的在 [`3feb37d/register.json`](3feb37d/register.json)，`ed11a5f` 的在 [`ed11a5f/register.json`](ed11a5f/register.json)，`b85a1bd` 的在 [`b85a1bd/register.json`](b85a1bd/register.json)，`211a705` 的在 [`211a705/register.json`](211a705/register.json)，`1e44d4d` 的在 [`1e44d4d/register.json`](1e44d4d/register.json)，`9e9104f` 的在 [`9e9104f/register.json`](9e9104f/register.json)，`4a12cd0` 的在 [`4a12cd0/register.json`](4a12cd0/register.json)，`bae0f9e` 的在 [`bae0f9e/register.json`](bae0f9e/register.json)，`509b088` 的在 [`509b088/register.json`](509b088/register.json)，`259d797` 的在 [`259d797/register.json`](259d797/register.json)，`cedf563` 的在 [`cedf563/register.json`](cedf563/register.json)，`91aa884` 的在 [`91aa884/register.json`](91aa884/register.json)，`9354b84` 的在 [`9354b84/register.json`](9354b84/register.json)，`8d1f1ea` 的在 [`8d1f1ea/register.json`](8d1f1ea/register.json)，`7d47980` 的在 [`7d47980/register.json`](7d47980/register.json)，`74707bd` 的在 [`74707bd/register.json`](74707bd/register.json)，`9ed97f2` 的在 [`9ed97f2/register.json`](9ed97f2/register.json)，`33f0cdb` 的在 [`33f0cdb/register.json`](33f0cdb/register.json)，`4d6b086` 的在 [`4d6b086/register.json`](4d6b086/register.json)，`f0173ed` 的在 [`f0173ed/register.json`](f0173ed/register.json)，`d5de336` 的在 [`d5de336/register.json`](d5de336/register.json)，`680914f` 的在 [`680914f/register.json`](680914f/register.json)，`8c48dac` 的在 [`8c48dac/register.json`](8c48dac/register.json)，`72b87c4` 的在 [`72b87c4/register.json`](72b87c4/register.json)，`3c9876f` 的在 [`3c9876f/register.json`](3c9876f/register.json)，`7e9a760` 的在 [`7e9a760/register.json`](7e9a760/register.json)，`12ebf01` 的在 [`12ebf01/register.json`](12ebf01/register.json)，`e0ed816` 的在 [`e0ed816/register.json`](e0ed816/register.json)，`09cf6e4` 的在 [`09cf6e4/register.json`](09cf6e4/register.json)，`842b0ff` 的在 [`842b0ff/register.json`](842b0ff/register.json)，`9d7f266` 的在 [`9d7f266/register.json`](9d7f266/register.json)，`74693f3` 的在 [`74693f3/register.json`](74693f3/register.json)，第十九轮的在 [`3b3fb2e/register.json`](3b3fb2e/register.json)）：每种 invariant 的覆盖方式、依据、对应测试、出现的用例，以及四次运行中的实际结果 |

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
- 分诊的前缀金额问题（上一段）：已由 #2 在 `/8` 修复，见第 0.9 节。

### 0.9 合入分诊 `/8`：联合树 `95b5f8a`

#2 修复了前缀金额问题（[r4413938264](https://github.com/wlvh/policy-compare/pull/11#discussion_r4413938264)），提交为 `0d9cfc0`（`renewal-triage/8`）。本项用普通合并提交 `95b5f8a` 合入 #2 的 `c23bc33`，没有冲突。

这次只改了分诊脚本、它的测试和 #2 的报告（[`95b5f8a/changed-since-9d7f266.txt`](95b5f8a/changed-since-9d7f266.txt)）。产品和评分器都没变，所以第 0.8 节中评分器、规则和浏览器的结果仍然适用，CI 在新 head 上全部重跑。本项重做的检查（[`95b5f8a/`](95b5f8a/)）：
- **Python 分诊**：37/37。
- **三个分诊复现脚本**（[`triage-probes.txt`](95b5f8a/triage-probes.txt)）：
  - 前缀金额：只改 `USD 1000 → USD 2000` 的卡现在判 `not_located`，不接受；对照 `USD 100 → USD 200` 仍判 `correct`；
  - 身份借用、分卡借用别页上下文：结果与 `/7` 相同，没有回退。
- **续保四次比较**：用 `/8` 重评已存结果，汇总与逐事件结果都与 `/7` 相同，也与 #2 的 `/8` 重评相同（[`renewal/compare.txt`](95b5f8a/renewal/compare.txt)）。

分诊线程全部关闭，分诊的前缀金额问题从不支持清单中移除。联合 head 为本节的报告提交，供 #2 同步。

### 0.10 Codex 复核：事件中的数字只按整数匹配（`9d6de76`）

[r4414263365](https://github.com/wlvh/policy-compare/pull/11#discussion_r4414263365)（P1），已复现。

**问题**：一个 run 里有两个金额：`Hull USD 100; Liability USD 1000` 改成 `Hull USD 200; Liability USD 2000`。一张只报告 `USD 1000 → USD 2000` 的卡，会被算作事件 `USD 100 → USD 200`：`USD 100` 匹配到了 `USD 1000` 的前缀，又落在事件的 run 上、紧挨卡片的编辑。#2 在分诊 `/8` 修的是同一类问题，评分器的 `spots()` 也有这个缺口。

**改法**：答案文字在卡片原文中的出现处，起点或终点不得落在卡片原文某个数字的内部。“数字”指连续的数位，两个数位之间最多夹一个 `.` 或 `,`，与分诊 `/8` 的口径相同。单卡和一删一增的两半都适用。

| 输入 | `ac9aadd` | `9d6de76` |
|---|---|---|
| 只报告 `USD 1000 → USD 2000` | **PASS**（假通过） | FAIL：找到 PASS，归属 FAIL |
| 只报告 Hull 的 `USD 100 → USD 200` / 整行替换 | PASS | PASS |

**验证**（[`9d6de76/`](9d6de76/)）：
- scorer 118/118，`verify:core` 271/271，`tsc` 0 处错误；
- 本轮测试在 `ac9aadd` 的评分器上 1 项失败；
- 两引擎的规则报告和浏览器规则报告与 `9d7f266` 逐项相同，只差提交号（[`compare-with-9d7f266.txt`](9d6de76/compare-with-9d7f266.txt)），真实数据的结论没有变化。

### 0.11 Codex 复核：事件改动的每一侧都要带卡片的编辑（`b4f97b6`）

[r4414375263](https://github.com/wlvh/policy-compare/pull/11#discussion_r4414375263)（P1），已复现。

**问题**：run 为 `USD 100; USD 200 included` 改成 `USD 200; USD 200 excluded`。一张卡删掉 `USD 100; `，把第二个 `USD 200` 记为未改，再把 `included` 改成 `excluded`，就通过了事件 `USD 100 → USD 200`，但它从没报告新金额的插入。原因是第 0.7 节的规则只要求一侧带编辑，新金额于是可以借同一 run 里另一处未改动的 `USD 200`。

**改法**：
- 由事件自己的新旧文字决定哪一侧有变化：去掉两者的共同开头和结尾后，还剩字符的一侧就是有变化的一侧。
- 有变化的一侧，出现处必须在事件的 run 上，并包含卡片在这些 run 上的编辑。
- 没有变化的一侧（例如句尾追加时，旧文字整段保留在新文字里），只要求出现在事件的 run 上。
- 移动事件不变。

| 输入 | `129df20` | `b4f97b6` |
|---|---|---|
| 删掉第一个金额、借另一处未改的 `USD 200` | **PASS**（假通过） | FAIL：找到 PASS，归属 FAIL |
| 第一个金额内逐字编辑；句尾追加 | PASS | PASS |

**验证**（[`b4f97b6/`](b4f97b6/)）：
- scorer 118/118，`verify:core` 271/271，`tsc` 0 处错误；
- 本轮测试在 `129df20` 的评分器上 1 项失败；
- 两引擎的规则报告和浏览器规则报告与 `9d7f266` 逐项相同，只差提交号，真实数据的结论没有变化。

同一次复核中，Codex 还报了一项产品问题（[r4414375279](https://github.com/wlvh/policy-compare/pull/11#discussion_r4414375279)，`packages/compare-core`，归 #2）：
- **现象**：跨闰日的整年期间 `1 March 2023 to 29 February 2024` → `1 March 2024 to 28 February 2025`，产品会陈述 `dates_rolled_forward_one_year`。
- **原因**：产品判定的是“两期各为整年且首尾相接”，而共同定义 D.0 要求每个日期恰好推后一个日历年。
- **对验收的影响**：评分器按 D.0 重算，判这条陈述为假（FAIL），不会放过。
- **未做的事**：这项由代码阅读确认，没有端到端复现，因为合成文档识别不出期间字段。
- **后续**：#2 用现有的期间字段输入经 `compare()` 复现，并在 `dabc8c2` 修复；本项合入后独立复核，见第 0.12 节。

### 0.12 联合树 `842b0ff`：合入日期事实修复，最终联合验收

依据 [#10 顶部当前收口决定](https://github.com/wlvh/policy-compare/issues/10)和[负责人复核](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6501741012)。#2 同步了联合 head `2740d94`，交付最后一项产品修复；本项用普通合并提交合入，在最终联合树上做受影响检查和既有联合验收。证据在 [`842b0ff/`](842b0ff/)。

| 提交 | 内容 |
|---|---|
| `842b0ff` | 普通合并提交，合入 #2 的 `31f07ed`，没有冲突。包含：<br>• `dabc8c2`：`dates_rolled_forward_one_year` 按每个端点核实，核心版本 `+facts.3`；<br>• `31f07ed`：#2 的第十轮报告。<br>自 `2740d94` 起，报告以外只改了 `packages/compare-core/index.ts` 和 `tests/result-format-2.test.ts`（[`changed-since-2740d94.txt`](842b0ff/changed-since-2740d94.txt)）。评分器、答案、分诊脚本都没变。**产品的最终代码在此**；评分器之后在第 0.13 节又改了一处。 |

**闰日事实的独立复核**（[r4414375279](https://github.com/wlvh/policy-compare/pull/11#discussion_r4414375279)）

用 #2 测试里的合成输入（`PERIOD: …`，现有规则把它读作期间字段）经 `compare()` 运行，再用评分器的 `factHolds` 按共同定义独立重算。修复前的产品取 `2740d94` 的 `packages/compare-core/index.ts`。脚本和输出见 [`leap-day-probe.mts`](842b0ff/leap-day-probe.mts)、[`leap-day-probe.log`](842b0ff/leap-day-probe.log)。

| 输入 | 修复前产品（`2740d94`） | 修复后产品（`842b0ff`） | 评分器重算 |
|---|---|---|---|
| `1 March 2023 to 29 February 2024` → `1 March 2024 to 28 February 2025`（跨闰日的连续整年） | **陈述**该事实 | 不陈述 | 不成立 |
| `1 April 2024 to 30 September 2024` → `1 April 2025 to 30 September 2025`（不足一年，两个日期各推后一年） | 不陈述 | 陈述 | 成立 |
| `01 April 2024 to 31 March 2025` → 次年（既有正控） | 陈述 | 陈述 | 成立 |

- **修复后**：产品与评分器在三个例子上一致。
- **修复前**：闰日例的陈述会被评分器判为“来源否定的事实”，即 FAIL，不会放过；不足一年的例子只是少说，不是错说。
- **证据层次**：这是合成文本输入经 `compare()` 的运行结果，不是真实版面上的端到端复现。
- **真实数据**：只有 R08、R32 陈述这条事实，修复后仍陈述，评分器重算成立。每个引擎共 3 条事实（R08、R32 的日期顺延，R24 的续页标题），与修复前相同（[`stated-facts.txt`](842b0ff/stated-facts.txt)）。
- **评分器没有改**：共同定义不变（每个端点同日同月、年份加一，其余文字相同），没有加闰日豁免。

**联合树验证**（`842b0ff`，本地 Linux；CI）

产品变了，所以受影响的检查都重跑，没有复用旧结果。

| 检查 | 结果 |
|---|---|
| scorer 测试 / `verify:core` / Python 分诊（`/8`） | 118/118、273/273（比 `b4f97b6` 多的 2 项是 #2 的日期测试）、37/37 |
| `tsc --noEmit` | 0 处错误 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10 |
| 规则 MuPDF / PDF.js（Node） | **退出码 2**：严格 PASS 28/32，NOT_EVALUATED 4（R16、R18、R23、R24，均为登记的尚未支持项），FAIL 0；事件 32/32；`knownGapsOnly=true`。报告与 `b4f97b6` 逐项相同，只差提交号（[`compare-with-b4f97b6.txt`](842b0ff/compare-with-b4f97b6.txt)） |
| 浏览器（两引擎，重新构建后的完整测试集） | 各 16/16；浏览器规则报告与 `b4f97b6` 逐项相同 |
| 续保四次比较 | 重新提取、重新比较（[`renewal/compare.txt`](842b0ff/renewal/compare.txt)）：<br>• 四份结果与 #2 在 `dabc8c2` 上的结果逐字节相同（sha256 一致）；<br>• 与此前产品（`+facts.2`）的结果相比只差 `coreVersion`；<br>• 用 `/8` 分诊，汇总和逐事件结果与 #2 的相同，也与 `95b5f8a` 的相同。 |
| 覆盖登记 | [`register.json`](842b0ff/register.json)：直接 10、间接 17、尚未支持 4；四个运行（两引擎 × Node / 浏览器）都没有 FAIL |
| CI（`842b0ff`） | 12/12 通过（[run 40909238969](https://github.com/wlvh/policy-compare/actions/runs/40909238969)、[run 40909256663](https://github.com/wlvh/policy-compare/actions/runs/40909256663)）。逐步核对：两个 `functional` 作业的每一步都成功；规则步骤日志为严格 28/32、事件 32/32、退出码 2；浏览器 16/16（[`ci-842b0ff.md`](842b0ff/ci-842b0ff.md)） |

**分项覆盖**（两引擎、Node 与浏览器相同；各项分开报，不相加）

| 项 | 结果 |
|---|---|
| **严格总状态** | PASS 28/32；另 4 项是登记的 NOT_EVALUATED（R16 `all_source_text_preserved`、R18 `ligature_geometry_not_uniformly_guessed`、R23 `all_aircraft_values_attached_to_original_identity`、R24 `same_logical_row_order`）；FAIL 0 |
| **事件用例** | 32/32。答案共列 31 个显式事件（R01、R15、R17、R23 没有）：找到 31/31，来源归属 31/31；单卡 29、一删一增 0，另 2 个是 R27、R28 的覆盖警告事件，按区域核对 |
| **身份**（适用的 16 个事件） | 确定归属 15，按要求呈现的显式未决 1（R25），未满足确定归属要求 0，明确身份陈述错误 0；不适用 13 项 |
| **位置集完整**（只限 R16 的 3 组、R24 的 8 组） | 11/11 |
| **引用内计数一致**（其余次数卡） | 0 处不一致。只说明卡片自己引用的出现位置和次数对得上，不是全文完整 |
| **声明准确** | 0 处与来源不符 |
| **控制用例** | 未声明的文字变化 0 |

**交付结论中必须保留的两项代价**（用户裁定）

1. **四个费率事件的审阅负担增加。**
   - **变化**：航空续保 #87、#88、#89、#93 在 #2 第七轮各是一张修改卡，分诊 `correct`；自第八轮起，每个事件变成一张“基准侧未找到对应”加一张“待审侧未找到对应”，分诊 `split_attributable`。两侧都带该行的项目号、名称和改动来源，没有错归。两引擎相同，`842b0ff` 上仍是这样（[`renewal/aviation_2024_vs_2025-mupdf.events.json`](842b0ff/renewal/aviation_2024_vs_2025-mupdf.events.json)）。
   - **代价**：这是能力的实际下降，审阅者要自己把两张卡对起来，不能写成“前后都是未评价、没有影响”。
   - **未变**：#92 仍是一张修改卡，分诊 `correct`。
2. **#91**：原文有可定位的项目号；产品拆错了结构，当前自动检查无法确认归属。
   - 分诊继续记 `not_evaluable`，即自动未评价。
   - 本项没有加跨单元推断，也不据此说产品的归属全部正确。

**完整的不支持清单**

本轮到此停止扩展，不再扩展表格身份、日期格式或金额规则。
- **4 项登记的尚未支持 invariant**：见上表，缺的证据层见第 4 节。
- **重复文字**：只有 R16、R24 的 11 组位置集核对全文完整。其他次数卡只核对引用内计数一致：页数等于文档页数，次数等于卡片自己引用、经来源校验的出现位置数。文档中未被引用的出现没有搜索。
- **页码跨多页的卡**：`page_number_only` 无法判定，记 `claim_unverifiable`（真实数据中没有）。
- **卡片拼装**：
  - 只支持单卡和一删一增，其他多卡拼装不支持；
  - 没有文字差异的 `result.unresolved` 条目不算事件表达；
  - 身份只认 layout.json 中该格的原文。
- **事件出现处不核对原文中的连续性**：
  - 评分器要求：
    - 答案文字在卡片该侧文字中连续出现；
    - 出现处每个字符的来源位置都在事件的 run 上（第 0.13 节起按字符核对，此前按操作）；
    - 数字按整数匹配；
    - 有变化的一侧带卡片在这些 run 上的编辑。
  - 评分器不核对这些字符在原文里也是相邻的一段、顺序相同。所以，一张卡若把同一组 run 里不相邻的片段拼在一起，恰好拼出答案文字，会被接受。
  - 真实数据和测试里没有见到这种卡。按收口要求不再加约束，登记为已知限制；是否改为加约束，需另行决定。
- **金额检查**：可判定范围见第 5 节，币种和切分方式都没有扩大。
- **日期事实**：产品只认 `DD Month YYYY` 的期间写法（#2 第 R10 节）；评分器按共同定义独立重算，不加闰日豁免。
- **续保分诊的评价范围**（分诊归 #2）：“0 个归属错误”只覆盖已评价的事件；#91 等未评价、未定位的事件不在其内。
- **收口时核实、本轮不修的三项**：共享页眉变体的次数变化（产品）、`repeat` 计入上下文出现（评分器偏严）、`page_number_only` 的“已确认”口径（定义）。见第 0.14 节。

**联合 head**：本节的报告提交 `63a750c` 推送后，Codex 又报了评分器的一项 P1，修复见第 0.13 节。最终联合 head 改为第 0.13 节的报告提交；本节对产品、续保和 CI 步骤的结论仍适用于它。

### 0.13 Codex 复核：事件文字按字符核对来源位置（`09cf6e4`）

[r4414882091](https://github.com/wlvh/policy-compare/pull/11#discussion_r4414882091)（P1），已复现。

**问题**：一个操作可以引用多个来源位置。评分器原来按操作判断“这段文字是否来自事件的 run”：只要操作有一个位置在事件的 run 上，这个操作的全部字符都算。于是可以构造这样一张卡：
- 一个删除操作，同时引用未改动行的 `USD 100 ` 和事件行的 `included`；
- 一个插入操作，同样拼接未改动行的 `USD 200` 和事件行的 `excluded`。

这张卡通过了事件 `USD 100 → USD 200`，但它从没报告事件行的金额改动。这与第 0.7 节修的“借另一单元的文字”同类：第 0.7 节按操作判断，只拦住了拆成多个操作的写法，合并成一个操作就绕过去了。

**改法**：
- 评分器已经核实，每个操作的文字等于它各个位置的文字按顺序相连（空白除外）。据此可以把每个字符对应到它自己的位置。
- 答案文字的出现处，只有每个字符自己的位置都在事件的 run 上才算。
- 第 0.11 节“每一侧带编辑”的要求不变。

| 输入 | `63a750c` | `09cf6e4` |
|---|---|---|
| 一个操作拼接未改动行的金额和事件行的词 | **PASS**（假通过） | FAIL：找到 PASS，归属 FAIL |
| 整行替换、逐字编辑、诚实的一删一增、句尾追加、整数匹配、每侧编辑的对照 | 原结论 | 不变 |

**验证**（[`09cf6e4/`](09cf6e4/)，本地 Linux）：
- scorer 118/118（新例子加在原有的借用文字测试里），`verify:core` 273/273，`tsc` 0 处错误。
- 本轮测试文件在 `63a750c` 的评分器上 1 项失败（[`before-fix-63a750c.log`](09cf6e4/before-fix-63a750c.log)）。
- 规则（两引擎）退出码 2；规则报告和浏览器规则报告与 `842b0ff` 逐项相同，只差提交号（[`compare-with-842b0ff.txt`](09cf6e4/compare-with-842b0ff.txt)）。真实数据的结论没有变化，登记见 [`register.json`](09cf6e4/register.json)。
- **复用的结果（来自第 0.12 节 `842b0ff`）**：只有规则（`scripts/acceptance.ts`）和浏览器 `rules.spec.ts` 读评分器。产品、分诊都没变，所以以下各项没有重跑：
  - PDF 机制、审核回归；
  - 其他 15 项浏览器测试；
  - 续保四次比较。
- CI 在新 head 上全部重跑。

**仍不核对的**：字符在原文中是否相邻、顺序是否相同（第 0.12 节的不支持清单）。按字符绑定位置后，跨行借用会被拒绝；同一组 run 内不相邻片段的拼接仍会被接受。

本节的报告提交 `de1c030` 的 CI 为 12/12 通过（[run 40911954824](https://github.com/wlvh/policy-compare/actions/runs/40911954824)、[run 40911970043](https://github.com/wlvh/policy-compare/actions/runs/40911970043)）。最终联合 head 见第 0.14 节。

### 0.14 收口时仍开放的发现（已核实，本轮不修）

Codex 对 `63a750c` 和 PR #9 的复核又报了三项。
- **核实方式**：都用合成文本输入经 `compare()` 核实（[`09cf6e4/open-findings.log`](09cf6e4/open-findings.log)，脚本在同一目录），不是真实版面上的端到端运行。
- **真实数据**：32 对规则用例和续保四次比较都没有触发它们。
- **处置**：按收口要求本轮不再扩展，列为已知限制；是否修复，另行决定。

| 发现 | 归属 | 核实结果 | 影响方向 |
|---|---|---|---|
| [r4414995196](https://github.com/wlvh/policy-compare/pull/11#discussion_r4414995196)：共享页眉变体的出现次数变化丢失 | 产品（#2） | 两版都有 `UMR B1234AV2024`、`UMR B01234AV2024` 两种写法，四页中的次数由 3＋1 变为 1＋3：0 张卡，`complete_for_scope`。对照：只在一侧新出现的写法照常报告 | **漏报**：次数变化不可见，与原则 4 冲突 |
| [r4414789954](https://github.com/wlvh/policy-compare/pull/9#discussion_r4414789954)：`repeat` 核对把上下文出现也计入 | 评分器（本项） | 只有第 2 页改动的重复行：产品报 `repeat.right = 1`（新文字的次数），同时把其余 3 处未改动的出现作为上下文引用。评分器按引用的 4 处出现核对，判“次数不一致” | **偏严**：会把产品支持的表达判 FAIL，不会放过错误 |
| [r4414859932](https://github.com/wlvh/policy-compare/pull/9#discussion_r4414859932)：`page_number_only` 的“已确认”口径不同 | 共同定义 | 一页文档的页边行 `Schedule Page 3 of 10` → `of 11`：产品按页边位置陈述 `page_number_only`；评分器要求印刷页码等于物理页码，判不成立 | **偏严**。这是共同定义中“已确认”的含义问题，需要 #2 与用户决定；评分器没有单方面放宽 |

PR #9 上还有 4 个 #2 的产品审阅线程未关闭（[r4412115000](https://github.com/wlvh/policy-compare/pull/9#discussion_r4412115000)、[r4412115015](https://github.com/wlvh/policy-compare/pull/9#discussion_r4412115015)、[r4414008547](https://github.com/wlvh/policy-compare/pull/9#discussion_r4414008547)、[r4414059357](https://github.com/wlvh/policy-compare/pull/9#discussion_r4414059357)）。本项没有核实，状态以 #2 为准。

**联合 head（当时）**：本节的报告提交 `5dde304`，代码树与 `09cf6e4` 相同。它在 PR #11、PR #9 和 #10 公布过。此后用户把任务改为持续完成，本节“本轮不修”的三项中，评分器的两项和事件匹配的连续性限制已在第 0.15 节修复；产品与分诊的发现转入 #2 的共同根因清单。

### 0.15 持续完成：评分器的三个共同根因（`6a78f0c`、`0c248bc`、`e0ed816`）

依据 [#10 顶部当前授权](https://github.com/wlvh/policy-compare/issues/10)（取代按轮次停工的条款）和 [#2 顶部共同定义](https://github.com/wlvh/policy-compare/issues/2)。三项都先用最小输入复现，再改共同入口，没有按卡片逐例加补丁。只改了评分器和它的测试，产品、答案、分诊都没变。证据在 [`e0ed816/`](e0ed816/)。

**1. 事件证据要证明原文中的那次变化（`6a78f0c`）**

先复现（[`before-fix-5dde304.log`](e0ed816/before-fix-5dde304.log)）：在 `5dde304` 的评分器上，下面的卡都通过了事件 `USD 100 → USD 200`：
- 重排：`USD ` 加上同行费率位的 `1 → 2` 再加 `00`，分在几个操作里，或放在一个位置内（位置的来源校验只核对首尾字符）；
- 重复：同一原文字符引用两次，代替它后面的字符；
- 两行顺序颠倒：金额取自 `USD` 之前的行；
- 只改空白：只增删金额内的空格，两个金额本身都没变（[r4415075897](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415075897) 的输入）。

另一方面，纯插入 `"" → "approved"`（[r4415128893](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415128893) 的输入）判 FAIL。原先列为理论疑点的“出现处在原文中不连续”由此确认成立。

改法：
- **阅读顺序**：每份文档按页 → 行（抽取顺序）→ 行内字符排出阅读顺序。卡片出现处的每个非空白字符对应到它自己的来源位置。
- **相邻**：出现处的字符必须在原文中逐个相接，不能重排、重复或跳过字符。卡片里的空格只能对应原文的空白或换行。
- **有效编辑**：变化部分指旧、新文字去掉共同开头和结尾后剩下的部分。在有变化的那一侧，变化部分中至少一个非空白字符必须是卡片自己的删除（旧侧）或插入（新侧）。只改空白的编辑、出现处其他位置的编辑都不算；事件本身只是空白变化时，空白编辑可以算。
- **空侧**：纯插入或纯删除的空侧不需要找文字；两侧都为空，不算展示了事件。
- 一删一增的两半用同样的检查。

保留的对照：整行替换、逐字编辑、两处编辑都报、跨行接续、诚实的一删一增、句尾追加、整数匹配、每侧编辑、合并操作。

控制用例中的 `declaredChange` 没有加顺序检查：它已要求卡片全文等于声明文字、每个位置（每个 quad）都在声明的 run 上，在这些 run 内调换字符也拼不出别的文字。

**2. 次数只计卡片所报的变体（`e0ed816`，[r4414789954](https://github.com/wlvh/policy-compare/pull/9#discussion_r4414789954)）**

先复现：四页中只有第 2 页的限额改了。卡片陈述 `4 → 1`，并把新版其余 3 处未改动的出现作为上下文引用，评分器判“次数与引用的出现位置数不一致”。这是假 FAIL。

改法：
- `repeat` 每一侧只与卡片**自己文字**的出现处比较。是否同一变体，看两处来源校验后的文字掩去显式分页表达中的数字后是否相同（空白不计）：`FIXTURE | PAGE 1` 与 `| PAGE 2` 算同一变体，`USD 1,000,000` 与 `USD 2,000,000` 算两个变体。
- R16/R24 的位置集用同一个变体判断：卡片在某一侧自己的出现落在集合的 run 上，才算报告了该集合；它在那一侧引用的其他变体是上下文，既不算“集合外”，也不计数。
- 把上下文计入次数、漏计一处，仍判 FAIL。

当前产品对“裸页码”页脚（例如 `- 1 -`，没有 `Page` 字样）不生成重复卡，所以不受影响（合成输入核对过）。若 #2 的重复内容修复会这样分组，评分器再按“数字随页递增”从来源独立核验，已在 [PR #9](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6503958083) 与 #2 约定。

**3. 页码事实只陈述分页表达中的数字（`0c248bc`，[r4414859932](https://github.com/wlvh/policy-compare/pull/9#discussion_r4414859932)）**

按共同定义，`page_number_only` 的判定：
- **双侧**：只差 `Page n` / `Page n of N` / `Page n/N` 中的数字，其余文字（包括表达里的 `Page`、`of`）相同，且数字确实不同；
- **单侧**：整段只由这类表达和空白构成。

这项事实不说印刷编号正确，所以去掉了“计数等于物理页号、总数等于文档页数”的前提：一页文档中 `Schedule Page 3 of 10 → of 11` 现在成立。跨多页的卡也能判定，不再记 `claim_unverifiable`。

仍判不成立的情况：只改空白、表达形式改变（`Page 3 → Page 3 of 11`）、页码旁的费率或金额改变、单侧 `Draft Page 2`。事实成立仍不替控制用例提供许可。

（更正，见第 0.16 节：此处原说产品 `facts()` 的 furniture 分支会对“裸页码”陈述这项事实，这是误读。该分支只掩去显式分页表达的计数与总数，产品与共同定义一致。）

**验证**（`e0ed816`，本地 Linux）

| 检查 | 结果 |
|---|---|
| scorer 测试 | 120/120（新增 2 项，原有 2 项按共同定义改写） |
| 修复前 | 每次修复时的测试文件，在它前一版的评分器上：`5dde304` 1 项失败（顺序与有效编辑的测试；第一处硬断言停在纯插入，其余伪造卡都判 PASS），`6a78f0c` 3 项失败，`0c248bc` 2 项失败（[日志](e0ed816/)） |
| `verify:core` / `tsc --noEmit` | 275/275，0 处错误 |
| 规则 MuPDF / PDF.js（Node） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11 |
| 浏览器 `rules.spec.ts`（两引擎，重新构建后） | 通过 |
| 与 `09cf6e4` 比较 | 两引擎的规则报告和浏览器规则报告逐项相同，只差提交号（[`compare-with-09cf6e4.txt`](e0ed816/compare-with-09cf6e4.txt)） |
| 覆盖登记 | [`register.json`](e0ed816/register.json)：直接 10、间接 17、尚未支持 4；四个运行都没有 FAIL |
| 复用（产品未变） | PDF 机制、审核回归、其他 15 项浏览器测试、续保四次比较沿用第 0.12 节 `842b0ff` 的结果，这些都不读评分器 |

**不支持清单的变化**（相对第 0.12、0.14 节）：
- **移除**：“事件匹配不核对原文中的相邻和顺序”，已实现；“跨多页的 `page_number_only` 记 `claim_unverifiable`”，现在能判定；`repeat` 计入上下文的偏严问题，已修；页码“已确认”的口径不一致，评分器已按共同定义。
- **仍在**：
  - 4 项登记的尚未支持 invariant；
  - 位置集只限 R16、R24，其他次数卡只核对引用内计数；
  - 只支持单卡和一删一增；
  - 金额检查的范围见第 5 节；
  - 费率拆卡、#91 的边界照旧；
  - 阅读顺序按抽取的行序：同一行内的顺序是确定的；跨行时以抽取顺序作原文顺序，多栏版面中抽取顺序与视觉顺序不一致的跨栏文字会被拒绝，不会被接受。
- **归 #2，按共同根因处理中**：重复内容的次数与对应（含 [r4414995196](https://github.com/wlvh/policy-compare/pull/11#discussion_r4414995196)）、身份列与表实例、分诊的有效编辑与空侧（[r4415075897](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415075897)、[r4415128893](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415128893)），以及 furniture 分支的页码事实。合入 #2 的固定 SHA 后，在联合树上验证并重评续保。

### 0.16 联合树：合入 #2 的三个根因修复，评分器跟进（`285f993`、`dcc549e`、`12ebf01`）

#2 推送了三个根因的修复（head `367020b`）。本项用普通合并提交 `285f993` 合入，没有冲突；然后用产品在联合树上的实际卡片检验评分器，并处理新的审阅意见。
- `703fd57`：重复行每个变体各自计数，其他变体标 `context: true`；
- `5ae3641`：页码事实的契约说明；
- `c899839`：行身份保留自己的列和表实例；
- `2c11771`：核心版本 `+row-identity.9+facts.3+repeat.2`；
- `367020b`：分诊 `renewal-triage/9`。

| 提交 | 内容 |
|---|---|
| `285f993` | 普通合并 #2 的 `367020b` |
| `dcc549e` | 评分器的变体判断与契约对齐。见下文 |
| `12ebf01` | 移动事件同样核对出现处；出现处两端的数字须在原文中也完整。见下文 |

**变体与契约对齐（`dcc549e`）**

- **问题**：契约现在写明“页码计数按所在页读”，例如第 3 页的 `Page 3` 与第 4 页的 `Page 4` 是同一变体。我在第 0.15 节的做法是把计数和总数全部掩去。用产品在联合树上的实际卡片核对，它误判了一张正确的卡：后一页计数改成 `Page 99 of 4`，卡片陈述 4 → 1，其他页列为上下文，评分器却把新版一侧算成 4。
- **改法**：
  - 显式分页表达的计数若随页递增，就按所在页读成 `n − 页号`；判断依据是任一侧卡片引用的出现中，计数取值不同、与所在页的差值恒定。
  - 不随页递增的计数（每页都印 `Page 1`）、页面总数、其他数字，都按原样。
  - 同一个印刷的 `Page 3` 出现在第 3、4 页时，算两个变体。
  - 标为 `context` 的出现若其实是卡片自己的变体，这个标记与来源矛盾，判 FAIL。
- **核对**：产品的实际卡片在下面 8 种输入上都没有 fault：
  - UMR 两种写法 3＋1 → 1＋3；
  - `Page 3 → 99`；
  - 一个旧文字变成两个新文字；
  - 带总数、不带总数的重分页；
  - 偏移计数；
  - 每页固定印 `Page 1`；
  - 只改一页的限额。
- **修复前**：测试文件在 `285f993` 的评分器上 1 项失败（[日志](dcc549e/before-fix-285f993.log)）。

**移动事件与数字边界（`12ebf01`，[r4416120281](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416120281)）**

- **Codex 报的问题**：`carried()` 对移动事件直接返回真，出现处的检查一项都没做。所以要求移动 `USD 100` 时，一张只引用 `USD 1000` 的 Moved 卡也判 PASS。
- **复现时另发现一处**：整数检查只看卡片文字。卡片的位置若从原文 `USD 1000` 中切出 `USD 100`，在卡片里看是完整数字，移动事件和替换事件都会因此误判 PASS。
- **改法**：
  - 去掉移动事件的捷径。移动不改文字，变化部分为空，所以不要求编辑，但两侧都要在事件的 run 上、按原文顺序出现。
  - 出现处以数字开头或结尾时，在原文中也须是完整数字：紧邻处没有数字，也没有后接数字的 `.` 或 `,`。
- **修复前**：在 `dcc549e` 的评分器上 2 项失败（[日志](12ebf01/before-fix-dcc549e.log)）。
- **真实数据**：R12、R13 的移动事件仍通过。

**联合树验证**

产品变了，所以在 `dcc549e` 上全套重跑（[`dcc549e/`](dcc549e/)）；`12ebf01` 只改评分器，重跑读评分器的几项（[`12ebf01/`](12ebf01/)）。

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊（`/9`）/ `tsc` | 120/120、282/282、40/40、0 |
| 构建、PDF 机制、审核回归（两引擎，`dcc549e`） | 通过；7/7、10/10 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。`dcc549e`、`12ebf01` 的报告都与 `e0ed816` 逐项相同，只差提交号 |
| 浏览器 | 完整测试两引擎各 16/16（`dcc549e`）；`rules.spec.ts` 在 `12ebf01` 上重跑，报告相同 |
| 覆盖登记 | [`12ebf01/register.json`](12ebf01/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取（[`dcc549e/renewal/compare.txt`](dcc549e/renewal/compare.txt)）：四份结果与 `842b0ff` 的只差 `coreVersion`。新分诊 `/9` 下逐事件结论完全不变：旧产品结果用新分诊重评不变，新产品结果用新分诊也不变。费率四事件 `split_attributable`、#91 自动未评价照旧 |

**审阅意见的处置**

| 线程 | 归属 | 处置 |
|---|---|---|
| [r4414995196](https://github.com/wlvh/policy-compare/pull/11#discussion_r4414995196)：两种写法次数互换被吞掉 | 产品 | #2 在 `703fd57` 修复。用我的输入在联合树上核对：现在两张计数卡（3→1、1→3），另一种写法作上下文，评分器无 fault |
| [r4415075897](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415075897)：只改空白 | 分诊 | `367020b` 修复。我的输入现在判 `not_located`；真金额变化的对照仍 `correct` |
| [r4415128893](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415128893)：空侧 | 分诊 | `367020b` 修复。纯插入、纯删除现在 `correct` |
| [r4415913728](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415913728)：只换币种代码 | 分诊 | `367020b` 修复。我的输入现在判 `not_located`。评分器侧已有同一对照 |
| [r4415969212](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415969212)：身份指标只查预览 | 分诊 | **未修**（`/9` 上仍复现）。只影响汇总指标，不接受错误的卡。等 #2 |
| [r4416120281](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416120281)：移动事件 | 评分器 | `12ebf01` 修复 |

**更正**：第 0.15 节和[交接评论](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6503958083)曾说，产品 `facts()` 的 furniture 分支会对“裸页码”陈述 `page_number_only`。这是误读。`signatures()` 只把显式分页表达的计数和固定总数记为 `pageTokens`，其他变化的数字会让整行不算 furniture。实测 `- n -`、`n / N` 都不陈述这项事实，产品已符合共同定义。已在 [PR #9](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6504569516) 更正。

### 0.17 次数陈述要覆盖卡片自己展示的文字；位置集逐侧核对（`7e9a760`）

**Codex 报的问题**（[r4416274609](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416274609)）：卡片只要在一侧报告了 R16/R24 的位置集，另一侧就完全不核对。

先复现：位置集 2 → 3。下面三张卡，在 `12ebf01` 的评分器上都判 PASS，位置集也记为通过（[日志](7e9a760/before-fix-12ebf01.log)）：
- **展示了旧侧却不计**：卡片左侧位置引用了该文字，但出现列表里没有旧侧出现，次数写 `0 → 3`；
- **写成新增**：`Added` 卡，次数 `0 → 3`，可旧版有 2 处；
- **同一文字在集合外计数**：旧侧 2 处都在集合上，新侧只引用正文里同样字样的一行，次数 `2 → 1`。

根因是同一处：一侧被免检，依据只是“卡片在这一侧没有引用集合里的出现”，而不是卡片在这一侧说的是别的文字。第一张卡还有另一面：普通的次数核对只与出现列表比较，而卡片自己展示的那处文字不在列表里。

改法：
- **卡片层**：卡片在某一侧展示的自己的文字，必须是它在这一侧计数的出现之一。否则次数与卡片自己展示的内容矛盾，判 FAIL。
- **位置集层**：只有当卡片在这一侧陈述的是另一段非空文字（自己的文字与另一侧不同，例如限额 A → B），这一侧才不按集合核对。空侧和相同文字都是对集合的陈述，出现位置与次数都必须与集合一致。

保留的对照：
- 第 0.15 节的限额 A → B：旧侧报告集合，新侧是另一段文字，仍通过；
- 一张卡或拆成两张卡完整报告集合，仍通过；
- 漏一处、多一处、拆开的两张卡之一不完整，仍判 FAIL。

**验证**（`7e9a760`，本地 Linux；产品未变，只重跑读评分器的几项，证据在 [`7e9a760/`](7e9a760/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / `tsc` | 120/120（在原有两项测试中加了 4 个反例）、282/282、0 |
| 修复前 | 本次测试文件在 `12ebf01` 的评分器上 2 项失败；用软断言逐个看，三张伪造卡都判 PASS，T1 记为通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。报告与 `12ebf01` 逐项相同，只差提交号 |
| 浏览器 `rules.spec.ts`（两引擎，重新构建后） | 通过；报告与 `12ebf01` 逐项相同，只差提交号（[`compare-with-12ebf01.txt`](7e9a760/compare-with-12ebf01.txt)） |
| 覆盖登记 | [`7e9a760/register.json`](7e9a760/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |

### 0.18 联合树 `948c3a1`：#2 的分诊 `/10`、身份预览与产品文字操作

#2 在 `948c3a1` 合入了本项的 `978ced3`，本项快进到这个提交，两条分支的代码树相同。相对 `978ced3`，改了下面这些（[`948c3a1/changed-since-978ced3.txt`](948c3a1/changed-since-978ced3.txt)）：
- **产品文字操作**（`e45f114`、`3230875`、`ceea1d4`，核心版本 `+ops.4`）：
  - 只用词、数字和标点作对齐锚点；
  - 锚点之间，两边个数相同时按顺序配对；
  - 一对词只保留共同的开头和结尾，不再逐字母配对。

  原先的字符级 diff 会跨数值配对字符，例如把 `7,400` 的逗号当成 `71,600` 的逗号。
- `2b9c225`：不含数字的表格行保留自己表格的范围。
- **分诊 `/10`**（`d393881`、`95e8020`）：同一张卡上，旧、新两处出现要在卡片的编辑里对得上。
- **身份指标**（`c3f8213`）：读已接受记录的完整原文，不再读 80 字符预览（[r4415969212](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415969212)）。

**联合验收**（产品变了，所以全套重跑，证据在 [`948c3a1/`](948c3a1/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/10` / `tsc` | 120/120、288/288、44/44、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。报告与 `7e9a760` 逐项相同，只差提交号：文字操作变了，32 对的判定没有一项变化 |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 续保四次比较 | 重新提取（[`948c3a1/renewal/compare.txt`](948c3a1/renewal/compare.txt)），结果见下 |

续保四次比较：
- **产品**：每次比较的卡片数量、文字、来源、事实、次数、结构、未决组都与 `367020b` 的结果相同。只有 32–38 张卡的文字操作变了，卡片编号不变。
- **逐事件结论**：新产品配 `/10`，与旧产品配 `/9` 逐事件完全相同（判定、接受的卡、行标记），差异为 0。
- **拆开看**：只换分诊、不换产品，即旧产品配 `/10`：
  - aviation 的 #36（两引擎）由 `correct` 退为 `not_evaluable`；
  - bizav 的 #57、#58（两引擎）由 `correct` 退为 `not_evaluable`。

  原因是旧的字符级 diff 跨数值配对，新的对齐规则不认这种配对。产品改用按词配对后，这几项都恢复为 `correct`。所以 `/10` 单独换上会更保守，与新产品一起没有改变任何结论。
- 费率四事件 `split_attributable`、#91 自动未评价照旧。`acceptedWithoutPrimaryIdentity` 在四次比较中都为空，修复前后相同。

**独立复核 #2 的分诊修复**（探针在 [`948c3a1/`](948c3a1/)）：

| 线程 | 输入 | `/9`（`367020b`） | `/10`（`948c3a1`） |
|---|---|---|---|
| [r4415969212](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415969212) | MSN 在行内第 90 个字符 | `primaryIdentityOnRecord=false` | `true`；短名称对照仍 `true` |
| [r4415913728](https://github.com/wlvh/policy-compare/pull/11#discussion_r4415913728) | #2 的输入：声明了表格身份、按原文位置构造的币种互换卡 | **`correct`，接受了这张卡** | `not_evaluable`，不接受；改 Hull 金额的对照仍 `correct` |
| [r4416398168](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416398168) | `Pay now.` → `Pay later now.`，编辑 `"" → "later"` | `not_evaluable` | **仍为 `not_evaluable`**，未修，归 #2 |

**更正**：第 0.16 节说 r4415913728 已由 `367020b` 修复，依据是我自己的输入在 `/9` 上判 `not_located`。那个输入没有触发这个缺口：同一张卡在声明了表格身份时，`/9` 仍判 `correct`，是 #2 用自己的输入发现的。我的复核不足以证明修复，线程关得过早。实际修复在 `/10`，上表已独立复核。

### 0.19 事件的旧、新出现要在卡片的编辑里对得上；编辑可以标在任一处重复的字上（`3c9876f`）

**问题**：用 #2 在 `/10` 中的两个对照，在 `948c3a1` 的评分器上复现（[日志](3c9876f/before-fix-948c3a1.log)）：
- **假 FAIL**：`South Sudan, ` → `South Sudan, Sudan, `，卡片把第一个 `Sudan,` 标成插入。这张卡是正确的：重复的词标在哪一处，是产品的对齐方式。评分器却判 FAIL，因为第 0.15 节的规则要求编辑落在“变化部分”内，也就是第二个 `Sudan,`。
- **假 PASS**：`USD 100 lorem ipsum dolor EUR 7` → `EUR 9 lorem ipsum dolor USD 200`。卡片把 `USD 100` 与 `EUR 9`、`EUR 7` 与 `USD 200` 各配成一对，中间夹着不变的文字，评分器仍判它展示了 `USD 100 → USD 200`。两侧分开看各自都有编辑，可卡片的编辑并没有把这两处当成一次变化。

**根因**：第 0.15 节的“有效编辑”有两个缺陷，都是同一处：
- 要求编辑落在变化部分，管得太细，把对齐方式当成了证据；
- 两侧分开判断，不看两处出现是否属于卡片编辑中的同一处，管得太粗。

**改法**（与 #2 的 `/10` 同一定义）：
- **自己的编辑**：每个需要文字的一侧，出现处带有卡片自己的非空白删除（旧侧）或插入（新侧），位置可以在出现处的任何地方。只改空白的编辑仍不算；事件本身只是空白变化时，例外照旧。
- **对得上**：同一张卡上两侧都有文字时，旧、新两处出现要在卡片的编辑里对得上：
  - 事件在某一侧保留的部分（变化部分以外），卡片若也保留，就必须与另一处出现配对；
  - 两处出现之间，不能有卡片保留、却不属于任何一处的文字。
- 纯插入、纯删除（一侧为空）和分在两张卡上的一删一增，不做这项配对检查，其余照旧。

**对照**（都在 `tests/scorer.test.ts`）：
- 接受：第一个或第二个 `Sudan` 标成插入；插入的从句重复了后面的词，卡片把重复的词与旧文后面的词配对；整行一删一增。
- 拒绝：两端金额。
- 已有的拒绝照旧：币种互换、借另一行金额、重排、重复引用、只改空白等。其中币种互换现在由“对得上”拒绝：Hull 金额的 `00` 与 Hull 的 `100` 配对，不属于新侧的 `USD 200`。

**验证**（`3c9876f`，本地 Linux；产品未变，只重跑读评分器的几项，证据在 [`3c9876f/`](3c9876f/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / `tsc` | 120/120（在原有测试中加了 5 个输入）、288/288、0 |
| 修复前 | 本次测试文件在 `948c3a1` 的评分器上 1 项失败；用软断言逐个看，第一个 `Sudan` 判 FAIL，两端金额判 PASS，其余对照修复前后都通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32（R12、R13 的移动事件照旧通过）；位置集 11/11。报告与 `948c3a1` 逐项相同，只差提交号（[`compare-with-948c3a1.txt`](3c9876f/compare-with-948c3a1.txt)） |
| 浏览器 `rules.spec.ts`（两引擎，重新构建后） | 通过；报告与 `948c3a1` 逐项相同，只差提交号 |
| 覆盖登记 | [`3c9876f/register.json`](3c9876f/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |

分诊没有对应改动：同一定义 #2 已在 `/10` 实现。续保结果不经过评分器，第 0.18 节的续保结论不受影响。

### 0.20 联合树 `72b87c4`：合入 #2 的分诊 `/12` 与非 ASCII 页码修复

本项用普通合并提交 `72b87c4` 合入 #2 的 `3b991a0`，没有冲突。相对 `ef0d1a2`，改了下面这些（[`72b87c4/changed-since-ef0d1a2.txt`](72b87c4/changed-since-ef0d1a2.txt)）：
- `b0f41cb`（分诊 `/11`）：一张卡同时改了两侧文字却对不上时，判定里写明这一点。
- `d1ce767`（分诊 `/12`）：卡片完整展示作者段落时，这个段落本身就算上下文，不论多短（[r4416398168](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416398168)）。
- `3b991a0`（核心版本 `+repeat.3`）：用 `Number()` 读不出的数字（阿拉伯-印度数字、全角数字）写成的页码计数，不再被确认为随页递增，这一行按内容比较。
  - 评分器本来就按原样读这类计数：它要求计数的几处取值互不相同，全是 NaN 时不成立，所以没有改。

**联合验收**（产品变了，全套重跑，证据在 [`72b87c4/`](72b87c4/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/12` / `tsc` | 120/120、289/289、44/44、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告都与 `3c9876f` 逐项相同，只差提交号（[`compare-with-3c9876f.txt`](72b87c4/compare-with-3c9876f.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`72b87c4/register.json`](72b87c4/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取（[`72b87c4/renewal/compare.txt`](72b87c4/renewal/compare.txt)）：四份结果与 `948c3a1` 的逐字段相同，只差 `coreVersion`。`/12` 下逐事件结论不变，旧结果、新结果都是 |

**独立复核 `/12`**（[`72b87c4/probes/`](72b87c4/probes/)）：
- `Pay now.` → `Pay later now.` 及其反向，在 `/10` 上判 `not_evaluable`，在 `/12` 上判 `correct`，未解释的卡为 0。
- 短段落的替换、长段落的插入两个对照，在两版上都判 `correct`。
- 同一个词插在另一段的反例在 #2 的测试中，44 项都通过。
- 身份预览、币种互换的探针在 `/12` 上结果不变。

### 0.21 联合树 `8c48dac`：合入 #2 的分诊 `/13` 与画像声明的重复页眉

本项用普通合并提交 `8c48dac` 合入 #2 的 `6b29460`，没有冲突。相对 `251fe03`，改了下面这些（[`8c48dac/changed-since-251fe03.txt`](8c48dac/changed-since-251fe03.txt)）：
- `0be4819`（核心版本 `+repeat.4`，PR #9 的 r4416656228）：画像声明的重复页眉也按变体逐一比较。
  - 以前，各处取值不同时，产品把各处的值拼成一段卡片文字，并按 4 次计数，可原文没有任何一处是这段文字。
- `6b29460`（分诊 `/13`，[r4416699649](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416699649)）：在作者编辑改变的一侧，记录身份必须位于含有这次出现中被改动字符的单元。

评分器没有改：
- **次数**：`repeat` 只与卡片自己文字的出现比较，拼接文字在原文中没有出现处。用旧产品那种卡片做探针，评分器判 FAIL：次数与引用的出现不符，卡片展示的文字也不在它计数的出现里（[`8c48dac/probes/joined-header-probe.md`](8c48dac/probes/joined-header-probe.md)）。
- **身份**：出现处的每个字符都必须来自答案为该事件指定的原文位置，身份不取自卡片里其他单元的文字。

**联合验收**（产品变了，全套重跑，证据在 [`8c48dac/`](8c48dac/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/13` / `tsc` | 120/120、290/290、45/45、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告都与 `72b87c4` 逐项相同，只差提交号（[`compare-with-72b87c4.txt`](8c48dac/compare-with-72b87c4.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`8c48dac/register.json`](8c48dac/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取（[`8c48dac/renewal/compare.txt`](8c48dac/renewal/compare.txt)）：四份结果与 `72b87c4` 的逐字段相同，只差 `coreVersion`。`/13` 下，判定、接受的卡、行标记和写出的证据，逐事件都不变 |

**独立复核 `/13`**（[`8c48dac/probes/`](8c48dac/probes/)）：

| 输入 | `/12` | `/13` |
|---|---|---|
| 一次出现跨两个单元，身份 `1315` 只在未改动的单元（`1315 USD` 加上 `100 1760` → `200 1760`） | **`correct`，接受** | `not_evaluable`，不接受 |
| 对照：身份在改动的单元（`100 1760 1315` → `200 1760 1315`） | `correct` | `correct` |

### 0.22 页码表达式中的数字必须是完整数字（`680914f`）

**问题**：#2 修产品的 r4416744456 时，本项检查了评分器，发现同一个缺口：
- 评分器的页码表达式会从 `Schedule Page 1.1` 中取 `1` 作页码，从 `Page 3 of 10,5` 中取 `10` 作总数；
- 所以 `Schedule Page 1.1` → `Schedule Page 2.1`、`Page 3 of 10,5` → `Page 3 of 11,5` 都被认为“只是页码变化”；
- 控制用例里陈述 `page_number_only` 的卡因此记为 NOT_EVALUATED，没有判为错误陈述。

这与 `12ebf01` 的数字边界是同一个根因：从更长的数字里切出一段。

先复现：本次测试文件在 `8c48dac` 的评分器上 1 项失败。用软断言逐个看，两种情形都是 NOT_EVALUATED，没有 fault（[日志](680914f/before-fix-8c48dac.log)）。

**改法**：页码表达式中的 n 和 N 必须是完整数字，后面不能紧跟数字，也不能紧跟后接数字的 `.` 或 `,`。句末的句号不受影响（`Page 3 of 10.` 照旧）。同一个表达式也用来读重复行的页码计数，所以变体判断与 #2 的 `5bd85da` 一致。

**验证**（`680914f`，产品未变，只重跑读评分器的几项，证据在 [`680914f/`](680914f/)）：
- scorer 120/120（加了 2 个输入），`verify:core` 290/290，`tsc` 0；
- 两引擎规则与浏览器规则报告与 `8c48dac` 逐项相同，只差提交号；
- 覆盖登记没有 FAIL。

### 0.23 联合树 `d5de336`：合入 #2 的整数页码与不含数字的记录修复

本项用普通合并提交 `d5de336` 合入 #2 的 `2f180a7`，没有冲突。这一批里，#2 也合入了本项的 `ef0d1a2`。产品方面（[`d5de336/changed-since-680914f.txt`](d5de336/changed-since-680914f.txt)）：
- `5bd85da`（`+facts.4`，PR #9 的 r4416744456）：页码只认这一行里的完整数字；
- `2f180a7`（`+row-identity.10`，r4416744444）：不含数字的记录保留所在表格的范围，不再被当成跨表的重复表头。

分诊没有变，仍是 `/13`。

**联合验收**（产品变了，全套重跑，证据在 [`d5de336/`](d5de336/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/13` / `tsc` | 120/120、293/293、45/45、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告都与 `680914f` 逐项相同，只差提交号 |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`d5de336/register.json`](d5de336/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取（[`d5de336/renewal/compare.txt`](d5de336/renewal/compare.txt)）：四份结果与 `8c48dac` 的逐字段相同，只差 `coreVersion`；判定、接受的卡、行标记、写出的证据，逐事件都不变 |

**仍开放的分诊审阅意见（归 #2，都已在 `/13` 上复现，[`d5de336/probes/`](d5de336/probes/)）**：

| 线程 | 输入 | `/13` |
|---|---|---|
| [r4416771397](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416771397) | 两张替换卡各只改一个币种，`USD 100 → USD 200` | `split_attributable`，两张卡都被接受 |
| [r4416771405](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416771405) | 新增行 `1315 \| A \| USD 100`，卡片缺 `A` | `correct`，`fullRowRecovered=true` |
| [r4416863588](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416863588) | 新增/删除行 `1315 \| Hull \| USD 100`，卡片只有 `USD 100,000` | `correct`，`fullRowRecovered=true` |
| [r4416863597](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416863597) | 新增行 `1315 \| USD 100 \| USD 100`，卡片只有一处 | `correct`，`fullRowRecovered=true` |

后三项是同一处：分诊逐格核对行时，没有套用出现处的规则，包括全部非空格子、完整数字、各格各自的出现。

评分器用同样的输入判 FAIL，对照判 PASS（[`scorer-analogs.md`](d5de336/probes/scorer-analogs.md)）：
- 评分器要求卡片包含事件的完整文字，数字按完整数字匹配；
- 一删一增只接受 `Removed` 卡加 `Added` 卡。

### 0.24 金额的正负号是金额的一部分（`f0173ed`，[r4417025747](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417025747)）

**问题**：金额分词时丢掉了数字前的负号。一张有来源支持的卡，在协定价值格里报告 `-100,020 → 100,020`，两侧切出的金额相同，`agreed_value_unchanged` 因此通过。

先复现：新测试在 `d5de336` 的评分器上失败，整个用例判 PASS（[日志](f0173ed/before-fix-d5de336.log)）。

**改法**：紧贴在数字前的正负号（`-`、`−`、`+`，前面不是字母、数字、`.` 或 `,`）算作金额的一部分。卡片文字、layout.json 的金额格、声明金额字段时的裸数字，都按这一条切分。数字之间的连字符不算正负号，对照 `1-100,000` 仍读作 `100,000`。会计括号不在支持范围内，见第 5 节。

**验证**（`f0173ed`，产品与 `d5de336` 相同，只重跑读评分器的几项，证据在 [`f0173ed/`](f0173ed/)）：
- scorer 121/121，`verify:core` 294/294，`tsc` 0；
- 两引擎规则与浏览器规则报告与 `d5de336` 逐项相同，只差提交号；
- 覆盖登记没有 FAIL。

### 0.25 联合树 `4d6b086`：合入 #2 的 `0e34d77`；重复行的变体按原文保留空白

本项用普通合并提交 `312c682` 合入 #2 的 `0e34d77`，没有冲突。这一批里，#2 也合入了本项的 `32e7fd4`。相对 `32e7fd4`，改了下面这些（[`4d6b086/changed-since-32e7fd4.txt`](4d6b086/changed-since-32e7fd4.txt)）：
- **产品**：
  - `c6b6746`、`654b983`（`+row-identity.12`）：不含数字的记录归到所在表格的表头行下，也不作下面各行的表头；
  - `1de56e9`（`+repeat.5`，r4416942422）：重复行的变体保留原文空白。四行中第 3 页多一个尾随空格时，这一页自成一个变体，`4 → 1`，其余作上下文。
- **分诊 `/14`**（`aeaec53`）：行内格子按完整数字匹配（[r4416863588](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416863588)），每格各需一次出现（[r4416863597](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416863597)）。

**评分器跟进（`4d6b086`）**：
- **问题**：评分器判断变体时仍去掉全部空白，于是把那三行未改动的上下文也算成卡片自己的出现。产品这张正确的卡被判 FAIL：“次数不符”“把自己的出现标为上下文”。
- **修复前**：新测试在 `f0173ed` 的评分器上失败，用的是合并后的产品（[日志](4d6b086/before-fix-f0173ed.log)）。
- **改法**：变体按原文读取。每处出现在每页上，从第一个引用位置到最后一个，按原始顺序取全部字符，空白照原样保留，几个引用片段之间的空白也保留。卡片自己的文字也从它自己的位置这样读取，不再用卡片上的 `oldText`/`newText`。页码计数仍按所在页读。
- **对照**：把产品这张卡的新侧次数改成 4（把上下文也算进去），判 FAIL。

**联合验收**（产品与评分器都变了，全套重跑，证据在 [`4d6b086/`](4d6b086/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/14` / `tsc` | 122/122、298/298、47/47、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告都与 `f0173ed` 逐项相同，只差提交号 |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`4d6b086/register.json`](4d6b086/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取（[`4d6b086/renewal/compare.txt`](4d6b086/renewal/compare.txt)）：四份结果与 `d5de336` 的逐字段相同，只差 `coreVersion`。`/14` 下，旧结果、新结果的判定、接受的卡、行标记、写出的证据，逐事件都不变 |

**分诊审阅意见**（探针在 [`4d6b086/probes/`](4d6b086/probes/)）：
- **已修，独立复核**：r4416863588、r4416863597。在 `/13` 上判 `correct`、整行已恢复；在 `/14` 上分别为 `partly_located`、`not_evaluable`，整行未恢复。对照两版都是 `correct`。
- **仍开放，归 #2**：r4416771397（拆到两张替换卡）、r4416771405（单字符格子）。`/14` 上仍复现。

### 0.26 联合树 `33f0cdb`：合入 #2 的 `d6e1837`；页码计数只按常规印法读

本项用普通合并提交 `792b6e2` 合入 #2 的 `d6e1837`，没有冲突。相对 `9121819`，产品只改了一处（[`33f0cdb/changed-since-9121819.txt`](33f0cdb/changed-since-9121819.txt)）：`094f3a8`（`+repeat.6`，#2 的 r4417060269），四行 `Page 1`…`Page 4` 中第 3 行改印成 `Page 03` 时，这一行按印出的样子自成变体，`4 → 1`，其余三行作上下文。

**评分器跟进（`33f0cdb`，[r4417210545](https://github.com/wlvh/policy-compare/pull/9#discussion_r4417210545)）**：
- **问题**：评分器把 `03` 和 `3` 都读成“比所在页多 0”，于是第 3 页那行和其余三行成了同一变体。产品这张正确的卡被判 FAIL：“次数不符”“把自己的出现标为上下文”。
- **修复前**：新测试在 `4d6b086` 的评分器上失败，产品用合并后的版本（[日志](33f0cdb/before-fix-4d6b086.log)，123 项中 1 项失败）。
- **改法**：只有按常规印法写的计数（`String(Number(n)) === n`，即没有前导零、`Number()` 能读的数字）才对照所在页读；`03` 或 `Number()` 读不了的数字照印出的样子保留。判断一个位置的计数是否随页走，也只看这种计数。
- **对照**：同一张卡把新侧次数改成 4（把上下文也算进去），判 FAIL。

**联合验收**（产品与评分器都变了，全套重跑，证据在 [`33f0cdb/`](33f0cdb/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/14` / `tsc` | 123/123、300/300、47/47、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告都与 `4d6b086` 逐项相同，只差提交号（[`compare-with-4d6b086.txt`](33f0cdb/compare-with-4d6b086.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`33f0cdb/register.json`](33f0cdb/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取（[`33f0cdb/renewal/compare.txt`](33f0cdb/renewal/compare.txt)）：四份结果的卡片与 `4d6b086` 逐字段相同，只差 `coreVersion`；`/14` 下逐事件不变 |

**给 #2 的建议**：变体的定义（空白、页码计数的读法）这几轮在产品与评分器两边各改了一次，每次都是一方先改、另一方的正确输出随即被判错。今后改这类共同定义，先把新写法写进契约 `FactSchema`/`RepeatSchema` 的注释，并在交接里点明，另一方据此同步。

### 0.27 联合树 `9ed97f2`：两条评分器发现；合入 #2 的分诊 `/15` 与两处产品修复

**评分器修复**（`2084fc2`、`9ed97f2`；修复前日志：[`9ed97f2/before-fix-935b6e4.log`](9ed97f2/before-fix-935b6e4.log)。本轮的测试文件在 `935b6e4` 的评分器上 124 项中 4 项失败）

| 发现 | 修复前（`935b6e4`） | 改法 | 修复后 |
|---|---|---|---|
| [r4416805143](https://github.com/wlvh/policy-compare/pull/9#discussion_r4416805143)：同一处出现列了两次 | 四页页眉 `USD 1000 → USD 2000`，产品给一张 Replaced 卡，计 4/4。把第一处出现再列一次，两侧次数都改成 5：**PASS，没有错误** | 一侧有两处出现引用同一个源字符（同页、同 `charId`）时，就是一处出现列了两次，判 FAIL，并写明哪一侧 | FAIL：“左侧（右侧）两处出现引用了同一批源字符”。产品的四份续保结果中，没有一处出现与另一处共用源字符 |
| [r4416542441](https://github.com/wlvh/policy-compare/pull/9#discussion_r4416542441)：页码事实不核对适用范围 | 正文一句话（y=300）`Refer to Page 3 …` → `Page 4 …`，卡片陈述 `page_number_only`：**PASS** | 先照旧重算文字形式，来源否定的仍判 FAIL。成立时还要有来源能证明的范围。契约允许三种：重复的页面行、标题行、页边行。来源只能证明第一种：卡片自己的文字按它引用的出现，印在一份文档的两页或更多页上；重复列出的出现只算一页。标题、页边的角色只靠 PDF 来源定不下来，所以在其他行上这条陈述无法评价（`claim_unverifiable`），不判 PASS | NOT_EVALUATED，原因写明“只有页码不同，但来源没有显示这是重复的页面行；标题行或页边行无法从来源确定”。对照：同一张卡不陈述该事实时 PASS；文字形式被来源否定时仍 FAIL |

**代价**（已写入第 5 节）：产品在单独一行的标题或页边行上也会陈述 `page_number_only`（探针：`Schedule Page 3` → `Schedule Page 4`），评分器现在对它也记“无法评价”。当前 32 对规则用例都没有陈述这条事实。续保结果里陈述它的只有一张卡，是重复的 `Page n of N` 行，评分器接受。

**合入 #2**：本项用普通合并提交 `6ac4600` 合入 #2 的 `5989361`，没有冲突。#2 已在 `76e3c29` 合入本项的 `9121819`。相对 `935b6e4`，有以下改动（[`9ed97f2/changed-since-935b6e4.txt`](9ed97f2/changed-since-935b6e4.txt)）：
- **分诊 `/15`**（`e4b9dfd`）修了三条：
  - [r4416771397](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416771397)：分开的删除卡、新增卡之间没有同卡对齐，所以每张卡都要改动作者改动的那部分；
  - [r4416771405](https://github.com/wlvh/policy-compare/pull/11#discussion_r4416771405)：每个非空的作者格都要核对，单字符格也算；
  - [r4417192877](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417192877)：作者格各占原文中不重叠的一段。

  独立复核（[`9ed97f2/probes/`](9ed97f2/probes/)），三条在 `/14` 上依次判 `split_attributable`、`correct`、`correct`，在 `/15` 上依次为 `not_evaluable`、`partly_located`、`partly_located`。各对照在两版上相同，包括“删除卡加新增卡”仍为 `split_attributable`。三个线程已回复并关闭。
- **产品**：
  - `b43de6a`（`+row-identity.13`，r4417210539）：带编号限定词的标识列名（`Serial No.`）另起一张表；
  - `5989361`（`+repeat.7`，r4417244277）：只在一侧出现的重复行也按变体分组。四页 `Draft` 中第 3 页是 `Draft ` 时，分成 `Draft` 3 处与 `Draft ` 1 处。

  评分器的对照（探针）：用当前评分器评 #2 修复前（`b43de6a`）的产品输出，判 FAIL（卡片计 4，自己的文字只有 3 处）；评修复后的产品输出，判 PASS。可见评分器与产品对“变体”的含义一致。
- **评分器线程**：
  - [r4416878298](https://github.com/wlvh/policy-compare/pull/9#discussion_r4416878298)：`4d6b086` 已随 `9121819` 进入 PR #9，已关闭。按 Codex 原输入（第三行 `USD1000`）跑了探针：`f0173ed` 判 FAIL，现在判 PASS。
  - r4416542441、r4416805143、[r4417210545](https://github.com/wlvh/policy-compare/pull/9#discussion_r4417210545)（`Page 03`，`33f0cdb`）：已回复修复，等 #2 合入后关闭。

**联合验收**（产品、分诊与评分器都变了，全套重跑，证据在 [`9ed97f2/`](9ed97f2/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/15` / `tsc` | 124/124、303/303、50/50、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10（PASS 行与 `33f0cdb` 相同） |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告都与 `33f0cdb` 逐项相同，只差提交号（[`compare-with-33f0cdb.txt`](9ed97f2/compare-with-33f0cdb.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`9ed97f2/register.json`](9ed97f2/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取（[`9ed97f2/renewal/compare.txt`](9ed97f2/renewal/compare.txt)）：四份结果的卡片与 `33f0cdb` 逐字段相同，只差 `coreVersion`。旧产品配 `/15` 与配 `/14`、新产品配 `/15` 与旧产品配 `/15` 相比，逐事件的判定、接受的卡、行标记、写出的证据都不变。航空 #87、#88、#89、#93 在 `/15` 更严的拆分规则下仍是 `split_attributable` |

### 0.28 联合树 `74707bd`：评分器再修三处；合入 #2 的分诊 `/16` 与两处产品修复

**评分器修复**（每项都先用最小输入复现，修复前日志在对应证据目录）

| 提交 | 发现 | 修复前 | 改法 |
|---|---|---|---|
| `b6aa2c8` | 与 #2 的分诊发现 [r4417384098](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417384098) 同根：事件文字两端的数字须是来源里的完整数字，但这项检查只看数字和数字中间的 `.`、`,` | 卡片新值是 `-200`（或 `−200`）时，仍算作显示了事件的 `200 included`：归属成立，PASS（[`b6aa2c8/before-fix-5ff1913.log`](b6aa2c8/before-fix-5ff1913.log)，124 项中 1 项失败） | 与金额规则（`f0173ed`）一致：紧贴在数字前的 `-`、`−`、`+` 属于这个数字；如果符号本身紧跟在字母、数字、`.` 或 `,` 后面（`1-200`、`SYN-1026`），就不算符号。规则与浏览器规则报告与 `9ed97f2` 逐项相同（[`b6aa2c8/`](b6aa2c8/)） |
| `4c8537d` | [r4417386694](https://github.com/wlvh/policy-compare/pull/9#discussion_r4417386694)：页码事实在比较遮掉数字后的文字前，先合并了空白 | `Schedule coverage Page 1 of 10` → `Page   2 of 10`：在 `b6aa2c8` 上文字形式成立，只记“范围无法确定”（NOT_EVALUATED，[`74707bd/before-fix-pagews-b6aa2c8.log`](74707bd/before-fix-pagews-b6aa2c8.log)，124 项中 1 项失败）；在 `935b6e4` 上判 PASS | 遮掉数字后的文字逐字比较，空白也算，与产品的 `maskedPageNumbers()` 相同。卡片陈述的事实被来源否定，判 FAIL |
| `c4a378a` | #2 的 `91366d2`（[r4417303223](https://github.com/wlvh/policy-compare/pull/9#discussion_r4417303223)）的正确输出被判错：旧版每页都印 `Page 1`，新版 `Page 1`…`Page 4`，产品给一张卡，计 4 → 4 | 评分器判 FAIL，原因是“次数不符”（[`a2dbe21/before-fix-perside-a2dbe21.log`](a2dbe21/before-fix-perside-a2dbe21.log)，两个方向都失败）。原因：评分器对两侧一次性决定某个计数位置“随页走”，于是旧版固定的 `Page 1` 也按页读，每页成了不同的变体。这与它自己的定义（固定的计数照印出的样子）相矛盾 | 每侧按卡片在本侧引用的出现自己判断：值不同且与页码差一个固定值，就是随页走；同一个值出现在两页或更多页，就是固定；两者都不是，才沿用另一侧的读法。这与产品一致：产品先用本文档的重复行特征，再用另一文档的。对照：把旧侧次数改成 1，仍判 FAIL |

**合入 #2**（普通合并，没有冲突）：
- `3b40ae3` 合入 `6f68277`：产品 `91366d2`（`+repeat.8`，即上表的 r4417303223）及 #2 的报告。
- `d2b972d` 合入 `8f63087`：
  - 产品 `a6c8858`（`+row-identity.14`，[r4417386686](https://github.com/wlvh/policy-compare/pull/9#discussion_r4417386686)）：表头要以标识名结尾，才算标识列（`Registration Status` 不算）。
  - 分诊 `/16`。

**分诊 `/16` 的独立复核**（[`74707bd/probes/`](74707bd/probes/)；三个线程已回复并关闭）

| 发现 | `/15` | `/16` |
|---|---|---|
| [r4417329496](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417329496)：替换行 `1315 \| USD 100 \| USD 100 \| Alpha`，卡片只显示一个金额格 | `correct`，整行已恢复 | `correct`（作者的金额改动已定位），**整行未恢复** |
| [r4417384098](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417384098)：作者格 `100`，卡片显示 `-100`（新增、删除两种） | `correct`，整行已恢复 | **`partly_located`**，整行未恢复 |
| [r4417384107](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417384107)：作者行 `1315 \| A \| A B \| B B`，卡片原样是 `1315 A A B B B`（`/15` 引入的假“不完整”） | `partly_located` | **`correct`**，整行已恢复 |

各对照在两版上相同。`/15` 修过的三条（拆到两张替换卡、单字符格、重叠的格）在 `/16` 上结果不变。

**中间树 `a2dbe21`**（产品 `91366d2`，评分器到 `4c8537d`；证据在 [`a2dbe21/`](a2dbe21/)）：
- 全套重跑，规则与浏览器规则报告与 `9ed97f2` 逐项相同，续保逐事件不变。
- 浏览器完整测试：MuPDF 16/16；PDF.js 15/16。F7 是 `deploy/server.mjs` 的缓存头测试，在服务器重启后的一次 `fetch` 上超时（60 秒）。自 `5ff1913` 起，`deploy/`、`tests/browser/`、`apps/` 都没改过。单独重跑一次通过（0.4 秒，[日志](a2dbe21/browser-pdfjs-F7-rerun.log)）。在最终树 `74707bd` 上完整套件两引擎各 16/16。

**联合验收**（产品、分诊与评分器都变了，全套重跑，证据在 [`74707bd/`](74707bd/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/16` / `tsc` | 125/125、306/306、53/53、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10（PASS 行与 `9ed97f2` 相同） |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告都与 `a2dbe21`、`9ed97f2` 逐项相同，只差提交号（[`compare-with-a2dbe21.txt`](74707bd/compare-with-a2dbe21.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`74707bd/register.json`](74707bd/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取（[`74707bd/renewal/compare.txt`](74707bd/renewal/compare.txt)）：四份结果的卡片与 `a2dbe21`、`9ed97f2` 逐字段相同，只差 `coreVersion`。旧产品配 `/16` 与配 `/15`、新产品配 `/16` 与旧产品配 `/16` 相比，逐事件都不变 |

**评分器线程**：PR #9 上的 r4416542441、r4416805143、r4417210545、r4417386694 已回复修复；#2 在 `9582515` 合入本树后已关闭。

### 0.29 联合树 `7d47980`：合入 #2 的 `9582515`

本项用普通合并提交 `7d47980` 合入 #2 的 `9582515`，没有冲突。`9582515` 已合入本项的 `74707bd`，所以上面各节的评分器修复都已进入 PR #9；PR #9 上的五条评分器线程都已关闭。相对 `3524d14`，只有一处产品改动（[`7d47980/changed-since-3524d14.txt`](7d47980/changed-since-3524d14.txt)）：`6eb647d`（`+row-identity.15`，[r4417493798](https://github.com/wlvh/policy-compare/pull/9#discussion_r4417493798)），同一页上重复出现的表头行另起一张表。评分器的身份核验只取 layout.json 中文字块的路径，不读表头，没有对应的问题。

**联合验收**（产品变了，全套重跑，证据在 [`7d47980/`](7d47980/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/16` / `tsc` | 125/125、307/307、53/53、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10（PASS 行与 `74707bd` 相同） |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告都与 `74707bd` 逐项相同，只差提交号 |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`7d47980/register.json`](7d47980/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取（[`7d47980/renewal/compare.txt`](7d47980/renewal/compare.txt)）：四份结果的卡片与 `74707bd` 逐字段相同，只差 `coreVersion`；逐事件不变 |

### 0.30 联合树 `630a2af`：合入 #2 的分诊 `/17`

本项用普通合并提交 `630a2af` 合入 #2 的 `c14276c`（`renewal-triage/17`），没有冲突。产品、评分器代码与 `7d47980` 相同；评分器只多了一项测试（`e2f90c9`）：`-100 → -200` 的卡不是事件 `100 → 200`。这种卡在 `b6aa2c8` 起的评分器上判 FAIL，在 `5ff1913` 上判 PASS。

**分诊 `/17` 的独立复核**（[`630a2af/probes/`](630a2af/probes/)）

| 发现 | `/16` | `/17` |
|---|---|---|
| [r4417511075](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417511075)：卡片把 `USD 100` 的位置列了两次，作者行 `1315 \| USD 100 \| USD 100` | `correct`，整行已恢复 | **`not_evaluable`**，整行未恢复（与只列一次相同） |
| [r4417560178](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417560178)：替换行 `100 → 200`，卡片 `-100 → -200` | `correct`，接受 | **`not_located`**，不接受；对照 `100 → 200`、`Hull-100 → Hull-200` 为 `correct` |

两线程已回复并关闭。另有两条新发现，在 `/17` 上复现，留给 #2：
- [r4417631502](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417631502)：单卡替换路径不核对段落归属，Liability 段落的卡被当成 Hull 事件，判 `correct`。评分器要求出现落在事件自己的文字块上，没有这个问题。
- [r4417631513](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417631513)：相同格子的分配是穷举，10 个格子约 5 秒，每多一格约慢十倍。实测四次续保分诊每次 6–10 秒；`/14`（还没有分配逻辑）与 `/16`、`/17` 耗时相同，可见当前真实数据不受影响。

| 检查 | 结果 |
|---|---|
| scorer / Python 分诊 `/17` | 125/125、55/55 |
| 续保 | 产品未变，用 `7d47980` 的四份结果按 `/17` 重新分诊（[`630a2af/renewal/compare.txt`](630a2af/renewal/compare.txt)）：与 `/16` 相比逐事件不变 |
| 规则、浏览器、构建 | 产品与评分器代码未变，本地未重跑，沿用 `7d47980`；CI 在本提交上全套运行 |

### 0.31 联合树 `8d1f1ea`：合入 #2 的分诊 `/18` 与表格边界修复

本项用普通合并提交 `8d1f1ea` 合入 #2 的 `be1ed04`，没有冲突。评分器未改。相对 `7ada38e`（[`8d1f1ea/changed-since-7ada38e.txt`](8d1f1ea/changed-since-7ada38e.txt)）有两处改动：
- **产品** `402f82d`（`+row-identity.16`）：
  - [r4417587174](https://github.com/wlvh/policy-compare/pull/9#discussion_r4417587174)：带限定词的标识表头（`Aircraft Registration`）出现在表内时，结束上一张表。
  - r4417643759：文字相同的行只在标识格也相同时按“唯一精确”配对。
- **分诊 `/18`** `be1ed04`：
  - [r4417631502](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417631502)：单卡替换的段落事件，要求两侧对齐的出现周围有作者段落，否则记 `same_card_context_unconfirmed`，即无法评价。
  - [r4417631513](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417631513)：相同格子按原文顺序分配。

**独立复核**（[`8d1f1ea/probes/`](8d1f1ea/probes/)）

| 发现 | `/17` | `/18` |
|---|---|---|
| r4417631502：Liability 段落的卡对 Hull 事件 | `correct`，接受 | **`not_evaluable`**，不接受，1 张未解释；对照（Hull 自己的卡）`correct` |
| r4417631513：`allocate(['0'] * 10, …)` | 4.74 秒 | **约 0 秒** |
| [PR #11 评论 6507993515](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6507993515)：拆到两张卡时，段落上下文取自未改动的单元 | `split_attributable`，两张都接受 | **仍是 `split_attributable`**，未修，留给 #2 |

**续保的代价**：产品未变，所以 `/17` → `/18` 的变化全部来自分诊（[`8d1f1ea/renewal/compare.txt`](8d1f1ea/renewal/compare.txt)）。两引擎相同，共 4 个事件由 `correct` 变为 `not_evaluable`（原因：卡片自己的单元里没有作者段落）：

| 事件 | 卡片 | 说明 |
|---|---|---|
| 航空 #46（coding） | `AW 62%, AX 23%, WAR 15%` → `AW 60%, AX 25%, WAR 15%` | 卡片只有改动的值，标签在另一个单元 |
| 航空 #47（brokerage） | `No. FEE PAYABLE BY CLIENT? 17.5% of gross premium.` → `… 15.0% …` | 卡片带的是另一个标签 |
| 商务航空 #2（umr） | `B0731AVNGN2240088` → `…2250088` 等三张 | 同上，只有值 |
| 商务航空 #37（origin） | `Isle Of Man` → `Isle of Man` | 同上 |

这些卡按人工读法大概率是对的；现在只是无法自动确认归属，不是错误陈述。航空 #1（umr）仍判 `correct`，但不再接受 `UMR: …/…` 那张页眉卡：那是另一个段落做了同样的改动，正是 Codex 反例在真实数据里的样子。其余列出的事件只有写出的 `candidates` 字段不同，判定和接受的卡都不变。

**联合验收**（产品、分诊变了，全套重跑，证据在 [`8d1f1ea/`](8d1f1ea/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/18` / `tsc` | 125/125、310/310、57/57、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10（PASS 行与 `7d47980` 相同） |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `7d47980` 逐项相同，只差提交号 |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`8d1f1ea/register.json`](8d1f1ea/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取：卡片与 `7d47980` 逐字段相同，只差 `coreVersion`。产品改动逐事件不变；分诊 `/18` 的变化见上表 |

### 0.32 联合树 `b3e84c8`：合入 #2 的 `441a81d`（分配耗时的第二次修复）

本项用普通合并提交 `b3e84c8` 合入 #2 的 `441a81d`，只改分诊（`scripts/renewal-triage.py` 及其测试），产品、评分器代码与 `8d1f1ea` 相同。之后又用 `1a754fc` 合入 #2 的 `50da244`（只有 `reports/`），两个分支在 `reports/` 以外完全相同。

**更正**：第 0.31 节和 [r4417631513](https://github.com/wlvh/policy-compare/pull/11#discussion_r4417631513) 线程里，我只测到 10 个相同格子就判定 `be1ed04` 已修复并关闭了线程，测得太少。#2 自己发现，`be1ed04` 去掉的只是排列组合的搜索，仍然是 2 的 n 次方。本项按同一探针复测（[`b3e84c8/probes/alloc-time-probe.log`](b3e84c8/probes/alloc-time-probe.log)）：

| n 个相同格子 | `be1ed04` | `441a81d` |
|---|---|---|
| 20 | 1.32 秒 | 0.001 秒 |
| 24 | 22.4 秒 | 0.002 秒 |
| 50 | 40 秒未完成 | 0.004 秒 |

| 检查 | 结果 |
|---|---|
| Python 分诊 / scorer | 57/57、125/125 |
| 已修发现的探针 | 结果与 `be1ed04` 相同；[PR #11 评论 6507993515](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6507993515)（拆到两张卡时，上下文取自未改动的单元）仍复现，留给 #2 |
| 新发现 [PR #11 评论 6508515495](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6508515495) | 卡片把 `USD 100,000` 拆成相邻的两段 `[0, 17)`、`[17, 21)`（在逗号前切开）。分诊拼接时插入空格，得到 `USD 100 ,000`，于是作者格 `USD 100` 判 `correct`、整行已恢复（新增、删除两种都是）；同样的文字作为一处位置时判 `partly_located`。在 `441a81d` 上复现（[探针](b3e84c8/probes/split-number-triage-probe.log)），留给 #2。评分器按来源字符顺序判断数字边界，不受影响 |
| 续保 | 用 `8d1f1ea` 的四份产品结果重新分诊（[`b3e84c8/renewal/compare.txt`](b3e84c8/renewal/compare.txt)）：逐事件不变 |
| 规则、浏览器、构建 | 产品与评分器代码未变，本地未重跑，沿用 `8d1f1ea`；CI 在本提交上全套运行 |

### 0.33 联合树 `9354b84`：合入 #2 的分诊 `/19` 与两处表格修复

本项用普通合并提交 `9354b84` 合入 #2 的 `7847d7d`，没有冲突。评分器未改。相对 `c2b4fe6`（[`9354b84/changed-since-c2b4fe6.txt`](9354b84/changed-since-c2b4fe6.txt)）有以下改动：
- **分诊 `/19`** `4f38eda`：卡片一起列出的相邻位置按一个词拼接，不再插入空格；整行恢复只读该记录自己的单元。
- **产品** `69f896d`、`dfb487f`（`+row-identity.18`）：
  - 只写标识名、没有值的行作表头；
  - 重复的记录按标识列分组；
  - 身份表头下的取值类单元格只用来防止错误绑定，不用来建立链接。

**分诊 `/19` 的独立复核**（[`9354b84/probes/`](9354b84/probes/)）

| 发现 | `/18`（`441a81d`） | `/19` |
|---|---|---|
| [PR #11 评论 6508515495](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6508515495)：`USD 100,000` 拆成相邻两段 | `correct`，整行已恢复 | **`partly_located`**，整行未恢复；与一段位置时相同 |
| [PR #11 评论 6508818754](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6508818754)：整行恢复借用同卡另一记录（`1760 Alpha`）的格子 | `correct`，整行已恢复 | `correct`，**整行未恢复**；对照（`1315 Alpha` 在自己的单元）仍为整行已恢复 |
| [PR #11 评论 6507993515](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6507993515)：拆到两张卡时，上下文取自未改动的单元 | `split_attributable` | **仍是 `split_attributable`**，未修，留给 #2 |

此前各条已修发现的探针，在 `/19` 上的结果都不变。

**评分器对产品新发现的交叉核对**（PR #9 [r4418530241](https://github.com/wlvh/policy-compare/pull/9#discussion_r4418530241)，产品问题，归 #2）：画像声明的重复页眉 `REPEATED HEADER LIMIT: Page 1…4`，最后一页改成 `Page 5`。产品给出删除 `Page 4`、新增 `Page 5` 两张卡，各计 1 次。评分器判 FAIL（次数不符，并把自己的出现标为上下文）。普通页眉作对照判 PASS（[探针](9354b84/probes/declared-counter-probe.log)）。可见评分器按契约的定义独立拒绝了这类输出。

**联合验收**（产品、分诊变了，全套重跑，证据在 [`9354b84/`](9354b84/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/19` / `tsc` | 125/125、314/314、59/59、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10（PASS 行与 `8d1f1ea` 相同） |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `8d1f1ea` 逐项相同，只差提交号 |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`9354b84/register.json`](9354b84/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取（[`9354b84/renewal/compare.txt`](9354b84/renewal/compare.txt)）：卡片与 `8d1f1ea` 逐字段相同，只差 `coreVersion`；分诊 `/18` → `/19`、产品改动，逐事件都不变 |

### 0.34 联合树 `91aa884`：合入 #2 的分诊 `/20` 与身份列、页眉计数修复

本项用普通合并提交 `91aa884` 合入 #2 的 `6060f6c`，没有冲突。评分器未改。相对 `505d3a7`（[`91aa884/changed-since-505d3a7.txt`](91aa884/changed-since-505d3a7.txt)）有以下改动：
- **分诊 `/20`** `ce7df65`：
  - 段落上下文只取自承载改动的单元；
  - 卡片完整包含的非空作者段落本身就算上下文，即使它就是改动本身；
  - 页码事实只遮掉完整数字；
  - 日期事实要求真实日期。
- **产品**：
  - `7e36311`、`59134bf`（`+row-identity.20`）：标识列的冲突键保持稳定；标题按 NFKC 读；关闭的表各自成范围；描述性表头下的单元格不算标识。
  - 同一批里（`+repeat.9`）：画像声明的页眉保留页码计数。

**独立复核**（[`91aa884/probes/`](91aa884/probes/)）

| 发现 | 修复前 | `/20` 或 `6060f6c` |
|---|---|---|
| [PR #11 评论 6507993515](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6507993515)：拆到两张卡时，上下文取自未改动的单元 | `split_attributable`，两张都接受（`/16`–`/19`） | **`not_evaluable`**，不接受；对照（Hull 自己的卡）`correct` |
| [PR #11 评论 6509794672](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6509794672)：整段改动 `Pay now.` → `Pay later.`，删除卡加新增卡 | `not_evaluable`，2 张未解释（`/18`、`/19`） | **`split_attributable`**，两张都接受；对照不变 |
| [PR #11 评论 6509987949](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6509987949)：`Page 1.1 → 2.1`、`Page 100,000 → 200,000`、`of 10,5 → 11,5` | 分诊 `consistent`；评分器 `false`（自 `680914f`） | 分诊 **`contradicted`**，与评分器一致；对照仍 `consistent` |
| PR #9 [r4418530241](https://github.com/wlvh/policy-compare/pull/9#discussion_r4418530241)：画像声明的页眉 `Page 1…4` → 最后 `Page 5` | 产品给删除、新增两张卡，评分器 FAIL | 产品给一张替换卡 `Page 1 → Page 5`，计 `4 → 1`；**评分器 PASS** |

此前各条已修发现的探针，在 `/20` 上的结果都不变。

**续保**（[`91aa884/renewal/compare.txt`](91aa884/renewal/compare.txt)）：
- 产品改动下逐事件不变。
- 分诊 `/19` → `/20` 只改了一个事件，两引擎相同：航空 #6（`HOWEVER:` → `However:`，作者改动就是整段）由 `not_evaluable` 变为 `split_attributable`。
- 被接受的是一张删除卡（`HOWEVER:`），以及在 Combined Single Limit 那张卡末尾插入的 `However:`。每张卡各带改动的一侧，审阅时需要配对。

**联合验收**（产品、分诊变了，全套重跑，证据在 [`91aa884/`](91aa884/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/20` / `tsc` | 125/125、318/318、63/63、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；7/7、10/10（PASS 行与 `9354b84` 相同） |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `9354b84` 逐项相同，只差提交号 |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`91aa884/register.json`](91aa884/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |
| 续保四次比较 | 重新提取：卡片与 `9354b84` 逐字段相同，只差 `coreVersion`；分诊只改航空 #6（见上） |

仍开放、归 #2：PR #9 的 [r4418900383](https://github.com/wlvh/policy-compare/pull/9#discussion_r4418900383)（右对齐的标识值与表头字形不重叠）。

### 0.35 金额格内只改正负号：卡片编辑的金额格按整格金额比较（`16ae858`）

**发现**（[PR #11 评论 6511081378](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6511081378)）：约定价值格 `-100,020` → `+100,020`，卡片的操作只改了正负号这一个字形，`-` → `+`。这张卡有来源支撑，`agreed_value_unchanged` 却判 PASS。原因有三：
- 卡片文字里没有金额；
- 声称的文字 `-`、`+` 也不是金额，而 `rest()` 去掉了符号；
- 卡片引用的金额格只贡献未声明的裸整数（`bare()`），带千分位的 `-100,020` 不计。

**修复前**：用 `32f357e` 的评分器跑本轮测试文件，只改正负号的卡判 **PASS**（[`16ae858/before-fix-32f357e.log`](16ae858/before-fix-32f357e.log)，125 项中 1 项失败）。

**改法**：对卡片操作所编辑的金额格（每格计一次），比较两侧该格的整格金额；适用于替换卡，以及一条记录（或无记录池）里的删除卡加新增卡。这一比较出现本例不允许的变化时，按普通金额变化判 FAIL。金额不变的格不受影响。

**对照**：
- 只改千分位分隔符（`100,020` → `100.020`），修复前就已判 FAIL：新格的 `100.020` 按裸数字读到了。
- 同一处正负号改动写成该记录的删除卡加新增卡，现在也判 FAIL。

**验证**（`16ae858`；产品同 `91aa884`；证据在 [`16ae858/`](16ae858/)）：

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / `tsc` | 125/125、318/318、0 |
| 构建（两引擎） | 通过 |
| 规则与浏览器规则（两引擎） | 退出码 2：严格 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；与 `91aa884` 逐项相同，只差提交号（[`compare-with-91aa884.txt`](16ae858/compare-with-91aa884.txt)） |

**分诊的新发现**（[PR #11 评论 6510958743](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6510958743)，归 #2）：作者段落与另一处被改的金额同在一个单元，两张只改 Liability 金额的卡被判为 Hull 事件的 `split_attributable`。在 `/20` 上复现（[探针](16ae858/probes/same-unit-context-triage-probe.log)），留给 #2。评分器不受影响，原因有二：卡片按两份 PDF 核对位置，第二张卡的旧侧 `Liability USD 999` 在旧文档里不存在；两张替换卡从不配对。

### 0.36 联合树 `cedf563`：合入 #2 的分诊 `/21` 与两处表格身份修复

本项用普通合并提交 `cedf563` 合入 #2 的 `72eb95f`，没有冲突。评分器未改。相对 `0c9534a`（[`cedf563/changed-since-0c9534a.txt`](cedf563/changed-since-0c9534a.txt)）有以下改动：
- **分诊 `/21`** `72eb95f`：
  - 整段作者段落只有围住被改的那一处时才算上下文；同一单元里别处的同样文字不算。
  - 拆成删除卡加新增卡的行，整行检查的两侧各从持有它的那张卡读；`acceptedRecord` 在两侧来自两张卡时多一个 `rightCard`。
- **产品**：
  - `6cf0ea9`（`+row-identity.21`，r4418900383）：一行有不在任何表头格下的格、而表头的身份列在这一行没有格时，这一行不按身份配对。
  - `74a54b6`（`+row-identity.22`，r4419030685、r4418984410）：一个身份列下落了两个格时，这一行的身份不完整，不按身份配对；不在任何表头格下的格，像不像数值都算可能缺失的标识。

**独立复核**（[`cedf563/probes/`](cedf563/probes/)）

| 发现 | `/20` | `/21` |
|---|---|---|
| [PR #11 评论 6510958743](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6510958743)：作者段落与另一处被改的金额同在一个单元 | `split_attributable`，两张只改 Liability 的卡都接受 | **`not_evaluable`**，不接受；对照（Hull 自己的卡）`correct` |
| [PR #11 评论 6511266424](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6511266424)：完整的删除卡加新增卡 | `split_attributable`，`fullRowRecovered` 假 | `split_attributable`，**`fullRowRecovered` 真**；对照（新增卡缺 `Hull`）仍为假 |
| PR #9 [r4418530241](https://github.com/wlvh/policy-compare/pull/9#discussion_r4418530241)：画像声明的页眉最后一页计数变化（产品 `cedf563`） | — | 产品仍给一张替换卡，计 `4 → 1`；评分器 PASS |

此前各条已修发现的探针，在 `/21` 上的结果都不变。

**续保**（[`cedf563/renewal/compare.txt`](cedf563/renewal/compare.txt)）：
- 产品改动下，四次比较的卡片与 `91aa884` 逐字段相同，只差 `coreVersion`；逐事件不变。
- 分诊 `/20` → `/21` 不改任何事件的结论和接受的卡。只有拆分行的 `fullRowRecovered` 由假变真，两引擎相同：航空 #87、#88、#89、#93，商务航空 #38、#39、#69、#71、#73。这些行的删除卡、新增卡各自带着整行。

**联合验收**（产品、分诊变了，全套重跑，证据在 [`cedf563/`](cedf563/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/21` / `tsc` | 125/125、321/321、65/65、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；PASS 行与 `91aa884` 相同 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `16ae858` 逐项相同，只差提交号（[`compare-with-16ae858.txt`](cedf563/compare-with-16ae858.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`cedf563/register.json`](cedf563/register.json)：直接 10、间接 17、尚未支持 4；没有 FAIL |

### 0.37 重复行的文字只取它自己那几行的字符（`259d797`）

**发现**（[PR #9 评论 6510906577](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6510906577)，#2 转来）：评分器把重复行的一处出现读成“从第一个引用位置到最后一个引用位置之间、按原始顺序的全部字符”。按列抽取的表格里，两个表头格之间夹着本列其他行的数据格，于是表头 `MSN | Operator | Value` 每页都成了不同的变体。产品对“旧 2 页、新 3 页都有这个表头”的正确卡（计 `2 → 3`）因此被判“次数不符”。

**复现**（[`259d797/probes/column-major-probe.log`](259d797/probes/column-major-probe.log)）：同样的页面按行抽取时 PASS，按列抽取时 `cedf563` 的评分器判 FAIL。

**改法**：一处出现的文字，取它引用到的那几行在第一个与最后一个引用字符之间的字符，按原始顺序。行内的空白照原样保留，所以某页多一个空格仍是这一页自己的变体；别的行的字符不算，包括分隔行上推断出来的换行。

**修复前**：本轮测试文件在 `cedf563` 的评分器上 1 项失败，产品的正确卡判 FAIL（[`259d797/before-fix-cedf563.log`](259d797/before-fix-cedf563.log)）。修复后这张卡通过；把它的次数改成 `2 → 2`，仍判 FAIL。

**验证**（`259d797` = 合并 #2 只含报告的 `ba4bbdd`（`c4c5c0b`）之后的评分器修复；产品、分诊同 `cedf563`；证据在 [`259d797/`](259d797/)）：

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 / `tsc` | 126/126、322/322、65/65、0 |
| 构建（两引擎） | 通过 |
| 规则与浏览器规则（两引擎） | 退出码 2：严格 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；与 `cedf563` 逐项相同，只差提交号（[`compare-with-cedf563.txt`](259d797/compare-with-cedf563.txt)） |
| 覆盖登记 | [`259d797/register.json`](259d797/register.json)：与 `cedf563` 相同 |

**分诊的两条新发现**（[PR #11 评论 6511895761](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6511895761)，归 #2；[探针](259d797/probes/moved-and-split-row-triage-probe.log)）：
- **没有文字改动的同页移动**：一张替换卡把段落留在原处、只改后面一句（`Liability excluded.` → `Liability included.`），被判为这次移动的 `correct`。`/20` 上已经如此，不是 `/21` 引入的。续保数据里 7 个没有文字改动的移动事件，接受的都是移动卡（或未定位），所以目前不改变任何真实结论。评分器只接受答案为该事件列出的卡片种类（R12、R13 的移动只认 `Moved`），并且卡片两侧要落在事件的前、后位置上。
- **拆分行的整行检查借用另一条记录**：删除卡、新增卡各含 1315 的单元（`Hull`）和 1760 的单元（`Alpha`），作者行是 `1315 | Alpha`。`/21` 判 `fullRowRecovered` 真，`Alpha` 借自 1760；`/20` 为假。这是 `/21` 新的拆分路径引入的，与单卡上已修的 [6508818754](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6508818754) 同一根因。续保数据里由假变真的 9 行（见 0.36），删除卡、新增卡各只有一个单元，就是这一行自己的，没有可借的格。评分器不报告整行恢复。

### 0.38 联合树 `509b088`：#2 合入了本项的 `c211a31`，再修分诊 `/22`、`/23` 与三处表格身份

#2 先把本项的 `c211a31` 普通合并为 `0f6d9ac`，之后又推了自己的修复，head 是 `509b088`。这个 head 已经包含本项的全部提交，所以本项直接快进到 `509b088`，没有新的合并提交。评分器未改。相对 `c211a31`（[`509b088/changed-since-c211a31.txt`](509b088/changed-since-c211a31.txt)）有以下改动：
- **分诊 `/22`** `cc99133`（[PR #11 评论 6511895761](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6511895761)）：
  - 没有文字改动的移动，只在三种情况下算有证据：卡片报告了移动（`Moved`）；段落在一处删除、在另一处新增；卡片带着这个事件自己的改动。否则记为不可评价。
  - 拆分行的两半各自保留确认了身份的单元，整行检查不再借用别的记录的格。
- **分诊 `/23`** `5410ae8`：
  - 两段相接的原文是否连成一个词，改为看卡片自己的编辑脚本在这个位置是否把两个字符紧挨着放（[PR #11 评论 6512133284](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6512133284)）。
  - 新增、删除段落在另一侧是否“原样保留”，改用整数匹配（[PR #9 评论 6512254699](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6512254699)）。
- **产品**：
  - `d34b3ad`（`+row-identity.23`，r4419250728）：限定的标识表头另一格带年份时，也结束上一张表。
  - `632dc80`（`+row-identity.24`，r4419388482、r4419472067）：身份不完整的两行，只有每个格都在同一表头列或同一表头间隙时，原文相同才算同一记录；没有表头的行里，写明名称、看起来像数值的标识（`Serial AB12.34`）能区分记录，但不用来配对。

**独立复核**（[`509b088/probes/`](509b088/probes/)）

| 发现 | `/21` | `/22` | `/23` |
|---|---|---|---|
| 6511895761 之一：没有文字改动的同页移动，一张只改后一句的替换卡 | `correct`，接受 | **`not_evaluable`**，不接受，1 张未解释；对照（移动卡）`correct` | 同 `/22` |
| 6511895761 之二：拆分行的两张卡都含 1315（`Hull`）和 1760（`Alpha`）的单元 | `fullRowRecovered` 真（借自 1760） | **假**；对照（`1315 Alpha` 在自己的单元）仍为真 | 同 `/22` |
| 6512133284：卡片 `1315 Hull USD 100,000; Note 100 ,000` 在 `[0, 14, 17, 21, 36]` 处分段 | `correct`，`fullRowRecovered` 真 | 同 `/21` | **`partly_located`**，假；新增、删除两种都如此；对照不变 |
| 6512254699：替换卡保留 `Limit USD 1000`、新增（删除）`Limit USD 100` | `not_located` | `not_located` | **`correct`**，接受；对照（另一侧原样保留这一段）仍 `not_located` |

此前各条已修发现的探针，在 `/23` 上的输出与 `/21` 逐行相同（[`earlier-probes-on-23.log`](509b088/probes/earlier-probes-on-23.log)）。

**续保**（[`509b088/renewal/compare.txt`](509b088/renewal/compare.txt)）：
- 产品改动下，四次比较的卡片与 `cedf563` 逐字段相同，只差 `coreVersion`；逐事件不变。
- 分诊 `/21` → `/23`：所有事件的结论、接受的卡、整行标记都不变。只有 9 个拆分行（航空 #87、#88、#89、#93，商务航空 #38、#39、#69、#71、#73）写出的候选证据多了身份判断（`identity`、`identityCells`），两引擎相同。

**联合验收**（产品、分诊变了，全套重跑，证据在 [`509b088/`](509b088/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/23` / `tsc` | 126/126、326/326、70/70、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；PASS 行与 `cedf563` 相同 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `259d797` 逐项相同，只差提交号（[`compare-with-259d797.txt`](509b088/compare-with-259d797.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`509b088/register.json`](509b088/register.json)：与 `259d797` 相同 |

仍开放、归 #2：PR #9 的 [r4419561470](https://github.com/wlvh/policy-compare/pull/9#discussion_r4419561470)（跨页重复的不含数字记录，身份不完整时按同一个键归组）与 [r4419635988](https://github.com/wlvh/policy-compare/pull/9#discussion_r4419635988)（没有表头的行里，`Serial AB12` 与 `S/N AB56` 两种写法的序号不同，仍按 `Insurer Alpha` 配成替换）。

### 0.39 货币符号和币种代码一样算币种（`bae0f9e`）

**发现**（[PR #11 评论 6513014284](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6513014284)）：评分器只认币种代码（`USD`、`EUR` 等）。`€`、`$` 这类货币符号不算币种，`rest()` 又把它们和其他标点一起去掉了。于是两条记录的币种格分别是 `€` 和 `$`、都没有变时，一张有来源支撑的替换卡把第一条的 `€` 配到第二条的 `$` 上，`moneyChanges()` 找不到任何违规，`agreed_value_unchanged` 和 `no_amount_or_currency_change` 都判 PASS。换成 `EUR` 与 `USD`，同样的卡此前就判 FAIL。

**修复前**：本轮测试文件在 `4f9af96` 的评分器上 1 项失败，`€` → `$` 的卡判 PASS（[`bae0f9e/before-fix-4f9af96.log`](bae0f9e/before-fix-4f9af96.log)）。

**改法**：Unicode 货币符号（`\p{Sc}`）在读币种代码的每一处都算币种；紧跟在货币符号后的数字也算金额，和紧跟在代码后一样。

**结果**：
- `€` → `$` 的卡判 FAIL，原因写明“€ to $”；`EUR` → `USD` 仍判 FAIL。
- 两条记录都是 `$` 时，同样的配对不改变币种，不报这项违规。
- 32 个规则用例的原文、版面和答案里都没有货币符号，所以规则结论不会变；报告逐项比对确认相同。

**验证**（`bae0f9e`；产品、分诊同 `509b088`；证据在 [`bae0f9e/`](bae0f9e/)）：

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 / `tsc` | 127/127、327/327、70/70、0 |
| 构建（两引擎） | 通过 |
| 规则与浏览器规则（两引擎） | 退出码 2：严格 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；与 `509b088` 逐项相同，只差提交号（[`compare-with-509b088.txt`](bae0f9e/compare-with-509b088.txt)） |
| 覆盖登记 | [`bae0f9e/register.json`](bae0f9e/register.json)：与 `509b088` 相同 |

### 0.40 日期的日和年必须是完整数字（`4a12cd0`）

**发现**（[PR #11 评论 6513158877](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6513158877)）：评分器读日期时没有要求数字完整。`20240` 被读出 `2024`，`121` 被读出 `21`。产品对 `PERIOD: 1 January 20240 to 31 December 20240` → `… 20250 …`（印出的年份前进了十年）声明了 `dates_rolled_forward_one_year`，评分器也认为这个事实成立：读出的年份各加一，去掉日期后剩下的文字（尾部的 `0`）两侧相同。`121 January 2024`、`1 January 2024.5` 也是这样。

**修复前**：本轮测试文件在 `1344e17` 的评分器上 1 项失败，`20240` 那张卡的事实成立（[`4a12cd0/before-fix-1344e17.log`](4a12cd0/before-fix-1344e17.log)）。

**改法**：日期的日和年必须是原文中的完整数字，规则与页码相同：前后都不能紧挨着数字，也不能是 `.` 或 `,` 再接数字。

**独立复核**（[`4a12cd0/probes/`](4a12cd0/probes/)，产品同 `509b088`）

| 卡片（产品自己的输出） | 产品声明的事实 | `1344e17` 评分器 | `4a12cd0` 评分器 | 分诊 `/23` |
|---|---|---|---|---|
| `20240` → `20250` | `dates_rolled_forward_one_year` | 成立，PASS | **不成立，FAIL** | `contradicted` |
| 日 `121` | 同上 | 成立，PASS | **不成立，FAIL** | `contradicted` |
| 年 `2024.5` → `2025.5` | 同上 | 成立，PASS | **不成立，FAIL** | **`consistent`** |
| 对照：两个完整日期各顺延一年 | 同上 | 成立，PASS | 成立，PASS | `consistent` |

产品的 `datePeriod()` 与 `withoutDates()` 读日期时同样不看数字边界，所以会声明这个错误的事实；分诊的 `DATE` 两端有 `\b`，前两种判对了，但 `2024.5` 的小数尾巴仍判为相符。两处都归 #2。

**验证**（`4a12cd0`；产品、分诊同 `509b088`；证据在 [`4a12cd0/`](4a12cd0/)）：

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 / `tsc` | 128/128、328/328、70/70、0 |
| 构建（两引擎） | 通过 |
| 规则与浏览器规则（两引擎） | 退出码 2：严格 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；与 `bae0f9e` 逐项相同，只差提交号（[`compare-with-bae0f9e.txt`](4a12cd0/compare-with-bae0f9e.txt)） |
| 覆盖登记 | [`4a12cd0/register.json`](4a12cd0/register.json)：与 `bae0f9e` 相同 |

### 0.41 联合树 `9e9104f`：#2 合入了本项的 `26052ad`，再修分诊 `/24` 与日期、表格身份

#2 把本项的 `26052ad` 普通合并为 `9e9104f`，这个 head 包含本项的全部提交，所以本项直接快进到这里。评分器未改。相对 `26052ad`（[`9e9104f/changed-since-26052ad.txt`](9e9104f/changed-since-26052ad.txt)）有以下改动：
- **分诊 `/24`** `3bc22cf`：
  - 日期顺延事实的检查只认完整的日和年（[PR #11 评论 6513158877](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6513158877) 的分诊侧）；
  - 新增、删除的行如果卡片声称属于别的记录（`rowKey`），这一行判为归属错误，不接受这张卡（[PR #11 评论 6513304357](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6513304357)）。
- **产品**：
  - `07210ca`（`+row-identity.25`，r4419561470、r4419635988）：身份不完整的记录跨页重复时，只在每格同列或同间隙时归组；`S/N` 与 `Serial` 用同一个键。
  - `d49f2d3`（`+row-identity.26+facts.5`，r4419741864、r4419804273，以及 6513158877 的产品侧）：日期的日和年按完整数字读，识别与遮掩都是；身份不完整时，同位置的格还要原文相同才算同一记录。

**独立复核**（[`9e9104f/probes/`](9e9104f/probes/)）

| 发现 | `/23` 或 `509b088` | `/24` 或 `9e9104f` |
|---|---|---|
| 6513304357：新增（删除）卡含 `1315 Hull USD 100` 但声称 `rowKey: "1760"` | `correct`，接受，整行完整 | **`misattributed`**，不接受，1 张未解释；声称 `1315` 或不声称的对照仍 `correct` |
| 6513158877 分诊侧：`fact_check()` 对 `2024.5` → `2025.5` | `consistent` | **`contradicted`**；`20240`、`121` 仍 `contradicted`；完整日期对照仍 `consistent` |
| 6513158877 产品侧：`20240`、`121`、`2024.5` 三张卡 | 产品声明 `dates_rolled_forward_one_year` | **产品不再声明**；完整日期对照仍声明，评分器判成立 |

此前各条已修发现的分诊探针，在 `/24` 上的输出与 `/23` 逐行相同（[`earlier-probes-on-24.log`](9e9104f/probes/earlier-probes-on-24.log)）。

**续保**（[`9e9104f/renewal/compare.txt`](9e9104f/renewal/compare.txt)）：产品改动下，四次比较的卡片与 `509b088` 逐字段相同，只差 `coreVersion`；分诊 `/23` → `/24` 与产品改动都不改变任何事件的任何字段，两引擎相同。

**联合验收**（产品、分诊变了，全套重跑，证据在 [`9e9104f/`](9e9104f/)）

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/24` / `tsc` | 128/128、332/332、71/71、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；PASS 行与 `509b088` 相同 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `4a12cd0` 逐项相同，只差提交号（[`compare-with-4a12cd0.txt`](9e9104f/compare-with-4a12cd0.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`9e9104f/register.json`](9e9104f/register.json)：与 `4a12cd0` 相同 |

仍开放、归 #2：PR #9 的 [r4419941396](https://github.com/wlvh/policy-compare/pull/9#discussion_r4419941396)（标签与值分成两条抽取行的页眉，丢了页码计数信息）。

### 0.42 联合树 `211a705`：页码事实只看文字形式；未决标记不让正确标签算作已确定；合入 #2 的分诊 `/26`

依据用户在 [PR #11 评论 6514251883](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514251883) 的 A、B 两项（PR #9 [评论 6514246431](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6514246431) 同一内容）。三个代码提交：

| 提交 | 内容 | 证据 |
|---|---|---|
| `1e44d4d` | 快进到 #2 的 `cb27454`（分诊 `/25`，产品 `+row-identity.27`），加本项的 A | [`1e44d4d/`](1e44d4d/) |
| `af046a3` | 本项的 B（评分器一侧） | 测试与规则在 `211a705` 上 |
| `211a705` | 普通合并提交，合入 #2 的 `9b57000`：分诊 `/26`（B 的分诊一侧，`5b1ad54`）；契约注释改成共同定义（`9b57000`，不改行为与版本）。**联合验收的固定 SHA** | [`211a705/`](211a705/) |

**A：页码事实只看文字形式（`1e44d4d`）。**
- **原来的做法**：`2084fc2` 给 `page_number_only` 加了一个前提，要求卡片自己的文字按它引用的出现印在两页或更多页上（“重复的页面行”）。单独一行的标题、页边行或正文，即使文字形式成立，也记“无法评价”。
- **共同定义**：见 #2 处置表 D.0 第十一轮，以及 `9b57000` 的 `FactSchema` 注释。这个事实只由两段文字决定：
  - 两段文字只差显式 `Page n`、`Page n of N`、`Page n/N` 表达中的完整数字；
  - 只在一侧的文字，只含这类表达和空白。

  行的角色既不能证明这个事实，也不是它的条件。那个前提是本项多加的假设，现在撤掉。
- **不变的部分**：
  - 产品在哪些行给出这个事实（重复页面行、标题行、页边行）仍是产品自己的范围。
  - 事实成立不等于控制用例允许这处变化。控制用例只允许答案声明的事件：未声明的形式变化（来源证明只是形式变化，或无法判断是否只是形式变化）仍记 NOT_EVALUATED，不判 PASS；其他未声明的内容变化判 FAIL。
  - `Page 1.1`、只在一侧的 `Draft Page 2`、同一处出现列两次，仍判 FAIL。
- **修复前**：测试文件在 `cb27454` 的评分器上 3 项失败（[`1e44d4d/before-fix-cb27454.log`](1e44d4d/before-fix-cb27454.log)）。
- **Codex 的同类发现**：Codex 在 PR #9 的 [评论 6514411176](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6514411176) 指的也是这个前提。它看的是 #2 的 `9b57000`，那里的评分器还是 `cb27454` 的版本。
  - 产品对单页的 `Page 1` → `Page 2`、`Schedule Page 3 of 10` → `Schedule Page 3 of 11` 给出带此事实的卡。这些卡在 `cb27454` 的评分器上记 `claim_unverifiable`，在 `211a705` 上 PASS。
  - 对照：`Draft Page 1` → `Final Page 2` 产品不陈述这个事实。
  - 见 [`211a705/probes/page-number-probe.log`](211a705/probes/page-number-probe.log)。

**B：未决标记盖不住明确的错误，也不让正确标签算作已确定。**
- **评分器一侧（本项，`af046a3`）**：
  - 契约说 `confidence: "unresolved"` 表示“对应关系没有确定”。评分器原来只在 `rowKey` 同时为空时，才把卡读成显式未决。
  - 所以一张卡写着声明的序列号（或正确的当事方字段）、同时标 `unresolved` 时，被读成“已确定”。结果是：R22、R11 通过了一个结果自己声明未确定的身份；R26 把“复核”算成了“确定”。
  - 现在先查错误身份：别的记录的键或当事方，不论置信度，都判错误声明。然后看未决标记：标了未决，正确标签只是候选，不算确定，只在答案允许显式复核时才接受。
  - 产品只在 `rowKey`、`entity` 都为空时才标 `unresolved`，所以真实产品卡没有变化，规则结果不变。
  - 修复前：3 项新测试在 `1e44d4d` 的评分器上失败（[`211a705/before-fix-1e44d4d.log`](211a705/before-fix-1e44d4d.log)）。
- **分诊一侧（#2，`5b1ad54`，分诊 `/26`）**：用本项的探针复核（[`211a705/probes/`](211a705/probes/)）。

| 探针（来源都是 `1315 Hull USD 100`，作者行 `1315 \| Hull \| USD 100`） | `/24`（`9e9104f`） | `/25`（`cb27454`） | `/26`（`9b57000`） |
|---|---|---|---|
| 新增、删除卡声称 `rowKey 9999`，并标 `unresolved` | `misattributed` | **`not_evaluable`**（`/25` 引入的退化） | `misattributed` |
| 替换卡，同上 | `not_evaluable` | `not_evaluable` | `misattributed` |
| 对照：`rowKey 9999`、`candidate`（新增、删除、替换） | `misattributed` | `misattributed` | `misattributed` |
| 对照：不声称 `rowKey`，标 `unresolved` 的新增、删除卡（[评论 6513806516](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6513806516)） | `correct`，接受 | `not_evaluable` | `not_evaluable` |
| 对照：`rowKey 1315`、`candidate` | `correct` | `correct` | `correct` |

两边现在读法一致：
- 明确错误的键在评分器里判错误声明（FAIL），在分诊里判归属错误。
- 未决标记下的正确标签或空标签都不算确定。评分器只在答案允许显式复核时接受；续保没有这种答案，分诊记“未评价”。

**联合验收（`211a705`，全套重跑，证据在 [`211a705/`](211a705/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/26` / `tsc` | 131/131、337/337、73/73、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；PASS 行与 `1e44d4d` 相同 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告和 `1e44d4d` 相比，除提交号外只差一个字段：R26 一条 invariant 的说明文字，即本项改写的依据（[`compare-with-1e44d4d.txt`](211a705/compare-with-1e44d4d.txt)）。各用例结论、身份结果都不变 |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`211a705/register.json`](211a705/register.json)：除 `secondary_key_or_explicit_identity_review` 的依据文字外，与 `1e44d4d` 相同 |

**续保**（[`211a705/renewal/compare.txt`](211a705/renewal/compare.txt)）：产品只改了注释。重新抽取后，四次比较的卡片与 `1e44d4d` 逐字段相同，`coreVersion` 也相同（`+row-identity.27`）。分诊 `/25` → `/26` 与产品改动都不改变任何事件的任何字段，两引擎相同。

`1e44d4d` 一步的续保（[`1e44d4d/renewal/compare.txt`](1e44d4d/renewal/compare.txt)）：产品 `d08c269` 下四次比较的卡片与 `9e9104f` 逐字段相同，只差 `coreVersion`（`+row-identity.27`）。分诊 `/24` → `/25` 与产品改动都不改变任何事件的任何字段，两引擎相同。

两个 PR 上目前没有未解决的审阅线程。

### 0.43 联合树 `b85a1bd`：合入 #2 的 `b8a9b55`（表格行身份 `+row-identity.28`）

#2 推了 `b8a9b55`，这时还没有合入本项的 `7341da0`。双方的交接消息错开了，为免互相等待，本项用普通合并提交 `b85a1bd` 合入 `b8a9b55`；它包含 #2 的 head，#2 合入时可以快进。相对 `211a705`，只改了产品与它的测试（[`b85a1bd/changed-since-211a705.txt`](b85a1bd/changed-since-211a705.txt)）：
- **r4420146482**：表格的范围原来按标题行拼接后的文字识别。现在按标题行的各个格识别：文字相同而分格不同的标题行，属于另一张表。
- **r4420199960**：一个格与别的格共用同一标题列时，当作不在任何标题下的格处理；身份列在该行没有格时，这一行的身份不完整。

评分器、分诊、契约都未改。

**联合验收（产品变了，全套重跑，证据在 [`b85a1bd/`](b85a1bd/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/26` / `tsc` | 131/131、339/339、73/73、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；PASS 行与 `211a705` 相同 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `211a705` 逐字段相同，只差提交号（[`compare-with-211a705.txt`](b85a1bd/compare-with-211a705.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`b85a1bd/register.json`](b85a1bd/register.json)：与 `211a705` 相同 |
| 单行页码探针 | 新产品上的结果与 `211a705` 相同（[`b85a1bd/probes/page-number-probe.log`](b85a1bd/probes/page-number-probe.log)）；分诊未改，分诊探针不重跑 |

**续保**（[`b85a1bd/renewal/compare.txt`](b85a1bd/renewal/compare.txt)）：四次比较的卡片与 `211a705` 逐字段相同，只差 `coreVersion`（`+row-identity.27` → `+row-identity.28`）。产品改动不改变任何事件的任何字段，两引擎相同。

### 0.44 删除卡与新增卡的金额只在来源显示为同一记录时才算抵消（`ed11a5f`）

两分支此前已指向同一提交 `3527ab2`（#2 合入本项 `0a327e7`），#2 又加了只含报告的 `565480c`，本项快进到那里。之后 Codex 对 `3527ab2` 提出一条评分器发现（[PR #11 评论 6514810449](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514810449)），本项先复现再修。

**问题。** `moneyChanges()` 原来按卡片声称的 `rowKey`（或当事方）与字段，把删除卡、新增卡分组，组内金额可以相抵。于是：
- 一张删除卡引用记录 A 的 `100,020`，一张新增卡引用记录 B 的 `100,020`；
- 只要两张卡都声称同一个键，就被当作同一记录的“删一个、加一个”，相抵后 `agreed_value_unchanged` 判 PASS；
- 来源证据没有任何变化，凭的只是产品自报的身份。不声称键时，同样的两张卡判“无法评价”。

**修复（`ed11a5f`）。**
- 每张卡另外报告它引用的文字块属于 layout.json 的哪条记录（按 `aircraft_schedule.<记录>.<字段>` 的逻辑路径）。
- 一个声称组内相抵的金额，只有在组内各卡引用的格都属于同一条记录时，才算这条记录的“没有变化”；否则这部分相抵记为无法评价，与没有记录身份的卡相同。
- 声称组内金额对不上的，仍判 FAIL：结果本身就向读者陈述了这条记录的金额变化。

**修复前：** 新测试在 `565480c` 的评分器上失败，跨记录的一对卡判 PASS（[`ed11a5f/before-fix-565480c.log`](ed11a5f/before-fix-565480c.log)）。对照：两张卡都引用记录 SYN-1026-001 自己的格时仍 PASS。

**分诊是否同根。** 用测试辅助函数构造：作者行 1315 改金额，删除卡来自 1315 行、新增卡来自 1760 行，两张都声称 `1315`。分诊判 `not_evaluable`，不接受；不声称键时相同；两张都来自 1315 行的对照判 `split_attributable`（[`ed11a5f/probes/`](ed11a5f/probes/)）。分诊按来源单元确认记录，不受这个根因影响。

**同一时间仍开放、归 #2：** Codex [PR #11 评论 6514669354](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514669354)（分诊 `one_side_edit()`）。作者的编辑是纯插入或纯删除时，替换了另一个词的替换卡也被判 `correct`。本项在 `/26` 上复现了 Codex 的输入、删除的镜像和一个较长段落（[复现说明](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514757811)，探针同在 [`ed11a5f/probes/`](ed11a5f/probes/)）。评分器的事件判定要求卡片每一侧为空当且仅当答案该侧为空，没有这个漏洞。

**验证（评分器改动；产品、分诊与 `b85a1bd` 相同，证据在 [`ed11a5f/`](ed11a5f/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/26` / `tsc` | 132/132、340/340、73/73、0 |
| 构建（两引擎） | 通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。与 `b85a1bd` 相比，除提交号外只差两个用例中金额 invariant 的说明文字，即本项改写的依据（[`compare-with-b85a1bd.txt`](ed11a5f/compare-with-b85a1bd.txt)）；各用例结论不变 |
| 浏览器 `rules.spec.ts`（两引擎） | 通过；与 `b85a1bd` 的差别同上 |
| 覆盖登记 | [`ed11a5f/register.json`](ed11a5f/register.json)：`agreed_value_unchanged`、`no_amount_or_currency_change` 的依据文字改写，前者多一项测试；其余相同 |

续保不用评分器，产品、分诊未改，续保结果与 `b85a1bd` 相同。

### 0.45 联合树 `3feb37d`：合入 #2 的 `c5a5330`（产品 `+row-identity.29`、分诊 `/27`）

#2 推了两项代码改动，这时还没有合入本项的 `ed11a5f`。本项用普通合并提交 `3feb37d` 合入 #2 的 `c5a5330`；它包含 #2 的 head，#2 合入时可以快进。相对 `ed11a5f`，只改了产品、分诊和它们的测试（[`3feb37d/changed-since-b85a1bd.txt`](3feb37d/changed-since-b85a1bd.txt) 列出相对 `b85a1bd` 的全部改动，其中评分器两处即本项的 `ed11a5f`）：
- **产品 `7da5d22`（`+row-identity.29`）**：
  - 重复页眉按标题行的各个格分组（r4420267662）；
  - 没有标题行的记录也要每个格同列或同间隙，才算同一记录（r4420346862）；
  - 一个格越过自己的标题格、伸向本行没有格的身份列时，身份不完整（r4420346858）。
- **分诊 `c5a5330`（`/27`）**：作者的编辑是纯插入或纯删除时，卡片若也给出另一侧，只有在它围绕该编辑的改动只增删事件本身的文字时才算数；否则判“无法评价”。这答复 Codex [PR #11 评论 6514669354](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514669354)。

**复核 `/27`**（[`3feb37d/probes/`](3feb37d/probes/)）：

| 探针输入 | `/26` | `/27` |
|---|---|---|
| 替换卡 `Pay earlier now.` → `Pay later now.`，作者插入 `later` | `correct`，接受 | **`not_evaluable`**，不接受 |
| 替换卡 `Pay later now.` → `Pay earlier now.`，作者删除 `later` | `correct`，接受 | **`not_evaluable`** |
| 较长段落：替换卡把 `all` 换成 `approved`，作者插入 `approved` | `correct`，接受 | **`not_evaluable`** |
| 对照：完全对应的替换卡；只给新侧的新增卡；完全对应的删除 | `correct` | `correct` |
| 跨行拆分（评分器发现 6514810449 的分诊对照） | 不接受 | 不接受；同行对照 `split_attributable` |

**联合验收（产品、分诊变了，全套重跑，证据在 [`3feb37d/`](3feb37d/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/27` / `tsc` | 132/132、343/343、73/73、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；PASS 行与 `b85a1bd` 相同 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `ed11a5f` 逐字段相同，只差提交号（[`compare-with-ed11a5f.txt`](3feb37d/compare-with-ed11a5f.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`3feb37d/register.json`](3feb37d/register.json)：与 `ed11a5f` 相同 |

**续保**（[`3feb37d/renewal/compare.txt`](3feb37d/renewal/compare.txt)）：四次比较的卡片与 `b85a1bd` 逐字段相同，只差 `coreVersion`（`+row-identity.28` → `+row-identity.29`）。分诊 `/26` → `/27` 与产品改动都不改变任何事件的任何字段，两引擎相同。

### 0.46 单独的正负号也是格内的声称；同一处编辑报两次，不论声称哪条记录都判失败（`786aefc`）

Codex 对 `565480c` 和 `3feb37d` 又提出两条评分器发现，本项先复现再修；同一条评论里还有一条分诊发现，归 #2。

| 发现 | 修复前（`c29c5bf` 的评分器） | 现在（`786aefc`） |
|---|---|---|
| [PR #11 评论 6514897964](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514897964) 第二条：一张替换卡把两个不变金额格 `-100,020`、`+100,020` 的正负号按相反顺序引用，`-+` → `+-` | PASS。`severalCells()` 只在声称含金额、币种记号或字母时才把格计入，单独的正负号两样都不含 | NOT_EVALUATED（`invariant_unverifiable`）。在 layout.json 的金额格或币种格里，声称的任何非空白字符都算对这个格的声称；多集合无法核实的跨格对应保持“无法评价” |
| [PR #11 评论 6514962741](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514962741)：两对删除卡、新增卡引用同一个不变格的同一批源字符，第二对声称另一个键 | PASS。重复字符只在同一声称记录组内比较 | FAIL：“同一处编辑报了两次”。源字符在全部删除卡（以及全部新增卡）之间比较；两对声称同一键时照旧 FAIL |

**修复前：** 两项新测试在 `c29c5bf` 的评分器上失败（[`786aefc/before-fix-c29c5bf.log`](786aefc/before-fix-c29c5bf.log)）。

**分诊发现（归 #2）。** 一个来源单元同时含记录 1315 和 1760，只有 1760 改了金额，声明身份 1315 却取自没变的那条记录。本项在 `/26` 和 `/27` 上都复现了：`correct`，接受，整行完整，0 张未解释卡；1315 本身改了的两个对照仍 `correct`（[`786aefc/probes/`](786aefc/probes/)，[复现说明](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515024332)）。评分器按卡片自己编辑所在的 layout.json 记录格归属事件，同一单元里别处的身份格不算，没有这个漏洞。

**验证（评分器改动；产品、分诊与 `3feb37d` 相同，证据在 [`786aefc/`](786aefc/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/27` / `tsc` | 134/134、345/345、73/73、0 |
| 构建（两引擎） | 通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。与 `3feb37d` 相比，除提交号外只差两个用例中金额 invariant 的说明文字（[`compare-with-3feb37d.txt`](786aefc/compare-with-3feb37d.txt)）；各用例结论不变 |
| 浏览器 `rules.spec.ts`（两引擎） | 通过；与 `3feb37d` 的差别同上 |
| 覆盖登记 | [`786aefc/register.json`](786aefc/register.json)：两个金额 invariant 的依据文字改写，`agreed_value_unchanged` 多两项测试 |

续保不用评分器，产品、分诊未改，续保结果与 `3feb37d` 相同。

### 0.47 联合树 `61e4add`：#2 快进合入本项 `8003bb5`，再修产品 `+row-identity.30`、分诊 `/28`

#2 普通合并本项的 `8003bb5`（含 `786aefc`）为 `81048e3`，再加报告 `61e4add`；它包含本项的 head，本项快进到这里。相对 `3feb37d`，代码改动只有本项的 `786aefc` 和 #2 的两项（[`61e4add/changed-since-3feb37d.txt`](61e4add/changed-since-3feb37d.txt)）：
- **产品 `d89f9f1`（`+row-identity.30`，r4420429153）**：在描述性标题格下出现标识名（`Status: Registration`）的无数字记录，结束这张表，而不当作下一张表的标题行。
- **分诊 `f90c911`（`/28`）**：同一来源单元内，身份格只有在它与编辑之间只隔着作者行自己的文字和数字时才算数（Codex [PR #11 评论 6514897964](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6514897964) 第一条）。

**复核**（[`61e4add/probes/`](61e4add/probes/)）：

| 探针 | `/27` | `/28` |
|---|---|---|
| 同一单元含 1315 与 1760，只有 1760 改了（6514897964 第一条） | `correct`，整行完整 | **`not_evaluable`**；1315 自己改了的两个对照仍 `correct` |
| 移动行只给前 40 个字符加 `1315`（[PR #11 评论 6515146325](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515146325)） | `correct`，整行完整 | **仍 `correct`，整行完整**：仍开放，归 #2 |
| 替换卡把一段改成两段相同的副本（[PR #9 评论 6515226035](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6515226035)） | `not_located`，不接受 | 同左：仍开放，归 #2（漏判，不是误接受）；只给新副本的新增卡对照 `correct` |
| 此前各条分诊探针 | — | 输出与 `/27` 相同 |

后两条与评分器无关：评分器不报告整行恢复，移动事件要求卡片两侧文字等于答案的整段文字；新增事件只接受答案列出的 `Added` 卡。

**联合验收（产品、分诊变了，全套重跑，证据在 [`61e4add/`](61e4add/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/28` / `tsc` | 134/134、346/346、74/74、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；PASS 行与 `3feb37d` 相同 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `786aefc` 逐字段相同，只差提交号（[`compare-with-786aefc.txt`](61e4add/compare-with-786aefc.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`61e4add/register.json`](61e4add/register.json)：与 `786aefc` 相同 |

**续保**（[`61e4add/renewal/compare.txt`](61e4add/renewal/compare.txt)）：四次比较的卡片与 `3feb37d` 逐字段相同，只差 `coreVersion`（`+row-identity.29` → `+row-identity.30`）。分诊 `/27` → `/28` 与产品改动都不改变任何事件的任何字段，两引擎相同。

### 0.48 重复行的一处出现按卡片引用的顺序逐个位置读取（`498cd4a`）

#2 转来 Codex 在 PR #9 的评分器发现（[评论 6514840841](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6514840841)），本项先复现再修。

- **问题。** `sourceText()` 把一处出现所引用各行的字符按原始抽取次序（raw offset）排序后拼接。若某一页把表头 `MSN | Operator | Value` 的各列从右往左抽取，这一页读成 `Value…MSN`，与其他页不再是同一变体。产品正确的卡（2 → 3 次）因此因“次数不符”判 FAIL。
- **修复。** 一处出现改为按卡片引用的顺序逐个位置读取：每个位置按所在行的字符顺序，从它的第一个字符读到最后一个；同一行上后一个位置接在前一个之后时，两者之间的字符也算。空白照原样保留，别的行的字符照旧不算。
- **修复前：** 新测试在 `61e4add` 的评分器上失败（[`498cd4a/before-fix-61e4add.log`](498cd4a/before-fix-61e4add.log)）。按列抽取的表格构造函数改为两个测试共用。

**验证（评分器改动；产品、分诊与 `61e4add` 相同，证据在 [`498cd4a/`](498cd4a/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/28` / `tsc` | 135/135、347/347、74/74、0 |
| 构建（两引擎） | 通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。与 `61e4add` 逐字段相同，只差提交号（[`compare-with-61e4add.txt`](498cd4a/compare-with-61e4add.txt)）：规则用例的 PDF 里，原始次序与行内次序一致 |
| 浏览器 `rules.spec.ts`（两引擎） | 通过；与 `61e4add` 逐字段相同 |
| 覆盖登记 | [`498cd4a/register.json`](498cd4a/register.json)：与 `61e4add` 相同 |

续保不用评分器，产品、分诊未改，续保结果与 `61e4add` 相同。仍开放、归 #2 的两条分诊发现见第 0.47 节。

### 0.49 没有记录的删除卡与新增卡也比较所编辑金额格的整格金额（`933ea5b`）

Codex 对 `839f2a2` 提出一条评分器发现（[PR #11 评论 6515705013](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515705013)），本项先复现再修。

- **问题。** 没有记录身份的删除卡、新增卡走合并路径。这条路径只比较金额文字和声称，不像替换卡和有记录的删除卡、新增卡那样，比较它们所编辑金额格的整格金额。例如：
  - 删除卡只引用记录 SYN-1026-001 的 `-100,020` 中的 `-`；
  - 新增卡只引用记录 SYN-1026-003 的 `+100,020` 中的 `+`；
  - 两张卡都不带键。

  修复前 `agreed_value_unchanged` 判 PASS。
- **修复。** 合并路径里，两侧都编辑了金额格、而整格金额在答案的事件之外不同时，判 FAIL，与有记录的组相同。只有一侧编辑金额格时，仍按声称判断：只删一个币种字母仍是“无法评价”，第十五轮的裁定不变。
- **修复前：** 新测试在 `839f2a2` 的评分器上失败（[`933ea5b/before-fix-839f2a2.log`](933ea5b/before-fix-839f2a2.log)）。对照：同一个 `-` 在自己的格里删了又加，仍 PASS。

**验证（评分器改动；产品、分诊与 `61e4add` 相同，证据在 [`933ea5b/`](933ea5b/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/28` / `tsc` | 136/136、348/348、74/74、0 |
| 构建（两引擎） | 通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。与 `498cd4a` 逐字段相同，只差提交号（[`compare-with-498cd4a.txt`](933ea5b/compare-with-498cd4a.txt)） |
| 浏览器 `rules.spec.ts`（两引擎） | 通过；与 `498cd4a` 逐字段相同 |
| 覆盖登记 | [`933ea5b/register.json`](933ea5b/register.json)：`agreed_value_unchanged` 多一项测试，其余相同 |

续保不用评分器，结果与 `61e4add` 相同。仍开放、归 #2 的两条分诊发现见第 0.47 节。

### 0.50 联合树 `8e638cb`：币种代码后的正负号属于金额（`ea444a0`）；合入 #2 的 `5888e7d`（产品 `+row-identity.31`、分诊 `/29`）

**评分器 `ea444a0`**（Codex [PR #11 评论 6515830550](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515830550)，本项先复现再修）：
- **问题：** `SIGN` 只在前面不是字母、数字、`.` 或 `,` 时才认正负号，所以 `USD−100,020` 里的负号被丢掉。一张有来源的替换卡把金额格 `USD−100,020` 改成 `USD+100,020`，两侧都读成 `100,020`：金额文字比较和整格比较都看不出变化，`agreed_value_unchanged` 判 PASS。
- **现在：** 紧跟在币种代码后的正负号属于金额。`SYN-1026`、`1-100,000` 仍没有正负号；带空格的写法本来就能识别，保留为对照。
- **修复前：** 新用例在 `b9e6f8a` 的评分器上失败（[`8e638cb/before-fix-b9e6f8a.log`](8e638cb/before-fix-b9e6f8a.log)）。
- **#2 一侧的同根问题：** 分诊的 `signed()` 沿用评分器旧的读法，把 `USD−100,020` 读作不带符号的 `100,020`。这一点已告知 #2，目前没有探针显示它导致错误结论。

**合入 #2 的 `5888e7d`**（普通合并提交 `8e638cb`）：
- **产品 `fb1c28e`（`+row-identity.31`）：** 不在任何标题格下的标识名也结束表格；重复页眉保留原文。
- **分诊 `5888e7d`（`/29`）：**
  - 增加重复段落一个副本的卡算作显示了这次增加（[PR #9 评论 6515226035](https://github.com/wlvh/policy-compare/pull/9#issuecomment-6515226035)）；
  - 移动的行只有每个格都在时才算整行恢复（[PR #11 评论 6515146325](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515146325)）。

**复核 `/29`**（[`8e638cb/probes/`](8e638cb/probes/)）：

| 探针 | `/28` | `/29` |
|---|---|---|
| 移动行只给前 40 个字符加 `1315` | `correct`，整行完整 | `correct`（移动本身已显示），**`fullRowRecovered` 为 false**；整行对照仍为 true |
| 替换卡把一段改成两段相同的副本，以及反方向 | `not_located` | **`correct`**；只给新副本的新增卡对照仍 `correct` |
| 此前各条分诊探针 | — | 输出与 `/28` 相同 |

**联合验收（产品、分诊、评分器都变了，全套重跑，证据在 [`8e638cb/`](8e638cb/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/29` / `tsc` | 136/136、350/350、76/76、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；PASS 行与 `61e4add` 相同 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `933ea5b` 逐字段相同，只差提交号（[`compare-with-933ea5b.txt`](8e638cb/compare-with-933ea5b.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`8e638cb/register.json`](8e638cb/register.json)：与 `933ea5b` 相同 |

**续保**（[`8e638cb/renewal/compare.txt`](8e638cb/renewal/compare.txt)）：四次比较的卡片与 `61e4add` 逐字段相同，只差 `coreVersion`（`+row-identity.30` → `+row-identity.31`）。分诊 `/28` → `/29` 与产品改动都不改变任何事件的任何字段，两引擎相同。

### 0.51 单侧只引用正负号的卡也是对金额的声称（`48a5887`）；按声明变化的金额格里的声称，不再报成“值未变”（`8a178d5`）

**评分器 `48a5887`**（Codex [PR #11 评论 6516045905](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516045905)，本项先复现再修）：
- **问题：** 只有一张删除卡，只引用未变金额 `-100,020` 里的 `-`，答案里也没有金额事件。修复前 `agreed_value_unchanged` 判 PASS，带不带行键都一样。只引用 `+100,020` 里 `+` 的新增卡、`−`（U+2212）的写法，结果相同。原因有两处：
  - 整格金额比较要两侧都编辑了金额格才进行，单侧的卡被跳过；
  - 声称比较只认能组成金额的字符，单独的正负号被丢掉。
- **现在：** 在金额本身带正负号的格里，没连着数字被声称的正负号，算作对这个金额的声称，和单独被声称的数字一样。所以单侧这张卡判 FAIL：它在值未变的格里声称了改动。两侧都声称、而且一致时（同一个 `-` 在自己的格里删了又加），仍然抵消，判 PASS。
- **不变的地方：**
  - `1-100,000` 里的连字符不是正负号，单独删它仍判 PASS，列为不支持（第 5 节）；
  - 只删币种字母仍是“无法评价”（第十五轮的裁定）；
  - 一张卡交换两个格的正负号仍是“无法评价”（第 0.46 节）。
- **修复前：** 六种情况（删除卡或新增卡、带不带行键、两种负号）都判 PASS（[`48a5887/before-fix-9ff5ea1-cases.log`](48a5887/before-fix-9ff5ea1-cases.log)），新测试在 `9ff5ea1` 的评分器上失败（[`48a5887/before-fix-9ff5ea1.log`](48a5887/before-fix-9ff5ea1.log)）。

**评分器 `8a178d5`**（修上一条时核对相邻情况发现，是本项自己的问题）：
- **问题：** 答案声明了金额变化，卡片只引用变化的那一个字符，例如 `100,020` → `200,020` 只引 `1` → `2`，无论是一张替换卡还是同一记录的删除卡加新增卡。这时金额断言另报一条“在值未变的格里声称了改动”，可是这个格确实按声明变了，这句话不对。
  - 这类卡本来就因为没显示事件的旧值和新值而判事件 FAIL，所以用例结论不变；错的是金额断言那一行。
  - 数字的情况在 `9ff5ea1` 就存在（[`48a5887/probes/declared-fragment-9ff5ea1.log`](48a5887/probes/declared-fragment-9ff5ea1.log)），`48a5887` 又把它带到了正负号上（[`48a5887/probes/declared-fragment-48a5887.log`](48a5887/probes/declared-fragment-48a5887.log)）。
- **现在：** 所编辑金额格的整格金额只按答案声明的事件变化时，格里的声称属于这次变化，不再按“值未变的格”比较；卡片文字本身显示了声明的变化时，原来就不比较。没有声明这次变化时，同样的卡仍判金额断言 FAIL；`48a5887` 的单侧正负号卡也仍判 FAIL。
- **修复前：** 新测试在 `1da2746`（`48a5887` 加一行登记）的评分器上失败（[`8a178d5/before-fix-1da2746.log`](8a178d5/before-fix-1da2746.log)）。
- **边界：** “按声明变化”按金额值比较、不看记录，和原有的允许变化规则一样：答案若在另一条记录上声明了相同的金额变化，这里也算已声明。

**同步：** 普通合并提交 `1c09dfc` 合入 #2 的 `5c6dab6`。它只加了 #2 自己的报告（`reports/issue-2-validation/`），产品、分诊、评分器代码都没变，所以没有重跑。

**留给 #2 的两条分诊发现**（`/29`，探针在 [`48a5887/probes/`](48a5887/probes/)）：
- Codex [6515923611](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515923611)：同一单元里，被改的金额会借用紧随其后那条记录的编号，中间只隔标点（[复现 6515988454](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515988454)）。
- 与 `ea444a0` 同根（[复现 6516032862](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516032862)）：`signed()` 把紧跟币种代码的正负号当成没有符号。作者的 `100` 被认作出现在 `USD−100` 里，新增卡、删除卡都判 `correct` 且整行完整；`USD−100` → `USD−200` 也被当成 `USD 100` → `USD 200`。第 0.50 节说“没有探针显示它导致错误结论”，现在有了。

**验证（评分器改动；产品、分诊与联合树 `8e638cb` 相同）**

| 检查 | `8a178d5`（证据在 [`8a178d5/`](8a178d5/)） | `48a5887`（证据在 [`48a5887/`](48a5887/)） |
|---|---|---|
| scorer / `verify:core` / Python 分诊 `/29` / `tsc` | 138/138、352/352、76/76、0 | 137/137、351/351、76/76、0 |
| 构建（两引擎） | 通过 | 通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。与 `48a5887` 相比只差同两条说明文字（[`compare-with-48a5887.txt`](8a178d5/compare-with-48a5887.txt)） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。与 `8e638cb` 相比只差 R11、R26 两个用例的金额断言说明文字（[`compare-with-8e638cb.txt`](48a5887/compare-with-8e638cb.txt)） |
| 浏览器 `rules.spec.ts`（两引擎） | 通过；同上 | 通过；同上 |
| 覆盖登记 | [`8a178d5/register.json`](8a178d5/register.json)：两条金额断言的说明文字又改一次，`agreed_value_unchanged` 再多一项测试；direct 10、indirect 17、unsupported 4，没有 FAIL | [`48a5887/register.json`](48a5887/register.json)（按 `1da2746` 生成）：两条金额断言的说明文字变了，`agreed_value_unchanged` 多一项测试 |

续保不用评分器，结果与 `8e638cb` 相同。

### 0.52 声明变化的豁免只覆盖按声明变化的那几个格（`d16ed68`）

Codex 对 `ee1ce44` 提出一条评分器发现（[PR #11 评论 6516327058](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516327058)），指出的是 `8a178d5` 引入的问题。本项先复现再修。

- **问题：** `8a178d5` 的做法是：一张卡编辑的金额格里只要有一个按声明变化，这张卡的声称比较就整体跳过，同一张卡在其他格里的声称也一起放过了。例如：
  - 答案声明记录 SYN-1026-001 的 `100,020` → `200,020`；两条记录的币种 `USD`、`EUR` 都不变；
  - 一张替换卡（没有声明金额字段）声称 `1U` → `2E`：金额的第一位，加上两个币种格各一个字母。

  `ee1ce44` 上 `agreed_value_unchanged` 判 PASS，`9ff5ea1` 上判 FAIL。同样的声称拆成删除卡加新增卡时，带不带记录都一样。
- **现在：** 只把按声明变化的那几个金额格里的声称放到一边（一个格只要有一个金额在声明的变化里就算），并且不再静默放过：这些声称没有逐字核对过那次变化，记为 NOT_EVALUATED。其他格（包括币种格）的声称照旧比较，这个例子判 FAIL（`U to E`）。
- **对 `8a178d5` 那个情形的影响：** 声明了变化、卡片只引用变化的那一个字符，金额断言现在记“无法评价”。它不再判 FAIL，也不再写那句不实的“值未变”。用例本身仍因事件未显示而判 FAIL。
- **修复前：** 新测试在 `ee1ce44` 的评分器上判 PASS；在 `9ff5ea1` 上判 FAIL，但报的是 `1,U to 2,E`，而且声明变化的那个情形仍是那句不实的话。日志：[`d16ed68/before-fix-ee1ce44-and-9ff5ea1.log`](d16ed68/before-fix-ee1ce44-and-9ff5ea1.log)。
- **边界：** 一个格算不算“按声明变化”，按金额值判断，不看记录（第 0.51 节）。如果另一个没变的格恰好有相同的金额，它的声称也会被放到一边，但只会记“无法评价”，不会判 PASS。

**验证（评分器改动；产品、分诊与联合树 `8e638cb` 相同，证据在 [`d16ed68/`](d16ed68/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/29` / `tsc` | 139/139、353/353、76/76、0 |
| 构建（两引擎） | 通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。与 `8a178d5` 相比只差 R11、R26 两条金额断言的说明文字（[`compare-with-8a178d5.txt`](d16ed68/compare-with-8a178d5.txt)） |
| 浏览器 `rules.spec.ts`（两引擎） | 通过；同上 |
| 覆盖登记 | [`d16ed68/register.json`](d16ed68/register.json)：两条金额断言的说明文字变了，`agreed_value_unchanged` 多一项测试；direct 10、indirect 17、unsupported 4，没有 FAIL |

### 0.53 卡片文字显示了声明的金额变化，其他格里的声称仍要比较（`81e065a`）

Codex 对 `009c349` 提出两条发现（[PR #11 评论 6516504352](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516504352)）。第一条是评分器的，本项先复现再修；第二条是分诊的，归 #2。

**评分器 `81e065a`：**
- **问题：** 答案声明记录 SYN-1026-001 的 `100,020` → `200,020`，两条记录的币种 `USD`、`EUR` 不变。一张卡的文字是 `100,020U` → `200,020E`：完整的声明金额，再加两个币种格各一个字母。`009c349` 上 `agreed_value_unchanged` 判 PASS；无论是一张替换卡，还是删除卡加新增卡（带记录或不带记录），都一样。
  - 原因：声称比较只在卡片文字没显示金额变化时才进行。这个条件在 `9ff5ea1` 就有，不是本段引入的。文字显示的是允许的变化，就整段跳过了。
- **现在：** 卡片文字只显示声明的变化时，按声明变化的金额格以外的声称，仍按答案的事件比较。这几张卡因 `U to E` 判 FAIL。只有完整金额的卡仍判 PASS（对照保留）。
- **修复前：** 三种卡形在 `009c349` 的评分器上都判 PASS，修复后都判 FAIL；对照在两边都是 PASS（[`81e065a/before-fix-cases.log`](81e065a/before-fix-cases.log)）。扩展后的测试在 `d16ed68` 的评分器上失败（[`81e065a/before-fix-d16ed68.log`](81e065a/before-fix-d16ed68.log)）。

**分诊（#2 的文件，`/29`，[复现 6516540351](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516540351)）：** 作者的事件是把一段从第 11 页移到第 12 页，文字没变。两张替换卡各自把这段留在原页，只改了后面一句 `Liability excluded.` → `Liability included.`，结果判 `split_attributable`，和真正的“第 11 页删除 + 第 12 页新增”一样。探针在 [`81e065a/probes/`](81e065a/probes/)。

**验证（评分器改动；产品、分诊与联合树 `8e638cb` 相同，证据在 [`81e065a/`](81e065a/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/29` / `tsc` | 139/139、353/353、76/76、0 |
| 构建（两引擎） | 通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。与 `d16ed68` 相比只差 R11、R26 两条金额断言的说明文字（[`compare-with-d16ed68.txt`](81e065a/compare-with-d16ed68.txt)） |
| 浏览器 `rules.spec.ts`（两引擎） | 通过；同上 |
| 覆盖登记 | [`81e065a/register.json`](81e065a/register.json)：两条金额断言的说明文字变了；direct 10、indirect 17、unsupported 4，没有 FAIL |

### 0.54 联合树 `081f370`：#2 快进合入本项，再修分诊 `/32` 与产品 `+row-identity.32`

**同步：** #2 先快进到本项的 `cc4dc8d`，然后加了两个提交；本项再快进到 #2 的 `081f370`。两条分支在 `081f370` 上代码相同。
- **分诊 `9e5ec24`（`/30`–`/32`）：** 修本项复现、留给 #2 的三条：
  - 币种代码后的正负号（[6516032862](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516032862)）；
  - 被改金额借用后一条记录的编号（[6515923611](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6515923611)）；
  - 没有移动段落的两张替换卡被算作拆开的移动（[6516504352](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516504352) 第二条）。
- **产品 `081f370`（`+row-identity.32`）：** 只有标识名、没有值的格，不再给出标识。

**复核 `/32`**（[`081f370/probes/`](081f370/probes/)）：已归档的 44 个分诊探针，加上新的一个，分别在 `/29` 和 `/32` 上运行。只有下面几行不同（[`diff-29-32.txt`](081f370/probes/diff-29-32.txt)）：

| 探针 | `/29` | `/32` |
|---|---|---|
| 新增卡、删除卡把 `USD−100` 当作作者的 `100` | `correct`，整行完整 | **`partly_located`**，整行不完整，与 `-100` 相同 |
| 替换卡 `USD−100` → `USD−200` 当作 `USD 100` → `USD 200` | `correct` | **`not_located`**，与 `-100` → `-200` 相同 |
| 1760 的金额被改，1315 跟在 `; ` 后面 | `correct`，被接受 | **`not_evaluable`**，1 张卡未解释；两个对照仍 `correct` |
| 两张替换卡都没有移动段落 | `split_attributable` | **`not_evaluable`**，2 张卡未解释；删除加新增的对照仍 `split_attributable`，移动卡对照仍 `correct` |
| [6516690587](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516690587) 的对照：只改第二份 `USD 100` | `correct`，`complete` | `not_evaluable`，`incomplete`（更保守，是 `/31` 同侧身份规则的副作用） |

**仍开放（#2 的文件）：** [6516690587](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516690587)。作者事件里有两处相同的替换，卡片只改了第一份，两处都被判成 `correct`，事件判 `complete`。

**联合验收（产品、分诊都变了，全套重跑，证据在 [`081f370/`](081f370/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/32` / `tsc` | 139/139、354/354、77/77、0 |
| 构建、PDF 机制、审核回归（两引擎） | 通过；PASS 行与 `8e638cb` 相同 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。规则与浏览器规则报告与 `81e065a` 逐字段相同，只差提交号（[`compare-with-81e065a.txt`](081f370/compare-with-81e065a.txt)） |
| 浏览器（两引擎） | 完整测试各 16/16 |
| 覆盖登记 | [`081f370/register.json`](081f370/register.json)：与 `81e065a` 相同 |

**续保**（[`081f370/renewal/compare.txt`](081f370/renewal/compare.txt)）：四次比较的卡片与 `8e638cb` 逐字段相同，只差 `coreVersion`（`+row-identity.31` → `+row-identity.32`）。分诊 `/29` → `/32` 与产品改动都不改变任何事件的任何字段，两引擎相同。

### 0.55 声明的金额变化只豁免引用其证据位置的卡（`f6d0ea0`）

Codex 对 `f46ec7a` 提出一条评分器发现（[PR #11 评论 6517617194](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6517617194)），本项先复现再修。这也撤销了第 0.51 节列出的边界“按声明变化按金额值比较、不看记录”。

- **问题：** 允许的金额变化原来是全部事件的变化合在一起的一个多重集合，不看卡片引用的是哪条记录。复现的情形：
  - 记录 SYN-1026-001 声明 `100020` → `200020`；
  - SYN-1026-003 仍是 `100020`，加出的一行 SYN-90 仍是 `200020`；
  - 一张替换卡把 SYN-1026-003 的旧金额和 SYN-90 的新金额配成一对。

  修复前 `agreed_value_unchanged` 判 PASS；去掉那条声明后判 FAIL。
- **现在：** 一个事件减少（增加）的金额，只豁免旧（新）侧引用了该事件 `evidence_locations` 所列 layout.json 文字块的卡，或删除卡加新增卡的组。上面的情形判 FAIL；声明那条记录自己的卡仍判 PASS。
- **影响范围：** 32 对规则答案里，只有 R11 和 R26 带金额断言，而它们的事件都没有声明金额变化，所以真实规则的结论不会变（见下表）。
- **修复前：** 新测试在 `f46ec7a` 的评分器上失败（[`f6d0ea0/before-fix-f46ec7a.log`](f6d0ea0/before-fix-f46ec7a.log)）。

**验证（评分器改动；产品、分诊与联合树 `081f370` 相同，证据在 [`f6d0ea0/`](f6d0ea0/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/32` / `tsc` | 140/140、355/355、77/77、0 |
| 构建（两引擎） | 通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。与 `081f370` 相比只差 R11、R26 两条金额断言的说明文字（[`compare-with-081f370.txt`](f6d0ea0/compare-with-081f370.txt)） |
| 浏览器 `rules.spec.ts`（两引擎） | 通过；同上 |
| 覆盖登记 | [`f6d0ea0/register.json`](f6d0ea0/register.json)：两条金额断言的说明文字变了，`agreed_value_unchanged` 多一项测试；direct 10、indirect 17、unsupported 4，没有 FAIL |

**仍开放、归 #2 的分诊发现：** [6516690587](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516690587)（两处相同的替换共用一处编辑）和 [6517133695](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6517133695)（一行的编辑分在两张卡上时 `fullRowRecovered` 为 false；[复现 6517148134](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6517148134)，探针在 [`f6d0ea0/probes/`](f6d0ea0/probes/)）。

### 0.56 声明的金额变化只豁免编辑了其证据位置的卡，不算未改动的上下文（`8906d05`）

Codex 对 `8f0e71b` 提出一条评分器发现（[PR #11 评论 6517783297](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6517783297)），指出 `f6d0ea0` 的范围仍过宽。本项先复现再修。

- **问题：** `f6d0ea0` 拿事件的证据位置去比卡片引用的所有文字块，连“相同”操作和卡片层面的位置都算在内。复现的情形：
  - 记录 SYN-1026-001 声明 `100,020 each` → `200,020 each`；
  - 一张卡把 SYN-1026-003 的 `100,020` 和 SYN-90 的 `200,020` 配成一对，另外把声明记录里未改动的 ` each` 作为“相同”操作引用。

  `8f0e71b` 上 `agreed_value_unchanged` 判 PASS；去掉那段上下文就判 FAIL。
- **现在：** 只有卡片的删除、插入操作所引用的文字块才去比事件的证据位置。这张卡有没有那段上下文都判 FAIL；声明记录自己的卡仍判 PASS。
- **修复前：** 扩展后的测试在 `8f0e71b` 的评分器上失败（[`8906d05/before-fix-8f0e71b.log`](8906d05/before-fix-8f0e71b.log)）。

**验证（评分器改动；产品、分诊与联合树 `081f370` 相同，证据在 [`8906d05/`](8906d05/)）**

| 检查 | 结果 |
|---|---|
| scorer / `verify:core` / Python 分诊 `/32` / `tsc` | 140/140、355/355、77/77、0 |
| 构建（两引擎） | 通过 |
| 规则（两引擎） | 退出码 2：严格 PASS 28/32 + 4 项登记 NOT_EVALUATED，FAIL 0；事件 32/32；位置集 11/11。与 `f6d0ea0` 相比只差 R11、R26 两条金额断言的说明文字（[`compare-with-f6d0ea0.txt`](8906d05/compare-with-f6d0ea0.txt)） |
| 浏览器 `rules.spec.ts`（两引擎） | 通过；同上 |
| 覆盖登记 | [`8906d05/register.json`](8906d05/register.json)：两条金额断言的说明文字变了；direct 10、indirect 17、unsupported 4，没有 FAIL |

### 0.57 用户复核（PR #11 评论 6517912220、PR #9 评论 6517899051）：措辞更正；三项缺口的独立复现

**措辞更正**（PR #11 [评论 6517912220](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6517912220)）：第 0.42 节原句“控制用例仍只认答案声明的事件，以及来源可证的形式变化”容易读成形式变化自动通过。已按代码（`no_material_differences`）改成准确说法：控制用例只允许答案声明的事件；未声明的形式变化（来源证明只是形式变化，或无法判断是否只是形式变化）仍记 NOT_EVALUATED，不判 PASS；其他未声明的内容变化判 FAIL。第 R19 节同类的历史句子补了说明：那是第十九轮的做法，第二十轮已收窄。评分器代码与产品结果都没改，所以不重跑。

**三项缺口，都在 #2 的文件里，本项在 `8906d05`（产品、分诊同 `081f370`）上独立复现**（探针在 [`8906d05/probes/`](8906d05/probes/)）：

| 项 | 输入 | 当前结果 | 对照 |
|---|---|---|---|
| 1（[r4420795051](https://github.com/wlvh/policy-compare/pull/9#discussion_r4420795051)） | 没有表头行；`MSN: \| Alpha Air \| USD 1000` 对 `MSN: \| Delta Air \| USD 2000` | 替换卡，按行身份配对，`rowKey` 为 `MSN:`，未决 0；`MSN -` 也一样 | `MSN`、`MSN#`、`MSN No.` 不配对；`MSN 123`、`MSN: 123` 配对 |
| 2（[r4421114827](https://github.com/wlvh/policy-compare/pull/9#discussion_r4421114827)） | 同样三行、同样几何，一侧按行抽取，另一侧按列抽取 | 3 张删除卡 + 1 张新增卡，未决 0 | 每种顺序与自己比较：0 差异 |
| 3（Codex [6516690587](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6516690587)） | 作者事件有两处相同的替换，卡片只改第一处 | `correct`、`complete`，两个原子都 `correct` | 两处都改：`correct`；只改第二处：`not_evaluable` |

另一条仍开放的分诊发现：Codex [6517133695](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6517133695)（一行的编辑分在两张卡上，`fullRowRecovered` 为 false）。这几项修好、本项同步并独立复核之前，共同完成条件不成立。

### 0.58 合入 #2 的 `8bf16df`（产品 `+row-identity.33`、分诊 `/34`）：三项复核；产品修复带来一处回退；Codex 的新分诊发现

**同步**：普通合并提交 `67f5c44` 合入 #2 的 `8bf16df`（其 `33bda44` 改产品，`8bf16df` 改分诊），无冲突；#2 的分支从 `8f0e71b` 起，不含本项的 `8906d05`—`c092726`，所以不能快进。评分器未改。合并后的快速检查（证据在 [`67f5c44/`](67f5c44/)）：评分器测试 140/140、分诊 79/79、`verify:core` 357/357、`tsc` 0。**产品还有一处回退未修（见下），这一树不是最终联合树，所以没有跑规则、浏览器与续保重提取的全套链路。**

**用户复核的三项**（探针在 [`67f5c44/probes/`](67f5c44/probes/)；“修前”指 #2 的上一版 `8f0e71b`，产品与分诊同 `081f370`）：

| 项 | 修前 | `67f5c44` | 本项另加的写法 |
|---|---|---|---|
| 1 只有身份名称和标点（`MSN:`、`MSN -`） | 按行身份配对 | 不配对（一删一增）；`MSN: 123`、`MSN 123` 仍配对 | `MSN No.:`、`MSN: —`、`MSN/`、`MSN :` 修前都配对，现在都不配对；`(MSN)` 前后都不配对。`MSN: TBA` 前后都按 `MSN: TBA` 配对：`TBA` 是字母，区分它是不是占位词要靠词表，本项不报（`AGENTS.md` 第 8 条） |
| 2 同一张三栏表，一侧按行抽取、一侧按列抽取 | 3 张删除卡 + 1 张新增卡 | 0 差异；把 `USD 2000` 改成 `USD 3000` 时，两种顺序都只报记录 `456` 的一张替换卡 | 四行的表也是 0 差异 |
| 3 两处相同的替换只改第一处 | `correct`、`complete` | `not_evaluable`、`partly_complete`，原子 `correct`、`not_evaluable` | 两处都改仍 `correct`，只改第二处仍 `not_evaluable` |

Codex [6517133695](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6517133695)（一行的两处编辑分在同一单元的两张卡上）：`fullRowRecovered` 由 false 变为 true；第二张卡不带身份时仍 false。旧探针全部重跑（[`all-probes-triage-34.log`](67f5c44/probes/all-probes-triage-34.log)，与 `/32` 的对比在 [`diff-32-34.txt`](67f5c44/probes/diff-32-34.txt)）：除上面两项外只有一处变化，r4417329496 的“两个相同金额格只显示一个”从 `correct` 变为 `not_evaluable`。它的作者事件就是两处相同的替换（`USD 100 → USD 200` 两次），这正是第 3 项要求的结果。

**新发现一：`33bda44` 的回退（产品，#2 的文件）**。规则是“基线上有三个以上分开的文字块，这一行就是自己的一行，不是上一行的折行”。真实表格里一条记录有三个格同时折到第二行时，折行那一条基线上也恰好有三个文字块：

| 输入（四栏表，10 磅字，折行在下方 11 处；`MSN` 格不折行） | 修前 | `67f5c44` |
|---|---|---|
| 每格的两行连着抽取（多数 PDF 的写法），折行里 `per annum` → `per month` | 记录 `123` 的一张替换卡，文字含全行 | 一张删除卡 `Holdings war risks per annum` + 一张新增卡 `... per month`，没有行键，未决 0，`complete_for_scope` |
| 按基线抽取，同样的改动 | 同右（修前已有） | 一删一增，同上 |
| 对照：只有两个格折行 | 记录 `123` 的替换卡 | 不变 |

第一行是回退：修前正确的结果，现在成了用户第 2 项同类的错误一删一增，而且记录 `123` 的另外三个格与它们的折行分开了。第二行是修前就有的同一根因。

**新发现二：两栏紧凑表（修前修后一样，不是回退）**。`MSN | Value` 两栏三行，一侧按行抽取、一侧按列抽取：没有变化时报一张有文字变化的替换卡（`Value 123 USD 1000 456 USD 2000` → `123 456 Value USD 1000 USD 2000`），改一个金额时报一删一增，未决都是 0。两栏表不被当作表读，段落文字按抽取顺序拼。`docs/extractor-capabilities.md` 已写明“复杂多栏阅读顺序和任意表型仍需要真实样本验证”，但结果状态仍是 `complete_for_scope`。修还是明确列为不支持，由 #2 按证据决定。

**新发现三：Codex [6518043799](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6518043799)（分诊，#2 的文件；`/32` 就有，不是 `/34` 带来的）**。新增（或删除）的作者行 `1315 | Hull | USD 100`，卡片只有一个单元 `1315 Hull; 1760 Liability USD 100`，而 `1760` 不是声明表里的事件：判 `correct`，三个格都 `correct`，`fullRowRecovered` 为 true。`USD 100` 其实写在 `1760` 之后。原因是增删行的格只检查“在带身份的单元里”，不像替换那样用 `linked()` 检查格与身份之间隔着什么。对照：`1760` 也是声明的事件时判 `not_evaluable`；单元只有 `1315 Hull USD 100` 或 `1315 Hull USD 100; 1760 Liability` 时判 `correct`。探针与两个版本的日志：[`added-row-linkage-triage-probe.py`](67f5c44/probes/added-row-linkage-triage-probe.py)。

新发现一和三由 #2 修复，新发现二由 #2 决定修复还是写明不支持。在此之前共同完成条件不成立。

### 0.59 跟在 page 后面的百分比或金额不是页码；货币隔一个空格时无法判定（`733abbe`）

**发现**（Codex [r4421658769](https://github.com/wlvh/policy-compare/pull/11#discussion_r4421658769)，审 `c092726`）：页码表达式把 `Printing cost per page 100USD` 里的 `100` 和 `Page 4%` 里的 `4` 都当成页码。于是卡片在 `100USD` → `200USD`、`4%` → `5%` 上陈述 `page_number_only` 时，评分器确认了这个事实。契约（`FactSchema`）写明金额和百分比从来不属于这个事实。产品（#2 的 `packages/compare-core/structure.ts`）也有同样的问题。

**复现**（[`733abbe/probes/`](733abbe/probes/)）：`409e4e2` 的评分器对下面 7 种写法都判事实成立：`100USD`、`4%`、`4 %`、`100€`、`of 10%`、`per page 100 USD`、`Page 3 USD 100`。产品在页脚行（y=815）上对 `100USD`、`4%`、`100€`、`of 10%` 都陈述了 `page_number_only`。

**改法**（只改评分器）：

| 写法 | `409e4e2` | `733abbe` |
|---|---|---|
| 数后面跟 `%` 或 `‰`，有无空格都算（`Page 4%`、`Page 4 %`、`of 10%`） | 事实成立 | 不是页码，事实被否定（卡片陈述就判 FAIL） |
| 数后面紧跟货币代码或货币符号（`100USD`、`100€`） | 事实成立 | 同上 |
| 改变的数后面隔一个空格是货币代码或符号（`per page 100 USD`、`Page 3 USD 100`、`of 11 USD 100`） | 事实成立 | 两种读法都说得通：页码后面接一个金额，或者这个数本身就是金额。无法判定，记 `claim_unverifiable`。控制用例里未声明的这种改动记 NOT_EVALUATED |
| 对照：`Page 3 of 10` → `Page 4 of 10`；`Page 3 of 10 USD 100` → `Page 4 of 10 USD 100`（货币前的数没变） | 成立 | 成立 |

货币隔一个空格时，本项不猜它是哪种读法：判成金额，会把产品正确的陈述判错；判成页码，又会放过错误的陈述。

**验证**（证据在 [`733abbe/`](733abbe/)）：
- 新测试在 `409e4e2` 的评分器上 2 项失败（[`before-fix-409e4e2.log`](733abbe/before-fix-409e4e2.log)）；
- 评分器测试 141/141、分诊 79/79、`verify:core` 358/358、`tsc` 0；
- 两引擎构建通过，`rules.spec.ts` 两引擎通过；
- 规则与浏览器规则的 4 份报告与 `8906d05` 逐字段相同，只差提交号（[`compare-with-8906d05.txt`](733abbe/compare-with-8906d05.txt)）；严格 28/32，4 项登记的 NOT_EVALUATED，FAIL 0，事件 32/32；
- 这一树的产品与分诊是 `67f5c44` 的：产品 `+row-identity.33`，分诊 `/34`。

产品一侧由 #2 修复。第 0.58 节的三项新发现仍开放。

**之后的分诊发现**（Codex [6518372639](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6518372639)，审 `409e4e2`；#2 的文件）：一行有两处措辞不同、文字重叠的编辑 `USD 100 → USD 200` 与 `100 → 200`，卡片只改了 `USD 100`（`1315 Hull USD 100 100` → `1315 Hull USD 200 100`），两个原子都判 `correct`，事件 `complete`。`/34` 只让完全相同的编辑各自占用一处改动，措辞不同时不分配。`/32` 结果相同。对照：两处都改仍 `correct`；只改裸的 `100` 时不是 `correct`。探针在 [`d9fc5a4/probes/`](d9fc5a4/probes/)。

### 0.60 一张卡的两侧不能把不同已声明事件的金额配成一对（`8ffff71`）

**发现**（Codex [6518612374](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6518612374)，审 `6427bba`）：声明两条记录的金额都改了：SYN-1026-001 的 `100020 → 200020`，SYN-1026-003 的 `300040 → 400040`。一张替换卡把第一条的旧值 `100020` 配上第二条的新值 `400040`，两条金额断言都判 PASS。原因是旧侧的金额由第一个事件豁免，新侧的金额由第二个事件豁免，两侧各自核对，没有核对配对本身。第 0.55、0.56 节只限制了“引用的位置”，这里两侧引用的都确实是事件的证据位置，所以没拦住。

**复现**（[`before-fix-6518612374-shapes.log`](8ffff71/before-fix-6518612374-shapes.log)，`6427bba` 的评分器）：跨事件配对的单卡判 PASS；同一配对写成一条记录的一删一增两张卡也判 PASS；两个事件一个只删除、一个只新增时，跨事件配对同样 PASS。

**改法**（只改评分器）：一张卡，或一条记录的删除卡与新增卡，两侧算作一次改动。先拿掉卡在两侧都编辑了证据位置的事件，剩下的金额如果两侧都有，就是跨事件配对：

| 情形 | `6427bba` | `8ffff71` |
|---|---|---|
| 剩下的金额来自改金额的事件（旧值、新值都有声明），例如 A 的旧值配 B 的新值 | PASS | FAIL：配对与两个事件的声明都矛盾 |
| 剩下的金额只来自只删除或只新增的事件 | PASS | NOT_EVALUATED：两个事件都没有声明与之矛盾的配对，配对是否成立无法核实 |
| 对照：每条记录各自的卡；一张卡同时显示两条记录的改动 | PASS | PASS |
| 对照：没有记录的删除卡与新增卡（各是一张卡，不声称配对） | PASS | PASS |

**验证**（证据在 [`8ffff71/`](8ffff71/)）：
- 新测试在 `6427bba` 的评分器上失败（[`before-fix-6427bba.log`](8ffff71/before-fix-6427bba.log)）；
- 评分器测试 142/142、分诊 79/79、`verify:core` 359/359、`tsc` 0；
- 两引擎构建通过，`rules.spec.ts` 两引擎通过；
- 规则与浏览器规则的 4 份报告与 `733abbe` 相比，只差 R11、R26 的金额断言说明文字（[`compare-with-733abbe.txt`](8ffff71/compare-with-733abbe.txt)）；严格 28/32，4 项登记的 NOT_EVALUATED，FAIL 0，事件 32/32。

### 0.61 只引用小数点或千位分隔符的卡也是对金额的声称（`78182e1`）

**发现**（Codex [6518833952](https://github.com/wlvh/policy-compare/pull/11#issuecomment-6518833952)，审 `2e221b8`）：未变的金额格 `100,020.25`，一张删除卡（或新增卡）只引用其中的小数点，有没有声称行键都一样，两条金额断言都判 PASS。第 0.51 节（`48a5887`）把单独引用的正负号算作对金额的声称，但单独的小数点或千位分隔符被丢掉了。

**复现**（[`before-fix-6518833952-cases.log`](78182e1/before-fix-6518833952-cases.log)，`2e221b8` 的评分器）：只删 `.`、只加 `.`、只删 `,`，各自有无行键，6 种都判 PASS。

**改法**（只改评分器）：金额格里的金额在数字之间有小数点或千位分隔符时，不带数字单独声称的分隔符也算对这个金额的声称，单侧或两侧都算，与正负号相同。单侧声称判 FAIL。对照：同一条记录上先删后加同一个分隔符，仍判 PASS。

**边界**：卡片的声称只有文字、没有它在格里的位置，所以这样的金额格末尾如果有标点（例如句末的句号），单独声称它也会按分隔符读。`layout.json` 的金额格通常只含金额本身。

**验证**（证据在 [`78182e1/`](78182e1/)）：
- 新测试在 `2e221b8` 的评分器上失败（[`before-fix-2e221b8.log`](78182e1/before-fix-2e221b8.log)）；
- 评分器测试 143/143、分诊 79/79、`verify:core` 360/360、`tsc` 0；
- 两引擎构建通过，`rules.spec.ts` 两引擎通过；
- 4 份规则报告与 `8ffff71` 相比只差 R11、R26 的金额断言说明文字（[`compare-with-8ffff71.txt`](78182e1/compare-with-8ffff71.txt)）；严格 28/32，4 项登记的 NOT_EVALUATED，FAIL 0，事件 32/32。

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

**“仅形式”的共同定义**：控制用例只允许答案声明的事件，以及评分器从来源独立重算可证的三种形式变化（D.0）。（这是第十九轮的做法。第二十轮起收窄：未声明的形式变化记 NOT_EVALUATED，不判 PASS；其他未声明的内容变化判 FAIL。见第 0.42 节。）评分器的判定与产品的 `facts` 用同一份文字定义，但各自实现：评分器只用原文、页码和文档行，不用产品的版面角色。差别在于续页标题：产品要求基础标题在两版中都是“标题”角色；评分器要求它是两版中某一行的全文。

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
  - **正负号**（`f0173ed`）：紧贴在数字前的 `-`、`−`、`+` 是金额的一部分，前面不能是字母、数字、`.` 或 `,`（紧跟币种代码时除外，`ea444a0`），所以 `-100,020` 与 `100,020` 是不同的金额。数字之间的连字符不算正负号，例如 `1-100,000`、`SYN-1026-003`。在金额本身带正负号的格里，没连着数字被声称的正负号也算对这个金额的声称，单侧也一样（`48a5887`）；在不带符号金额的格里（如 `1-100,000`），单独声称的连字符不由金额断言判断，这一点不支持。会计写法的括号（`(100,020)`）不当作负号读：括号的增删不会被识别为金额变化，这一点不支持。
  - **货币符号**（`bae0f9e`）：`€`、`$`、`£` 等 Unicode 货币符号与币种代码一样算币种，紧跟其后的数字算金额。`US$` 读作 `$` 加字母 `US`：在版面的币种格里，`US$` 与 `A$` 因字母不同而被区分；在其他文字里只比较 `$`，不区分是哪国的元。
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
- **页码事实只证明文字形式**（`1e44d4d` 撤回了 `2084fc2` 的“重复的页面行”前提，见第 0.42 节）：`page_number_only` 只证明两段文字只差显式 `Page n`、`Page n of N`、`Page n/N` 表达中的完整数字（单侧文字只含这类表达和空白）。它不证明印刷的页码正确或等于 PDF 页号，也不证明这一行是页眉、页脚或标题。不带 `Page` 字样的裸页码（例如 `- 3 -`）不在这个事实之内。后面跟 `%`、`‰`（有无空格都算），或紧跟货币代码、货币符号（`100USD`、`100€`）的数是百分比或金额，不是页码（`733abbe`，第 0.59 节）；改变的数后面隔一个空格才是货币代码或符号（`Page 3 USD 100`、`per page 100 USD`）时，两种读法都说得通，记 `claim_unverifiable`。
- **重复行的文字按抽取的行读**（`259d797`、`498cd4a`）：一处出现的文字按卡片引用的顺序逐个位置读取，每个位置按它所在行的字符顺序读，别的行不算；同一行上后一个位置接在前一个之后时，两者之间的字符也算。抽取若把同一印刷行分成两行、而卡片只引用其中一行，另一行的文字不进入这处出现的变体；一行内字符的顺序以抽取给出的行为准。
- **多余的卡只在有对应 invariant 时才拦截**：额外的、解释不了的卡，只有在该用例声明了禁止它的 invariant 时才会被拒绝，例如 `no_content_differences`、`no_material_differences` 和金额/币种检查。答案没有声明这类要求的用例，评分器不另做误报检查。

## 6. 验证（当前 `78182e1`，产品 `+row-identity.33`、分诊 `/34`；本地 Linux）

每一轮都在该轮的代码提交上完整重跑，证据各自放在对应目录里。

| 轮次 / 代码提交（证据目录） | scorer 测试 | Python 分诊 | `verify:core` | 两个引擎的规则（Node） | 浏览器 `rules.spec.ts`（两个引擎） | 修复前反例（当轮测试文件） |
|---|---|---|---|---|---|---|
| `78182e1`（当前，`78182e1/`；单独声称的分隔符） | 143/143 | 79/79（分诊 `/34`） | 360/360 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `8ffff71` 相比只差 R11、R26 的金额断言说明文字 | `rules.spec.ts` 两引擎通过 | 测试文件在 `2e221b8` 的评分器上 1 项失败（只删小数点的卡判 PASS） |
| `8ffff71`（`8ffff71/`；一张卡的两侧不能配对不同事件的金额） | 142/142 | 79/79（分诊 `/34`） | 359/359 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `733abbe` 相比只差 R11、R26 的金额断言说明文字 | `rules.spec.ts` 两引擎通过 | 测试文件在 `6427bba` 的评分器上 1 项失败（跨事件配对的卡与一删一增判 PASS） |
| `733abbe`（`733abbe/`；跟在 page 后面的百分比或金额不是页码） | 141/141 | 79/79（分诊 `/34`） | 358/358 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；4 份报告与 `8906d05` 逐字段相同，只差提交号 | `rules.spec.ts` 两引擎通过 | 测试文件在 `409e4e2` 的评分器上 2 项失败（`100USD`、`4%` 等判事实成立） |
| `67f5c44`（`67f5c44/`；合入 #2 的 `8bf16df`，评分器未改） | 140/140 | 79/79（分诊 `/34`） | 357/357 | 未跑：产品有一处回退未修（第 0.58 节），等 #2 的修复后在最终联合树上跑 | 未跑（同左） | 评分器未改；产品与分诊修前修后的对照见 `67f5c44/probes/` |
| `8906d05`（`8906d05/`；只算卡片编辑的文字块） | 140/140 | 未变（77/77） | 355/355 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `f6d0ea0` 相比只差 R11、R26 的金额断言说明文字 | `rules.spec.ts` 两引擎通过 | 测试文件在 `8f0e71b` 的评分器上 1 项失败（引用声明记录未改动的上下文后，跨记录配对判 PASS） |
| `f6d0ea0`（`f6d0ea0/`；声明的金额变化只豁免引用其证据位置的卡） | 140/140 | 未变（77/77） | 355/355 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `081f370` 相比只差 R11、R26 的金额断言说明文字 | `rules.spec.ts` 两引擎通过 | 测试文件在 `f46ec7a` 的评分器上 1 项失败（跨记录配对的金额被另一条记录的声明豁免，判 PASS） |
| 联合树 `081f370`（`081f370/`；#2 的 head，产品 `+row-identity.32`，分诊 `/32`） | 139/139 | 77/77（分诊 `/32`） | 354/354 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `81e065a` 逐字段相同，只差提交号 | 完整浏览器测试各 16/16；PDF 机制、审核回归通过 | 评分器未改；分诊修复前后的对照见 `081f370/probes/` |
| `81e065a`（`81e065a/`；文字显示声明变化时其他格的声称仍比较） | 139/139 | 未变（76/76） | 353/353 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `d16ed68` 相比只差 R11、R26 的金额断言说明文字 | `rules.spec.ts` 两引擎通过 | 测试文件在 `d16ed68` 的评分器上 1 项失败（`100,020U` → `200,020E` 判 PASS） |
| `d16ed68`（`d16ed68/`；声明变化的豁免只覆盖按声明变化的格） | 139/139 | 未变（76/76） | 353/353 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `8a178d5` 相比只差 R11、R26 的金额断言说明文字 | `rules.spec.ts` 两引擎通过 | 测试文件在 `ee1ce44` 的评分器上 2 项失败（声明变化旁的币种声称 `1U` → `2E` 判 PASS） |
| `8a178d5`（`8a178d5/`；按声明变化的金额格里的声称；`1c09dfc` 再合入 #2 只含报告的 `5c6dab6`，代码相同） | 138/138 | 未变（76/76） | 352/352 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `48a5887` 相比只差 R11、R26 的金额断言说明文字 | `rules.spec.ts` 两引擎通过 | 测试文件在 `1da2746` 的评分器上 1 项失败（声明了变化、只引变化字符的卡被报“值未变”） |
| `48a5887`（`48a5887/`；单侧只引用正负号的卡；`1da2746` 只加一行登记） | 137/137 | 未变（76/76） | 351/351 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `8e638cb` 相比只差 R11、R26 的金额断言说明文字 | `rules.spec.ts` 两引擎通过 | 测试文件在 `9ff5ea1` 的评分器上 1 项失败（只删 `-100,020` 的 `-` 的卡判 PASS） |
| 联合树 `8e638cb`（`8e638cb/`；合并 #2 `5888e7d`，产品 `+row-identity.31`，分诊 `/29`；币种代码后的正负号） | 136/136 | 76/76（分诊 `/29`） | 350/350 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `933ea5b` 逐字段相同，只差提交号 | 完整浏览器测试各 16/16；PDF 机制、审核回归通过 | 测试文件在 `b9e6f8a` 的评分器上 1 项失败（`USD−100,020` → `USD+100,020` 判 PASS） |
| `933ea5b`（`933ea5b/`；无记录删除卡、新增卡的整格金额） | 136/136 | 未变（74/74） | 348/348 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `498cd4a` 逐字段相同，只差提交号 | `rules.spec.ts` 两引擎通过 | 测试文件在 `839f2a2` 的评分器上 1 项失败（无键的删除卡、新增卡把正负号在两条记录间移动，判 PASS） |
| `498cd4a`（`498cd4a/`；重复行按引用顺序逐个位置读取） | 135/135 | 未变（74/74） | 347/347 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `61e4add` 逐字段相同，只差提交号 | `rules.spec.ts` 两引擎通过 | 测试文件在 `61e4add` 的评分器上 1 项失败（右往左抽取的表头，产品的正确卡判 FAIL） |
| 联合树 `61e4add`（`61e4add/`；#2 的 head，产品 `+row-identity.30`，分诊 `/28`） | 134/134 | 74/74（分诊 `/28`） | 346/346 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `786aefc` 逐字段相同，只差提交号 | 完整浏览器测试各 16/16；PDF 机制、审核回归通过 | 评分器未改 |
| `786aefc`（`786aefc/`；单独的正负号、跨组重复编辑） | 134/134 | 未变（73/73） | 345/345 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `3feb37d` 相比只差两个用例的金额 invariant 说明文字 | `rules.spec.ts` 两引擎通过 | 测试文件在 `c29c5bf` 的评分器上 2 项失败（交换两格正负号的卡判 PASS；声称不同键的重复编辑判 PASS） |
| 联合树 `3feb37d`（`3feb37d/`；合并 #2 `c5a5330`，产品 `+row-identity.29`，分诊 `/27`） | 132/132 | 73/73（分诊 `/27`） | 343/343 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `ed11a5f` 逐字段相同，只差提交号 | 完整浏览器测试各 16/16；PDF 机制、审核回归通过 | 评分器未改 |
| `ed11a5f`（`ed11a5f/`；删除卡与新增卡的金额按来源记录相抵） | 132/132 | 未变（73/73） | 340/340 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `b85a1bd` 相比只差两个用例的金额 invariant 说明文字 | `rules.spec.ts` 两引擎通过 | 测试文件在 `565480c` 的评分器上 1 项失败（跨记录的一对删除卡、新增卡共用声称的键，判 PASS） |
| 联合树 `b85a1bd`（`b85a1bd/`；合并 #2 `b8a9b55`，产品 `+row-identity.28`） | 131/131 | 73/73（分诊 `/26`） | 339/339 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `211a705` 逐字段相同，只差提交号 | 完整浏览器测试各 16/16；PDF 机制、审核回归通过 | 评分器未改 |
| 联合树 `211a705`（`211a705/`；合并 #2 `9b57000`，分诊 `/26`；未决标记） | 131/131 | 73/73（分诊 `/26`） | 337/337 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `1e44d4d` 相比只差提交号和 R26 一条说明文字 | 完整浏览器测试各 16/16；PDF 机制、审核回归通过 | 测试文件在 `1e44d4d` 的评分器上 3 项失败（写着正确键、标 `unresolved` 的卡判已确定） |
| 联合树 `1e44d4d`（`1e44d4d/`；快进到 #2 `cb27454`，分诊 `/25`；页码事实只看文字形式） | 128/128 | 72/72（分诊 `/25`） | 334/334 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `9e9104f` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制、审核回归通过 | 测试文件在 `cb27454` 的评分器上 3 项失败（单行页码事实记“无法评价”） |
| 联合树 `9e9104f`（`9e9104f/`；#2 的 head，分诊 `/24`） | 128/128 | 71/71（分诊 `/24`） | 332/332 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `4a12cd0` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制、审核回归通过 | 评分器未改 |
| `4a12cd0`（`4a12cd0/`；日期须为完整数字） | 128/128 | 未变（70/70） | 328/328 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `bae0f9e` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `bae0f9e` 逐项相同 | 测试文件在 `1344e17` 的评分器上 1 项失败（`20240` 的卡判事实成立） |
| `bae0f9e`（`bae0f9e/`；货币符号算币种） | 127/127 | 未变（70/70） | 327/327 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `509b088` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `509b088` 逐项相同 | 测试文件在 `4f9af96` 的评分器上 1 项失败（`€` 配 `$` 的卡判 PASS） |
| 联合树 `509b088`（`509b088/`；#2 的 head，分诊 `/23`） | 126/126 | 70/70（分诊 `/23`） | 326/326 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `259d797` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制、审核回归通过 | 评分器未改 |
| `259d797`（`259d797/`；重复行只取自己那几行的字符） | 126/126 | 65/65（分诊 `/21`） | 322/322 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `cedf563` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `cedf563` 逐项相同 | 测试文件在 `cedf563` 的评分器上 1 项失败（按列抽取的表头，产品的正确卡判 FAIL） |
| 联合树 `cedf563`（`cedf563/`；合并 #2 `72eb95f`，分诊 `/21`） | 125/125 | 65/65（分诊 `/21`） | 321/321 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `16ae858` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制、审核回归通过 | 评分器未改 |
| `16ae858`（`16ae858/`；金额格内只改正负号） | 125/125 | 未变（63/63） | 318/318 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `91aa884` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `91aa884` 逐项相同 | 测试文件在 `32f357e` 的评分器上 1 项失败（只改正负号的卡判 PASS） |
| 联合树 `91aa884`（`91aa884/`；合并 #2 `6060f6c`，分诊 `/20`） | 125/125 | 63/63（分诊 `/20`） | 318/318 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `9354b84` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 评分器未改 |
| 联合树 `9354b84`（`9354b84/`；合并 #2 `7847d7d`，分诊 `/19`） | 125/125 | 59/59（分诊 `/19`） | 314/314 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `8d1f1ea` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 评分器未改 |
| 联合树 `b3e84c8`（`b3e84c8/`；合并 #2 `441a81d`，分配耗时） | 125/125 | 57/57（分诊 `/18`，`441a81d`） | 未重跑（代码同 `8d1f1ea`） | 未重跑（产品、评分器代码同 `8d1f1ea`） | 未重跑 | 评分器未改 |
| 联合树 `8d1f1ea`（`8d1f1ea/`；合并 #2 `be1ed04`，分诊 `/18`） | 125/125 | 57/57（分诊 `/18`） | 310/310 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `7d47980` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 评分器未改 |
| 联合树 `630a2af`（`630a2af/`；合并 #2 `c14276c`，分诊 `/17`） | 125/125 | 55/55（分诊 `/17`） | 未重跑（代码同 `7d47980`） | 未重跑（产品、评分器代码同 `7d47980`） | 未重跑 | 新测试在 `5ff1913` 的评分器上失败，在 `b6aa2c8` 起通过 |
| 联合树 `7d47980`（`7d47980/`；合并 #2 `9582515`） | 125/125 | 53/53（分诊 `/16`） | 307/307 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `74707bd` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 评分器未改 |
| 联合树 `74707bd`（`74707bd/`；合并 #2 `8f63087`，每侧读页码计数） | 125/125 | 53/53（分诊 `/16`） | 306/306 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `a2dbe21` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 测试文件在 `a2dbe21` 的评分器上 1 项失败（产品的正确卡被判 FAIL） |
| 联合树 `a2dbe21`（`a2dbe21/`；合并 #2 `91366d2`，页码事实保留空白） | 124/124 | 50/50（分诊 `/15`） | 304/304 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `9ed97f2` 逐项相同 | MuPDF 16/16；PDF.js 15/16（F7 超时，单独重跑通过）；PDF 机制、审核回归通过 | `4c8537d` 的新用例在 `b6aa2c8` 的评分器上失败（NOT_EVALUATED 而非 FAIL） |
| `b6aa2c8`（`b6aa2c8/`；事件数字的正负号） | 124/124 | 未变（50/50） | 303/303 | **退出码 2**：与 `9ed97f2` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `9ed97f2` 逐项相同 | 测试文件在 `5ff1913` 的评分器上 1 项失败（`-200` 的卡算作事件的 `200`） |
| 联合树 `9ed97f2`（`9ed97f2/`；合并 #2 `5989361`，重复列出的出现、页码事实的范围） | 124/124 | 50/50（分诊 `/15`） | 303/303 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `33f0cdb` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 测试文件在 `935b6e4` 的评分器上 4 项失败（重复列出的出现、正文句子的页码事实判 PASS） |
| 联合树 `33f0cdb`（`33f0cdb/`；合并 #2 `d6e1837`，常规印法的页码计数） | 123/123 | 47/47（分诊 `/14`） | 300/300 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `4d6b086` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 测试文件在 `4d6b086` 的评分器上 1 项失败（产品的正确卡被判 FAIL） |
| 联合树 `4d6b086`（`4d6b086/`；合并 #2 `0e34d77`，变体保留空白） | 122/122 | 47/47（分诊 `/14`） | 298/298 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `f0173ed` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 测试文件在 `f0173ed` 的评分器上 1 项失败（产品的正确卡被判 FAIL） |
| `f0173ed`（`f0173ed/`；金额的正负号） | 121/121 | 未变（45/45） | 294/294 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `d5de336` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `d5de336` 逐项相同 | 测试文件在 `d5de336` 的评分器上 1 项失败（正负号变化的卡判 PASS） |
| 联合树 `d5de336`（`d5de336/`；合并 #2 `2f180a7`） | 120/120 | 45/45（分诊 `/13`） | 293/293 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `680914f` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 评分器未改 |
| `680914f`（`680914f/`；页码表达式中的完整数字） | 120/120 | 未变（45/45） | 290/290 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `8c48dac` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `8c48dac` 逐项相同 | 测试文件在 `8c48dac` 的评分器上 1 项失败（两种情形都是 NOT_EVALUATED） |
| 联合树 `8c48dac`（`8c48dac/`；合并 #2 `6b29460`） | 120/120 | 45/45（分诊 `/13`） | 290/290 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `72b87c4` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 评分器未改；分诊修复前后的对照见 `8c48dac/probes/` |
| 联合树 `72b87c4`（`72b87c4/`；合并 #2 `3b991a0`） | 120/120 | 44/44（分诊 `/12`） | 289/289 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `3c9876f` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 评分器未改；分诊修复前后的对照见 `72b87c4/probes/` |
| `3c9876f`（`3c9876f/`；事件的旧、新出现对得上） | 120/120 | 未变（44/44） | 288/288 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `948c3a1` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `948c3a1` 逐项相同 | 测试文件在 `948c3a1` 的评分器上 1 项失败（第一个 `Sudan` 判 FAIL，两端金额判 PASS） |
| 联合树 `948c3a1`（`948c3a1/`；#2 的 `/10`、产品 `+ops.4`） | 120/120 | 44/44（分诊 `/10`） | 288/288 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `7e9a760` 逐项相同 | 完整浏览器测试各 16/16；PDF 机制 7/7、审核回归 10/10 | 评分器未改；分诊修复前后的对照见 `948c3a1/probes/` |
| `7e9a760`（`7e9a760/`；位置集逐侧核对） | 120/120 | 未变（40/40） | 282/282 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `12ebf01` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `12ebf01` 逐项相同；其他浏览器测试、PDF 机制、审核回归沿用 `dcc549e` | 测试文件在 `12ebf01` 的评分器上 2 项失败（三张伪造卡判 PASS） |
| 联合树 `12ebf01`（`dcc549e/`、`12ebf01/`；合并 #2 `367020b`） | 120/120 | 40/40（分诊 `/9`） | 282/282 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `e0ed816` 逐项相同 | 完整浏览器测试各 16/16（`dcc549e`）；`rules.spec.ts` 在 `12ebf01` 上相同 | 测试文件在 `285f993`、`dcc549e` 的评分器上分别 1、2 项失败 |
| `e0ed816`（`e0ed816/`；三个共同根因） | 120/120 | 未变（37/37） | 275/275 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `09cf6e4` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `09cf6e4` 逐项相同 | 本轮测试文件在 `5dde304`、`6a78f0c`、`0c248bc` 的评分器上分别 1、3、2 项失败 |
| 联合树 `09cf6e4`（`09cf6e4/`） | 118/118 | 未变（37/37） | 273/273 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `842b0ff` 逐项相同 | `rules.spec.ts` 两引擎通过，与 `842b0ff` 逐项相同；其他浏览器测试沿用 `842b0ff` | `63a750c` 的评分器上 1 项失败（一个操作拼接两处位置的卡判 PASS） |
| 联合树 `842b0ff`（`842b0ff/`；合并 #2 `31f07ed`） | 118/118 | 37/37（分诊 `/8`） | 273/273 | **退出码 2**：严格 28/32，事件 32/32；位置集 11/11；与 `b4f97b6` 逐项相同 | 完整浏览器测试各 16/16，`rules.spec.ts` 只剩登记缺口 | 评分器未改；产品修复前后的对照见 `leap-day-probe.log` |
| 第二十轮联合树 `9d7f266`（`9d7f266/`；合并 `42bfc9b`） | 118/118 | 35/35（分诊 `/7`） | 271/271 | **退出码 2**：严格 NOT_EVALUATED 28/32，事件 32/32；位置集 11/11 | 完整浏览器测试各 16/16，`rules.spec.ts` 只剩登记缺口 | `a4954a1` 的评分器读联合树：2 项失败，规则退出码 1（R24:E1 身份路径不受支持） |
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
pnpm test:rules:mupdf; echo "exit $?"   # 最终联合树 09cf6e4、842b0ff 与 9d7f266 预期为 2（74693f3 至 a4954a1 为 1，第十九轮为 2，第十八轮为 1）
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
