本 PR 保留同一产品的 PDF.js / MuPDF 独立构建及完整里程碑历史，继续处于 Draft，未合并或生产发布。当前重点是修复 2847b56 审核确认的 F1–F7。

## 两个 P1 的修复结果

- **F1 已修复并实测**：显式章节和稳定唯一标题分别绑定字段，金额相同不能跨归属配对后消失。两版实际 PDF/浏览器均显示 HULL 与 LIABILITY 各自的金额修改。不能可靠归属的重复字段仍显示组内金额变化并标明该组待复核，不是 generic partial 后隐藏变化。
- **F2 已修复并实测**：正文流损坏即使页眉可读，也明确显示 partial 或 failed。PDF.js 使用版本化 worker 补丁并设置 stopAtErrors，MuPDF 用真实原生日志回调关联当前页面。干净压缩流、错误后的正常文档、坏页后的正常页均有控制验证。

[修复验收报告](https://github.com/wlvh/policy-compare/blob/feat/policy-compare/docs/fix-acceptance.md) · [代码与反例说明](https://github.com/wlvh/policy-compare/blob/feat/policy-compare/docs/review-fixes.md)

## 其余修复与验证

F3 将歧义限定到冲突组，独立增删继续显示；F4 非日期内容变化时不归 RollForward；F5 处理 Form 矩阵与状态恢复；F6 逐侧核验最终几何，单侧错框不能通过；F7 版本资源路径与重新验证缓存，并实测旧 immutable 缓存仍保留时的升级。

最终产品冻结：`1ce93d4dd41d1d46d5dd4b49a35f73d1b74a7183`。48 项核心/评分器/服务器测试；两版各 32/32 原规则及精细定位、10 项真实 PDF 审核回归、15 组浏览器流程；CLI 0/2/3/130；PDF.js 无 MuPDF 的独立构建均通过。

该最终提交已重新完成 **360/360 热比较、6/6 冷启动和各 20 次交互/晚期取消**。旧 f81aebd 和中间 6850bb5 的测量分别保留，未冒充最终版本结果。原 184 个 validation 文件与标准答案未修改。新增反例来自作者操作，不取另一引擎输出作答案。

[当前 Linux CI](https://github.com/wlvh/policy-compare/actions/runs/40279913611) 五项成功，已核对 PR 测试合并引用与产品源码树一致；包含实际双容器构建、只读非 root 启动和健康检查。运行包解压后也重新执行两个 P1，静态文件逐个匹配正式测量哈希。

## 审核材料与剩余条件

[审核者指南](https://github.com/wlvh/policy-compare/blob/feat/policy-compare/docs/reviewer-guide.zh-CN.md) · [修复版审核附件](https://github.com/wlvh/policy-compare/releases/tag/review-20261026-fixes)

完整内存、普通/实际目标设备、真实完整人工审阅和独立留出仍未完成；实际公开/共享/生产许可按范围落实。工程综合与业务试点保持 BLOCKED，不能因 CI 绿色而改为全部通过。私有 GitHub 技术审核已由用户授权。

原审核者 ZIP 的认证链接未能读取；本轮没有声称运行其中脚本，而是独立复现并保存了相同机制及补充边界。初版失败、6850bb5 的补充失败和所有阶段报告均保留。请优先用原审核反例复核两个 P1，再检查 F3–F7 与原验证集；不要修改 expected 迎合输出。
