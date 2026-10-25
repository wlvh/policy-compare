# mupdf 独立版本验收

产品冻结提交：f81aebd8f2e756b781b40957a06237a6cefb5c3e。共用核心/UI/profile/评分器，单个任务两侧固定使用本引擎。

| 项目 | 状态 | 证据 |
|---|---|---|
| 32 对原规则 | PASS | reports/rules-mupdf.json |
| 32 对浏览器精细来源位置 | PASS | reports/browser-rules-mupdf.json |
| 浏览器全流程 | PASS | reports/browser-tests-mupdf.json；11 组，含连续 20 次任务/取消 |
| 6 项机制 PDF | PASS | reports/pdf-checks-mupdf.json |
| CLI 0/2/3/130 | PASS | reports/cli-checks.json |
| 热比较 | PASS | 180/180；9 组 × 20 次，reports/engine-ab.json |
| 时间预算 | PASS | 同上逐轮原始记录 |
| 全程交互/晚期取消 | PASS | 20 次，reports/interaction-profile.json |
| 完整内存 | BLOCKED | 短寿命子进程历史峰值覆盖不完整 |
| 目标/普通参考设备 | BLOCKED | 当前为 M4 Max / 128 GiB 开发机 |
| Linux 容器 | BLOCKED | Docker daemon/API 无响应，reports/container.json |

MuPDF 保留原生字符 quad；非 BMP 的 fromCharCode 问题由随包版本化补丁修复。实际包许可为 AGPL-3.0-or-later，本轮本地开发评估已授权；未声称外部分发/共享/生产许可已落实。

可运行产物：delivery/policy-compare-mupdf.tar.gz；解压执行 Node 24 的 node server.mjs。源码开发/构建/验收入口分别为 pnpm dev:mupdf、pnpm build:mupdf、pnpm verify:mupdf。

本版本功能与本地时间测量通过，**工程综合验收 BLOCKED；业务试点 BLOCKED**。限制、第三方范围及最小缺失条件见 acceptance-report.md 和 engine-comparison.md。
