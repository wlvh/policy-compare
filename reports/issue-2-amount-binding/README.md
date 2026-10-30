# Python 完整金额对应核验补正（2026-10-30）

接续对 `3a520c1` / `a6043d9` 的独立复核。本次只修改 `scripts/renewal-triage.py` 和既有 Python 正式测试；产品、TS 评分器、预期、身份声明、PDF 均不变。代码提交 `f8353c8e2e27b30bcb5a592bdbc010b81c2aa07f`，分诊 `renewal-triage/40`，交付待独立复核，不合并 PR。

## 反例与实际结果

[repro.py](repro.py) 保存用户给出的复现代码，输入、辅助函数调用及断言未改；从仓库根目录运行 `python3 reports/issue-2-amount-binding/repro.py`。被审版本上的 [before/user-repro.log](before/user-repro.log) 与修改后的 [after/user-repro.log](after/user-repro.log) 分开保留。

预期：同记录 `123 / Alpha`，`USD 100 → USD 2000`。错误卡 A 为 `100→200`，B 为 `1000→2000`。

| 检查 | 修复前 | 修复后 |
|---|---|---|
| 事件结论 | split_attributable | not_evaluable |
| 接受卡 | a、b | 空 |
| 整行恢复 | true | None：没有可确认的接受记录，不声明恢复 |
| 未解释卡 | 0 | 2 |
| 用户断言 | 失败，退出 1 | 通过，退出 0 |

## 修复依据

以前把对侧增删操作的文字片段用子串关系核对答案。`1→2` 的改变片段符合预期，但该来源保留的 `00` 或 `000` 被漏掉了。

现在从当前选中出现的完整字符区间出发，沿同卡的编辑操作还原另一侧：未改变的字符继续保留，边缘的替换操作块也纳入。对侧非空时，必须完整等于当前编辑的对侧值，并在原文顺序、完整数字边界和**同一组编辑位置**上命中，不能从卡片其他位置借同值。对侧确实为空的真正删除/新增继续允许。

纯插入/删除与另一项合法编辑同处一个操作块时，仍允许由已独立配对的邻接编辑解释该部分，但消费其确切编辑位置，不再消费允许文字的子串集合。没有添加金额模型、币种词表或新的评分器。

## 验证与复用

- [before/python.log](before/python.log)：新增正式测试配被审代码，原向、反向及带小数三种错误金额组合均复现失败。
- [after/python.log](after/python.log)：Python 正式测试 **88/88**；`py_compile` 通过。
- 新测试同方法覆盖：两张错误替换、错误旧半＋真正新增、真正删除＋错误新半、正确单卡、真正删除＋新增；分别检查结论、接受卡、整行恢复和未解释卡。正确替换还直接从左右两侧调用 `pure()` 验证兼容性，避免用拒绝所有替换来通过反例。
- 既有正确多卡、同事件配对、重复格、原来四项修复及插入 `later` 同时 `now→soon` 的正向仍全部通过。
- [scope-and-reuse.json](scope-and-reuse.json) 保存两处源码改动和产品/TS/身份声明 Git 对象未变的证据。因此复用已核实的 [PR CI 41048431006](https://github.com/wlvh/policy-compare/actions/runs/41048431006)、[push CI 41048412027](https://github.com/wlvh/policy-compare/actions/runs/41048412027) 的产品、核心 373/373、两引擎浏览器各 16/16、容器等结果；这些不是本轮本地重跑结果。

新候选的仓库 CI 也已自然完成：[PR 41052907187](https://github.com/wlvh/policy-compare/actions/runs/41052907187)、[push 41052892673](https://github.com/wlvh/policy-compare/actions/runs/41052892673) 各 6 个作业全部成功，逐步状态见 [ci/pr-run.json](ci/pr-run.json)、[ci/push-run.json](ci/push-run.json)。分诊作业原始日志 [ci/python-job.log](ci/python-job.log) 明确记录当前测试 88/88 及新增完整对侧测试通过。上述产品/TS 的本轮复用依据仍为文件对象未变和既有证据，不把远端运行写成本地实跑。

## 固定产品输出重评

本轮**没有重新提取 PDF**。`python3 reports/issue-2-amount-binding/retriage.py` 读取 `reports/issue-2-followup/renewal/` 的四份固定压缩结果，解压后先核对原运行记录的 SHA-256；作者 edits 文件也核对既有 SHA-256，再运行当前分诊。

[retriage/runs.json](retriage/runs.json) 逐次记录命令、退出码、固定产品哈希和前后事件哈希。两对续保×两引擎均退出 0，**事件全部字段相同、文件字节也相同**；四份 delta 为空。当前事件保存在压缩 JSON 中，旧结果和旧证据没有改写。

产品变化检测证据沿用原交付；本次只证明新分诊拒绝已复现错误，同时没有改变这四份固定结果的评价。可评价范围错误归属仍为 0，未评价、未定位及部分定位不是“无差异”。

R16/R18/R23/R24 仍为原四项严格未评价；严格 28/32、事件 32/32、指定位置集 11/11 沿用未改的产品与 TS 评分器证据。航空 #87/#88/#89/#93 拆卡代价、#91 自动未评价及两栏/稀疏表等范围不变。真实试用 NOT_RUN、业务签收和指定设备性能 BLOCKED、部署 NOT_RUN。未合并 PR 到 feat/main，未切默认或改冻结 review 分支。
