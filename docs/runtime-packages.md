# 当前版本的精简运行包

运行包适合把已经构建的程序复制到另一台机器试用。接收机器需要 Node.js 24 LTS 和支持当前应用的浏览器。包内包含所选 PDF 引擎、Rust 比较核心、网页资源、本地静态服务、许可证及样例 PDF。

开发报告、测试答案、测试集、依赖安装目录和编译缓存保留在开发仓库。网页的 P01、P02、E03 按钮及运行包的 `samples/before.pdf`、`samples/after.pdf` 均保留。

## 使用已经生成的包

1. 将所选引擎的 `.tar.gz` 文件和配套 `manifest.json` 复制到接收机器，按清单核对文件 SHA-256 后解压。
2. 在解压后的 `policy-compare-mupdf` 或 `policy-compare-pdfjs` 目录打开终端，运行 `node server.mjs`。
3. 打开 `http://127.0.0.1:8080/`。可以点击网页样例，也可以选择包内两份 PDF 或自己的文件。
4. 结束后在终端按 Ctrl+C。完整操作说明见包内 `RUN.zh-CN.md`。

上述方式用于接收机器本地访问。通过另一台设备的内网地址访问时，需要配置 HTTPS 并保留应用所需的安全响应头，具体步骤见[部署指南](deployment.md)。

## 从源码生成

在仓库根目录准备既有的 Node、pnpm、Rust 工具链和 Python 虚拟环境，并安装选定引擎。使用新的发布编号构建后打包。

```sh
pnpm install --frozen-lockfile
pnpm install:mupdf
POLICY_RELEASE_ID=r-local-example POLICY_REVISION="$(git rev-parse HEAD)" pnpm build:mupdf
pnpm package:runtime --engine mupdf
```

PDF.js 对应使用 `install:pdfjs`、`build:pdfjs` 和 `--engine pdfjs`。两种引擎分别完成构建后可用 `--engine both` 打包。

输出默认保存在 `delivery/runtime-<发布编号>/`。已有目录会拒绝覆盖，可用 `--out <新目录>` 指定位置。清单中的归档文件名以清单所在目录为基准，因此可以将整个目录一起复制。

打包前会核对版本路径、引擎、源码提交和每份静态文件的大小及哈希。所选引擎须绑定同一源码提交。此入口独立保存当前包的身份和验证结果，历史运行包与历史性能报告仍保持各自原有的版本关系。

## 验证实际解压内容

```sh
POLICY_BROWSER_CHANNEL=bundled \
POLICY_REPORT_DIR=reports/maintenance/runtime-example \
pnpm verify:runtime delivery/runtime-r-local-example/manifest.json
```

验证入口需要开发依赖和已安装的 Playwright Chromium。它会在临时目录解压包，检查文件身份，启动包内服务，复用现有四项部署浏览器检查，再通过文件选择入口比较包内的 `before.pdf` 和 `after.pdf`，核对金额、日期和原文高亮。完成后会停止本次启动的服务并删除解压临时目录。

这份结果记录自动操作检查。真实用户试用、业务样本、普通办公设备、完整内存与公司环境要求继续使用各自的验收记录。

