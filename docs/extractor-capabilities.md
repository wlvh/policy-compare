# 两个 PDF 提取器的能力与证据

锁定 MuPDF.js 1.28.1；MuPDF 适配器位于 engines/mupdf/adapter.ts，Node 与浏览器共用。已检查安装包 dist/mupdf.js 的 StructuredText.walk、dist/mupdf.d.ts 的 walk/render/资源释放签名。浏览器内 WASM 随静态资源自托管。

提取选项：preserve-ligatures、preserve-whitespace、preserve-images、inhibit-spaces、clip；没有 preserve-spans 或 dehyphenate。ActualText 沿用该版本引擎默认行为，rawText 表示提取结果，不能保证恢复字体映射损坏前的视觉原文。未知替换字符会产生覆盖问题。

walk 原实现用 String.fromCharCode 接收完整码点，会截断非 BMP 字符。patches/mupdf@1.28.1.patch 只把这一处改成 fromCodePoint；pnpm 锁定补丁哈希。此修改需随 MuPDF 许可材料一起交付。

字符 origin 与 quad 来自 walk；每个 quad 保留 ul,ur,ll,lr 的方向身份。页面旋转/CropBox/UserUnit 已由 MuPDF 应用，适配器只消除显示页边界原点；不会二次旋转。几何统一对称量化到 0.001 pt。字体和图像回调包装对象、结构化文本、页和位图显式销毁；PDF Worker 持有两个文档直到关闭或取消。

真实合成 PDF 验证见 reports/pdf-checks.json：非 BMP、组合字符、连字保留；90 度旋转 + 非零 CropBox + UserUnit=2 的原点 (440,60)、显示页 600×480；密码、损坏输入、单页异常、销毁后拒绝使用。规则集中另外覆盖旋转状态、嵌入图片与整页扫描。

新增 Unicode 机制样本最初失败：ReportLab 4.4.9 生成 ToUnicode 的 `<1F600>` 不是有效偶数长度 UTF-16BE。pypdf 同样报告 odd-length string。生成器现显式修正为 `<D83DDE00>`；失败记录保留在 reports/failures/pdf-mechanisms-initial.json。这是独立新增测试输入的编码修复，validation 原 32 对 PDF、source、expected、layout 均未修改。

边界：图片未做 OCR；批注/表单有可见覆盖提示；电子签名有效性和通用矢量内容识别未实现。普通文本页 complete_for_scope 仅表示可提取文本范围。复杂多栏阅读顺序和任意表型仍需要真实样本验证。两个版本把同一张表按不同次序抽取（一侧按行、一侧按列）时，只有每行各列都有内容、三栏以上的紧凑表按各自的基线成行；两栏表、某列有空格的稀疏表、按基线抽取的折行格不支持：文字都可见，但可能出现只是次序不同的卡，或一删一增（第十一轮，PR #9 r4421790337）。


局部行边界也可能有歧义：已恢复表内，两条完整基线的各列文字逐格成对抽取时，它们既可能是两条记录，也可能是一条记录的每格都换行。`+row-identity.35` 对这种局部块保留逐侧原文及 `ambiguous_identity`，不再把续行的 `(a)` 确定为独立行键；其他完整记录、部分格换行和紧凑表按行/按列提取沿用原有处理。这不扩大上述不支持格式的范围。

PDF.js 路线锁定 pdfjs-dist 6.4.299（Apache-2.0），实现位于 engines/pdfjs。已检查 getTextContent、TextLayer、PDFDocumentLoadingTask.destroy、PDFPageProxy.commonObjs 字体对象及算子表的实际代码与类型。显式 disableNormalization=true；同样的 TextContent 选项用于提取和显示来源。独立文字项、标量/UTF-16 区间、run 几何均保留，Node 不伪造字符 quad。

浏览器使用 PDF.js 自己的已加载字体，TextLayer 按提取项建立文本节点；通过 DOM Range 测量具体范围，并按实际 DOM 字号重新测量文本宽度，避免库的测量字号量化误差把标点推到邻字。所有调整基于实际字体前进宽度，没有均分文本段。R04/R09/R14/R31 的严格位置失败与修复证据保留。sourceRanges 中的 itemText 和 UTF-16 范围在测量前核对；核心与 DocInput 不接收 DOM。

两版分别以相同几何标准对照原 layout 及源字符检查。PDF.js Node 报告的 run 来源检查与浏览器精细定位报告分开；浏览器 32 对的实际测量在 reports/browser-rules-pdfjs.json。几何方法不同，不要求两版快照或 JSON 一致。原生/文字层几何各自如实标注。

审核修复新增 PDF.js `+strict-streams.1`：锁文件中的 pdfjs-dist 补丁修改 build 与 legacy/build 两个实际使用的非压缩 worker，阻止 makeFilter 把无效压缩流无条件变成 NullStream。浏览器明确加载该 worker，配合 stopAtErrors:true 传播页面解析失败。Node 与浏览器都使用补丁；不能仅设置 stopAtErrors 就声称完成。补丁保留于 patches/pdfjs-dist@6.4.299.patch。

MuPDF 适配器版本升至 3：通过真实 setLog 回调按同步原生操作收集错误及 read-error 诊断；正常 warning 不一律视为失败。严重页面诊断变成 page_failed 覆盖问题，保留可读片段但不声明完整。回调作用域在 finally 恢复，后续页/文档不继承旧错误。文档打开/页树阶段严重错误直接失败。

`pdfjs-adapter/3`：PDF.js 对 Type 3 字体（如 Chromium 打印的页眉页脚）报告 `ascent/descent = NaN`，适配器原先只对缺失值兜底，使这类页面全部被判解析失败；现在非有限的字体度量也按缺失处理（上伸 0.8、下伸 −0.2），并由 `tests/fixtures/mechanisms/chromium-type3-header.pdf` 的机制检查覆盖。pdfjs-dist 版本、公共 schema 与 `page-merkle/1` 不变；适配器版本写入快照，所以同一 PDF 的快照哈希与 `/2` 不同。

PDF.js 图像覆盖现在应用 Form 开始/结束的矩阵和图形状态；独立反例验证平移、嵌套、缩放和后续图片状态恢复。自托管字体、CMap 和 WASM 放到 /pdfjs/<实际包版本>/，固定资源要求缓存重新验证。
