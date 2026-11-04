# 主变化清单与纯次数摘要分离

文字相同、只是跨页出现次数不同的项目，原先和实际文字编辑进入同一变化清单，并可点击定位相同文字。这会让用户把 Calloway、Calloway Specialty、731 当成需要审阅的文字改动。本轮收紧默认展示规则，保留底层事实与全部证据。

## 当前规则

- 主变化清单保留真实文字增删改、位置移动及待核对内容。Page 1 of 17 → Page 1 of 18、合同号改动、Draft 新出现都继续保留。
- 两版文字相同、仅重复次数不同且没有明确标记归属未决的项目，放入独立的“重复文字次数变化”摘要。摘要项目数始终可见，详情默认收起，不再生成主变化卡。
- 摘要每项保留原文、两版次数、页数、不同写法上下文及全部来源。点击摘要中的普通文字不会定位；只有主动展开来源并点击具体位置才定位，并说明该来源不代表具体新增／减少位置。
- 主清单计数和筛选隐藏数量不包含摘要项；过滤主清单不会隐藏数量摘要。初始选择第一条主清单记录，不再选择次数项。
- 明确标为结构／归属未决的内容不因文字相同而移入摘要，覆盖与未决列表原样保留。未改文字发生实际移动时仍保留在主清单，以单份原文和位置呈现，避免暗示文字被改写。

没有修改比较核心、提取器、事实判断、样本、作者预期或导出格式。JSON 的原始 differences 和统计仍包含次数记录，因此导出记录数可以大于主清单卡片数；这次不是减少了检测到的事实，也不是准确率提升。页数变化不用于抵消次数差额，也不用于认定新增／减少的位置。

## 本地验证

PDF.js、MuPDF 构建通过。两引擎各21项、共42项定向浏览器检查通过，最终日志见 [PDF.js](tests-pdfjs.log)、[MuPDF](tests-mupdf.log)。测试后仅同步页脚说明文字，最终两引擎重新构建并完成原文件复核。

| 检查 | PDF.js | MuPDF |
|---|---|---|
| 新规则：增加／减少次数分离、真实页码修改、主动查看来源、真正移动、真实页眉金额修改 | 6/6 | 6/6 |
| 连续滚动、可见页加载及宽高变化 | 5/5 | 5/5 |
| 既有审阅、搜索、导出、取消、20次任务替换 | 6/6 | 6/6 |
| 未决字段、损坏页、覆盖区域及资源缓存回归 | 4/4 | 4/4 |

回归复用作者固定的 R16、R12、R09 及独立 PDF 包 P13。P13 明确把 Reference: Page 3 of 10. 改成 Reference: Page 4 of 10.，检查它仍在主卡并定位实际编辑；没有依赖产品当前类别反推预期，也未修改 PDF 或作者答案。

滚动测试明确重置到两侧第一页后再验证，避免依赖“第一条次数卡位于第一页”的旧初始状态。规则手册的2.5和默认计数说明同步更新，保留有版本依据的历史样本记录数。

```sh
pnpm build:pdfjs
pnpm build:mupdf
POLICY_ENGINE=pdfjs pnpm exec playwright test tests/browser/repeat-display.spec.ts tests/browser/scroll.spec.ts tests/browser/review.spec.ts tests/browser/review-regressions.spec.ts --reporter=line
POLICY_ENGINE=mupdf pnpm exec playwright test tests/browser/repeat-display.spec.ts tests/browser/scroll.spec.ts tests/browser/review.spec.ts tests/browser/review-regressions.spec.ts --reporter=line
```

## 用户原文件复核

在本机 PDF.js 页面重新选择用户原来的 left.pdf/right.pdf：

- 主清单94张卡，独立数量摘要9项，默认收起；Calloway、Calloway Specialty、731均没有独立主卡。
- 选择 Page 1 of 17 → Page 1 of 18 卡后，两侧分别有实际编辑的红绿标记，没有相同文字的示例蓝框。
- 展开摘要可看到9项完整原文和17→18次的数量；Calloway保留17处基准来源、18处待审来源。
- 新导出的103条原始记录与固定商务航空结果递归逐字段比较，仅排除 quads、resolvedGeometry、extractionSnapshotHashes，其余完全一致。

[实际界面核对](ui-check.json)、[导出数据与全部数量项核对](data-check.json)记录本轮证据。实际 PDF 截图及完整导出仅保留本机 tmp/local-preview/，没有纳入本轮提交。MuPDF使用上述正式回归，没有将它写成用户原文件的手动检查。

这42项定向检查不等于全套规则、容器、性能或业务验收；已有未评价和样本边界未在本轮关闭。
