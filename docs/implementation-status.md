# 实施状态

2026-10-26；基线：97bbdcd，当前目录原来不是 Git 仓库，没有应用源码、AGENTS.md 或 CLAUDE.md。完整保留执行包及所有标准答案，建立本地分支 `feat/policy-compare`，没有远程仓库。

已完整读取 START_HERE、622 行完整方案、validation/README、REVIEW_GUIDE、生成器、构造检查器和样本目录。用户本轮 AGENTS 指令适用。

| 阶段 | 状态 | 实际证据 / 依赖 |
|---|---|---|
| P0 | PASS | 包内 187 文件哈希一致；183352 项样本构造检查通过；契约与评分器入口已实现 |
| P1 | PASS | R01/R02/R18/R27 真实 PDF 与浏览器流程通过；金额高亮、搜索、取消及网络边界验证；PNG 证据在 reports/browser-review.png |
| P2 | PASS | 主体/字段身份、原样优先、局部联合拆合、声明表格键、歧义组证据；32 对 PDF 产品评分通过；真实样本仍缺失 |
| P3 | IN_PROGRESS | 严格评分器、审阅界面与异常语义；32 对 PDF 验收依赖 P1 |
| P4 | IN_PROGRESS | 长样本、容器、浏览器测试设施；PDF 性能依赖 P1 |
| P5 | BLOCKED | 真实样本、独立留出、许可和普通办公参考设备缺失 |

许可记录见 license-status.json。用户明确授权先接入 MuPDF 开发；许可结论未落实，不能宣称生产或分发许可完成。已安装锁定版本 1.28.1，逐字符 walk 源码的非 BMP 截断已通过版本化补丁修复；专用 PDF 验证待执行。

开发机：Apple M4 Max，16 逻辑 CPU，128 GiB RAM，macOS 27.0.1，接交流电；Google Chrome 154.0.8037.98。系统 Node 23.10.0 不符合 LTS 要求，使用已存在的 Codex Node 24.19.0。Python 使用已有 3.12.14。pnpm 固定 10.12.1。

必要差异：T0 期间按方案继续独立部分，阶段提交不等于阶段退出条件通过；工程版与业务试点均不能宣称完成。
