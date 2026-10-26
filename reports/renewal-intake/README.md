# 新续保样本：已有观察和未完成检查

这是固定产品 `1ce93d4dd41d1d46d5dd4b49a35f73d1b74a7183` 在另一批合成续保输入上的记录。它不替代原 32 对验证集，不计入真实保单人工试用，不宣称全量作者事件通过。

输入来自 `jiehuan/falcon-mini` 的 `0eef67dd6cbe477ab625885220686c674640fb88`，作者声明所有公司名、编号、金额虚构。10 个源文件保留原字节并核对 Git blob SHA 与 SHA-256，见 [来源清单](source-manifest.json)。原 184 个 validation 文件未修改。

## 结果和边界

| 样本 | 引擎 | CLI / 浏览器状态 | 差异卡片 | 待核验组 | 提取覆盖 issue |
|---|---|---|---:|---:|---:|
| aviation_2024_vs_2025，20/19 页 | PDF.js | partial / partial | 227 | 13 | 0 |
| aviation_2024_vs_2025，20/19 页 | MuPDF | partial / partial | 226 | 13 | 0 |
| bizav_2024_vs_2025，18/19 页 | PDF.js | partial / partial | 400 | 2 | 0 |
| bizav_2024_vs_2025，18/19 页 | MuPDF | partial / partial | 400 | 2 | 0 |

每个 workflow PASS 仅证明比较流程能结束、导出结果、选定免赔额有双侧位置、关闭任务后 Worker 为 0，且未观察到站外/上传请求。它不代表 partial 已解除，不代表所有变化正确，更不代表业务签收。

金额抽查是航空版作者事件 14（第 4 页 250,000→300,000、400,000→500,000）和商务航空版事件 11（第 3 页 50,000→75,000）。[位置参考](amount-location-reference.json) 来自独立 pdfplumber/pdfminer 的原 PDF 词区域，并看过 Poppler 渲染；不来自产品输出。

作者清单共 177 项正文、5 项页眉页脚/水印事件，完整漏报、误报、分类与移动事件核对仍为 NOT_EVALUATED。本机是 M4 Max / 128 GiB；这里的单次耗时、后来复现脚本的重跑，均不是正式 A/B 性能验收。

## 已确认的新问题

- **RENEWAL-01，页码误分类：** 商务航空版两引擎各 35 张纯页码卡片为 Material；作者 H4 和 PDF 原文确认是页码。另有 38 张 Draft 的 Cosmetic 卡片，作为提示负担观察。[原始观察摘要](new-observations.json)
- **RENEWAL-02，承保人—份额未关联：** 第 8 页 HPX 0624 的 12.5%→10.0% 未形成完整业务事件；旧值单列删除，新值属于重复百分比待核验组。两引擎均读到同一高度的公司、编号、份额、日期，结构整理却把公司及编号识别为标题，百分比作为正文，table/rowKey/entity 为空。[结构诊断](structural-diagnostics.json)
- **待核验提示可操作性不足：** 不同组都显示相同概括文字，且当前跳转只取每侧首个位置。跨页组需翻页核对，不能点一次就视作全组已确认。该结论来自当前源码和实际界面观察。

这些问题在本次交付中保留，产品尚未改动。F1—F7 仍按原审核范围关闭；不能用泛化 partial 替代进一步解决明确的结构问题。

两版逐项证据与源区间见 [findings.json](findings.json)，包含页码误分类实例，以及 HPX 新份额来源只在待核验组、没有进入差异卡片的检查。

## 原始材料在哪里

- [CLI 摘要](cli-summary.json)、[浏览器摘要](browser-summary.json)、[输入登记](intake-summary.json)、[开发机环境](environment.json)。本目录的摘要把原机绝对目录换为 `$RENEWAL_EVIDENCE_ROOT`；原始文件在附件中未改。
- [PDF.js 航空截图](aviation_2024_vs_2025-pdfjs-deductible.png)、[MuPDF 航空截图](aviation_2024_vs_2025-mupdf-deductible.png)、[PDF.js 商务航空截图](bizav_2024_vs_2025-pdfjs-deductible.png)、[MuPDF 商务航空截图](bizav_2024_vs_2025-mupdf-deductible.png)。截图及金额坐标抽查不等于全量定位便利性评审。
- [原始证据附件校验清单](raw-artifact.json)：Release 的 `policy-compare-renewal-baseline.tar.gz`，含全部原输入/作者答案、8 份原始完整结果、日志、页面渲染、截图和逐项待核对表。压缩包已经实际解压并验证 45 个载荷文件。
- [复现工具检查](reproduction-checks.json)：移植为不依赖个人目录的工具后，重新下载验证输入、重跑 4 个浏览器流程并核对加载资源与原正式构建哈希；没有代替全量规则评分。

完整复现命令、如何观察和后续技术难点见 [交接手册](../../docs/handoff.zh-CN.md)。原始附件保留了历史绝对路径，不需要接收者创建这些目录。
