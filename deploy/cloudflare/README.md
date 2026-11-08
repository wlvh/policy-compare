# 固定候选的 Cloudflare Pages 发布

本目录只增加托管配置、试用入口与开源材料，不重编译或改写候选应用。执行范围及试用任务见 [第一轮试用安排](../../docs/public-pilot-r20.zh-CN.md)。

## 当前发布结果

- 独立项目名：`huaweidata-compare`；主站项目 `huaweidata` 不变。
- 候选目录：`delivery/public-pilot-r20-a3-mupdf/site/`。
- 首次控制台发布的已确认许可上传包位于 `delivery/public-pilot-r20-a3-mupdf/cloudflare-upload.zip`，其原始身份记录保留在 `upload-package.json` 和 `initial-approved-site-files.json`。后续 CLI 修订直接发布更新后的 `site/` 目录，身份由当前 `approved-site-files.json` 记录。
- 原始应用来自固定镜像 `sha256:fee53485a33b436a3f48ca17084f2a46e128e7c3bf64655ffd758adbbd5ed998` 的 `/app/dist`，放入 `site/releases/r20-a3-mupdf/`。
- `reports/public-pilot/r20-a3-mupdf/artifact-copy.json` 保存 89 个原资源的 SHA-256 核对；`upload-package.json` 保存 ZIP 校验值及临时解压核对。
- `cloudflare-local/verification.json` 是 Wrangler 本地 Pages 预览上的现有 4 项浏览器检查，不能替代公开地址验收。
- 已通过独立 Pages 项目发布至 `https://compare.huaweidata.com/`，Custom domain 已显示 Active，HTTPS 可访问。
- 首次控制台部署为 `292f37c2-9253-46f6-96e1-24dcd1b4dd75`。随后使用 Wrangler 发布托管修订 `3350dadc-9f46-4b85-b0e0-7fd8e33309b2`，实际应用资源及构建清单保持原字节。
- Wrangler 的旧 OAuth 授权过期。用户完成设备登录后，CLI 已能读取部署并发布。本次只申请账户、用户及域名读取和 Pages 发布权限。
- `external-cli-release/verification.json` 保留本次公网部署的浏览器检查结果，1 项通过、3 项失败。该次诊断将引擎就绪等待从默认 5 秒改为产品自身期限 15 秒，仍失败。确切诊断差异保存在 `verification-probe.diff`，测试源码和配置已恢复原样。
- 尚未发送邀请，真实参与者及业务样本数均为 0。试用者可以由用户自行转发链接邀请，以匿名编号登记，姓名与联系方式不构成部署前提。

## 源码与许可证

所有者已于 2026-11-07 明确选择 AGPL v3 或更高版本公开发布本轮固定候选。实际授权声明位于 `DISTRIBUTION-NOTICE.txt`，项目根目录的 `LICENSE` 和 `NOTICE` 提供许可证及本轮授权范围。

源码归档、下载清单及 ZIP 已绑定实际授权声明。确认前的 ZIP 和校验记录按原状态保留。

完整源码材料包括固定应用源码、锁文件与构建脚本、Rust crate 源码、MuPDF Unicode 补丁、完整上游 MuPDF 源码和运行时 JavaScript 包。MuPDF 官方完整源码归档来自：

`https://github.com/ArtifexSoftware/mupdf-downloads/releases/download/1.28.1/mupdf-1.28.1-source.tar.gz`

npm 包标记的上游源码提交为 `20061bd45183f5a2bff8f43675e4da91e5ac2901`。其 1,422 个普通源码文件与完整归档逐字节相同；完整归档另含第三方目录。对应记录见 `mupdf-source-comparison.json`。候选原生 MuPDF WASM 与经 npm integrity 核验的包中字节相同，见 `mupdf-binary-provenance.json`；本步没有声称重新编译了 MuPDF。

MuPDF 完整源码压缩包约 69 MB，超过 Pages 单文件限制，因此按顺序切成小于 25 MiB 的文件。下载页提供全部分卷、拼接与构建说明和校验值。源码下载按需进行，不自动增加试用者打开应用时的下载量。

## 发布与验证

当前可直接使用已登录的 Wrangler 发布已核对目录。项目名及分支必须明确指定，避免覆盖主站。

```sh
WRANGLER_SEND_METRICS=false \
CLOUDFLARE_ACCOUNT_ID=7bd4a486d159295357a217bd714c1462 \
bash scripts/pnpm-local.sh dlx wrangler@4.158.0 pages deploy \
  delivery/public-pilot-r20-a3-mupdf/site \
  --project-name huaweidata-compare --branch main --commit-dirty=true
```

实际发布日志保存在 `reports/public-pilot/r20-a3-mupdf/wrangler-deploy.log`。CLI 默认记录的 Git 提交 `1762516` 是托管工作分支的基点，固定应用的真实提交以 `build-info.json` 中的 `a3ad164` 为准。本次托管文件尚未提交，文件级身份由 `approved-site-files.json` 记录。

首次控制台发布采用以下步骤。

1. 保持独立项目，选择 Pages 的 Direct Upload。不要向 `huaweidata` 或旧项目 `huaweidata-site` 上传。
2. 上传已核对、许可已落实的 ZIP。检查上传列表无遗漏、无超限文件，再 Deploy site。
3. 保存部署编号和实际 `*.pages.dev` 地址。先在临时地址执行原清单资源核对、HTTP 检查与现有部署浏览器检查。
4. 在该项目 Custom domains 中关联 `compare.huaweidata.com`，按平台返回信息配置 DNS，等 HTTPS 生效后重新执行外部检查。不能用临时域名的结果替代自定义域名的结果。
5. 公开验证通过后再发送邀请。受邀者联系人、反馈及业务文件保存在获准的仓库外位置。

`_headers` 复用正式容器的 CSP、COOP、COEP、nosniff 和 Referrer-Policy，固定版本资源使用不可变缓存。显式 `404.html` 避免不存在路径被 SPA 回退成成功页面。`_redirects` 只提供健康检查路径；根路径是可见的试用及源码许可入口。

本地预览使用 Wrangler 4.158.0，实际命令：

```sh
bash scripts/pnpm-local.sh dlx wrangler@4.158.0 pages dev \
  delivery/public-pilot-r20-a3-mupdf/site --port 8091 --ip 127.0.0.1
```

项目没有配置 Pages Functions 或数据库。首次公网浏览器响应中发现 Cloudflare 自动加入 Web Analytics 脚本，CSP 已将其阻止，curl 的文件核对没有揭示这项浏览器响应差异。Pages 项目自己的 Web Analytics 开关显示关闭，注入来源尚未追溯到具体规则。

本次托管修订仅对 HTML 响应增加 `Cache-Control: no-transform`，采用 Cloudflare 文档明确支持的禁止注入方式。WASM、JavaScript 等资源继续使用原有压缩与缓存。实际 `_headers` 在源码下载页的 `hosting-headers.txt` 中提供。`normal-load-diagnostic.json` 与 `routed-load-diagnostic.json` 的实际浏览器 HTML 均已无统计脚本，且与固定应用首页逐字节一致。

这两次加载对照均出现应用自身的 15 秒超时，MuPDF WASM 在终止前未完成下载。此前两个正常加载探针完成过 P02，现有证据表明加载有波动，不能将当前失败只归因于测试的请求拦截。源码、报告和实际发布状态应以 `reports/public-pilot/r20-a3-mupdf/README.md` 为准。
