# 已保留的失败与修复依据

- MuPDF.js 1.28.1 walk 用 String.fromCharCode 截断非 BMP；版本化补丁改为 fromCodePoint。新增 Unicode PDF 曾含 ReportLab 产生的无效 ToUnicode `<1F600>`，pypdf 同样拒绝奇数长度编码；修复新增样本为 UTF-16BE `<D83DDE00>`，不改原 32 对。
- 首轮浏览器 MuPDF Worker 在 WASM await 尚未结束时收到文档，消息丢失。加入明确 ready 握手，保留 browser-initial.json。
- PDF.js R17 字体切换令页脚提取项由多项变一项，出现假增删。公共结构层合并同页同基线页脚，保留 pdfjs-R17 的原失败结果。
- 严格字符位置评分发现 PDF.js 通用文字层字体会把小数点、逗号或词内字符移到邻近位置。保留 browser-pdfjs-R04/R09/R14/R31 结果及逗号截图。先绑定 PDF.js 渲染页实际加载的字体，再按实际 DOM 字号实测字形前进宽度，修正 TextLayer 量化字号导致的整体缩放误差。没有均分段框、改答案或扩大单引擎容差。
- 新增旋转机制测试最初使用了手写粗略坐标上界；现依据作者指定基线、字体 advance/ascent/descent、CropBox/Rotate/UserUnit 生成独立 layout.json，并用两引擎相同的重叠规则检查。该新增几何预期不取自任一引擎输出。
- 两个 Playwright 进程最初共用 test-results，产生 trace ENOENT；已改为 test-results/pdfjs 与 test-results/mupdf，分别重跑。此项属于测试设施冲突，不是产品功能失败。
- 第一次生产 A/B 预检失败：静态服务遗漏 .mjs MIME；远程 Playwright 连接不能使用 download.path()。分别修为 JavaScript MIME 和 saveAs()。原 18 次失败预检及 2 次冷启动记录保留在 engine-ab-preflight-mime-and-download.json；它们不是正式冻结提交的 A/B 数据。
- 原单 MuPDF 基线部分工作负载内存超过 1 GiB，完整 180 次热运行留在 ../baseline-single-engine。公共核心后续以页级快照哈希和逐页验证替代全文字符串与双份 DocInput 复制；最终双引擎使用同一优化后的核心重新测量。
