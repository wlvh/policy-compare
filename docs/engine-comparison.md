# PDF.js / MuPDF.js 实测对照

日期：2026-10-26。产品冻结提交：`1ce93d4dd41d1d46d5dd4b49a35f73d1b74a7183`。两版使用同一公共核心、profile、预算与 UI；正式报告里的 build 哈希锁定实际产物。原始逐轮记录：reports/engine-ab.json。

这是 F1–F7 修复后的新测量。原 f81aebd/2847b56 报告保存在 reports/baseline-review-2847b56；它们只代表旧产品和原评分器的结果，不替代本次测量。

当前状态：完整路径时间与正确性采集 **PASS**；时间预算 **PASS**；包含完整内存的开发机验收 **BLOCKED**；普通 16 GiB 参考设备 **BLOCKED**。已保存的第一批测量中，标准表格的 Chrome helper 在采集时退出；因此不能保证短寿命子进程的历史峰值都被回收。本批统一将完整内存验收标为 BLOCKED；已测物理峰值与 RSS 仍如实报告。诊断原件在 reports/diagnostics。这份报告不能替代业务试点验收。

## 正确性先决条件

两引擎分别通过原 32 对业务规则、六个控制用例与真实浏览器精细位置评分。产品不读 source/expected/layout。R25 金额与双侧来源保留；R27/R28 用具体区域和 partial 表达图片未覆盖，未声称读出图片金额。Node PDF.js 的 run 来源与浏览器 DOM Range 测量分别记录，不混为一项通过。

审核回归 PASS：两个 P1 在真实 PDF 和浏览器中验证；每版 10 项真实 PDF 回归，补充章节归属、坏页/好页、嵌套 Form 和诊断隔离。F6 评分器修复后重新执行了原 32 对精细定位；仅一侧正确不能代表替换双方通过。新测量保留同样的输入 PDF 字节、性能预算和样本次数。

MuPDF 使用原生字符 quad。PDF.js 先保留提取项与标量/UTF-16 区间，显示时核对同样的 TextContent 并用真实加载字体的 DOM 范围测量。默认通用文字层字体曾造成标点偏移，修复与失败证据在 reports/failures。没有均分段落框，也没有修改标准答案。

## 条件与口径

- 设备：Apple M4 Max，16 逻辑 CPU，131072.0 MiB RAM；macOS 开发机，Chrome 154.0.8037.98，接交流电。
- 浏览器：独立 headless Chrome，1500×1000，DPR 1；两侧各一页、同样的 1.35 渲染尺度。仅被测引擎运行，另一引擎浏览器已关闭。
- 三类原始 PDF 各有 8、45、100 页版本；每个版本、每个引擎 **20 次热比较**。按 A/B、B/A 平衡交替；原始 PDF SHA-256 和顺序逐轮保存。每次都重新读文件、打开、提取和比较，无 DocInput/结果复用。
- 热运行先完成应用与选定引擎预热；计时从点击开始，到完整差异和约定的首个原文位置可操作。正式热比较共 360 次，冷启动每引擎 3 次，共 6 次。
- 经验 p95 用 nearest-rank：20 次排序后第 19 项。它不是精确的总体尾延迟。所有失败尝试都保留；成功耗时统计同时列成功数/总数。
- 内存使用独立 Chrome 进程树的 macOS footprint：逐进程实际物理占用/历史峰值，包含 Worker、WASM、原生分配与 GPU；先记录 about:blank 基线，再报告各进程峰值之和减基线。不同进程峰值可能不同步，求和偏保守。同时保存总物理内存和 100 ms RSS 样本；RSS 可能重复计算共享页。JSON 导出在测量峰值之后执行，导出额外内存不计入比较预算。
- 小型 p95 ≤3 秒、标准 p95 ≤20 秒；标准文档可归因峰值 ≤1 GiB。100 页容量组只按事先定义的完整或明确预算降级合同验收；不能拿降级当速度优势。

## 热比较结果

时间单位秒；内存是上述已采集进程口径的增量峰值 MiB，存在短寿命进程覆盖缺口，不能据此确认完整内存达标。

| 工作负载 | 引擎 | 成功/总数 | 失败数 | 中位数 | 经验 p95 | 最大值 | 已测峰值 MiB | 时间预算 | 完整内存 |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| renewal-small | pdfjs | 20/20 | 0 | 0.548 | 0.548 | 0.548 | 348.5 | PASS | BLOCKED |
| renewal-small | mupdf | 20/20 | 0 | 0.481 | 0.482 | 0.482 | 315.3 | PASS | BLOCKED |
| renewal-standard | pdfjs | 20/20 | 0 | 2.347 | 2.397 | 2.430 | 714.1 | PASS | BLOCKED |
| renewal-standard | mupdf | 20/20 | 0 | 2.148 | 2.199 | 2.215 | 589.3 | PASS | BLOCKED |
| renewal-capacity | pdfjs | 20/20 | 0 | 5.347 | 5.381 | 5.413 | 905.0 | PASS | BLOCKED |
| renewal-capacity | mupdf | 20/20 | 0 | 4.898 | 4.931 | 4.964 | 732.1 | PASS | BLOCKED |
| dense_table-small | pdfjs | 20/20 | 0 | 0.464 | 0.465 | 0.465 | 281.4 | PASS | BLOCKED |
| dense_table-small | mupdf | 20/20 | 0 | 0.398 | 0.399 | 0.413 | 303.8 | PASS | BLOCKED |
| dense_table-standard | pdfjs | 20/20 | 0 | 1.931 | 1.948 | 1.948 | 577.2 | PASS | BLOCKED |
| dense_table-standard | mupdf | 20/20 | 0 | 1.714 | 1.731 | 1.731 | 515.0 | PASS | BLOCKED |
| dense_table-capacity | pdfjs | 20/20 | 0 | 4.281 | 4.414 | 4.431 | 902.3 | PASS | BLOCKED |
| dense_table-capacity | mupdf | 20/20 | 0 | 3.781 | 3.847 | 3.881 | 687.9 | PASS | BLOCKED |
| template_change-small | pdfjs | 20/20 | 0 | 0.631 | 0.648 | 0.648 | 369.7 | PASS | BLOCKED |
| template_change-small | mupdf | 20/20 | 0 | 0.565 | 0.565 | 0.581 | 347.0 | PASS | BLOCKED |
| template_change-standard | pdfjs | 20/20 | 0 | 2.914 | 2.996 | 3.014 | 732.0 | PASS | BLOCKED |
| template_change-standard | mupdf | 20/20 | 0 | 2.681 | 2.730 | 2.747 | 770.0 | PASS | BLOCKED |
| template_change-capacity | pdfjs | 20/20 | 0 | 6.430 | 6.664 | 6.680 | 1451.5 | PASS | BLOCKED |
| template_change-capacity | mupdf | 20/20 | 0 | 5.897 | 6.081 | 6.081 | 1092.0 | PASS | BLOCKED |

每轮还核对所有已知变化、默认可见性、输入哈希、完整状态、约定首个位置的实际多边形与独立作者几何预期。模板组分别检查 82、452、1002 个已知事件，不以卡片数相等定义两引擎正确性。

## 冷启动

干净浏览器上下文/缓存，从导航到引擎就绪；OS 文件缓存未强行清理。只报 3 次的中位数和范围，不报冷 p95。资源字节仅为 Playwright 返回了非零大小的响应体之和。两版顶层 Worker 请求的 responseBodySize 均返回 0，虽然 Worker 已实际初始化，因此该列是可计数字节的下界，不是完整下载量；不能据此判定总下载体积优势。完整静态文件大小另列。

| 引擎 | 成功/总数 | 中位数秒 | 范围秒 | 已计数响应体下界 MiB |
|---|---:|---:|---:|---:|
| pdfjs | 3/3 | 0.138 | 0.125–0.165 | 0.8 |
| mupdf | 3/3 | 0.108 | 0.107–0.126 | 10.2 |

## 分项诊断

以下是标准组各阶段中位数，单位 ms。异步阶段会重叠，不能把分项直接相加当总耗时。MuPDF 的 nativeTextExtraction 是 toStructuredText，walk 的原生回调成本包含在 sourceAdaptation；PDF.js 是 getTextContent，覆盖算子遍历另列。因此这一列不能单独用来判定纯解析器胜负。传递列是逐页发送时间戳到核心 Worker 收取的最大延迟，包含克隆/排队/调度；不是纯复制 CPU 时间，也不能将各页延迟相加当串行总耗时。

| 工作负载 | 引擎 | 打开 | 文字提取 | 来源适配 | 传递队列最大延迟 | 覆盖 | 契约检查 | 快照 | 结构 | 对应 | 差异 | 渲染 | 定位 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| renewal-standard | pdfjs | 7 | 56 | 16 | 5 | 33 | 305 | 1635 | 53 | 29 | 2 | 70 | 10 |
| renewal-standard | mupdf | 5 | 58 | 94 | 3 | 0 | 193 | 1083 | 52 | 29 | 2 | 36 | 0 |
| dense_table-standard | pdfjs | 8 | 66 | 19 | 3 | 54 | 212 | 1249 | 49 | 72 | 4 | 63 | 26 |
| dense_table-standard | mupdf | 6 | 58 | 66 | 1 | 0 | 133 | 744 | 36 | 70 | 4 | 33 | 0 |
| template_change-standard | pdfjs | 7 | 62 | 18 | 5 | 36 | 308 | 1863 | 58 | 37 | 239 | 114 | 11 |
| template_change-standard | mupdf | 5 | 64 | 106 | 3 | 0 | 215 | 1232 | 58 | 34 | 188 | 37 | 0 |

传递队列尾延迟、读取、首次可审阅、逐轮交互响应和工作量在原始 JSON 中。主 A/B 记录中的交互是比较初期两次分类切换；额外的标准模板交互测试覆盖整个计算期间、完整列表筛选、滚动、跳转反馈和晚期取消，见 reports/interaction-profile.json。跳转反馈与新页全部定位就绪分别计时，后者不混入反馈指标。

以下单位 ms；每引擎 20 次独立任务，来自同一产品冻结提交。响应 p95 预算 100 ms，取消每次须在 1000 ms 内停止且剩余 Worker 为 0。

| 引擎 | 成功/总数 | 响应 p95 | 响应最大值 | 跳页全部定位 p95 | 取消 p95 | 状态 |
|---|---:|---:|---:|---:|---:|---|
| pdfjs | 20/20 | 16.7 | 82.2 | 118.2 | 316.6 | PASS |
| mupdf | 20/20 | 16.9 | 108.9 | 69.2 | 232.9 | PASS |

## 差异与选择

按同轮配对计算，MuPDF 比 PDF.js 少用的总时间中位数：

- renewal-small：66.4 ms；MuPDF 较快 20/20 轮。
- renewal-standard：183.5 ms；MuPDF 较快 20/20 轮。
- renewal-capacity：434.1 ms；MuPDF 较快 20/20 轮。
- dense_table-small：66.3 ms；MuPDF 较快 20/20 轮。
- dense_table-standard：216.5 ms；MuPDF 较快 20/20 轮。
- dense_table-capacity：500.0 ms；MuPDF 较快 20/20 轮。
- template_change-small：66.3 ms；MuPDF 较快 20/20 轮。
- template_change-standard：248.9 ms；MuPDF 较快 20/20 轮。
- template_change-capacity：499.7 ms；MuPDF 较快 20/20 轮。

这些差异属于完整产品路径，包含数据结构、提取、渲染和定位，不能全部归因于解析库本身。两条路线在这套合成材料上的正确性都通过；真实模板、字体和编码噪声仍需留出样本。即使某路线在每轮都略快，标准组绝对差距和用户流程的意义仍应分开判断，不为制造冠军继续扩到 100 次。

静态目录体积：pdfjs 7.2 MiB；mupdf 10.5 MiB（未压缩，含各自资源与许可）。PDF.js 路线已在未安装/下载 MuPDF 的独立目录与独立缓存中构建通过，产物/请求无 MuPDF；MuPDF 原生字符几何路径更直接。PDF.js 精细定位需要维护文字层、字体与来源关系。

本地试用可优先选择 PDF.js 的 Apache-2.0 路线，同时保留 MuPDF 原生字符几何版本。该建议考虑分发材料与接入成本，不等于忽略 MuPDF 的实测优势，也不构成生产许可或业务质量批准。两版均保留，生产默认版本应在真实人工审阅、未调参留出、目标设备与实际许可范围落实后确定。

## 未完成条件

Linux 两个容器变体：PASS。GitHub Linux CI 实际构建、只读非 root 启动与健康检查通过；https://github.com/wlvh/policy-compare/actions/runs/40279913611。旧本机 Docker BLOCKED 记录保留，不覆盖为通过。普通 16 GiB 参考设备及真实业务/留出材料未提供。OpenShift/Harness 没有部署，它们属于可选组织接入。完整内存统计仍受短寿命子进程覆盖缺口限制。
