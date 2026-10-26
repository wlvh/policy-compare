本 PR 交付同一保单比较产品的 PDF.js / MuPDF 独立构建。F1—F7 已在原复核范围关闭，产品 `1ce93d4` 已接受为开发基线，PR 为 Ready，尚未合并。本次按用户要求交付当前代码、操作/观察说明、已知限制、原始证据与复现脚本；开发基线接受与工程综合、业务试点验收分别判断。

[开发交接手册](https://github.com/wlvh/policy-compare/blob/feat/policy-compare/docs/handoff.zh-CN.md) · [固定交接附件](https://github.com/wlvh/policy-compare/releases/tag/handoff-20261026) · [新续保样本证据](https://github.com/wlvh/policy-compare/blob/feat/policy-compare/reports/renewal-intake/README.md)

**当前未修问题明确交接：** 两对新增合成续保样本在两引擎中均为 partial，177 项正文与 5 项页眉事件尚未全量评分。承保人—份额未组成完整行，HPX 的 12.5%→10.0% 只部分表达；商务航空样本各有 35 张纯页码卡片误归 Material。原 32 对通过及 F1—F7 关闭不意味着这些新问题已解决。本次未修改产品/基准实现或原 expected。

[复核关闭记录](https://github.com/wlvh/policy-compare/blob/feat/policy-compare/docs/review-closure.md) · [真实文档试用说明与记录表](https://github.com/wlvh/policy-compare/blob/feat/policy-compare/docs/real-document-trial.zh-CN.md)

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

用户提供的原审核者复核报告确认：5 份原 PDF、2 个原脚本字节与前轮一致，两条 --assert-fixed 检查均以 0 退出，F1—F7 本轮关闭。F1—F6 来自直接执行，F7 来自实际浏览器测试代码及 CI 日志核对。Codex 未取得认证 ZIP，不把审核者执行写成自己的新执行；原反例复跑缺口已经由审核者补足。

初版失败、6850bb5 的补充失败和所有阶段报告均保留。旧修复标签及七个附件保持冻结；本次使用新交接标签提供说明、新样本原始证据和可移植复现工具。新工具已实际下载核验输入、运行两版浏览器抽查及结构诊断，不能把这些 workflow PASS 当成全量新样本验收。真实文档试用待获准资料、人工审阅人和目标设备信息。
