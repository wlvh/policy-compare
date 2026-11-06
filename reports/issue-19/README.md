# Issue #19：Rust / WASM 开发及验收记录

2026-11-06。复审后的 CLI 加载修复、实际 WASM 双哈希核验及 CI 滚动调查见[修订记录](review-followup/README.md)。原“CLI 与浏览器同一产物”的证明不完整，已撤回原证明范围，新的核验使用 CLI 镜像内实际文件；原候选记录保留。

2026-11-06。已将正式比较与原文搜索迁移为 Rust，在浏览器比较 Worker 中执行编译后的 WASM；Node 命令行和正式规则验证复用该核心。**开发已交付本地评审，验收尚未全部完成，Issue #19 保持开放。** 没有公司 HTTPS、真实 OpenShift、目标办公终端及指定使用者的验收证据，不能以本地通过代替正式放行。

迁移基线为 `6a5f1ef7e3f6997e58a1bf303774419c16cb994b`；产品候选冻结在 `e2154a31f43f315618a20760ff1ab034d85add9e`，分支 `feat/issue-19-rust-wasm`。后续报告提交不改变该候选产品。实现、接口、开发构建和停止行为见 [Rust 核心说明](../../docs/rust-core.md)。

## 实际开发内容

- Rust 执行规范化及原文映射、结构恢复、字段与表格对应、差异计算、重复写法和次数、来源、覆盖与未决生成，以及完整原文搜索。宿主只提供阶段通知和中止检查，不导入 JavaScript 比较算法。
- 外部输入和结果继续使用 `DocInput` 与结果格式 2。保留 `page-merkle/1`、配置摘要及差异 ID 规则；规范 JSON 的数字格式和属性排序与原约定一致。核心版本明确标记 Rust，产物由 SHA-256 标识。
- 按元信息、逐页、该侧结束接收输入；保留字符与来源映射校验。两侧完整后比较。正常完成后保留搜索所需原文，临时计算区释放；关闭、替换、取消、超时和整体失败仍终止 Worker 及 PDF 客户端。
- PDF 与比较核心分别就绪，只启动一次 PDF 打开，只转移一次端口和文件字节。核心初始化期限 15 秒，保留任务 120 秒期限；失败不回退旧 TypeScript。
- 固定 Rust 1.93.0、直接及传递依赖，加入两版网页、独立 PDF.js 构建、镜像 Rust 构建阶段、版本资源清单、实际核心版本和哈希、第三方许可证及 CI 入口。
- TypeScript 旧算法隔离在 `packages/legacy-core`，只作明确的迁移对照和旧检查工具。正式网页、CLI、规则评价入口均已退出对它的依赖。

迁移复核修正了单位专属事实、JavaScript 的 Unicode 正则边界差异、WASM 32 位乘法及来源索引溢出。新增长段落回归的词元乘积超过 2^32，必须明确记录预算未决。结构恢复改为完整单元只规范化一次，避免随每一行追加重复处理整段；原文及映射输入不变，冻结对照仍逐字段一致。

## 候选与证据绑定

两版 Linux ARM64 候选见 [MuPDF 镜像记录](release/candidate-mupdf/container.json) 和 [PDF.js 镜像记录](release/candidate-pdfjs/container.json)。它们由固定 Node 与 Rust 基础镜像构建，使用 UID 12345、只读根目录、1 CPU / 256 MiB 静态服务限制、无挂载。计算仍在浏览器；这些容器限额不是浏览器内存限额。

发布路径分别为 `/releases/r19-budget-mupdf/` 和 `/releases/r19-budget-pdfjs/`。核心实际版本、WASM 哈希、全部资源及哈希分别记录在 [MuPDF 清单](release/candidate-mupdf/build-info.json) 与 [PDF.js 清单](release/candidate-pdfjs/build-info.json)。同一候选的浏览器和 Linux CLI 使用内容相同的 WASM；本机重新编译的产物哈希不冒充 Linux 发布产物哈希。

镜像仅保存在本地 Docker，未推组织仓库，`RepoDigests` 为空。本地 image ID 不能写成组织仓库已经可以拉取的发布摘要。

## 功能与迁移验收

| 项目 | 结果与范围 | 证据 |
|---|---|---|
| 核心、评价器、契约、发布约束与新增 Rust 回归 | 415 / 415 通过；包含 Unicode 原文位置、非法输入、单位事实隔离和超过 2^32 的预算回归 | [日志](core-tests.log)、[逐项结果](core-tests.json) |
| 同冻结提取输入，旧 TS 与 Rust 对照 | 两引擎共 64 / 64 通过；唯一允许差异为 `coreVersion`，其余事实、位置、覆盖、未决、统计和指纹一致 | [对照](parity.json)、[输入清单及内容哈希](frozen-baseline.json) |
| Linux 候选网页与正式 CLI 的同核心一致性 | 两引擎共 64 / 64 通过；完整核心输出一致，CLI 输出另与冻结旧结果对照；不把后来的 DOM 几何混入核心输出 | [MuPDF](release/candidate-mupdf/cross-entry-candidate.json)、[PDF.js](release/candidate-pdfjs/cross-entry-candidate.json)、[日志](release-cross-entry.log) |
| 两版正式类型检查与静态构建 | 通过；均包含 Rust 核心及清单 | [MuPDF](build-mupdf.log)、[PDF.js](build-pdfjs.log) |
| 只安装 PDF.js 的独立构建 | 通过；没有 MuPDF 安装或打包产物 | [独立构建](independent-build.log) |
| 两引擎独立 Node 规则评分 | 各发现 32 / 32 预期事件；严格状态各 28 通过、4 未评价，命令退出 2；不能称严格全通过 | [MuPDF](rules-mupdf.json)、[PDF.js](rules-pdfjs.json) |
| MuPDF 完整浏览器回归 | 41 / 41 通过，使用 Playwright bundled Chromium；其中规则用例允许原已登记未评价项 | [日志](release-browser-mupdf.log)、[逐项结果](release/browser-mupdf/browser-tests-mupdf.json) |
| PDF.js 核心和生命周期专项 | 5 / 5 通过，使用同一 bundled Chromium；包括冻结输入、初始化期间取消、加载失败、初始化超时后重试、网络隐私检查 | [日志](release-browser-pdfjs-core.log)、[结果](release/browser-pdfjs-core/browser-tests-pdfjs.json) |
| PDF.js 安装版 Chrome 的 32 对浏览器规则 | 通过该规则用例，原四项严格未评价保留 | [日志](release-browser-pdfjs-chrome.log)、[逐项规则](release/browser-pdfjs-chrome/browser-rules-pdfjs.json) |
| 两个实际 Linux 镜像的浏览器流程 | 各 34 通过、1 明确跳过独立 F7 缓存测试；覆盖加载、提取、比较、高亮、搜索、导出、错误恢复、连续任务和关闭释放 | [MuPDF](release/candidate-mupdf/browser.log)、[PDF.js](release/candidate-pdfjs/browser.log) |
| 本地双镜像升级与回滚 | 两种提取器均通过；旧 TypeScript 版本的旧页在切换后首次比较、新页进入 Rust 候选、回滚至旧镜像、Rust 旧页在回滚后继续工作；资源失败 0 | [MuPDF](release/rollback-mupdf/rehearsal.json)、[PDF.js](release/rollback-pdfjs/rehearsal.json) |
| PDF、文件名、密码、搜索词不进入 HTTP 上传、路径或查询参数 | 被测本地流程通过；检查请求完整 URL、查询、方法和 body，并保留 #17 的诊断字段白名单 | [MuPDF](release/browser-mupdf/privacy-rust-mupdf.json)、[PDF.js](release/browser-pdfjs-core/privacy-rust-pdfjs.json) |

旧结果只用于迁移等价对照，不充当正确性真值。独立规则预期仍来自原输入、明确要求和来源记录；产品不接收答案。发现、来源归属、位置、展示、事实分类及不适用的记录身份分别保留在规则报告中。

## 未通过与未评价

- **失败保留：** PDF.js 在 bundled Chromium 的 R14 短段落与 R31 标点细位置检查失败，发现本身通过，来源归属、位置及展示未通过。条款记录身份要求不适用，不能改叫未评价。迁移前旧网页包在同一浏览器、同一输入复现了完全相同的导出结果及评分：[旧版结果](legacy-browser-pdfjs/browser-rules-pdfjs.json)、[旧版日志](legacy-browser-pdfjs.log)、[Rust 结果](browser-pdfjs/browser-rules-pdfjs.json)。这项差异不是迁移新引入的，但也没有因迁移而消失。
- **未评价保留：** R16 全文保留、R18 连字细粒度几何、R23 所有未变记录身份、R24 跨页行序。P10/P11 等既有来源正确性问题继续沿用[原独立样本记录](../synthetic-review-20261030-run1/README.md)，本次不重新宣称全业务范围已正确。
- **环境未评价：** 公司 HTTPS、实际 OpenShift、普通 16 GiB 办公终端、组织 Chrome / Edge 策略、目标架构推广、真实发布和回滚、指定人员试用及组织许可签收。复用 [#17 的分层交付](../issue-17/README.md)，不能由旧 TS 发布包的通过替代新候选。本次终端 PATH 未找到 oc/crc，kubectl 未设置当前上下文，见[可用环境检查](environment-availability.json)。未将这些项目自动移交或标为通过，Issue #19 继续开放。
- 安装版 Chrome headless 的部分长轮次出现上下文意外关闭；纯旧 TypeScript 的初次性能尝试也有相同中断。未确定原因，不用一次隔离通过推断该环境长期稳定。原始失败记录保留；固定 bundled Chromium 的功能与性能记录分别报告。
- 全仓 `tsc --noEmit` 的既有滚动测试在 `HTMLImageElement` 类型推断上有两条错误；该测试源码与迁移基线相同。两种正式应用构建各自的 TypeScript 检查通过，不把它表述为全仓所有类型检查通过。

## 性能记录

同设备、浏览器、输入哈希、提取器和配置内比较两种核心。保留原工作负载时间目标、每组 20 次要求和标准样本 1 GiB 增量物理峰值目标。原始协议见 [测量协议](performance-protocol.json)，实际网页清单及其哈希见 [性能构建绑定](performance-builds.json)。

正式对照 **720 / 720 次完成**：两提取器、两实现、9 组工作负载、每组 20 次。指定值可见、允许的处理状态、完整结果的卡数及关闭后 Worker 检查均通过；适用工作负载的既定时间目标均通过。这些是原基准的检查项，不是逐事件的完整来源正确性验收。完整表见 [20 次统计](performance-summary.md)、[可复算汇总](performance-summary.json) 和 [逐次记录](performance.json)。P50 为每组排序后的第 10 个耗时，P95 为第 19 个，沿用原基准口径。

MuPDF 的标准续保 P50 约 2248 → 1816 ms、标准密集表格 1816 → 1314 ms；标准模板大改则为 2517 → 2817 ms。PDF.js 的标准续保为 2382 → 2715 ms、标准密集表格 1916 → 2166 ms、标准模板大改 2666 → 3716 ms；容量模板大改为 5849 → 8600 ms。**本版 PDF.js 各工作负载较旧版慢约 12%–47%，这项相对变慢没有被称为已消除。** 所有适用时间预算仍满足；容量样本无既定时间上限，该项记不适用。阶段诊断中，模板大改标准样本的差异及证据生成阶段 Rust 约 0.62 s，TS 约 0.12 s，保留为后续定位依据，不据此推断单一函数或语言是全部差值的原因。

四个运行环境各仅一份初次页面/引擎加载记录，不能计算冷加载 P95。先前 3 次开发测量及中止轮次单独保留，不代替最终对照。冻结输入对照中的历史 `coreMs` 还包含冻结文件写入，和 Rust API 调用计时边界不同，均不用于本节性能结论。

内存汇总发现初始采样并发时可能返回空基线：20 次对照的四组运行环境中有三组缺少初始 RSS，原先按 0 算出的增量无效。已在 [主记录](performance.json) 中将这些派生差值置空并标未评价，保留 [修正前原始记录](performance-original-memory-sampling.json)；720 次耗时、实际总 RSS、输出检查和 Worker 观察未改。修正采样等待后，另做 [36 次单轮资源补测](memory-check.json)、[资源汇总](memory-summary.json)，四组均取得有效初始基线和 36 个关闭附近的 RSS 采样，Worker 均为 0。补测不能替代 20 轮的峰值记录，也没有把内存目标改称通过。Rust 的页解析、校验和页快照在 `inputAdmission` 中，旧 TS 在接收完后做这些操作，不能直接比较单个同名阶段并声称提速；端到端使用原任务开始至首屏可审阅起止。

当前设备为 Apple M4 Max、128 GiB，Chromium 版本见原始记录。进程树 RSS 每 100 ms 采样，包括活跃后台任务、WASM 和 GPU 的所在进程，但可能重复计算共享页或漏掉短峰值。RSS 不等于完整增量物理峰值；目标办公设备与完整内存峰值继续未评价。关闭任务后的 Worker 数和 RSS 分开保留，不承诺 Rust 释放后操作系统 RSS 立即降低。

## 复现

先按 [构建说明](../../docs/rust-core.md) 安装开发依赖并构建。冻结规则提取输入已提交在 `validation/migration/issue-19/*.json.gz`；无需重新生成旧答案。

```sh
pnpm verify:core
pnpm exec tsx scripts/issue19-parity.ts
pnpm test:rules:mupdf
pnpm test:rules:pdfjs
pnpm test:browser:mupdf
pnpm test:browser:pdfjs
pnpm exec tsx scripts/issue19-candidate-parity.ts reports/issue-19/release
```

最后一条复核已保存在本地的实际候选 image ID 和构建阶段 CLI，不把可变标签当作同一镜像；异机需先获得相同候选镜像或按文档另建候选，并使用独立证据目录。

性能脚本还需要冻结旧网页包。若目录不存在，在 Node 24 环境执行以下准备；已存在的目录应先核验，不能覆盖后冒充原包：

```sh
(
set -eu
POLICY_BASE_REVISION=6a5f1ef7e3f6997e58a1bf303774419c16cb994b
test ! -e tmp/issue19-baseline-source
test ! -e tmp/issue19-baseline
mkdir -p tmp/issue19-baseline-source
git archive "$POLICY_BASE_REVISION" apps packages profiles engines patches package.json pnpm-lock.yaml tsconfig.json tsconfig.pdfjs.json tsconfig.mupdf.json vite.config.ts scripts/release-config.ts | tar -x -C tmp/issue19-baseline-source
(
  cd tmp/issue19-baseline-source
  pnpm install --frozen-lockfile
  pnpm install:mupdf
  pnpm install:pdfjs
  POLICY_RELEASE_ID=development POLICY_REVISION="$POLICY_BASE_REVISION" pnpm build:mupdf
  POLICY_RELEASE_ID=development POLICY_REVISION="$POLICY_BASE_REVISION" pnpm build:pdfjs
)
mkdir -p tmp/issue19-baseline
cp -R tmp/issue19-baseline-source/dist/mupdf tmp/issue19-baseline/mupdf
cp -R tmp/issue19-baseline-source/dist/pdfjs tmp/issue19-baseline/pdfjs
)
pnpm exec tsx scripts/issue19-performance.ts --formal
pnpm exec tsx scripts/issue19-performance-summary.ts
```

早期并行跨入口检查曾共用临时输入目录，造成两引擎输入相互覆盖，触发提取器不一致的明确拒绝。已按提取器及 CLI 实例隔离目录，重新顺序验证通过；不能用该初轮失败或初轮通过替代最终候选证据。32 位预算修复前中止的性能数据也不与最终结果混算。
