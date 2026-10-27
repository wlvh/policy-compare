# 开发成果交接：如何运行、观察和继续开发

交接日期：2026-10-26。本次交付的是可运行、可复核的开发版本。原 32 对规则与 F1—F7 的已确认修复保留；新续保样本暴露的表格关联和页码问题尚未修复。它适合技术评估与有人完整核对原文的试用，尚不能替代完整人工审阅。

2026-10-28 补充：[当前比较规则、问题证据与改进技术方案](technical-design-20261028.zh-CN.md)。该文档说明现有实现与待实施方案的区别，没有改变本交接快照的产品或验收结论。

## 1. 接收者先看什么

- 仓库：[wlvh/policy-compare](https://github.com/wlvh/policy-compare)。仍为私有仓库，接收者需要读取权限。
- 固定交接快照和附件：[handoff-20261026](https://github.com/wlvh/policy-compare/releases/tag/handoff-20261026)。优先使用这个标签复现本次交付；`feat/policy-compare` 是持续开发分支。
- 产品实现及正式性能固定在 `1ce93d4dd41d1d46d5dd4b49a35f73d1b74a7183`；交接标签增加使用说明、补充证据和复现脚本，未改变产品/基准实现。
- [PR #1](https://github.com/wlvh/policy-compare/pull/1) 为 Ready，尚未合并。开发基线接受、Git 合并、工程综合验收、业务验收是四个不同状态。

普通体验者阅读第 2—5 节即可；接手开发者继续阅读第 6—9 节。原要求优先级及历史审核见 [审核者指南](reviewer-guide.zh-CN.md)。

## 2. 最快体验：使用已构建运行包

需要 Node.js 24，以及桌面浏览器。本机实际验证为 Chrome 154；Linux CI 的浏览器和环境以对应报告为准。以下终端示例使用 macOS/Linux 语法。

从本次 Release 下载 `policy-compare-pdfjs.tar.gz`，解压后：

```sh
cd policy-compare-pdfjs
node server.mjs
```

打开终端显示的 `http://127.0.0.1:8080/`。保持终端运行，结束服务按 Ctrl+C。不要直接双击 `dist/index.html`，Worker/WASM 需要随包的 HTTP 静态服务。

在页面的「01 基准版」选择包内 `samples/before.pdf`，「02 待审版」选择 `samples/after.pdf`，再点「开始比较」。这是一对简单的虚构样本，适合先熟悉操作。

MuPDF 版下载 `policy-compare-mupdf.tar.gz`，进入 `policy-compare-mupdf` 后同样执行 `node server.mjs`。两版同时运行时，可在第二个终端用 `PORT=8082 node server.mjs` 避免端口冲突。每个运行包已经固定一个引擎，不需要安装另一个引擎或 npm 依赖。

各包的 `BUILD.json` 锁定静态文件哈希，`DEPENDENCIES.json` 与 `dist/licenses` 保存版本和许可。压缩包哈希见附件 `DELIVERY_MANIFEST.json`。

## 3. 体验两对较复杂的续保文档

Release 的 `policy-compare-renewal-baseline.tar.gz` 包含原始输入、作者答案、原始试跑结果、截图和逐文件哈希。解压后，输入在：

```text
policy-compare-renewal-baseline/source/testdata/renewal/
  aviation_2024_vs_2025/left.pdf   去年，20 页
  aviation_2024_vs_2025/right.pdf  今年，19 页
  bizav_2024_vs_2025/left.pdf      去年，18 页
  bizav_2024_vs_2025/right.pdf     今年，19 页
```

同一子目录的 `left.pdf` 放左边，`right.pdf` 放右边。两版比较时使用相同原始字节；换版本前关闭旧任务，再重新选择文件。

这些文件来自 [jiehuan/falcon-mini](https://github.com/jiehuan/falcon-mini/tree/0eef67dd6cbe477ab625885220686c674640fb88/testdata/renewal)，固定提交 `0eef67dd6cbe477ab625885220686c674640fb88`。作者明确声明它们为合成文件，所有公司名、编号和金额虚构。共 4 份 PDF、76 页；作者清单含 177 项正文事件及 5 项页眉页脚/水印事件。它们不是 3—5 对真实业务保单，也不算独立业务留出。

源文件没有重新生成，`changes.json` / `changes.md` 保留作者原文。应用只接收两份 PDF，不能读取这些答案。想验证程序能否帮助发现变化时，先从原文独立记录判断，再对照结果和作者清单；不要被程序卡片提前引导。

当前固定版本的实际观察：

| 样本 | PDF.js 卡片数 | MuPDF 卡片数 | CLI / 浏览器最终状态 | 待核验组数 |
|---|---:|---:|---|---:|
| 航空 MRC 版式 | 227 | 226 | 两版均 partial | 两版各 13 |
| 商务航空经纪合同版式 | 400 | 400 | 两版均 partial | 两版各 2 |

卡片数不等于业务事件数，不能拿 400 对 84 直接计算误报率。完整作者事件尚未逐项验收；这里的运行与抽查结果不能写成整批通过。原始摘要及截图见 [补充样本记录](../reports/renewal-intake/README.md)。

## 4. 怎样操作和观察结果

1. **先看任务状态。** 「比较完成」表示程序在声明的可提取文本范围内结束；不等于人工业务签收。「未完全覆盖」表示存在提取缺口或对应关系待核验；计算已经结束，继续等待不会自行解除。「处理失败」要查看具体错误并重新检查输入。
2. **点击变化卡片核对双侧原文。** 红底为旧文字，绿底为新文字。核对章节、主体、页码和实际高亮，不只看数字。可先查看航空版第 4 页的 250,000→300,000、400,000→500,000，或商务航空版第 3 页的 50,000→75,000。这些金额已在两版做双侧坐标抽查。
3. **查看黄色的「需要核验的范围」。** 点击后当前界面只跳到每侧第一个相关位置；跨页组还要翻页核对其他位置。提示重复、缺少页码和具体内容摘要是当前已知的易用性不足。
4. **使用搜索和筛选。** 搜索用于寻找原文位置，不是筛选变化卡片。分类筛选会显示隐藏数量；结束前回到「全部变化」，避免忽略待复核和格式性项目。两侧可分别翻页，也可关闭「同步滚动」。
5. **保存反馈。** 「导出 JSON」保存结构化结果，包含原文片段和位置。记录输入哈希、引擎、产品版本、双方页码、实际结果、预期和截图；不知道是否变化时保留待核对，不猜一个答案。
6. **结束任务。** 「关闭任务」释放本次文档和 Worker；「取消」终止正在运行的比较。不要把关闭任务理解为已安全擦除所有物理内存。

每份 PDF 上限为 100 页、30 MiB；密码文件可输入密码。当前不做 OCR（把扫描图片识别成文字），图片区域应按覆盖提示人工核对。原文比对不验证电子签名有效性，也不解释保险条款的法律效力。

## 5. 当前问题：接收者必须知道的限制

### 表格行内关系未可靠恢复（RENEWAL-02）

航空样本第 8 页，HPX 0624 的份额由 12.5% 变成 10.0%。程序已读到公司名、编号、份额和日期，且四者具有同一行的纵向坐标；但没有把它们组织成一条承保人记录。实际结构把 `HPX 0624` 和 `HX-AV-2210` 当作标题，把 `12.5%` 当成正文。新版编号变化后，份额对应进一步失去稳定依据。

结果里旧 12.5% 被单列为删除，新的 10.0% 留在重复百分比待核验组，尚未形成完整的「HPX：12.5%→10.0%」事件。这是已确认的技术能力缺口。黄色提示诚实说明了不完整，但不能代替把表格关联做好。

当前专用表格规则只配置了 `REGISTRATION / SERIAL / MODEL / CCY / AGREED VALUE` 这一组列名，未覆盖这张 `Insurer / Reference / Written Line / Stamp Date` 表。不要将此产品描述为已具备通用表格恢复能力，也不要认为以后每换一种表格就必须让用户添加配置。

### 页码被当作重要变化（RENEWAL-01）

商务航空样本在两版中各有 35 张纯页码卡片归为 Material（重要变化），例如 `Page 1 of 17` 删除和 `Page 1 of 18` 新增。作者 H4 将它们列为 Header，原文也确认是页码。这是已确认的误分类/审阅噪声。另有 38 张 Draft 水印 Cosmetic 卡片，作为提示负担观察，不直接等同 38 项错误。

### 黄色提示不表示所有未知都已穷尽

航空样本 13 组待核验集中在第 8 页重复份额、第 11—13 页清单片段、第 13—14 页发动机状态、第 15—17 页重复表头。本次未记录页面提取失败或图像覆盖问题；这不证明所有文字永不漏读。227 张卡片也未全部经过人工确认，其中包含待复核分类。

完整人工审阅、真实留出、普通或目标设备、完整内存仍未完成。F1—F7 继续按原复核范围关闭，新问题另列；不能把旧的 32/32 和 CI 绿色扩大成对新表格的质量保证。

## 6. 从源码开发、构建和使用 CLI

需要 Git、Node 24、pnpm 10.12.1。先确保有私有仓库读取权限：

```sh
git clone --branch feat/policy-compare https://github.com/wlvh/policy-compare.git
cd policy-compare
git checkout handoff-20261026
npm install --global pnpm@10.12.1
pnpm install --frozen-lockfile
pnpm install:pdfjs
pnpm dev:pdfjs --port 5173
```

PDF.js 路线不需要安装、下载或加载 MuPDF。要运行另一版，在同一项目的另一终端执行：

```sh
pnpm install:mupdf
pnpm dev:mupdf --port 5174
```

使用命令输出的地址。项目里的 `scripts/pnpm-local.sh` 是原开发机选择已有 Node 24 的便利脚本；接收者使用正常配置的 Node/pnpm，不依赖开发者的绝对路径。

生产静态构建（每个服务器命令占用一个终端）：

```sh
pnpm build:pdfjs
STATIC_ROOT=dist/pdfjs PORT=8081 node deploy/server.mjs
```

```sh
pnpm build:mupdf
STATIC_ROOT=dist/mupdf PORT=8082 node deploy/server.mjs
```

输入与 CLI：

```sh
node scripts/fetch-renewal-samples.mjs --out tmp/renewal-inputs
pnpm compare -- --engine pdfjs --left tmp/renewal-inputs/testdata/renewal/aviation_2024_vs_2025/left.pdf --right tmp/renewal-inputs/testdata/renewal/aviation_2024_vs_2025/right.pdf --out tmp/aviation-pdfjs.json
```

下载脚本核对固定来源、文件大小、Git blob SHA 和 SHA-256，遇到已存在且内容不同的文件会停止，不覆盖旧输入。不能访问上游时，使用 Release 的续保样本附件，其 `source/` 目录与下载输出具有相同内容。

另一版显式使用 `--engine mupdf`。CLI 退出码：完整为 0、不完整为 2、失败为 3、取消为 130；发现差异本身不算失败。这批样本当前返回 2，不要在脚本里吞掉该状态。

PDF.js CLI 的位置是文字段及区间，不是浏览器最终的精细高亮；MuPDF 保留原生字符位置。精细定位要在浏览器核验左右两侧。

## 7. 接手者怎样复核

原功能回归按 [审核者指南](reviewer-guide.zh-CN.md) 执行。不要改原 `validation/` 的标准答案，不把一版输出当另一版答案。

只复现本批样本的浏览器加载、导出、指定金额位置及资源释放时，先启动上述 8081/8082 服务，再执行：

```sh
pnpm exec playwright install chromium
pnpm exec tsx scripts/renewal-browser-check.ts --inputs tmp/renewal-inputs --out tmp/renewal-browser-run --browser chromium
```

已安装 Google Chrome 时可改为 `--browser chrome`；只验 PDF.js 可加 `--engine pdfjs`，无需安装 MuPDF。输出目录必须为空，避免覆盖原始证据。脚本报告里的 workflow PASS 只指这些抽查，`fullAuthorEventAcceptance` 仍为 NOT_EVALUATED。它不是全量新规则评分器，也不做性能冠军判断。

重现「公司和份额没有连接」的内部结构：

```sh
pnpm exec tsx scripts/inspect-renewal-structure.ts --inputs tmp/renewal-inputs --engine both --out tmp/renewal-structure.json
```

该脚本只读取输入并记录同一行的文字、坐标及结构分类，不修复产品。已保存观察见 [结构诊断](../reports/renewal-intake/structural-diagnostics.json)。

原验收分三层：样本构造检查只证明样本按作者操作生成；规则/浏览器测试证明对应测试范围；正式性能证明固定版本、固定输入和设备下的测量。完整 `pnpm verify` 因内存/目标设备等缺项仍可能返回 BLOCKED/非零，不能删检查换取全部绿色。

正式 A/B 原始记录在 `reports/engine-ab.json`，产品绑定 1ce93d4，360 次热运行和 6 次冷启动已保留。M4 Max / 128 GiB 的成绩不替代普通办公电脑。产品或基准实现发生变化时，应重新绑定新版本测量；仅更新交接文档不重复该测量。

## 8. 当前难点与后续开发方向

| 难点 | 当前证据 | 下一步应验证什么 |
|---|---|---|
| 从版面恢复通用表格行列 | 承保人行已读出同一高度，却被拆成标题和正文 | 用文字位置、间距、对齐等恢复表格，覆盖陌生列名、换行、跨页和列宽变化；业务规则用于增强，不作为读懂普通表格的前提 |
| 可靠对应新旧记录 | 多个相同百分比不能确定属于谁 | 综合主体、编号、行列和上下文，不用正在变化的金额强配；重名/缺少区分信息时保留具体待核验范围 |
| 区分正文与页面装饰 | 页码变更产生重要变化卡片 | 识别重复页码/表头并保留可查来源，同时防止含重要金额的重复页眉被一起隐藏 |
| 让不完整结果可操作 | 多个相同提示，跨页组只跳首处 | 显示原因、具体原文、双方页码和全部出现位置；不要靠更宽泛的 partial 掩盖明确变化 |
| 验证能适用于陌生文档 | 原集通过，新增版式仍暴露缺口 | 保留原集，补齐作者事件核对；另取未用于调规则的不同模板。当前两对已公开样本不能再冒充未见过的留出 |
| 保留准确定位与性能边界 | Unicode、两版位置来源和资源释放已有约束 | 改结构时仍保留字符来源和双侧定位；分别测提取、整理、比较、渲染，不牺牲正确性换时间 |

实现入口：`engines/*/adapter.ts` 读取文字/坐标；`packages/compare-core/structure.ts` 整理结构；`packages/compare-core/index.ts` 对应与生成差异；`profiles/aviation.ts` 业务规则；`apps/web/main.tsx` 与 `PageCanvas.tsx` 展示和定位；`tests/evaluation/scorer.ts` 评分。运行时不能读标准答案。

本次交接没有实现上述通用表格改造。后续应先保存当前失败，再补共同能力和不同模板的回归；不能只加 HPX/某份 PDF 的特例，不重写 expected，不把重要变化隐藏到泛化提示里。

## 9. 数据、许可、Linux 与交付状态

PDF 在浏览器本地处理，附带服务器仅提供静态文件与健康检查。结果 JSON、截图、日志可能含原文，按输入的资料范围保存。真实文档能在本地应用中使用，不自动代表可以上传仓库、CI 或进入代理上下文。

本地双引擎开发和私有技术审核已有用户授权；实际对外分发、共享部署和生产许可分别记录在 [许可状态](license-status.json)，不得从本次预发布推断商业授权。随包保留 PDF.js、MuPDF、字体和解码器的实际 LICENSE/NOTICE 与补丁。

Linux 容器、健康检查、只读文件系统与非 root 启动已有 CI 证据，详见 [部署说明](deployment.md)。替换静态服务时保留 Worker/WASM MIME、COOP/COEP 头和缓存策略；固定 URL 资源不能统一使用一年 immutable 缓存。组织平台尚未生产部署。

交付清单：Git 历史、源码、锁文件、版本化引擎补丁、CLI、两版静态运行包、Linux 配置、原验证集与评分器、新样本固定输入/作者答案/原始结果/复现脚本、旧失败与正式性能原件。本次源码 ZIP 是交接标签快照；大体积原始新样本结果放独立附件，并在仓库保留哈希和可读摘要。

**工程综合验收和业务试点仍未全部通过。** F1—F7 已关闭、开发基线可接收，与新样本问题仍存在可以同时成立。请按当前已知状态继续工作，不把可运行交付写成自动审单能力已经验收。
