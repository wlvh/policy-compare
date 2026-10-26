# 保单 PDF 比对 · 双引擎本地验证版

**接手和体验请先读：[开发交接手册](docs/handoff.zh-CN.md)。** 包含运行包、源码启动、CLI、测试文件、界面操作、结果含义、观察方法、已知问题与后续难点。固定快照及完整附件见 [handoff-20261026](https://github.com/wlvh/policy-compare/releases/tag/handoff-20261026)。

**当前明确限制：通用表格行列恢复尚未实现。** 新两对合成续保样本均返回 partial，已确认承保人—份额关联不完整、页码误列重要变化等问题，详见 [补充样本证据](reports/renewal-intake/README.md)。本次交付保存现状，未把这些问题写成已修复；原 32 对规则和 F1—F7 的通过结论只适用于原复核范围。

**开发基线已接受：F1—F7 本轮复核关闭，PR #1 已转为 Ready，尚未合并。** 产品固定为 `1ce93d4`。原审核者已用字节未变的原 PDF 和原脚本复跑通过；证据来源与范围见 [复核关闭记录](docs/review-closure.md)。下一阶段使用 [3—5 对真实文档试用说明](docs/real-document-trial.zh-CN.md) 与 [空白记录表](docs/trial-record-template.zh-CN.md)。开发基线接受不等于工程综合或业务试点验收通过。

**审核入口：[审核者指南](docs/reviewer-guide.zh-CN.md)。** 其中列出需求优先级、代码与证据索引、固定版本、完整复现命令和未完成条件。可下载的代码材料、冻结性能输入及两个运行包放在 [审核预发布](https://github.com/wlvh/policy-compare/releases/tag/review-20261026-fixes)；该预发布不是生产上线或工程验收批准。

**审核修复记录：[F1–F7 的修复与反例证据](docs/review-fixes.md)。** 原 2847b56 存在两个 P1，旧预发布保留用于对照。修复范围含字段归属、严重解码诊断、局部歧义、混合续期分类、Form 坐标、分侧精细位置评分与缓存升级；48 项核心测试、两版各 10 项真实 PDF 回归和各 15 组浏览器测试通过。正式性能与运行包须核对新产品冻结提交，不沿用旧性能 PASS。

这是同一套 React/TypeScript 应用、比较核心、profile 和评分器的两个独立构建。**PDF.js 6.4.299** 使用提取项来源和浏览器文字层范围定位；**MuPDF.js 1.28.1** 保留原生字符 origin/quad。一次任务两侧固定同一引擎，不回退、不混合结果、不上传 PDF。

本轮有效要求：`IMPLEMENTATION_PLAN.zh-CN.md` + `CODEX_ENGINE_AB_AMENDMENT.zh-CN.md`，冲突以增补为准。原执行包和完整验证答案保存在首个提交 `97bbdcd`；validation 资料保持不变。

当前交付：两版本地功能可用；各 32 对规则与精细定位通过；360 次正式热比较和 6 次冷启动成功。**工程综合验收、业务试点均为 BLOCKED**：完整内存覆盖、普通参考设备及真实样本/留出尚未完成。Linux 容器以绑定当前产品的 CI 实际结果为准。详细边界见 [验收报告](docs/acceptance-report.md)、[引擎对照](docs/engine-comparison.md)、[PDF.js 单版报告](docs/acceptance-pdfjs.md) 与 [MuPDF 单版报告](docs/acceptance-mupdf.md)。

## 已构建运行包

本机 `delivery/policy-compare-pdfjs.tar.gz` 和 `delivery/policy-compare-mupdf.tar.gz` 各自含固定引擎静态资源、自托管 Worker/WASM、实际许可材料、依赖版本清单、两份虚构试用 PDF 和静态服务器。解压进入目录后，用 Node 24 执行 `node server.mjs`，打开 http://127.0.0.1:8080；无需安装 pnpm 或另一 PDF 引擎。校验值见 `DELIVERY_MANIFEST.json`，实际解压/浏览器启动证据见 `reports/delivery-check.json`。

重建运行包：`pnpm package:delivery`；复核交付包：`pnpm exec tsx scripts/check-delivery.ts`。产物哈希必须与正式 A/B 冻结记录一致。这两个命令不代替 Linux 容器验收。

## 安装与运行

需要 Node 24 LTS、pnpm 10.12.1。当前开发机实际使用 Node 24.19.0、macOS Chrome 154.0.8037.98。本机系统默认 Node 是 23；可用 `./scripts/pnpm-local.sh dev:pdfjs` 或 `./scripts/pnpm-local.sh dev:mupdf`，包装脚本只为当前进程选择已有 Node 24，不更改系统安装。

只安装 PDF.js 路线（此过程不会安装或下载 MuPDF）：

```sh
pnpm install --frozen-lockfile
pnpm install:pdfjs
pnpm dev:pdfjs
```

需要 MuPDF 路线时单独安装：

```sh
pnpm install:mupdf
pnpm dev:mupdf
```

两个开发命令默认显示 localhost 地址；同时启动时可传 `--port 5174` 区分。构建各固定一个引擎，不提供运行时静默切换。切换版本前关闭当前任务，或在同一浏览器标签中打开另一版；所有文档须重新提取。

```sh
pnpm build:pdfjs
pnpm preview:pdfjs --port 4174
pnpm build:mupdf
pnpm preview:mupdf --port 4175
```

生产静态资源分别在 `dist/pdfjs/`、`dist/mupdf/`。本地验证生产服务器（同一静态服务器实现）：

```sh
STATIC_ROOT=dist/pdfjs PORT=8081 node deploy/server.mjs
STATIC_ROOT=dist/mupdf PORT=8082 node deploy/server.mjs
```

文件在浏览器读取并比较。服务器仅接受 GET/HEAD，不提供上传接口。关闭任务终止 Worker 并释放文档/位图/Blob URL；不承诺物理内存安全擦除。真实保单进入开发代理上下文仍需单独的数据授权；随包样本都是虚构资料。

## CLI

```sh
pnpm compare -- --engine pdfjs --left old.pdf --right new.pdf --out result-pdfjs.json
pnpm compare -- --engine mupdf --left old.pdf --right new.pdf --out result-mupdf.json
```

CLI 完整比较返回 0，partial 返回 2，失败返回 3，Ctrl-C 返回 130；发现差异本身不算失败。受保护 PDF 可通过本地 `POLICY_LEFT_PASSWORD`、`POLICY_RIGHT_PASSWORD` 环境变量提供密码，不写入结果。输出含原文差异，请按文档敏感级别保存。

PDF.js CLI 的位置是提取项及 Unicode 标量/UTF-16 范围，精度为 `run`；精细位置需浏览器文字层解析，不能把 CLI 段框当字符高亮。MuPDF CLI 可直接输出原生字符 quad。两引擎不要求 JSON、快照或卡片数量相同。不传 --engine 时保留早期 MuPDF 默认行为；建议像上例一样显式选择。

## 验证

```sh
pnpm env:check
pnpm verify:core
pnpm test:rules:pdfjs
pnpm test:rules:mupdf
pnpm test:browser:pdfjs
pnpm test:browser:mupdf
pnpm exec tsx scripts/pdf-check.ts pdfjs
pnpm exec tsx scripts/pdf-check.ts mupdf
pnpm exec tsx scripts/review-check.ts pdfjs
pnpm exec tsx scripts/review-check.ts mupdf
pnpm verify:pdfjs
pnpm verify:mupdf
pnpm verify
```

浏览器测试需要本地 Google Chrome（其他机器可在 playwright.config.ts 中选择已安装 Chrome/Edge 或安装 Playwright Chromium）。测试报告在 reports，失败证据保留。`verify` 会准确汇总 PASS/FAIL/BLOCKED/NOT_RUN，不会把环境缺项当全部通过。

样本构造检查与产品评分分开：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r validation/requirements.txt
.venv/bin/python validation/fixture_checks.py
```

`fixture_checks.py` 只证明 32 对 PDF 的构造。产品只读取 PDF 与通用 profile；source/expected/layout 仅评估程序可读。六个控制用例和 R18/R21/R25/R27/R28 均保留原要求。

## A/B 性能与运行

```sh
pnpm bench:generate
# 先按上面的生产静态服务器命令分别启动 8081 / 8082
pnpm bench:compare
pnpm bench:interactions
```

三类工作负载各有 8、45、100 页版本，每版每组 20 次正式热比较，按 A/B、B/A 平衡顺序，每次只运行一个引擎。每引擎另做 3 次冷启动。原始逐轮记录在 reports/engine-ab.json；口径与结论在 docs/engine-comparison.md。高配开发机数字不替代普通 16 GiB 参考机。

独立构建复核：`pnpm exec tsx scripts/independent-build.ts` 在 tmp 中新建 PDF.js 安装/构建环境及独立缓存，不复制 MuPDF 引擎目录，检查依赖和最终产物。它不修改原项目或标准答案。

Linux 构建与启动说明见 docs/deployment.md。两个变体：

```sh
docker build --build-arg ENGINE=pdfjs -f deploy/Dockerfile -t policy-compare:pdfjs .
docker build --build-arg ENGINE=mupdf -f deploy/Dockerfile -t policy-compare:mupdf .
docker run --rm --read-only --user 12345:12345 -p 8080:8080 policy-compare:pdfjs
pnpm test:container
```

许可范围在 docs/license-status.json，实际包 LICENSE/字体/解码器许可在 docs/third-party，锁文件分别位于根目录及 engines/*。本地双引擎开发评估已授权；未声称组织生产批准或已购买商业许可。

工程与业务试点状态、已知限制及缺失条件以 docs/acceptance-report.md 与 docs/implementation-status.md 为准。真实样本/独立留出、普通参考设备与实际 Linux 容器运行存在缺口时，交付可运行开发快照，不能称工程和业务验收全部通过。
