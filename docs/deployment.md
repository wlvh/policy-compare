# Issue #17：开发、候选包验证与内网发布

本指南是可执行交付入口，不是集群已部署的证明。应用仅分发静态资源，PDF 在浏览器内处理。当前支持受控开发体验；来源错误、复杂表格归属和严格样本未评价范围继续按 README 与原报告登记。正式目标架构、访问入口、目标终端与实际引擎使用条件需由组织确认。

## 源码统一从 main 主干获取

相关代码合入 `main` 后按本指南执行。本地开发、候选镜像构建和 OpenShift 发布的源码来源统一为 [main 主干](https://github.com/wlvh/policy-compare/tree/main)。平台侧配置 Git 来源时，仓库地址填写 `https://github.com/wlvh/policy-compare.git`，分支（ref）填写 `main`。

首次获取源码：

```sh
git clone --branch main --single-branch https://github.com/wlvh/policy-compare.git
cd policy-compare
```

已有工作区更新时，先处理自己的未提交改动，再切换并同步主干：

```sh
git switch main
git pull --ff-only origin main
```

镜像构建使用仓库根目录作为构建上下文，构建文件为 [deploy/Dockerfile](https://github.com/wlvh/policy-compare/blob/main/deploy/Dockerfile)。本指南的源码和构建文件链接均指向 `main`。

发布前记录这次实际取到的主干提交：

```sh
git branch --show-current  # 应输出 main
git rev-parse HEAD         # 保存本次发布对应的完整提交号
```

`main` 指定源码来自哪里，具体提交号和镜像内容摘要确定本次发布的内容。每次发布仍需绑定实际提交并验证候选镜像；后续主干更新不会自动改变已发布版本，推广和回滚继续使用已验证的镜像摘要。

## 本地开发（L1）

macOS/Linux 使用 Node.js 24、pnpm 10.12.1，从锁文件安装：

```sh
pnpm install --frozen-lockfile
pnpm install:mupdf
pnpm start:local mupdf 8080
```

入口检查 Node/pnpm、引擎依赖、端口并打开浏览器；只监听 127.0.0.1，Ctrl+C 只停止该次启动的进程组。端口占用时退出，不复用或停止其他服务。PDF.js 使用 `pnpm install:pdfjs`、`pnpm start:local pdfjs 8082`。仓库内的 `scripts/pnpm-local.sh` 可使用本机已有的 Codex Node 24 运行时，不修改系统 Node。

首屏三个按钮加载本站的虚构 P02、P01、E03 并开始比较；预期说明单独来自样本编辑记录，不随产品打包。只有六个 PDF 放在 `apps/web/public/samples/`，构建包含相应引擎许可。开发入口不等于正式发布入口。

构建后对照：

```sh
pnpm build:mupdf
STATIC_ROOT=dist/mupdf node deploy/server.mjs
```

根路径开发构建不要求 Git 元数据；源码 ZIP 未提供提交时明确显示 `source-archive-unversioned`。发布构建必须有真实提交或显式 `POLICY_REVISION`，不能把无版本源码当已冻结发布包。

## 冻结版本与候选镜像（L2-A）

从已同步的 `main` 主干构建，记录当前提交号，并确保工作区产品文件与该提交一致。release-id 是 1–40 位小写字母、数字、连字符，以字母开头、字母或数字结尾；不同内容必须使用不同版本号，禁止覆盖已发布版本。容器入口拒绝覆盖已有候选标签或已有验收记录；重验已构建镜像时使用公共浏览器验证入口。明确传入引擎与 Linux 架构：

```sh
POLICY_RELEASE_ID=r20261104-abc1234 POLICY_PLATFORM=linux/arm64 pnpm test:container mupdf
```

脚本从源码构建实际镜像，以任意非 root UID 12345、只读文件系统、1 CPU/256 MiB、无挂载运行；浏览器访问容器实际随机端口，核对版本、引擎、构建清单后执行完整普通流程及失败恢复、取消、滚动回归。完成后只停止自己创建的容器。默认基础镜像已按内容摘要固定；组织批准的替代镜像用 `POLICY_NODE_IMAGE=<image>@sha256:<digest>`，更换后重新验证。

报告在 `reports/local-deploy/<release-id>-<engine>/`，包括镜像 ID、架构、基础镜像摘要、资源清单、浏览器结果、输入哈希和运行约束。无内部仓库时本地 image ID 不是仓库可拉取的 RepoDigest，不能填进正式发布模板冒充已推广镜像。

资源构建通过 `POLICY_RELEASE_ID` 设置 `/releases/<id>/`，可用 `POLICY_CONTACT` 在构建时设置普通用户维护联系人。每个镜像只服务自己的版本路径；根请求 302 跳到该路径且不缓存。缺失文件返回 404，不返回首页。启动前校验 `build-info.json` 中每个文件的 SHA-256 和长度，缺少或修改资源时不进入健康状态。不可变版本路径下所有资源可长期缓存；保留期内不得替换该目录内容。

公共浏览器入口可检查构建后服务、容器或真实 HTTPS Route：

```sh
POLICY_BASE_URL=https://review.example.internal/releases/r20261104-abc1234/ \
POLICY_RELEASE_ID=r20261104-abc1234 POLICY_ENGINE=mupdf \
POLICY_MANIFEST_SHA256=<expected-build-info-file-sha256> \
POLICY_REPORT_DIR=reports/openshift/r20261104-abc1234 \
pnpm verify:deployment
```

预期哈希从已验候选包 `build-info.json` 取得，不能为了通过而采用未知目标返回的值。指定外部网址时不启动或复用 Vite；用例以版本路径为基准。独立临时服务器的 F7 缓存测试明确跳过，不能计为 Route 测试。`verification.json` 仅报告本次选择的浏览器用例，不代替网络策略、平台身份和业务验收。

更新与回滚的本地演练使用两个实际候选镜像：

```sh
POLICY_REPORT_DIR=reports/local-deploy/<rehearsal-id> \
pnpm exec tsx scripts/release-rehearsal.ts <previous-image-id> <candidate-image-id>
```

它在本机路径代理后切换固定入口，验证旧标签页在切换后首次比较仍加载原版本、新会话进入新版、回滚后新会话进入旧版及新版标签页继续工作。它是容器版本保留验证，**不是 OpenShift Route 验证**。

## 真实 OpenShift（L2-B）与正式推广（L3）

本节部署的候选镜像应由上述 `main` 主干流程构建并验证。将实际主干提交号、发布版本和仓库镜像摘要一起交接给平台维护者。

共用运行约束在 `deploy/openshift/base/`；环境参数分别在 `overlays/local/`、`overlays/production/`。示例的 null 是尚未取得的真实信息，生成器会拒绝，不提供可误用的假域名或镜像。

平台填写命名空间、仓库 RepoDigest、节点架构、主机名、实际 OpenShift 版本、内部 ingress controller 名称、路由选择标签和允许入站的 NetworkPolicy peers。服务不主动出网，默认禁止全部容器出站连接；入站选择器需针对集群 CNI 和路由器网络模式确认，不能照搬别处标签。组织监控如需访问，在经审核的 peers 中加入。默认 Route 为 edge TLS，容器内 HTTP；不支持只改字段就宣称入口到容器已加密。

先只生成并审核候选资源，命令直接调用 tsx，避免 pnpm 脚本的输出前缀污染 JSON：

```sh
pnpm exec tsx scripts/render-openshift.ts /secure/local-parameters.json > /tmp/policy-candidate.json
oc --context <development-context> -n <namespace> apply --dry-run=server -f /tmp/policy-candidate.json
oc --context <development-context> -n <namespace> apply -f /tmp/policy-candidate.json
oc --context <development-context> -n <namespace> rollout status deployment/policy-<release-id>
```

生成的 Deployment 不固定 UID，不挂载服务账号令牌，使用只读根目录、RuntimeDefault、丢弃全部能力和 requests/limits；Service 只选择当前版本标签。Route 使用独立版本路径，不在首次部署时切固定入口。

真实 Route 的浏览器验收通过后，再单独生成固定入口：

```sh
pnpm exec tsx scripts/render-openshift.ts /secure/local-parameters.json --entry > /tmp/policy-entry.json
oc --context <development-context> -n <namespace> apply -f /tmp/policy-entry.json
```

平台必须记录：Route 被指定内部入口接受，其他入口没有额外暴露；证书受终端信任；实际 Pod UID、readOnlyRootFilesystem、资源限制、无凭据挂载；网络策略和无非必要出站连接实际生效；重新调度仍取得同一仓库镜像摘要。生产参数使用同一生成器和 L2 已验同架构 RepoDigest。换仓库后核对摘要，多架构镜像同时核对子镜像摘要；重建即新候选，回到 L2。

固定入口升级前开旧标签页，升级后继续定位/搜索/新任务；新会话检查新版；回滚时用上一版参数重新生成 `--entry` 并应用，确认真正回到上一版且比较样例通过。不能使用原来的单 Deployment `rollout undo` 代替本方案的入口切换：每个保留版本有独立 Service/Deployment/路径 Route。

默认保留被替换版本 7 天以及镜像、配置、验收记录。回收前确认保留时间、告知窗口、回滚目标，保留期内不强制刷新用户任务。安全缺陷提前撤回时记录原因和影响。首次没有上一稳定版本时，回滚项记未评价，不能无依据通过。

CRC 需真实 `openshift` preset、安装包与拉取凭据。没有集群时不以 Docker、kind、MicroShift 或 YAML 校验替代。准备要求以 [CRC 官方安装说明](https://crc.dev/docs/installing/)为准；路径 Route 的平台行为参考 [OpenShift ingress 官方文档](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html-single/ingress_and_load_balancing/index)，实际平台版本仍需核对。

## 验收与交接

Issue #17 的 G1/G2/G3 和 A01–A12 分开登记。普通流程通过不等于来源全部正确；本地容器通过不等于 G2；Windows/Edge、普通 16 GiB 办公终端性能、实际禁止外网、证书/认证与 5–10 人试用仍必须有各自证据。未取得环境的项目记未评价，不写不适用。

组织维护者接手前提供实际联系人、内网访问范围、引擎适用条件记录、批准基础镜像及制品流。用户 PDF、密码、文件名、搜索词和导出结果不进 URL、服务器访问日志或自动遥测；关闭任务释放文档与相关显示资源，不宣称物理内存安全擦除。诊断由用户主动下载，只含发布版本、引擎与版本、浏览器版本、阶段、错误代码；JSON 比较结果含原文，按资料授权另行处理。
