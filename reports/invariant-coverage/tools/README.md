# 证据工具

这些脚本原先放在 Claude Code 会话的临时目录里，`reports/invariant-coverage/<提交>/` 下的日志和报告都是用它们生成的。交接时，每个脚本取最新版本放到这里，并把写死的提交号和临时路径改成参数，用法与当时相同。所有命令都在仓库根目录运行。

| 文件 | 作用 | 交接时的核对 |
|---|---|---|
| `scorer-chain.sh <名称>` | 评分器链：评分器测试、分诊测试、`verify:core`、`tsc`、两引擎的规则验收、构建与 `rules.spec.ts`。输出写到 `reports/invariant-coverage/<名称>/` | 只做了 `bash -n`；改成参数后没有重跑（原版生成了 `c9c6e0c/`） |
| `full-chain.sh <名称> <结果目录>` | 全套联合链：评分器链，加上 PDF 机制、审核回归、浏览器全套，再用两个引擎重新提取续保结果并分诊。续保样本要先放进 `tmp/renewal-inputs`（见 `scripts/fetch-renewal-samples.mjs`） | 只做了 `bash -n`；原版生成了 `88718d0/` |
| `triage-probes.sh <目录>` | 依次运行 `*/probes/` 下所有 Python 分诊探针。目录参数是含 `tests/test_renewal_triage.py` 和 `scripts/renewal-triage.py` 的那份代码 | 在 `09c3d5a` 上运行：52 个探针，输出与 `88718d0/probes/` 里已提交的日志相同 |
| `compare-rules.py <旧> <新>` | 两个证据目录的 4 份规则报告逐字段比较，提交号除外 | `88718d0 c9c6e0c` 的输出与 `c9c6e0c/compare-with-88718d0.txt` 相同 |
| `register.mts <证据目录> <完整提交号>` | 生成覆盖登记 `register.json` | 用 `c9c6e0c` 的报告重新生成，结果与已提交的 `c9c6e0c/register.json` 逐字节相同 |
| `renewal-compare.py <旧结果目录> <旧证据目录名> <新结果目录> <新证据目录名>` | 比较两棵树在续保上的结果：产品卡片，以及逐事件的分诊结论 | 用 `081f370` 和 `88718d0` 运行：卡片除 `coreVersion` 外相同，没有事件改变，与 `88718d0/renewal/compare-with-081f370.txt` 一致 |
| `playwright.local.config.ts` | 本地浏览器配置，指向预装的 Chromium。两个链脚本运行前会把它复制到 `tmp/`（`tmp/` 不入库） | |

TypeScript 探针用 `pnpm exec tsx <探针>` 运行。Python 探针用 `python3 -I <探针> <目录>` 运行，各目录的 `probes/README.md` 说明每个探针检查什么。
