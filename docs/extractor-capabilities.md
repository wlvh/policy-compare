# PDF 提取器能力与证据

锁定 MuPDF.js 1.28.1；唯一适配器位于 packages/pdf-adapter/index.ts，Node 与浏览器共用。已检查安装包 dist/mupdf.js 的 StructuredText.walk、dist/mupdf.d.ts 的 walk/render/资源释放签名。浏览器内 WASM 随静态资源自托管。

提取选项：preserve-ligatures、preserve-whitespace、preserve-images、inhibit-spaces、clip；没有 preserve-spans 或 dehyphenate。ActualText 沿用该版本引擎默认行为，rawText 表示提取结果，不能保证恢复字体映射损坏前的视觉原文。未知替换字符会产生覆盖问题。

walk 原实现用 String.fromCharCode 接收完整码点，会截断非 BMP 字符。patches/mupdf@1.28.1.patch 只把这一处改成 fromCodePoint；pnpm 锁定补丁哈希。此修改需随 MuPDF 许可材料一起交付。

字符 origin 与 quad 来自 walk；每个 quad 保留 ul,ur,ll,lr 的方向身份。页面旋转/CropBox/UserUnit 已由 MuPDF 应用，适配器只消除显示页边界原点；不会二次旋转。几何统一对称量化到 0.001 pt。字体和图像回调包装对象、结构化文本、页和位图显式销毁；PDF Worker 持有两个文档直到关闭或取消。

真实合成 PDF 验证见 reports/pdf-checks.json：非 BMP、组合字符、连字保留；90 度旋转 + 非零 CropBox + UserUnit=2 的原点 (440,60)、显示页 600×480；密码、损坏输入、单页异常、销毁后拒绝使用。规则集中另外覆盖旋转状态、嵌入图片与整页扫描。

新增 Unicode 机制样本最初失败：ReportLab 4.4.9 生成 ToUnicode 的 `<1F600>` 不是有效偶数长度 UTF-16BE。pypdf 同样报告 odd-length string。生成器现显式修正为 `<D83DDE00>`；失败记录保留在 reports/failures/pdf-mechanisms-initial.json。这是独立新增测试输入的编码修复，validation 原 32 对 PDF、source、expected、layout 均未修改。

边界：图片未做 OCR；批注/表单有可见覆盖提示；电子签名有效性和通用矢量内容识别未实现。普通文本页 complete_for_scope 仅表示可提取文本范围。复杂多栏阅读顺序和任意表型仍需要真实样本验证。
