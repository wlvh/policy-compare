# PR #20 独立审核后的三项修订

审核基线 `f49500b`，本轮修订产品 `a3ad1646f4ea3eb95ec94ae493e0d5d1a593013d`。本轮只修正 CLI 加载错误边界、补齐实际产物身份核验并调查 CI 滚动失败。没有改动 Rust 算法、PDF 适配器、视口或页面画布实现，没有重跑或改写原 720 次性能测量。Issue #19 继续开放。

## 1. CLI 加载失败：已修正

`packages/cli/run.ts` 在自己的 `try` 中动态导入核心，使文件读取、哈希验证或 WASM 编译的失败进入统一错误处理，退出码保持 3。没有把整个核心接口改成异步，也没有通过改写外层任意退出码隐藏未捕获异常。

新增两条回归从真实 `packages/cli/main.ts` 入口启动子进程，在隔离副本中删除或损坏实际 WASM 文件，保留真正的哈希验证。两者均返回 3、输出 `failed：…`、不输出未捕获调用栈。旧的正常业务结果、部分结果及取消约定保留。

## 2. CLI 实际 WASM 哈希：已补齐

**旧报告的产物身份结论范围不足，予以更正：** 原跨入口检查证明了浏览器清单一致和结果相等，没有独立证明 CLI 的实际字节与浏览器相同。旧报告中的这部分 PASS 不能单独作为“同一 WASM 产物”的验收证明；没有发现旧候选实际使用了不同产物。

新检查从真正执行 CLI 的不可变镜像编号内读取 `core.wasm`，计算 SHA-256，先与该镜像自己的 `core-info.json` 核对，再与浏览器加载并校验过的哈希核对。主机 CLI 使用相同读取程序检查实际文件。每条记录及汇总分别保存 `browserCoreSha256`、`cliCoreSha256`，格式标为 `cross-entry-core/2`。

新增否定对照：向真实 WASM 增加不参与执行的自定义段，确认模块仍有效、完整比较结果相同、该 CLI 文件和它自己的清单也一致；新的跨入口身份检查仍因两份文件的实际哈希不同而拒绝。另检查实际文件与自己的清单不一致时明确失败。

两引擎新候选共 64 组冻结输入通过完整输出对照及实际字节身份核对。两份哈希在本地 Linux ARM64 候选中均为 `30d737bc7bcf0e7d555811aeae19834e6311c6117fc9b355d572da8f44002898`。

- [MuPDF 候选及双哈希](candidate-mupdf/cross-entry-candidate.json)、[CLI 文件读取记录](candidate-mupdf/cli-core-artifact.json)、[逐案例](candidate-mupdf/cross-entry/cross-entry-mupdf.json)
- [PDF.js 候选及双哈希](candidate-pdfjs/cross-entry-candidate.json)、[CLI 文件读取记录](candidate-pdfjs/cli-core-artifact.json)、[逐案例](candidate-pdfjs/cross-entry/cross-entry-pdfjs.json)

## 3. PDF.js 滚动失败：已补充同环境对照，保留既有间歇现象

原 [CI 42215113898](https://github.com/wlvh/policy-compare/actions/runs/42215113898/job/127883058392) 确实失败：PDF.js 容器浏览器 33 通过、1 跳过、1 失败。轨迹显示页码已回到第 1 页、滚动位置约 14，但第 1 页还是占位区域，等待 `data-ready-page="0"` 超时。这与 R14/R31 字符位置失败分开记录，未将它忽略或改称通过。

本轮取得迁移前的直接失败证据：[2026-11-04 的 CI 41832530229 / job 126583036695](https://github.com/wlvh/policy-compare/actions/runs/41832530229/job/126583036695)。当时是 TypeScript 核心，分支头 `97d13fd`，实际执行合并提交 `f79e4d3`；同一个用例、同一第 53 行、同一 `data-ready-page="0"` 断言和 5000 ms 超时。该轮为 35 通过、1 失败，Chromium 与本轮同为 156.0.8078.4。两个历史运行器的 Ubuntu 镜像日期不同，未把它们称为完全相同的环境。

随后在**同一个 Ubuntu x64 运行器及同一 bundled Chromium** 上重建并检查基线 `6a5f1ef` 和原审核候选 `f49500b`，保留原容器套件的前序操作。两者各 34 通过、1 跳过，目标滚动用例都通过。本地同版本 Chromium 的原用例又分别通过 20 次；额外连续缓存淘汰与返回各 200 轮也未复现。

可以确认的是：这种失败表象在 Rust 迁移前已经发生；本轮同环境对照未复现。**具体停滞机制、历史两次是否完全同因，以及新时序是否改变触发概率，仍未确定。** 本轮没有声称修复滚动问题，没有放宽 5 秒断言，没有加测试重试或跳过。保留失败状态和证据，并在下次失败时自动附上视口滚动位置、缓存页、待渲染请求及实际 DOM。读取内部调度引用只用于失败诊断，不用作验收真值。基线证据收集作业仅限 PR #20，避免把冻结旧源代码检查变成后续 Rust 开发的额外门槛。

- [调查结论及源码对应](scroll-investigation.json)
- [迁移前失败日志节选](pre-rust-ci-failure-excerpt.log)、[原审核候选 CI 失败节选](reviewed-ci-failure-excerpt.log)
- [同运行器基线／候选结果](ci-scroll/comparison.json)、[基线逐项](ci-scroll/baseline-browser-tests.json)、[候选逐项](ci-scroll/reviewed-browser-tests.json)
- [本地原用例 20 + 20 次](local-scroll-comparison.json)、[本地各 200 轮滚动](local-scroll-stress.json)

## 验证及范围

修订代码本地单元测试 **418/418 通过**，含本轮 3 条新增回归；两版构建通过；新镜像普通流程各 34 通过、1 明确跳过。新候选的跨入口完整结果和双哈希核验共 64/64 通过。

代码提交 `a3ad164` 的 [CI 42228008179](https://github.com/wlvh/policy-compare/actions/runs/42228008179) 已完成 **7/7 作业成功**，其中新增基线作业的成功表示证据采集完成，其逐用例状态仍独立记录；功能和容器作业继续是产品检查。

本轮报告和 CI 上传路径补充不改变候选产品代码。后续报告提交的 CI 以对应提交的实际结果为准，不把前一提交的通过移作新提交的通过。

来源校验逐字符扫描文本项并重复构建偏移表的平方级成本已登记为后续性能事项，本轮未修改，也未把审核方的定向阶段探针混入原端到端性能矩阵。原 R14/R31 失败、四项严格未评价、完整内存和真实组织环境未评价，以及整体 Issue 未通过的状态继续保留。
