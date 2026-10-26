# 契约与来源位置

唯一运行时 schema 与 TypeScript 类型来源：packages/contracts/index.ts。内部页码从 0 开始；文本区间是 Unicode 标量半开区间。`scalarOffsets` 显式把标量位置转换为 JS/DOM 的 UTF-16 下标。

DocInput 保留输入 SHA-256、提取器名称/版本、adapterVersion、选项、页面变换、覆盖问题、字符/提取项来源。MuPDF 的原生 quad 不变；PDF.js 的每个标量引用原提取项及 scalarRange/utf16Range，`precision=run`、`geometryMethod=engine_run`。同一项的标量共享该项完整区域，**没有均分宽度或声称这是字符几何**。

PDF.js 显式调用 `getTextContent({disableNormalization:true,includeMarkedContent:false})`。这是提取选项，不是完全无损保证。独立空白提取项保留在 DocInput 中并标记 inferred；公共结构层将它们作为逻辑分隔保存，不把排版间距当业务字词。提取项内部原文、金额、标点和符号继续进入保真比较。字体更换导致的页脚项拆分/合并通过同页基线恢复逻辑单元，两个引擎共用该规则。

浏览器文字层使用同样选项产生的 TextContent，并在每次解析前确认提取项 ID、完整原文和 UTF-16 范围一致。DOM Range 实测区域写入 `resolvedGeometry`，方法标为 `text_layer_range`；该动态几何不属于冻结核心输入的确定性保证。跨页、跨行各自保留位置。没有范围测量时不把 run 框冒充精细高亮。

CompareResult 区分 `coreVersion`、`extractors[2]`、profile、tokenizer、schema 和 `snapshotHashVersion`。公共核心拒绝提取器名称/版本/选项不同的左右输入。相同冻结输入和配置使用固定排序、稳定 ID、确定性工作量预算，规范结果可复现。快照采用按页规范哈希再计算有序根哈希（page-merkle/1），避免生成两份超大全文字符串。

匹配文本只帮助寻找对应。规范化映射支持连字一对多、组合字符多对一；实际差异仍来自 rawText。主体与字段身份先绑定，原样条款优先，再在单调窗口内共同评估 1:1、1:2、2:1、增删。表格使用声明的主/次键；重键组仍可见展示金额并保留两侧来源。滚动只用加权单调对应，移动链接单独保留。

任务结果 complete_for_scope / partial / failed / cancelled 与测试 PASS / FAIL / BLOCKED / NOT_RUN 不混用。图片、未知编码、页面失败和不支持对象列具体覆盖问题；预算耗尽列 unresolved。完成仅表示已声明的可提取文本范围。

取消：外层通过共享取消标记通知核心，在页级快照、结构单元及 LCS 行等边界检查并抛出取消，主线程同时终止 Worker。完整结果的算法和确定性不依赖该标记；取消不返回假完整结果。正式运行须使用附带服务器的 COOP/COEP 头以及 localhost/HTTPS；自建静态主机缺这些条件时仍有硬终止，但不承诺已验证的取消时限。

审核修复：显式章节先于页眉位置启发式处理；重复字段键本身不再代表唯一身份。唯一且稳定的标题上下文先绑定，其他冲突字段仅在本组内展示原文变化并标为待复核。正文重复造成的歧义也只限制该组，不压制独立增删。年度顺延仅适用于非日期原文完全不变的情况。

严重解码失败必须进入完整性结果：PDF.js 严格 worker 补丁与 stopAtErrors 联用，MuPDF 的严重原生诊断按同步调用关联当前文档/页面。已读取页眉不等于正文完整；页面问题沿已有 coverage/page_failed 契约传递。正常压缩页和错误之后的正常文档仍须完整。
