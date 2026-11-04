# 单侧变化卡的原文参考定位

一张卡只有一侧原文时，点击原先只移动有来源的 PDF，另一侧停在之前查看的页面。即使打开“同步滚动”，点击也没有调用滚轮已经使用的文字对应关系，因此出现用户截图中左侧第12页、右侧第9页的情况。这是界面导航遗漏。

## 当前行为与范围

- 两侧都有原文来源：点击分别定位各自来源；只有实际编辑字符高亮。单侧的标点增删不会使整段另一侧停止导航。
- 只有一侧来源且开启同步：有来源的一侧定位真实原文；另一侧复用已有文字对应关系显示参考上下文。可以是相同页码，也可以因重新分页而不同。参考侧显示“参考位置”和无直接来源说明，不画改动高亮。
- 参考侧本页没有文字对应：只显示同序号的物理页，超出文档范围时显示末页，并明确说明仅为页码参考、不表示内容对应。无可用页面时明确提示。
- 关闭同步：只移动有来源一侧，另一侧保留当前页；说明中写明同步已关闭。
- 主动查看重复次数摘要的某个来源、搜索和覆盖缺口定位继续只使用所选择的来源，本次没有为它们添加自动对照定位。

复用原有滚轮文字对应和插值，没有增加业务身份判断，也没有将“未找到对应”改称确定新增或退出。没有修改提取器、比较核心、评分器、作者PDF／预期或导出格式。参考位置是导航便利，不证明该项在另一侧存在原文；文字对应也不保证整行或整页具有同一业务身份。

## 本地验证

两引擎构建通过：[PDF.js](build-pdfjs.log)、[MuPDF](build-mupdf.log)。两引擎各26项、共52项定向浏览器测试通过：[PDF.js日志](tests-pdfjs.log)、[MuPDF日志](tests-mupdf.log)。日志只去除颜色控制字符并将本机仓库绝对路径替换成`<repo>`。

| 范围 | 每个引擎 | 核对内容 |
|---|---:|---|
| 本轮新增 | 5 | 新增与删除、同步开关、重新分页、无可提取对侧、两侧有来源但编辑字符只在一侧 |
| 重复次数摘要 | 6 | 主卡与摘要分离、真实页码／金额编辑、移动、来源与导出 |
| 连续滚动 | 5 | 跨页、同步、可见页加载和宽高变化 |
| 既有审阅 | 6 | 搜索、定位、导出、取消、任务替换和交换方向 |
| 异常与资源回归 | 4 | 未决字段、损坏页、覆盖区域、缓存 |

新增测试复用已有固定PDF。R29提供整句新增及反向删除；R16作者布局中，旧版物理第1页的上下文到新版第2页，验证没有强迫同页码；扫描E03与原生文字P13组合验证没有文字对应时只作页码参考；R31逗号删除验证两侧直接原文仍能导航。R31测试只评价导航，没有重新评价或关闭既有Mac位置验收缺口。既有次数测试只将“切换回主卡后没有旧摘要提示”的断言更新为允许当前卡自己的无直接来源提示。

```sh
pnpm build:pdfjs
pnpm build:mupdf
POLICY_ENGINE=pdfjs pnpm exec playwright test tests/browser/one-sided-navigation.spec.ts tests/browser/repeat-display.spec.ts tests/browser/scroll.spec.ts tests/browser/review.spec.ts tests/browser/review-regressions.spec.ts --reporter=line
POLICY_ENGINE=mupdf pnpm exec playwright test tests/browser/one-sided-navigation.spec.ts tests/browser/repeat-display.spec.ts tests/browser/scroll.spec.ts tests/browser/review.spec.ts tests/browser/review-regressions.spec.ts --reporter=line
```

另将新增测试中的正向R29用例指向仍运行`b6e4a1691911fc3581594ec08966fc22479adcb1`的本地PDF.js预览：先把缺来源一侧移到第2页，再点第1页新增卡，旧版仍停第2页，断言失败。见[旧版失败日志](before-b6e4a16.log)。该运行使用单独Playwright配置指定现有8081预览、不启动当前构建；当前版本使用上面的正式配置通过。日志是本次实际执行结果，未将故意失败记为修复后的通过。

## 用户原文件复核

在本机8081的PDF.js工作台重新选择用户原`left.pdf`／`right.pdf`。文件哈希和[此前公开样本一致性证据](../continuous-scroll/public-source-check.json)相符；实际PDF截图仅保留本机，没有纳入提交。

开启同步，刻意把基准侧移到物理第12页、待审侧保持第1页，再点`Holm Mutual Aviation Insurance`单侧卡：两侧均显示物理第9页；基准侧有“参考位置”，高亮多边形0个，待审侧实际新增高亮3个。提示为“基准侧无直接来源；已按已有文字对应显示参考位置，不表示找到该项原文。”见[实际界面核对](ui-check.json)。主清单94张、重复次数摘要9项继续保持。

原文件手动复核仅运行PDF.js；MuPDF证据为上述正式回归。此次没有重新提取四组续保PDF或重新宣称全部规则、性能、容器和业务验收通过，既有未评价边界保持。
