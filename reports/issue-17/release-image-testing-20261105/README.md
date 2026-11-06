# 同一候选镜像体验流程验证

2026-11-05，按用户要求将本机运行同一候选发布镜像列入发布测试流程。新增 `pnpm preview:release <container.json> [port]`，在自动容器检查后、镜像推送前执行；人工记录与 OpenShift 验收分别保存。

两引擎 Linux 容器 CI 增加同镜像体验入口检查及清理步骤，并验证人工记录没有被自动填写为通过。CI 实际运行结果以 PR #18 对应提交的 checks 为准。

本轮验证使用已存在的 MuPDF 镜像，不重新构建产品：

- 产品提交：`bc9105e44bece8bcb326f5b06cdde733c3618bb4`。
- 版本：`r20261104-bc9105e`，Linux arm64。
- 镜像：`sha256:f4769d0bf32c8bd96a1cb84c479871aa942da2eeabb9374d36800d35ca01b1ae`。
- 清单 SHA-256：`01b3879db852b418aca6d11be85dee96fd940e903be42182ba6f1d3b070bdaf2`。
- 候选原检查：[container.json](../../local-deploy/r20261104-bc9105e-mupdf/container.json)。

## 本轮实际检查

| 检查 | 结果与证据 |
|---|---|
| 两引擎 TypeScript 类型检查 | 通过；脚本及文档哈希见 [verification.json](verification.json)。 |
| 镜像体验入口 | 8090 启动成功；镜像编号、架构、版本标签、清单哈希、健康接口、跳转和隔离响应头一致；[实际运行记录](preview.json)保留容器 ID、用户、限额、挂载和端口。 |
| 复用与停止后重启 | 容器 ID 保持相同，没有重建镜像；[生命周期结果](lifecycle.json)。 |
| 失败保护 | 拒绝失败候选、错误清单哈希、错误提交标签、同名但限制不符的容器和已有记录目录；不替换外来容器，不覆盖证据。复用中的服务发生核对失败后继续运行；本次新启动的服务核对失败后停止。见[拒绝记录](rejected-attempts.json)和[命令日志](guard-checks.log)。 |
| 浏览器部署用例 | 通过 4 项：P02/P01/E03、来源高亮、搜索导出、诊断字段与被测请求范围、关闭清理；隔离配置缺失阻断；主脚本失败后重载；Worker 失败后重试。见[逐项结果](browser-tests-mupdf.json)、[目标预检](target-preflight.json)和[验证范围](browser-verification.json)。 |
| 文档命令 | 部署指南 25 个、新体验指南 4 个 shell 块语法检查通过；本地文件链接通过。部署参数与清单生成检查重新执行，见[操作指南检查](../operator-guide-checks.json)。 |
| 人工验收 | 未评价；生成的 [manual-review.json](manual-review.json) 全部保留 `NOT_EVALUATED`，没有用自动结果填写人工通过。 |
| 真实 OpenShift / 正式环境 | 未评价；没有执行真实集群部署、网络策略、Route、HTTPS 或正式使用者验收。 |

浏览器使用 Playwright 配套 Chromium，环境和输入哈希分别见 [environment.json](environment.json) 和 [input-sha256.json](input-sha256.json)。本轮只执行新增入口及 4 项部署用例，既有完整回归和严格未评价项保留原记录。

最初探测历史 PDF.js 复核记录时，因其使用 `image` 字段且没有 `platform`，新入口按规范拒绝。该尝试保留在命令日志中；没有改写历史报告，也没有放宽新入口的字段要求。本轮入口正向运行验证限定为规范格式的 MuPDF 候选记录，不宣称新入口已对历史 PDF.js 记录兼容。

验证完成后，专用 8090 测试容器已停止并删除；8092/8093 的失败保护测试容器也已删除。用户当前的 `policy-compare-openshift-preview`（8088）持续运行。保存的 `preview.json` 表示当时启动检查结果，不表示专用测试容器仍在运行。

后续操作按[候选发布镜像测试流程](../../../docs/release-image-testing.md)执行；源码、依赖或引擎变化后生成新候选，本机试用与实际集群验证使用该候选的同一镜像。
