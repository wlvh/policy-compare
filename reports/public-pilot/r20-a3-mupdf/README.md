# 固定 Rust 候选的公网发布记录

## 实际状态

已发布至 [compare.huaweidata.com](https://compare.huaweidata.com/)，应用入口为 [固定候选 r20-a3-mupdf](https://compare.huaweidata.com/releases/r20-a3-mupdf/)。Custom domain 显示 Active，实际 HTTPS 资源和隔离响应头已检查。

公开浏览器验收当前为 **FAIL**。现有 4 项检查中 1 项通过、3 项失败，均在等待引擎就绪时失败。另行使用正常浏览器访问，也出现应用自身的 15 秒加载超时。此前两次正常浏览器探针完成过 P02，说明程序能在已观察条件下运行，同时首次加载仍存在波动。

真实受邀者和业务样本均为 0。用户已选择业务文件稍后提供。七项本地代理操作检查保留在 Issue #19 原候选记录中，人工作业表仍为未评价。Issue #19 继续开放。

## 版本与发布身份

| 项目 | 实际记录 |
| --- | --- |
| 固定应用 | `r20-a3-mupdf` |
| 应用源码 | `a3ad1646f4ea3eb95ec94ae493e0d5d1a593013d` |
| 原始镜像 | `sha256:fee53485a33b436a3f48ca17084f2a46e128e7c3bf64655ffd758adbbd5ed998` |
| 构建清单 SHA-256 | `766c5704bbeb17a8e6e7ff6e151056219c8316b96b51ce5f3d7e3a3b6c382416` |
| Rust WASM SHA-256 | `30d737bc7bcf0e7d555811aeae19834e6311c6117fc9b355d572da8f44002898` |
| Pages 项目 | `huaweidata-compare` |
| 首次控制台部署 | `292f37c2-9253-46f6-96e1-24dcd1b4dd75` |
| 当前 CLI 部署 | `3350dadc-9f46-4b85-b0e0-7fd8e33309b2` |
| 当前部署地址 | `https://3350dadc.huaweidata-compare.pages.dev/` |

原始 89 个应用资源及构建清单共 90 个文件均保持字节相同。托管修订增加 HTML 禁止改写响应头与该配置的源码下载，当前上传目录共 117 个文件，其中 115 个可直接下载，另外两个为 Pages 配置文件。

Wrangler 默认附带的 Git 标记 `1762516` 是当前托管分支基点。实际应用身份取自上述固定清单。托管文件及本轮记录尚未提交 Git，具体文件校验值保存在 `approved-site-files.json`。

## 工具与授权

本机安装的 Cloudflare 插件含官方 API MCP 配置，当前会话未提供其可调用工具。Wrangler 4.158.0 可运行，但旧 OAuth 授权已过期。用户完成官方设备登录后，CLI 已能读取部署及发布。

本次授权仅含账户、用户、域名读取和 Pages 发布，自动带有刷新登录所需的 `offline_access`。未记录令牌。发布命令及重现方法见 [托管说明](../../../deploy/cloudflare/README.md)。实际 CLI 日志为 `wrangler-deploy.log`，部署列表为 `pages-deployments.json`。

所有者明确授权本轮固定候选按 AGPL v3 或更高版本公开发布。授权声明、完整 MuPDF 源码分卷、项目源码、依赖源码、补丁和构建说明已随站提供，入口为 [源码与许可证](https://compare.huaweidata.com/open-source/)。授权范围见根目录 `NOTICE` 和站点 `DISTRIBUTION-NOTICE.txt`。

## 页面改写问题

首次发布时，浏览器收到 Cloudflare 自动注入的 Web Analytics 脚本。应用的 CSP 将其阻止。同期 curl 下载得到的 HTML 与上传文件相同，因此初次文件核对没有揭示浏览器响应差异。

Pages 项目自身的统计开关显示关闭，具体注入规则尚未确定。本次采用仅对 HTML 增加 `Cache-Control: no-transform` 的方式禁止注入，WASM 等资源继续使用原有压缩和缓存。两个浏览器对照中的实际应用 HTML 都已无统计脚本，并与固定候选首页逐字节相同，见 `hosting-revision.json`。这一方式来自 Cloudflare 的官方配置说明。[Cloudflare Web Analytics 配置](https://developers.cloudflare.com/web-analytics/get-started/)

## 浏览器与下载证据

| 证据 | 观察结果 |
| --- | --- |
| `pages-dev/verification.json` | Wrangler 本地 Pages 上的原有 4 项检查通过 |
| `external/verification.json` | 首次公网检查 3 通过、1 失败。执行时同时下载全部发布材料，存在带宽竞争 |
| `external-serial/verification.json` | 无同步下载的公网复跑仍有就绪失败 |
| `external-cli-release/verification.json` | 当前 CLI 部署，1 通过、3 失败 |
| `cold-load.json` | Chromium 156.0.8078.4 完成 P02。进入应用到 PDF 引擎就绪约 3.99 秒，点击 P02 到结果约 5.35 秒 |
| `cold-load-installed-chrome.json` | Chrome 156.0.8078.81 完成 P02。进入应用到 PDF 引擎就绪约 17.31 秒，点击 P02 到结果约 2.88 秒 |
| `normal-load-diagnostic.json` | 当前部署，正常加载也出现应用 15 秒超时 |
| `routed-load-diagnostic.json` | 当前部署，开启请求拦截后同样出现应用 15 秒超时 |
| `public-cli-release-http.json` | 当前部署的 115 个文件中，111 个在本轮下载限制内完成并与上传字节相同，4 个大型源码文件下载超时 |
| `public-source-recheck.json` | 串行重检四个大型源码文件，4/4 完成且 SHA-256 相同 |
| `public-file-summary.json` | 结合初次下载和单独保留的重检记录，115/115 个公开文件逐字节核对一致 |

17.31 秒包括动态主程序下载，产品的 15 秒 PDF 初始化计时在主程序挂载后开始，两者起点不同。以上均为本机和当前网络的单次观察，不作为普通设备或公网性能分位数。网络原始记录中负数缓存体积表示浏览器未提供有效测量值，不能计入传输总量。

诊断曾把测试的引擎就绪等待从默认 5 秒改为产品期限 15 秒，并增加主程序挂载等待，仍未通过。修改已保存为 `verification-probe.diff`，测试源码与 Playwright 配置已恢复原样。失败记录对应当时的诊断版本，保留其实际含义。

当前两个对照都在 MuPDF WASM 下载完成前触发应用超时，不能只归因于测试拦截。正常加载对照脚本保存在 `load-probe.ts`。当前保留该问题，未修改固定产品或无限延长测试来获取通过状态。

大型源码文件仅在主动下载时传输。首轮 HTTP 核对使用 4 路并行和每文件 60 秒期限，原始失败保留。`public-source-recheck.json` 单独记录随后对这四个文件采用串行、每文件 300 秒的重检。该下载设置与应用 15 秒初始化期限分开记录。

## 剩余范围

先解决或明确记录当前首次加载失败，再汇总真实网络、普通设备、陌生使用者与业务样本反馈。用户可直接转发网址，使用 U01–U10 匿名记录。邀请草稿尚未发送，业务文件按用户决定等待后续提供。

完整浏览器内存、严格规则缺口、公司接入、组织权限、OpenShift 与办公终端验收保留原状态。该站的本地或公网一次成功不替代这些要求。
