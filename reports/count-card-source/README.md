# 次数卡可以定位文字示例

后续默认规则已经取代本页的“次数卡”交互：纯次数项不再进入主变化清单，改为独立数量摘要，仅主动查看具体来源时定位。[当前规则与验证](../repeat-count-summary/README.md)；以下是旧交互的历史记录。

次数卡曾为避免冒认新增位置，在点击时只清空高亮，导致用户点击 `Calloway Specialty`、`731` 时看不到定位反馈。现在点击或键盘激活次数卡，会定位一处该文字的已知来源，并以中性色高亮。

次数增加时查看待审版，次数减少时查看基准版；优先选择该侧当前页上的同文字来源，否则使用首处来源。排除只作上下文的其他写法，不把排序后剩余的最后一处认作新增。原文区域明确提示“文字示例……不代表这里是新增或减少的位置”，卡片仍保留具体新增／减少位置未确定的说明。完整来源默认收起，真正的文字修改保留红绿展示。

本轮只改界面、样式和既有浏览器回归，没有修改比较核心、提取器、事实或导出格式。此交互取代上一轮“次数卡点击只清除高亮”的决定；来源完整与新增位置未确定的边界保持。

## 验证

PDF.js 和 MuPDF 构建通过。两引擎各13项、共26项定向浏览器检查通过：

- 次数卡4项：增加／减少的文字示例、同页两个不同词分别定位、真实页眉修改继续红绿展示。
- 连续滚动3项：上下跨页、独立与同步、短页末尾、快速往返、来源跳转与窗口宽度变化。
- 既有审阅6项：金额、搜索、导出、相同文件、连字／扫描、覆盖、取消、20次任务替换及交换方向。

新增对照复用已有作者固定的 R16 PDF 中的测试声明与金额页眉，两者次数同为2→3且位于同一页的不同纵向位置；核对点击后高亮坐标确实不同、仅高亮一侧、来源仍收起，以及提示没有宣称具体新增位置。未修改 PDF 或作者预期。

```sh
pnpm build:pdfjs
pnpm build:mupdf
POLICY_ENGINE=pdfjs pnpm exec playwright test tests/browser/repeat-display.spec.ts tests/browser/scroll.spec.ts tests/browser/review.spec.ts --reporter=line
POLICY_ENGINE=mupdf pnpm exec playwright test tests/browser/repeat-display.spec.ts tests/browser/scroll.spec.ts tests/browser/review.spec.ts --reporter=line
```

[PDF.js 测试日志](tests-pdfjs.log)、[MuPDF 测试日志](tests-mupdf.log)保存最终输出。这些定向检查不等同于全套核心、容器或业务验收。

另在本机 PDF.js 页面用用户原文件实际点击 `Calloway Specialty` 与 `731`：两次均定位到待审 PDF 第2页，分别高亮不同的文字区域，基准侧没有高亮，提示均明确为文字示例。[实际位置核对](user-file-check.json)记录了两次结果。实际截图留在本机 `tmp/local-preview/`，没有纳入本次提交。
