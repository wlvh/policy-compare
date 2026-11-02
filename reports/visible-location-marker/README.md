# 点击原文来源后，标记需要真正可见

用户点击重复页眉次数卡后仍看不到标记。复现确认：窄窗口将原文区排在卡片下方，旧定位只滚动 PDF 内部，没有把原文区带入浏览器视野；原有中性色描边又会随 PDF 缩小到不足一个屏幕像素。高亮元素存在不足以证明用户看得到定位。

## 修改

- 明确点击卡片、搜索或来源时，如果原文窗格在屏外或露出范围不足，就将原文区域滚入视野；初始加载、手动翻页和连续浏览不触发这次外层跳转。
- 次数卡的文字示例使用蓝色填充、固定屏幕宽度的描边，以及2像素蓝色外框和“文字示例”标签。边框不随 PDF 缩小，标签保持11像素文字；靠近页顶／页右时调整标签方向。
- 异步文字层完成时读取最新选择，避免加载期间点击被初始化时的旧选择覆盖。
- “新增位置未确定”的说明和全部来源保持；蓝框表示所点文字的来源示例，不表示它是确定新增的位置。真实增删继续使用原有红绿标记。

只修改界面、样式和既有浏览器回归，没有修改提取、比较、事实判断或导出。

## 验证

新增回归复用已有作者固定的 R16 PDF，在650×700窗口点击次数卡。旧实现的文字高亮可见比例为0，测试失败，见[修复前输出](before-pdfjs.log)。修复后要求文字、外框和标签的可见比例至少0.99，并核对边框至少2像素、外框有实际尺寸、另一侧没有该框、全部来源保持收起。0.99仅容纳浏览器对完全可见SVG返回0.99999的浮点舍入。

两引擎构建通过；PDF.js、MuPDF 各16项、共32项定向浏览器检查通过，见[PDF.js 日志](tests-pdfjs.log)、[MuPDF 日志](tests-mupdf.log)。包括次数卡、真正文字修改、连续滚动、可见页加载、窗口宽度／高度变化、搜索导出、覆盖、取消及20次任务替换。

```sh
pnpm build:pdfjs
pnpm build:mupdf
POLICY_ENGINE=pdfjs pnpm exec playwright test tests/browser/repeat-display.spec.ts tests/browser/scroll.spec.ts tests/browser/review.spec.ts --reporter=line
POLICY_ENGINE=mupdf pnpm exec playwright test tests/browser/repeat-display.spec.ts tests/browser/scroll.spec.ts tests/browser/review.spec.ts --reporter=line
```

本机 PDF.js 另用用户原文件检查 Calloway：在652×988窗口，修复前原文窗格顶部在831.5像素，标记位于约923像素，原文大部分仍在屏外；修复后窗格顶部约389.5像素，蓝框和标签完整显示，框宽约55像素、高26像素，边框2像素。原始比对仍为103张卡，仍标注示例来源为待审第2页。[实际窗口与标记尺寸](user-file-check.json)保存本轮核对；截图仅保留本机 `tmp/local-preview/location-before.png`、`location-after.png`。

原文件手动检查仅在 PDF.js 上完成，MuPDF 使用正式回归。上述定向检查不等于全套规则、容器、性能或业务验收通过。
