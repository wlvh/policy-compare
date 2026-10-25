# 两个 PDF 提取器的能力与证据

锁定 MuPDF.js 1.28.1；MuPDF 适配器位于 engines/mupdf/adapter.ts，Node 与浏览器共用。已检查安装包 dist/mupdf.js 的 StructuredText.walk、dist/mupdf.d.ts 的 walk/render/资源释放签名。浏览器内 WASM 随静态资源自托管。

提取选项：preserve-ligatures、preserve-whitespace、preserve-images、inhibit-spaces、clip；没有 preserve-spans 或 dehyphenate。ActualText 沿用该版本引擎默认行为，rawText 表示提取结果，不能保证恢复字体映射损坏前的视觉原文。未知替换字符会产生覆盖问题。

walk 原实现用 String.fromCharCode 接收完整码点，会截断非 BMP 字符。patches/mupdf@1.28.1.patch 只把这一处改成 fromCodePoint；pnpm 锁定补丁哈希。此修改需随 MuPDF 许可材料一起交付。

字符 origin 与 quad 来自 walk；每个 quad 保留 ul,ur,ll,lr 的方向身份。页面旋转/CropBox/UserUnit 已由 MuPDF 应用，适配器只消除显示页边界原点；不会二次旋转。几何统一对称量化到 0.001 pt。字体和图像回调包装对象、结构化文本、页和位图显式销毁；PDF Worker 持有两个文档直到关闭或取消。

真实合成 PDF 验证见 reports/pdf-checks.json：非 BMP、组合字符、连字保留；90 度旋转 + 非零 CropBox + UserUnit=2 的原点 (440,60)、显示页 600×480；密码、损坏输入、单页异常、销毁后拒绝使用。规则集中另外覆盖旋转状态、嵌入图片与整页扫描。

新增 Unicode 机制样本最初失败：ReportLab 4.4.9 生成 ToUnicode 的 `<1F600>` 不是有效偶数长度 UTF-16BE。pypdf 同样报告 odd-length string。生成器现显式修正为 `<D83DDE00>`；失败记录保留在 reports/failures/pdf-mechanisms-initial.json。这是独立新增测试输入的编码修复，validation 原 32 对 PDF、source、expected、layout 均未修改。

边界：图片未做 OCR；批注/表单有可见覆盖提示；电子签名有效性和通用矢量内容识别未实现。普通文本页 complete_for_scope 仅表示可提取文本范围。复杂多栏阅读顺序和任意表型仍需要真实样本验证。


PDF.js 路线锁定 pdfjs-dist 6.4.299（Apache-2.0），实现位于 engines/pdfjs。已检查 getTextContent、TextLayer、PDFDocumentLoadingTask.destroy、PDFPageProxy.commonObjs 字体对象及算子表的实际代码与类型。显式 disableNormalization=true；同样的 TextContent 选项用于提取和显示来源。独立文字项、标量/UTF-16 区间、run 几何均保留，Node 不伪造字符 quad。

浏览器使用 PDF.js 自己的已加载字体，TextLayer 按提取项建立文本节点；通过 DOM Range 测量具体范围，并按实际 DOM 字号重新测量文本宽度，避免库的测量字号量化误差把标点推到邻字。所有调整基于实际字体前进宽度，没有均分文本段。R04/R09/R14/R31 的严格位置失败与修复证据保留。sourceRanges 中的 itemText 和 UTF-16 范围在测量前核对；核心与 DocInput 不接收 DOM。

两版分别以相同几何标准对照原 layout 及源字符检查。PDF.js Node 报告的 run 来源检查与浏览器精细定位报告分开；浏览器 32 对的实际测量在 reports/browser-rules-pdfjs.json。几何方法不同，不要求两版快照或 JSON 一致。原生/文字层几何各自如实标注。
