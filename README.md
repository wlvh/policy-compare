# 保单 PDF 比较工具：使用说明

选择旧版和新版 PDF，查看文字、金额和条款变化，并点击变化回到原文核对。PDF 在使用者自己的浏览器内处理，不上传；目前不识别扫描图片中的文字。**当前是需要人工核对的开发试用工具，不能直接作为完整审单结论。**

## 获取并启动当前版本

体验当前版本请使用 **`main` 源码**。下方的历史运行包仍对应 `1ce93d4`，没有包含后来合并的修复与独立试用结果；合并源码不会自动更新下载包或部署网站。

以下源码启动步骤适用于 **macOS/Linux**，浏览器建议使用 Chrome。Windows 原生启动尚未验证，现有源码脚本使用 macOS/Linux 的命令格式。

1. 准备 **Node.js 24** 和 **pnpm 10.12.1**。在 [Node.js 下载页](https://nodejs.org/en/download)选择 **24.x**，安装后重新打开终端。检查版本；若尚无指定版本的 pnpm，可通过 npm 安装：

   ```sh
   node --version
   npm install --global pnpm@10.12.1
   pnpm --version
   ```

   第一条应显示 `v24.x.x`，最后一条应显示 `10.12.1`；已有正确版本无需重新安装。不要直接使用下载页默认的其他 Node 主版本。pnpm 安装问题可查看[官方安装说明](https://pnpm.io/installation)。

2. 登录 GitHub，下载 [main 源码 ZIP](https://github.com/wlvh/policy-compare/archive/refs/heads/main.zip)并解压。仓库目前是私有的，使用者需要仓库读取权限；没有权限时请联系提供工具的维护者。
3. 在解压后的 **`policy-compare-main` 文件夹**打开终端，该目录内应能看到 `package.json`。例如，macOS 解压到默认下载目录后，可执行 `cd "$HOME/Downloads/policy-compare-main"`；其他保存位置请相应调整。通过 Git 获取源码的使用者也在仓库根目录执行后续命令。
4. 依次安装依赖、构建并启动 PDF.js 版；任何一步报错时先处理报错，再继续下一步：

   ```sh
   pnpm install --frozen-lockfile
   pnpm install:pdfjs
   pnpm build:pdfjs
   pnpm preview:pdfjs --port 8080 --strictPort
   ```

5. 终端出现本地地址后，在浏览器打开 **http://127.0.0.1:8080/**，页面顶部应显示 `pdfjs`。使用期间保持终端开启；关闭浏览器不会停止服务，在启动服务的终端按 **Ctrl+C** 才会停止。不要直接双击 `index.html`。

首次需要下载源码依赖。之后只需在同一目录运行最后一条启动命令；更新源码后，应停止旧服务，重新执行安装、构建和启动步骤，并重新载入两份 PDF。

### 需要对照 MuPDF 版时

两版界面与比较核心相同，区别在于读取 PDF 的方法。完成上面的根目录依赖安装后，在同一源码目录另开终端执行：

```sh
pnpm install:mupdf
pnpm build:mupdf
pnpm preview:mupdf --port 8082 --strictPort
```

打开 **http://127.0.0.1:8082/**，顶部应显示 `mupdf`。可以用同一对文件观察差异；另一引擎的输出也需要原文核对。

## 完成一次比较

1. 在「01 基准版」选择旧 PDF，在「02 待审版」选择新 PDF；有密码就在对应输入框填写。每份最多 **100 页、30 MiB**。
2. 点「开始比较」。左侧显示变化清单，右侧显示两份原文。
3. 先查看处理状态。有黄色「需要核验的范围」时，点击条目查看未比较或对应未确定的位置；一组可能涉及多个位置，跨页内容还要翻页检查。
4. 点击变化卡片，核对两边高亮：红色为旧侧删除或替换的文字，绿色为新侧增加或替换的文字。尤其确认金额属于哪条记录、哪一列。可以开关「同步滚动」分别查看两侧。
5. 搜索框用于找原文，分类下拉框用于筛选变化。检查结束前回到「全部变化」，避免遗漏被筛选隐藏的卡片。
6. 要保留结果，点「导出 JSON」，并保留原始两份 PDF；结束本次比较点「关闭任务」。更换文件后再次点「开始比较」。

### 首次体验的三个样例

源码已包含下面的虚构 PDF，不需要准备业务文件。每个目录中 **`before.pdf` 放基准侧，`after.pdf` 放待审侧**。先用 P02 完成点击、搜索和导出，再查看另外两种状态：

| 样例目录 | 要观察的结果 |
|---|---|
| [P02：金额变化](validation/synthetic-review-20261030/cases/P02) | 1315 的 `USD 100 → USD 2000` 可见并能定位；1760 的 `USD 1000` 未改。点击核对金额所在行，搜索 `1315`，最后导出 JSON。 |
| [P01：无变化对照](validation/synthetic-review-20261030/cases/P01) | 两份文件逐字节相同，应没有内容变化卡。 |
| [E03：纯扫描图片](validation/synthetic-review-20261030/cases/E03) | 图片可见金额修改，但没有文字层；应明确提示「此页只有图片，正文文字尚未比较」。0 张文字卡不能理解为文档无变化。 |

这三个样例用于熟悉操作和覆盖提示，不代表全部能力验收。[17 对样本说明](validation/synthetic-review-20261030/README.md)及[首轮实际结果](reports/synthetic-review-20261030-run1/README.md)另行保存。

较复杂的两对虚构续保样本在 [测试文件目录](https://github.com/jiehuan/falcon-mini/tree/0eef67dd6cbe477ab625885220686c674640fb88/testdata/renewal)。下载同一子目录的 `left.pdf`（旧）和 `right.pdf`（新）；`changes.md` 是作者记录的答案。这些样本存在拆卡和未评价范围，需要人工核对，也不等同真实业务试用。

## 结果怎么看、目前有哪些限制

| 提示 | 含义 |
|---|---|
| 本次处理结束 | 没有记录到覆盖缺口或未决，仍需核对变化是否正确；不保证不存在未知遗漏。 |
| 有已记录的缺口或未决（黄色） | 有内容没读完整，或旧、新文字没有可靠对应；要补看「需要核验的范围」，不能只看变化清单。 |
| 处理失败 | 本次未正常完成，查看错误信息并检查文件。 |

**卡片数量不代表业务重要性；没有卡片不一定代表没有变化；绿色处理状态也不证明每处高亮或归属正确。** 程序不输出业务或法律结论。

截至 2026-10-30，已知限制包括：

- **部分表格会拆散记录。** 例如 P10 的金额与记录号分散在多张卡，自动归属证据不足；需要结合原文行列核对。
- **存在已确认的错误高亮。** P11 中未改变的 789 行 `USD 3000` 的 `USD` 前缀被标成删除，两引擎均可复现；真实修改仍保留。见[具体来源及截图](reports/synthetic-review-20261030-run1/README.md)。
- **页码事实标签仍可能误标。** 例如 `Policy wording - Page # → Policy wording - Page 4`，不能据标签就认定只有页码数字改变或忽略该变化。
- **跨页、整行重排与复杂续保对应仍有未评价范围；扫描图片文字未比较。** 一处黄色提示可能需要核对多个位置，不能只看跳转到的第一处。

已完成的工程集成及[验收证据](reports/issue-2-amount-binding/README.md)保留原范围；它们不等于所有严格要求通过，也不代替真实业务签收或指定设备性能验收。

## 常见启动问题

| 现象 | 处理方法 |
|---|---|
| `node` / `pnpm` 找不到，或版本不符 | 安装上方指定版本，重新打开终端，再检查 `node --version`、`pnpm --version`。 |
| 提示找不到 `package.json` | 当前目录不对；进入解压后的源码根目录，再执行命令。 |
| 浏览器打不开本地地址 | 确认终端中的启动命令仍在运行，且打开的地址、端口与终端输出一致。 |
| 8080 端口被占用 | 如已有本工具服务，可直接使用；也可改成 `pnpm preview:pdfjs --port 8083 --strictPort`，随后打开 http://127.0.0.1:8083/。 |
| 提示构建目录不存在 | 先完成 `pnpm install --frozen-lockfile`、对应引擎的安装和 `pnpm build:pdfjs`（或 `pnpm build:mupdf`）。 |
| 下载源码或运行包返回 404 / 无权限 | 检查是否登录了获准读取本仓库的 GitHub 账号，向维护者确认访问权限。 |

## 给其他人使用与反馈

以上是**每位使用者在自己的电脑上运行**的方式。`127.0.0.1` 指访问者自己的电脑；把你的本地地址发给别人，对方不会连到你的服务。当前没有在此交付统一的共享服务网址。

需要统一网址时，由维护者按[部署说明](docs/deployment.md)配置并验证 HTTPS 访问入口及浏览器所需的服务器响应头，再提供实际网址。比较仍在访问者浏览器内进行；仅合并 `main` 不会自动完成部署。

有仓库权限可在 [GitHub Issues](https://github.com/wlvh/policy-compare/issues/new)提交反馈；没有权限可将记录交给提供工具的维护者。请附上：

- 使用的引擎（页面顶部 `pdfjs` / `mupdf`）、源码或运行包的下载来源和日期；通过 Git 获取源码时，附 `git rev-parse HEAD` 输出。
- 文件名或样例编号、双方页码、所属记录和列、你认为正确的变化与程序实际显示。
- 截图和获准分享的导出 JSON；JSON 包含原文片段，也带有核心及提取引擎版本。原 PDF 按同一资料授权范围处理。

## 历史运行包（复核旧版用）

[review-20261026-fixes 下载页](https://github.com/wlvh/policy-compare/releases/tag/review-20261026-fixes)中的 [PDF.js 包](https://github.com/wlvh/policy-compare/releases/download/review-20261026-fixes/policy-compare-pdfjs.tar.gz)和 [MuPDF 包](https://github.com/wlvh/policy-compare/releases/download/review-20261026-fixes/policy-compare-mupdf.tar.gz)对应 `1ce93d4`；版本与文件哈希见[交付清单](DELIVERY_MANIFEST.json)。它们不代表当前 `main`，此处保留链接供复核历史版本。

历史包需要 Node.js 24，但无需 pnpm 或源码依赖。解压后在包含 `server.mjs` 的目录执行 `node server.mjs`，打开 http://127.0.0.1:8080/；包内 `samples/before.pdf` / `after.pdf` 可用于旧版试用。
