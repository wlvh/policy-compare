# 审核者入口

本仓库交付同一保单比较产品的 PDF.js 与 MuPDF.js 两个独立版本。请审核代码、运行结果与证据之间是否一致；文档中的 PASS 是已有测试的结论，不是要求审核者接受该结论。

这是用户授权建立的私有审核仓库。材料全部为项目源码、虚构测试 PDF 与技术测量，没有真实保单。未邀请或通知具体审核者，也未执行生产部署。对外公开、共享服务和生产许可仍按实际范围核实。

## 1. 版本与材料

| 对象 | 固定位置或版本 | 用途 |
|---|---|---|
| 原始任务包 | `97bbdcd` | 原始说明、32 对规则与标准答案；PR 的 `main` 基线 |
| 正式性能产品版本 | `f81aebd8f2e756b781b40957a06237a6cefb5c3e` | 360 次热比较、6 次冷启动、40 次全程交互/晚期取消使用的产品源码 |
| 本地交付报告 | `d6c3afb` | 正式验收、对照报告和交付工具 |
| 当前审核版本 | `review-20261026` 标签 | 增加本指南、审核打包与 Linux CI；若有后续修复，另用提交和证据说明 |
| 当前分支 | `feat/policy-compare` | 仓库默认显示待审核实现；Draft PR 指向原任务包 `main`，尚未合并 |
| 运行包哈希 | [DELIVERY_MANIFEST.json](../DELIVERY_MANIFEST.json) | 两个静态运行包的 SHA-256；包内 BUILD.json 锁定每个静态文件 |
| 审核附件哈希 | Release 的 `REVIEW_ARTIFACTS.json` | 审核 ZIP、冻结性能输入及两个运行包的大小、SHA-256 与源码提交 |

完整提交历史在 Git 仓库中。审核 ZIP 是标签对应的源码快照，保留原目录结构，并附正式测量使用的 `bench/generated` 字节；没有 `.git`、依赖安装目录、嵌套 ZIP 或运行包。两个运行包作为单独附件提供。GitHub 自动生成的 Source code ZIP 不包含忽略的性能输入，请使用命名审核 ZIP，或另下载冻结输入附件。

性能 PDF 为 3 类 × 3 个规模 × 2 份，共 18 份，另有作者预期和 SHA-256 清单。不要先重新生成它们再宣称复现了既有测量的原始输入。

## 2. 先读这些要求与结论

1. [CODEX_ENGINE_AB_AMENDMENT.zh-CN.md](../CODEX_ENGINE_AB_AMENDMENT.zh-CN.md)：覆盖旧方案冲突条款。
2. [IMPLEMENTATION_PLAN.zh-CN.md](../IMPLEMENTATION_PLAN.zh-CN.md)、[START_HERE.zh-CN.md](../START_HERE.zh-CN.md)：其他范围、预算与验收要求继续有效。
3. [总验收](acceptance-report.md)、[PDF.js 验收](acceptance-pdfjs.md)、[MuPDF 验收](acceptance-mupdf.md)、[引擎对照](engine-comparison.md)。
4. [原规则集说明](../validation/README.md)、[32 条规则目录](../validation/dataset/CASE_CATALOG.zh-CN.md)：构造检查不等于产品正确。

本地交付时，两个引擎各 32 对规则和浏览器位置通过，公共 34 项测试、各 11 组浏览器流程通过。正式 A/B 360/360 热比较与 6/6 冷启动成功。完整内存、普通参考设备与真实留出仍未通过。原本机 Docker 无响应的 BLOCKED 记录保留；新 GitHub Linux CI 是独立补充证据，需检查实际 job 及附件，不能从工作流文件存在推定成功。

旧报告中的“未推送/没有远程”是 `d6c3afb` 本地交付时点的事实；本次用户随后授权创建仓库和上传审核材料。旧原始数据不因上传而改写。CI 的 Linux/云主机结果不替代 M4 Max A/B 或用户目标设备测量。

## 3. 代码与风险索引

| 审核问题 | 主要实现 | 证据 |
|---|---|---|
| 两边固定同一引擎，无静默回退 | `packages/pdf-adapter/api.ts`、`node.ts`、`apps/web/main.tsx`、`vite.config.ts` | `tests/boundary.test.ts`、独立构建报告、运行包请求记录 |
| 原文、身份、标量/UTF-16、位置精度 | `packages/contracts/index.ts`、`engines/*/adapter.ts` | `docs/contracts.md`、`tests/contracts.test.ts`、两版 pdf-checks |
| PDF.js 提取与文字层来源一致 | `engines/pdfjs/view.ts`、`client.ts` | 浏览器规则报告、R04/R09/R14/R31 历史失败与修复说明 |
| MuPDF 原生几何及非 BMP | `engines/mupdf/adapter.ts`、`patches/mupdf@1.28.1.patch` | 旋转/CropBox/UserUnit/Unicode 机制测试 |
| 主体、表格键、移动和拆合 | `packages/compare-core/`、`profiles/` | 核心测试、R10/R12/R13/R15/R22–R26 |
| 规则评分不依赖卡片数或另一引擎 | `tests/evaluation/scorer.ts`、`scripts/acceptance.ts` | 16 项评分器反例、两版 rules 与 browser-rules |
| 覆盖缺口不变成假完整 | 两个适配器、公共核心、`PageCanvas.tsx` | R25/R27/R28；保留金额双侧来源及具体缺口区域 |
| 生命周期、取消、导出、网络 | `apps/web/`、`tests/browser/` | 连续 20 次任务/取消、晚期取消、无上传请求 |
| 公平完整路径测量 | `bench/compare.ts`、`interactions.ts`、`generate.py` | 逐轮输入哈希、顺序、计时、正确性、位置与内存原件 |
| 容器与可复现构建 | `deploy/`、独立锁文件、`.github/workflows/ci.yml` | 实际 Docker job、非 root/只读启动与健康检查 |

建议特别核查：R18 连字、R21 勾选、R25 歧义键下的可见金额及两侧来源、R27/R28 图像缺口；六个控制用例不能用 Review 分类豁免假变化。运行时代码不得读取 `expected/source/layout`。PDF.js 的 run 框不能算精细高亮，真正精细位置来自浏览器文字层实测。

## 4. 最短复现路径

需要 Node 24 LTS、pnpm 10.12.1、Python 3.10+。本地原测量使用 Node 24.19.0；Python 依赖锁定在 `validation/requirements.txt`。安装依赖需要包注册表网络；单独运行 Release 运行包不需要下载 npm 依赖。

```sh
gh repo clone wlvh/policy-compare
cd policy-compare
git checkout review-20261026
corepack enable
corepack prepare pnpm@10.12.1 --activate
pnpm install --frozen-lockfile
pnpm install:pdfjs
pnpm install:mupdf
python3 -m venv .venv
.venv/bin/python -m pip install -r validation/requirements.txt
```

若使用命名审核 ZIP，直接进入解压目录即可，无需 Git checkout。只审核 PDF.js 的独立性时，不执行 `pnpm install:mupdf`。

```sh
# 构造检查与产品检查分开
.venv/bin/python validation/fixture_checks.py
pnpm verify:core
pnpm build:pdfjs
pnpm build:mupdf
pnpm test:rules:pdfjs
pnpm test:rules:mupdf
pnpm exec tsx scripts/pdf-check.ts pdfjs
pnpm exec tsx scripts/pdf-check.ts mupdf

# 默认使用已安装 Google Chrome；没有时用 Playwright Chromium
pnpm exec playwright install --with-deps chromium
POLICY_BROWSER_CHANNEL=bundled pnpm test:browser:pdfjs
POLICY_BROWSER_CHANNEL=bundled pnpm test:browser:mupdf

# 使用冻结 bench/generated 输入后，再执行 CLI 的取消场景
pnpm exec tsx scripts/cli-check.ts
pnpm exec tsx scripts/independent-build.ts
pnpm test:container pdfjs
pnpm test:container mupdf
```

本地试用：`pnpm dev:pdfjs` 或 `pnpm dev:mupdf`。CLI 命令见根 README；`--engine` 显式选 `pdfjs` 或 `mupdf`。运行包解压后执行 `node server.mjs`，选择包内 `samples/before.pdf` 和 `after.pdf`。

全量入口为 `pnpm verify`，单版为 `pnpm verify:pdfjs` / `pnpm verify:mupdf`。环境缺失时返回 BLOCKED/非零，不应通过删除必需检查把汇总变成绿色。

## 5. 复核已有性能证据或重新测量

先查看 [reports/engine-ab.json](../reports/engine-ab.json) 与 [reports/interaction-profile.json](../reports/interaction-profile.json)。全部尝试保留，成功数与总数同时记录；正式产品冻结为 `f81aebd`。统计环境为 M4 Max / 128 GiB / Chrome 154，不能把其结果外推到普通办公电脑。

从 Release 下载 `policy-compare-benchmark-inputs.tar.gz`，在项目根解压即可恢复 `bench/generated`。命名审核 ZIP 已包含这些文件。校验清单里的 18 个 PDF 哈希后，分别在两个终端执行：

```sh
STATIC_ROOT=dist/pdfjs PORT=8081 node deploy/server.mjs
STATIC_ROOT=dist/mupdf PORT=8082 node deploy/server.mjs
```

另一个终端运行 `pnpm bench:compare`，再运行 `pnpm bench:interactions`。先保存仓库已有 `reports/engine-ab.json` 等报告，避免覆盖原始证据。完整 A/B 会做 360 次热比较，不能用少量 smoke 代替。当前完整物理内存采集实现使用 macOS 工具；Linux/其他设备须适配统计并另列口径，不能用 JS heap 宣称完整内存通过。

`bench/generate.py` 可重建合成工作负载，但既有 A/B 的字节以附件为准。它们有可用编号/键信息，是受控合成样本，不能冒充真实、不同来源、未调参的留出集。

## 6. 证据索引与剩余条件

- `reports/validation-integrity.json`：原 validation 的 184 个文件与 `97bbdcd` 一致。
- `reports/rules-{pdfjs,mupdf}.json`、`browser-rules-*.json`：分别按业务事件和实际原文位置评分。
- `reports/core-tests.json`、`browser-tests-*.json`、`pdf-checks-*.json`、`cli-checks.json`：各测试层实际结果。
- `reports/pdfjs-independent-build.json` 与 `.log`：隔离安装/构建，无 MuPDF。
- `reports/engine-ab.json`、`interaction-profile.json`：正式逐轮记录。
- `reports/baseline-single-engine/`、`baseline-ab-7a676c6/`、`failures/`、`diagnostics/`：旧测量和失败未删除；它们不代表最终版本验收。
- `reports/delivery-check.json`：两个运行包实际解压、浏览器比较、哈希与生命周期验证；是 macOS 验证。
- `docs/third-party/`、`reports/*licenses*.json`、独立锁文件、运行包 DEPENDENCIES.json：实际第三方版本与许可材料。
- GitHub Actions 的 `reports-*` 和 `linux-container-*` 附件：本次 Linux CI 的独立原始报告，按 run ID/提交读取。

剩余条件：完整内存口径仍有短寿命进程峰值缺口；普通 16 GiB/实际目标设备尚未测量；真实开发样本、完整人工审阅和独立封存留出未提供；实际公开分发/共享服务/生产范围尚未落实。Linux 容器是否解除原本机阻塞，应以本次 CI 实际结果单独判断。工程综合与业务试点不能仅因 CI 绿色而自动改成通过。

审核发现请附文件/行号、复现输入、实际与预期、具体来源证据及影响范围。预期若来自新业务材料，应独立记录该材料与授权，不能修改既有标准答案迎合任一引擎输出。
