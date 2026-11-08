# Cloudflare Pages 发布

本轮独立项目为 `huaweidata-compare`，公开入口为 `https://compare.huaweidata.com/`。本目录保存托管模板，`scripts/package-cloudflare.ts` 从已检查的镜像生成可发布目录。当前启动修订候选为 `r21-startup-a1`，应用源码为 `14a2467d97937c7cca979390d4665d07af65d61c`。

原候选 `r20-a3-mupdf` 的固定资源及原始失败记录已保存。首次部署及 CLI 托管修订分别为 `292f37c2-9253-46f6-96e1-24dcd1b4dd75` 和 `3350dadc-9f46-4b85-b0e0-7fd8e33309b2`。历史证据见 [原发布记录](../../reports/public-pilot/r20-a3-mupdf/README.md)，启动修订见 [本轮记录](../../reports/public-pilot/startup-followup/README.md)。

## 生成发布目录

使用 Node 24 LTS、pnpm 10.12.1 和已启动的 Docker。候选镜像及其 `container.json` 必须来自同一冻结源码，并通过现有容器检查。

```sh
POLICY_RELEASE_ID=r21-startup-a1 \
POLICY_REPORT_DIR=reports/public-pilot/startup-followup/candidate \
POLICY_BROWSER_CHANNEL=bundled \
bash scripts/pnpm-local.sh test:container mupdf
```

上述命令用于从候选源码提交构建。在本次实际构建中，该提交为 `14a2467`，随后增加的发布记录与打包步骤由 PR #21 保存。重新构建时以实际检出的提交生成对应候选记录，核对文件清单。现有候选使用保留的镜像编号，不重用标签替换其身份。

本轮打包脚本以前一轮已核对目录为输入，同时保留其源码材料与旧版本路径。输出目录必须尚不存在。

```sh
bash scripts/pnpm-local.sh exec tsx scripts/package-cloudflare.ts \
  reports/public-pilot/startup-followup/candidate/container.json \
  delivery/public-pilot-r20-a3-mupdf/site \
  delivery/public-pilot-r21-startup-a1/site-final
```

脚本核对前一目录全部 117 个文件，从候选的固定镜像提取新资源，再检查每个资源与候选清单的一致性。它加入托管模板、当前入口、对应项目源码、相同 Cargo.lock 的 Rust 依赖源码、修改说明和构建方法。完整上游 MuPDF 源码和 JavaScript 依赖材料沿用已核对文件。输出旁的 `package.json` 保存全站文件哈希。

本机没有前一轮目录时，可将第二个参数换成其保留的固定部署地址。脚本按已提交清单下载并核对文件。

```sh
NODE_USE_ENV_PROXY=1 bash scripts/pnpm-local.sh exec tsx scripts/package-cloudflare.ts \
  reports/public-pilot/startup-followup/candidate/container.json \
  https://3350dadc.huaweidata-compare.pages.dev/ \
  delivery/public-pilot-r21-startup-a1/site-final
```

固定部署地址中的大型源码分卷需要按需下载。脚本每文件最多等待 300 秒，输出完成后才写入全站清单。该期限用于打包恢复，与浏览器应用的初始化期限分别定义。

## 检查与发布

```sh
WRANGLER_SEND_METRICS=false bash scripts/pnpm-local.sh dlx wrangler@4.158.0 pages dev \
  delivery/public-pilot-r21-startup-a1/site-final --port 8093 --ip 127.0.0.1
```

在本地预览上执行 `verify:deployment`，设置候选清单中实际的版本与 SHA-256，并为每次检查指定独立报告目录。示例命令保存在本轮记录中。

本机 Wrangler 已通过用户完成的官方设备登录获得 Pages 发布和必要读取权限。使用独立项目的生产分支发布生成的目录。

```sh
WRANGLER_SEND_METRICS=false \
CLOUDFLARE_ACCOUNT_ID=7bd4a486d159295357a217bd714c1462 \
bash scripts/pnpm-local.sh dlx wrangler@4.158.0 pages deploy \
  delivery/public-pilot-r21-startup-a1/site-final \
  --project-name huaweidata-compare --branch main
```

发布后保存部署编号，并分别核对固定部署地址和自定义域名。执行原四项部署检查、首次加载与首次比较记录，并检查新旧两个版本的构建清单、实际文件哈希和隔离响应头。主站项目 `huaweidata` 的发布链路独立维护。

## 恢复

旧版本路径 `/releases/r20-a3-mupdf/` 在新站点中保留，可直接访问作对照。需要恢复整个站点时，在 Pages 项目 Deployments 中选择固定旧部署 `3350dadc-9f46-4b85-b0e0-7fd8e33309b2`，执行 Rollback，再重新核对自定义域名和旧候选清单。

也可以按上面的固定部署地址和已提交清单恢复前一目录，再由 Wrangler 上传该目录。旧 `_headers` 的原文来自该部署的 `open-source/hosting-headers.txt`，`_redirects` 使用原有健康检查映射。

## 响应头与源码材料

`_headers` 提供 CSP、COOP、COEP、nosniff、Referrer-Policy 和版本资源缓存。HTML 使用 `no-transform`，阻止 Cloudflare 自动改写页面加入统计脚本。WASM 继续按原设置传输压缩。实际配置原文随站提供为 `open-source/hosting-headers.txt`。

项目自有代码沿用已授权的 AGPL v3 或更高版本发布路径。`LICENSE`、`NOTICE` 和 `DISTRIBUTION-NOTICE.txt` 提供许可、修改与分发说明。每个候选的构建清单和源码归档标明具体提交。上游 MuPDF 完整归档分卷保留，原生 WASM 与官方 npm 包的字节核对记录沿用原候选证据。

试用任务见 [定向试用安排](../../docs/public-pilot-r20.zh-CN.md)。真实受邀者、业务样本、普通设备性能、完整内存与组织环境各自记录。Issue #19 保持开放。
