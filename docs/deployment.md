# OpenShift 部署操作指南

目标：将保单比对工具部署到 OpenShift，通过内网 HTTPS 地址提供浏览器访问。

本指南适用于首次部署、版本更新和入口回滚。首次部署使用平台分配的测试/试用项目，正式环境推广使用已验证的同架构镜像。**源码统一从 `main` 获取，相关 PR 合入主干后执行。**

操作顺序：**登录集群 → 下载主干代码 → 读取平台配置 → 打包并自动检查 → 同镜像人工试用 → 推送镜像 → 部署 → 检查网址 → 开放固定入口。**

暂无集群时，可先执行[候选发布镜像测试流程](release-image-testing.md)，在 Docker 中试用同一候选镜像；无需 Red Hat 账号。该阶段的结果单独记录。

## 第 0 步：确认部署前置条件

部署前需落实以下平台配置与权限，由平台管理员提供或确认。

1. 确认 OpenShift 控制台地址、登录账号及本工具专用的测试项目。已有项目使用实际项目名称；需要新建时，在第 2.1 步创建，并确认账号具有项目内的部署权限。
2. 为本工具分配独立内网域名，并配置 DNS、受信任的 HTTPS 证书和内部访问入口。
3. 提供镜像仓库地址、推送权限和基础镜像来源，并为目标项目的默认服务账号配置镜像拉取权限。部署机的 Docker 登录状态与集群的镜像拉取凭据分别配置；私有基础镜像需在构建前登录其所属仓库。
4. 按第 2 步确认实际参数，在第 4 步复制 [平台配置模板](../deploy/openshift/operator-settings.example.json) 并填写全部字段。该文件只保存环境参数，不保存密码、令牌、证书私钥或镜像拉取凭据内容。
5. 确认部署机可访问集群、镜像仓库、GitHub、构建所需的 npm 包和基础镜像；构建环境禁止直接访问外网时，预先准备内部制品来源。

**部署机**指执行本指南命令的工作站或服务器。本文命令适用于 macOS/Linux 的 Bash 终端；Windows 环境使用已配置的 WSL/Linux 部署机。部署机需安装 Git、Docker、Node.js 24、pnpm 10.12.1 和 OpenShift 命令行工具 `oc`。浏览器自动检查组件在第 5 步安装。

`platform.json` 共有以下 **12 个字段，全部必填**。它们不是 12 个自由命名项：项目、架构、域名、入口规则和镜像仓库必须对应实际平台；可自行决定的是经授权的新名称、首次副本数和实际维护渠道。查询命令及确认步骤集中在第 2.1–2.5 步。

| 配置项 | 实际作用 | 取值来源与填写要求 |
|---|---|---|
| `namespace` | 放置本工具资源的项目。 | 第 2.1 步查询已有项目，或获准后新建。填项目实际名称，如 `policy-compare-test`，不填中文展示名称；项目须存在且账号有部署权限。 |
| `architecture` | 决定镜像架构和应用运行节点。 | 第 2.2 步确认本项目可用工作节点，填 `amd64` 或 `arm64`。不能根据办公电脑选择；镜像验证环境须与之匹配。 |
| `host` | 用户访问服务的完整域名。 | 第 2.3 步由平台分配并落实 DNS、内部入口和证书，如 `policy-compare.apps.internal.example.com`。只填域名，不带协议、端口、路径或 IP。 |
| `replicas` | 每个发布版本运行多少个网页服务副本。 | 首次试用填整数 `1`；当前生成器接受 `1–20`，增大前核对项目配额。不是浏览器并发数，也不会加速浏览器内的 PDF 比较。旧版本保留期间会另占资源。 |
| `routeLabels` | 给候选和固定入口 Route 加标签，供入口控制器筛选。 | 第 2.4 步依据平台实际 `routeSelector` 提供 JSON 键值对象。不能自行编造 `internal: true`；增加标签也不会自动让其他入口拒绝该 Route。 |
| `ingressPeers` | 允许哪些网络来源访问应用容器的 TCP 8080 端口。 | 第 2.4 步由平台按实际网络、路由器命名空间/Pod 标签或来源网段提供 JSON 数组。是入口路由器的后端来源，不是办公电脑 IP 清单；结构与组合含义见该步骤。 |
| `platformVersion` | 记录本次实际 OpenShift 版本。 | 第 2.4 步查 `oc get clusterversion version`，填实际版本字符串，如 `4.20.1`。不填客户端 `oc` 版本；此字段不会升级集群，也不证明已兼容该版本。 |
| `internalIngressController` | 记录本工具应由哪个内部入口接收，供验收对照。 | 第 2.4 步填实际控制器资源名称，如 `internal`。不填域名、IP、Pod 名或 Service 名；它不会自动绑定 Route 或排除默认入口，第 10 步须核对实际接收者。 |
| `contact` | 显示在网页“使用说明与版本信息”中的维护渠道。 | 应用维护负责人提供真实团队、邮箱或工单地址，填单行文本。构建时写入网页；修改后需创建新候选，仅修改部署参数不会更新已验镜像的页面。 |
| `registryServer` | 部署机登录的候选镜像仓库。 | 第 2.5 步由仓库维护者提供主机名，可带端口，如 `registry.example.internal:5000`。不带协议、项目路径或凭据；不是应用的 `host`。 |
| `imageRepository` | 本工具候选镜像在仓库中的完整路径。 | 第 2.5 步使用已创建或获准创建且有推送/拉取权限的路径，如 `registry.example.internal:5000/team/policy-compare`。必须以 `registryServer/` 开头，不带 `:版本` 或 `@sha256:摘要`。仓库项目与 OpenShift 项目不一定同名。 |
| `baseImage` | Dockerfile 用来构建并运行应用的 Node 基础镜像。 | 第 2.5 步提供兼容当前 Dockerfile、支持目标架构的 Node.js 24 完整镜像引用，必须固定 `@sha256:...`。它与最终应用镜像是两个对象，不能用 `imageRepository` 代替；摘要格式正确不等于内容、架构和组织使用条件已核实。 |

OpenShift 项目是放置本工具运行实例、内部服务和访问入口等资源的工作区，其实际名称对应 `namespace`（命名空间）。该名称与 GitHub 仓库名称没有绑定关系；填写 `platform.json` 或运行本项目的部署脚本都不会自动创建项目。

若组织批准使用项目当前的公共基础镜像，`baseImage` 可填以下完整值；否则由管理员提供内部镜像的实际地址和摘要：

```text
node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
```

另有三类前置条件不通过这 12 个字段自动建立：项目操作权限与镜像凭据、DNS/HTTPS 证书与终端信任、组织要求的用户登录控制。当前模板没有应用登录功能，也没有公司统一账号登录（SSO）的配置开关；集群登录、仓库登录和内网访问也不等同于应用用户鉴权。若组织要求入口 SSO，由平台落实并保留浏览器所需响应头；现有自动网址检查不包含 SSO 登录步骤，需要先完成测试登录适配，不能把登录页当作应用检查通过。

**完成条件：**账号和部署机工具就绪，已明确平台、仓库及应用维护负责人。第 2 步确认实际参数，第 4 步保存配置并检查；尚未落实的项不能用示例值代替。

## 第 1 步：检查部署机的工具

**执行位置：**部署机的 Bash 终端。后续步骤依赖当前会话中的环境变量，需在同一终端中顺序执行。命令失败时，完成故障处理后再执行下一步。

```sh
git --version
docker info
node --version
pnpm --version
oc version --client
```

**预期结果：**五条命令均成功；Node 显示 `v24.x.x`，pnpm 显示 `10.12.1`，`docker info` 能显示 Server 信息。若 Docker 提示无法连接，先启动 Docker 服务。

## 第 2 步：登录 OpenShift

**执行位置：**浏览器中的 OpenShift 控制台。

点击右上角用户名菜单 → **Copy login command（复制登录命令）**，按页面提示取得登录命令，并在部署机终端执行。登录命令包含集群地址与访问令牌，不得提交至仓库或包含在反馈截图中。

然后执行：

```sh
oc whoami
oc whoami --show-server
export POLICY_CONTEXT="$(oc config current-context)"
```

**预期结果：**第一条显示当前账号，第二条显示目标集群地址。集群地址与部署目标不一致时，重新登录目标集群。

### 第 2.1 步：确认或创建目标项目

**执行位置：**已完成第 2 步登录的部署机终端。

先查看当前账号可以访问的项目：

```sh
oc --context "$POLICY_CONTEXT" projects
```

**预期结果：**列出可访问的项目。若控制台显示中文展示名称，应使用其对应的实际项目名称填写配置。

确定本次使用的项目名称。以下以 `policy-compare-test` 为例；已有分配项目时，将引号内的值替换为其实际名称：

```sh
export POLICY_NAMESPACE="policy-compare-test"
```

**只有需要新建项目时执行以下命令；已有目标项目时跳过。** 新建名称须遵守公司命名规范，可使用 `policy-compare-test` 这样的名称，避免 `openshift-`、`kube-` 系统前缀。账号具备项目创建权限时执行：

```sh
oc --context "$POLICY_CONTEXT" new-project "$POLICY_NAMESPACE"
```

**预期结果：**显示项目已创建并被选中。若提示 `Forbidden` 或 `You may not request a new project`，按公司流程申请创建及部署权限；若提示项目已存在，确认该项目归属和使用授权后再继续。[项目创建权限与命名说明](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html/building_applications/projects#creating-a-project-using-the-CLI_projects)

无论使用已有还是新建项目，最后执行以下命令确认目标：

```sh
oc --context "$POLICY_CONTEXT" project "$POLICY_NAMESPACE"
```

**预期结果：**显示正在使用指定项目。该命令只切换项目，不会创建项目。切换成功表示可以访问该项目，部署还需账号对 Deployment、Service、Route 和 NetworkPolicy 具有所需的读取、创建和更新权限；第 9 步执行服务端配置校验。新建项目后还须落实第 0 步要求的镜像拉取权限及其他平台配置。

将同一名称填入 `platform.json`，例如以下字段（文件中其余字段保留各自的实际配置）：

```json
"namespace": "policy-compare-test"
```

**完成条件：**目标项目已存在、当前账号可访问并已取得部署所需权限，配置中的 `namespace` 与本步骤的 `POLICY_NAMESPACE` 完全一致。

### 第 2.2 步：查询并确定应用运行架构

`architecture` 表示运行容器的服务器所使用的 CPU 架构。它同时决定第 6 步构建哪一种镜像，以及部署后应用可以被分配到哪一类节点，必须按目标环境填写。

**执行位置：**已登录目标 OpenShift 的部署机终端。查询节点及其架构标签：

```sh
oc --context "$POLICY_CONTEXT" get nodes -L kubernetes.io/arch
```

**预期结果：**节点列表最后一列显示 `amd64` 或 `arm64` 等实际架构。只采用平台允许本项目部署应用的工作节点结果，不能仅根据控制平面节点填写；节点显示 `Ready` 也不代表本项目一定可使用它，还需满足项目的节点选择、资源和调度限制。若提示 `Forbidden`，由平台管理员执行该查询并确认本项目可用节点的架构。

| 目标工作节点架构 | `architecture` 填写值 |
|---|---|
| Intel/AMD 的 x86-64 服务器 | `amd64` |
| ARM64 服务器 | `arm64` |

若集群同时具有两种架构，选择平台允许本项目使用的一种，本次镜像构建与部署统一使用该值。本项目当前仅接受上述两种架构；查询到其他架构时，现有部署模板不支持，不能通过更改配置名称代替适配。

例如，已确认目标工作节点为 `amd64` 时执行以下命令；目标为 `arm64` 时将引号内的值改为 `arm64`：

```sh
export POLICY_ARCH="amd64"
```

将相同值填入 `platform.json` 的 `architecture` 字段。以下为 `amd64` 示例：

```json
"architecture": "amd64"
```

再检查部署机的 Docker 服务实际运行架构：

```sh
docker version --format '{{.Server.Os}}/{{.Server.Arch}}'
```

**预期结果：**显示 `linux/amd64` 或 `linux/arm64`。本指南在部署机上构建并立即运行镜像执行自动检查，应使用与目标架构一致的 Docker 环境。例如，Docker 为 `linux/arm64`、目标节点为 `amd64` 时，应在具备原生 amd64 Docker 的构建/验证机上执行后续镜像检查；跨架构模拟运行可以用于探索，但不能替代目标架构的实际运行验证。

部署文件会按所填架构生成节点选择条件 `kubernetes.io/arch`。填成集群中没有可用节点的架构时，应用可能一直等待分配；镜像与实际运行节点不匹配时也可能启动失败。[节点架构与调度说明](https://docs.redhat.com/en/documentation/openshift_container_platform/4.15/html/postinstallation_configuration/configuring-multi-architecture-compute-machines-on-an-openshift-cluster)

**完成条件：**已确认本项目可用工作节点的架构、同架构的镜像验证环境及基础镜像支持情况，配置中的 `architecture` 与 `POLICY_ARCH` 一致。浏览器所在电脑的 CPU 架构不参与这个字段的选择。

### 第 2.3 步：确定用户访问域名

`host` 是用户在浏览器中访问本工具时使用的域名。部署文件将它写入网址接入配置（Route）的 `spec.host`，用户访问地址为 `https://<host>/`；具体发布版本使用该域名下的 `/releases/<版本号>/` 路径。

先由平台确认本项目应使用的内部入口控制器、允许使用的域名范围及分配给本工具的完整域名。有查询权限时，可在已登录的部署机终端查看入口控制器名称和实际使用的域名：

```sh
oc --context "$POLICY_CONTEXT" -n openshift-ingress-operator get ingresscontrollers -o custom-columns='NAME:.metadata.name,DOMAIN:.status.domain'
```

**预期结果：**列出入口控制器及其域名，名称与平台指定的 `internalIngressController` 对应。若提示 `Forbidden`，由平台管理员提供查询结果。该列表本身不能证明哪个入口仅供内网使用，不应直接将默认入口当作内部入口。

例如，平台确认内部入口域为 `apps.internal.example.com`，并批准本工具使用 `policy-compare` 这个应用名称，可以分配完整域名 `policy-compare.apps.internal.example.com`。以下均为示例，须替换为实际分配值。

填写前需确认：

- 内网用户使用的 DNS 能将该完整域名解析到平台指定的内部入口地址。平台已配置适用的泛域名解析时可沿用，否则需单独配置该名称的解析。DNS 负责将域名转换为访问地址。
- 内部入口提供的 HTTPS 证书覆盖该完整域名，且目标办公浏览器信任其签发机构。泛域名证书 `*.apps.internal.example.com` 可覆盖上述单层子域名示例。
- 该域名及本工具使用的路径已经分配给本项目，没有与其他应用冲突。名称中含有 `internal` 不会自动限制访问范围，实际内部入口仍需在第 10 步核验。

**当前模板使用接收该 Route 的入口控制器默认证书，没有在 Route 中设置单独的证书和私钥。** 使用默认域下的应用名称或公司另行分配的自定义域名，都必须先确认该默认证书覆盖目标名称。本项目的部署文件不包含公司 DNS 记录或单独域名证书的创建配置；平台若有自动配置机制，仍须确认其结果，不能仅凭已填写 `host` 判断 DNS 和证书已经就绪。[Route 与证书说明](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html/network_apis/route-route-openshift-io-v1)

确定实际域名后，设置变量并检查部署机上的 DNS 解析。将示例域名替换为已分配值：

```sh
export POLICY_HOST="policy-compare.apps.internal.example.com"
node --input-type=module <<'NODE'
import { lookup } from 'node:dns/promises';
console.log(process.env.POLICY_HOST);
console.log(await lookup(process.env.POLICY_HOST, { all: true }));
NODE
```

**预期结果：**显示实际域名及解析地址，并与平台提供的内部入口地址一致。`ENOTFOUND` 表示当前解析器未能找到该名称，需检查域名填写、公司 DNS 或内网连接。部署机解析成功不等于办公终端也可访问；第 10 步还需从目标内网浏览器检查 HTTPS 和实际页面，本步骤不要求尚未部署的应用已经返回网页。

在 `platform.json` 中填写相同域名，例如：

```json
"host": "policy-compare.apps.internal.example.com"
```

**完成条件：**完整域名已获分配，DNS、内部入口与默认证书已确认，配置中的 `host` 与 `POLICY_HOST` 完全一致。不得将本机试用的 `127.0.0.1:8088` 或服务器 IP 填入该字段；本指南的域名 Route 和 HTTPS 流程使用域名访问。

### 第 2.4 步：确认平台版本、入口选择和网络来源

**执行位置：**已登录的部署机终端。以下读取集群配置；权限不足时，由平台维护者执行并提供结果，不通过猜测名称或标签补齐参数。

查看 OpenShift 平台版本：

```sh
oc --context "$POLICY_CONTEXT" get clusterversion version
```

**预期结果：**显示集群实际版本，`AVAILABLE=True` 且 `PROGRESSING=False`。将实际 `VERSION` 填入 `platformVersion`；若正在升级，先与平台确认部署窗口。此字段只记录环境，不会改变集群版本或选择另一套部署模板。

将平台指定的内部入口控制器名称写入变量。以下名称 `internal` 必须替换为第 2.3 步确认的实际资源名称，再读取完整配置及来源标签：

```sh
export POLICY_INTERNAL_ROUTER="internal"
oc --context "$POLICY_CONTEXT" -n openshift-ingress-operator get ingresscontroller "$POLICY_INTERNAL_ROUTER" -o json
oc --context "$POLICY_CONTEXT" get namespace "$POLICY_NAMESPACE" --show-labels
oc --context "$POLICY_CONTEXT" get namespace openshift-ingress --show-labels
oc --context "$POLICY_CONTEXT" -n openshift-ingress get pods --show-labels
```

**预期结果：**控制器存在，并取得其选择条件、对外提供入口的方式以及路由器 Pod 标签。平台标准路由器通常位于 `openshift-ingress`；使用不同部署方式时，来源和网络规则须按实际环境确认。将控制器资源名称填入 `internalIngressController`。

平台需要据此提供两项不同配置：

| 字段 | 如何确定 | 不能由此推断的结论 |
|---|---|---|
| `routeLabels` | 使本工具 Route 标签满足指定内部控制器实际 `spec.routeSelector`；应用项目自身还须符合控制器的 `spec.namespaceSelector`。选择器包含 `matchExpressions` 时也须满足表达式。 | 标签不是“仅内网”开关。其他控制器如果不筛选 Route，仍可能接收它；平台需配置其他入口的排除规则，并在第 10 步检查所有实际接收者。 |
| `ingressPeers` | 允许入口路由器访问后端 Pod 的来源。用实际命名空间标签和路由器 Pod 标签确定，或由平台在适用网络下提供明确来源网段。 | Route 被接收不证明后端网络可达，Pod 选择器也不必然适用于所有网络实现。不能用开放全部来源替代排查。 |

下面只说明 JSON 结构：`routeLabels` 是键值对象，`ingressPeers` 是来源数组。示例标签必须按上面查询结果及平台审核值替换，不能直接视作公司集群参数：

```json
{
  "routeLabels": { "example.com/visibility": "internal" },
  "ingressPeers": [
    {
      "namespaceSelector": { "matchLabels": { "kubernetes.io/metadata.name": "openshift-ingress" } },
      "podSelector": { "matchLabels": { "ingresscontroller.operator.openshift.io/deployment-ingresscontroller": "internal" } }
    }
  ]
}
```

同一个来源对象内的 `namespaceSelector` 和 `podSelector` 必须同时满足；拆成数组中的两个对象会放宽为满足任一来源。只填写 `podSelector` 时，其范围是应用所在项目，不能用它跨项目选择路由器。选择器可使用 `matchLabels` 或有效的 `matchExpressions`。本流程拒绝空选择器、空来源对象和 `/0` 全来源网段，不能将它们用作待填占位值。

路由器使用 `hostNetwork` 等方式时，网络插件可能按节点地址识别其流量；平台需确认当前网络实现，必要时提供 `ipBlock` 来源网段并验证。网段使用“地址/掩码长度”（CIDR）格式，例如 `[{"ipBlock":{"cidr":"10.10.0.0/16"}}]` 只展示结构，必须换成平台确认的实际来源。`ipBlock` 与标签选择器不能写在同一来源对象。多条 NetworkPolicy 的放行规则会叠加，现有其他策略可能扩大访问范围。模板自身不放行容器主动出站；这不控制办公浏览器的网络。上述事实须在实际环境验证，配置格式检查无法证明隔离生效。[入口选择条件](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html-single/operator_apis/index)、[网络策略语义](https://kubernetes.io/docs/concepts/services-networking/network-policies/)

**完成条件：**平台提供实际 `platformVersion`、`internalIngressController`、`routeLabels` 和 `ingressPeers`，确认应用项目满足入口选择条件，明确其他入口排除规则及网络验证方式。未落实真实平台规则时，停止在部署前准备阶段。

### 第 2.5 步：确认仓库、基础镜像、副本和维护渠道

由镜像仓库维护者提供可用仓库地址及本工具的路径。以下说明三个字段的区别，均为示例：

| 字段 | 示例 | 来源及要求 |
|---|---|---|
| `registryServer` | `registry.example.internal:5000` | 候选镜像仓库的登录主机。当前流程只使用一套候选镜像地址，部署机和集群节点都须可访问、解析并信任其证书。不能仅提供集群内部可解析的 `.svc` 地址给外部部署机。 |
| `imageRepository` | `registry.example.internal:5000/team/policy-compare` | 已分配的仓库/项目/镜像路径。先确认仓库项目已创建或支持获准自动创建；登录成功不证明具有该路径的推送权限。集群拉取权限也须分别配置。 |
| `baseImage` | `node:24.22.1-alpine@sha256:...` | 组织批准的 Node.js 24 基础镜像完整引用，摘要使用实际的 64 个十六进制字符，不能把 `...` 填入文件。摘要可标识多架构清单或单架构镜像；所选内容必须支持 `architecture`。 |

使用 OpenShift 集成仓库时，镜像路径中的项目须存在，按平台权限配置推送和拉取；使用其他仓库时，其项目不必与 `namespace` 同名。若平台分别提供部署机推送地址和节点拉取地址，须先确定一套双方可用的地址，或由维护者调整并验证跨地址的镜像推广流程，不能直接将两者混填。

`baseImage` 必须与当前 `deploy/Dockerfile` 兼容：构建阶段需要 Node.js 24、Corepack/pnpm 及所需的文件写入权限，运行阶段需要 Node 并能按非 root 用户读取静态资源。不能只看“Node 24”名称就认定另一种 UBI/其他基础镜像可以直接替换。使用私有基础镜像时，部署机须先登录其所属仓库；若不同于 `registryServer`，两处分别登录。构建网络还需能取得锁定的 npm 包和浏览器依赖，最终网页不依赖外部 CDN 不代表镜像构建可完全离线。

本工具每个副本申请 `100m CPU/64Mi`，上限 `1 CPU/256Mi`；`replicas` 是每个发布版本的副本数，首次填数字 `1`。资源配额需同时容纳仍保留的旧版本。浏览器内的 PDF 内存不计入容器限制，增加副本不等于提高单次比较性能。

`contact` 填实际承担支持工作的团队、邮箱或工单地址，例如“保单工具维护组，工单入口：公司实际地址”。它会作为普通文字显示，不会自动发邮件或创建工单，也不能填写访问令牌。正式推广同一镜像时保留镜像中已写入的维护渠道；若测试和正式需要不同联系人，应在创建候选前确定共同渠道，或另建候选并重新检查。

最后由平台确认目标项目默认服务账号的镜像拉取配置。只查看已关联的凭据名称：

```sh
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" get serviceaccount default -o jsonpath='{.imagePullSecrets[*].name}{"\n"}'
```

**预期结果：**平台能说明实际使用的项目/全局凭据或其他拉取机制，以及它对本次仓库路径的权限；空输出本身不能证明可拉取或不可拉取。若平台已为本次仓库创建项目拉取凭据，并要求关联到默认服务账号，将下方示例名称替换为实际凭据名称后执行：

```sh
export POLICY_PULL_SECRET="替换为已创建的项目拉取凭据名称"
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" secrets link default "$POLICY_PULL_SECRET" --for=pull
```

本步骤不创建或输出凭据内容；全局凭据、跨项目授权或外部凭据供应方式由平台处理。关联成功仍须在第 9 步用实际 Pod 拉取结果验证。[镜像拉取权限说明](https://docs.redhat.com/en/documentation/openshift_container_platform/4.15/html/images/managing-images)

**完成条件：**仓库路径与推送/拉取权限、双方网络与证书信任、兼容的固定基础镜像、副本配额及维护渠道均已明确，再进入源码和配置步骤。

## 第 3 步：下载主干代码

**执行位置：**部署机终端。进入项目存放目录，首次获取源码时执行：

```sh
git clone --branch main --single-branch https://github.com/wlvh/policy-compare.git &&
cd policy-compare
```

已有工作区时，进入仓库根目录，处理未提交改动后执行：

```sh
git switch main &&
git pull --ff-only origin main
```

后续命令均在 `policy-compare` 仓库根目录执行：

```sh
git branch --show-current
test -f deploy/Dockerfile && test -f scripts/render-openshift.ts && echo '部署文件已找到'
```

**预期结果：**分支显示 `main`，并显示“部署文件已找到”。如果主干缺少部署文件，先确认相关 PR 已合入 `main`。

## 第 4 步：配置部署参数

创建部署资料目录：

```sh
mkdir -p tmp/openshift
test -f tmp/openshift/platform.json || cp deploy/openshift/operator-settings.example.json tmp/openshift/platform.json
```

用文本编辑器打开 `tmp/openshift/platform.json`，按第 2.1–2.5 步确认的实际值填写 12 个字段，替换全部占位值。上面的复制命令保留已经存在的配置，更新部署时应核对原文件是否仍适用于当前目标。目录已被 Git 忽略。

下面是一个完整 JSON 的结构示例，用来核对对象、数组、字符串和整数的写法。域名、标签、版本、仓库和联系人均为示例，不代表公司已经提供了这些资源；除首次 `replicas: 1` 外均按实际环境填写。基础镜像只在组织批准使用该固定公共镜像时沿用：

```json
{
  "namespace": "policy-compare-test",
  "architecture": "amd64",
  "host": "policy-compare.apps.internal.example.com",
  "replicas": 1,
  "routeLabels": { "example.com/visibility": "internal" },
  "ingressPeers": [
    {
      "namespaceSelector": { "matchLabels": { "kubernetes.io/metadata.name": "openshift-ingress" } },
      "podSelector": { "matchLabels": { "ingresscontroller.operator.openshift.io/deployment-ingresscontroller": "internal" } }
    }
  ],
  "platformVersion": "4.20.1",
  "internalIngressController": "internal",
  "contact": "保单工具维护组 support@example.com",
  "registryServer": "registry.example.internal:5000",
  "imageRepository": "registry.example.internal:5000/team/policy-compare",
  "baseImage": "node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53"
}
```

执行统一配置检查。只需要已安装的 Node.js 24，不依赖第 5 步的 pnpm 安装：

```sh
node scripts/check-platform.ts tmp/openshift/platform.json
```

**预期结果：**显示“12 项配置格式及已选环境一致性检查通过”。检查覆盖全部必填项、拼写错误/多余字段、占位值、副本范围、域名、标签和来源结构、仓库路径与固定摘要，以及第 2 步确认的项目、架构、域名和入口名称。它不能核实标签是否属于真实集群、平台是否批准、DNS/证书是否生效或账号是否有权限；这些仍按对应步骤验证。报错时按字段修正后重跑，不先构建镜像。

将配置加载为当前终端的环境变量，并选择目标项目：

```sh
export POLICY_NAMESPACE="$(node -p "require('./tmp/openshift/platform.json').namespace")"
export POLICY_ARCH="$(node -p "require('./tmp/openshift/platform.json').architecture")"
export POLICY_HOST="$(node -p "require('./tmp/openshift/platform.json').host")"
export POLICY_REGISTRY="$(node -p "require('./tmp/openshift/platform.json').registryServer")"
export POLICY_IMAGE_REPO="$(node -p "require('./tmp/openshift/platform.json').imageRepository")"
export POLICY_CONTACT="$(node -p "require('./tmp/openshift/platform.json').contact")"
export POLICY_NODE_IMAGE="$(node -p "require('./tmp/openshift/platform.json').baseImage")"
export POLICY_INTERNAL_ROUTER="$(node -p "require('./tmp/openshift/platform.json').internalIngressController")"
oc --context "$POLICY_CONTEXT" project "$POLICY_NAMESPACE"
```

**预期结果：**配置检查通过，最后一条命令显示第 2.1 步确认的目标项目。项目不存在时返回第 2.1 步完成创建；权限不足时申请该项目所需权限，处理后再继续。

## 第 5 步：检查镜像来源并安装打包依赖

**执行位置：**部署机终端，仓库根目录。

先登录候选仓库。若私有基础镜像属于另一个仓库，先额外执行 `docker login 基础镜像所属的实际仓库主机`，使用该仓库的凭据；公共可匿名拉取的基础镜像无需额外登录。

```sh
docker login "$POLICY_REGISTRY" &&
docker pull --platform "linux/$POLICY_ARCH" "$POLICY_NODE_IMAGE" &&
docker image inspect --format '{{.Os}}/{{.Architecture}}' "$POLICY_NODE_IMAGE"
```

**预期结果：**登录成功，拉取成功，最后显示与第 2.2 步相同的 `linux/amd64` 或 `linux/arm64`。认证、证书、架构或网络失败先处理后再构建；登录成功不证明路径推送权限，基础镜像兼容性仍以第 6 步真实构建与运行检查为准。

然后安装依赖：

```sh
pnpm install --frozen-lockfile &&
pnpm install:mupdf &&
pnpm exec playwright install --with-deps chromium
```

**预期结果：**三条命令均成功退出。Linux 浏览器依赖安装可能要求管理员权限。下载失败时，检查构建网络或内部制品来源，修复后重新执行。

本指南使用 MuPDF；调整引擎后需重新验证，组织实际使用条件由维护者另行确认。

## 第 6 步：打包并自动检查候选镜像

镜像包含网页资源和静态服务器。构建检查会启动临时容器执行浏览器自动检查，完成后停止临时容器。

生成发布版本号并记录主干提交：

```sh
export POLICY_REVISION="$(git rev-parse HEAD)"
export POLICY_RELEASE_ID="r$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short=7 HEAD)"
export POLICY_PLATFORM="linux/$POLICY_ARCH"
export POLICY_REPORT_DIR="$PWD/tmp/openshift/$POLICY_RELEASE_ID"
export POLICY_IMAGE_TAG="$POLICY_IMAGE_REPO:$POLICY_RELEASE_ID"
printf '本次版本：%s\n主干提交：%s\n资料目录：%s\n' "$POLICY_RELEASE_ID" "$POLICY_REVISION" "$POLICY_REPORT_DIR"
```

执行镜像构建和自动检查：

```sh
POLICY_BROWSER_CHANNEL=bundled pnpm test:container mupdf
```

**预期结果：**命令正常退出，结果 JSON 中 `status` 为 `PASS`。检查针对临时容器运行，后续将该镜像推送并部署至 OpenShift。

读取已验证镜像的编号：

```sh
POLICY_IMAGE_ID="$(node -p "JSON.parse(require('node:fs').readFileSync(process.env.POLICY_REPORT_DIR + '/container.json', 'utf8')).imageId")" &&
export POLICY_IMAGE_ID &&
printf '已验证镜像：%s\n' "$POLICY_IMAGE_ID"
```

**预期结果：**输出以 `sha256:` 开头的镜像 ID。检查失败时，查看本次资料目录的 `failure.log`。修复后使用新版本号重新构建，保留原检查记录。

`releaseId` 和最终镜像地址 `image` 不手工填入 `platform.json`：前者由本步骤生成，后者在第 7 步推送后取得。`POLICY_IMAGE_ID` 是本机镜像编号，`POLICY_IMAGE_TAG` 是可重新指向的仓库标签，`POLICY_IMAGE_DIGEST` 才是部署使用的固定仓库地址；三者不可互换。`POLICY_CONTEXT` 来自登录时的实际上下文，`POLICY_REPORT_DIR` 按本次版本生成，所有检查和失败记录保存在对应目录。

### 第 6.1 步：人工试用同一候选镜像

```sh
pnpm preview:release "$POLICY_REPORT_DIR/container.json" 8088
```

**预期结果：**终端显示体验地址、记录目录和 `READY_FOR_MANUAL_REVIEW`。命令复用第 6 步记录的镜像编号，不重新构建；启动后容器继续运行。端口占用时可改用其他空闲端口。

在浏览器打开输出地址，按[检查清单及结果记录步骤](release-image-testing.md#第-3-步在浏览器逐项检查)执行 P02/P01/E03、来源、搜索、导出、方向交换、取消重开及关闭任务。填写生成的 `manual-review.json`，保留版本及镜像标识。人工项初始均为未评价，启动成功不计为人工验收通过。发现失败先修复并创建新候选；未评价项按项目放行要求处理。完成本轮后，使用输出的停止命令关闭体验容器，再进入下一步。

## 第 7 步：推送已验证镜像

**执行位置：**部署机终端。第 5 步已登录候选仓库；凭据过期时重新执行 `docker login "$POLICY_REGISTRY"`，然后推送本次已验证镜像：

```sh
docker tag "$POLICY_IMAGE_ID" "$POLICY_IMAGE_TAG" &&
docker push "$POLICY_IMAGE_TAG"
```

**预期结果：**推送结束显示 `digest: sha256:...`。推送失败时先处理账号、该仓库路径的推送权限或网络问题。

从 Docker 镜像元数据中读取仓库摘要，生成固定镜像地址：

```sh
docker image inspect "$POLICY_IMAGE_TAG" > "$POLICY_REPORT_DIR/registry-image.json" &&
POLICY_IMAGE_DIGEST="$(node -e "const fs=require('node:fs'); const images=JSON.parse(fs.readFileSync(process.env.POLICY_REPORT_DIR+'/registry-image.json','utf8')); const digest=images[0].RepoDigests.find(x=>x.startsWith(process.env.POLICY_IMAGE_REPO+'@sha256:')); if(!digest)throw new Error('没有找到推送后的仓库摘要'); process.stdout.write(digest);")" &&
export POLICY_IMAGE_DIGEST &&
printf 'OpenShift 将使用：%s\n' "$POLICY_IMAGE_DIGEST"
```

**预期结果：**输出完整的 `仓库主机/项目/policy-compare@sha256:...` 地址，后续 OpenShift 配置使用该地址。

## 第 8 步：生成 OpenShift 部署文件

将平台配置、发布版本和镜像地址写入发布参数文件，并核对原候选检查记录：

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('tmp/openshift/platform.json', 'utf8'));
const verified = JSON.parse(fs.readFileSync(process.env.POLICY_REPORT_DIR + '/container.json', 'utf8'));
if (verified.status !== 'PASS') throw new Error('原候选镜像自动检查未通过');
if (verified.releaseId !== process.env.POLICY_RELEASE_ID || verified.platform !== 'linux/' + c.architecture) throw new Error('发布版本或目标架构与已验镜像不一致');
if (!process.env.POLICY_IMAGE_DIGEST?.startsWith(c.imageRepository + '@sha256:')) throw new Error('固定镜像地址与已配置仓库路径不一致，跨仓库推广须另行核验');
c.releaseId = process.env.POLICY_RELEASE_ID;
c.image = process.env.POLICY_IMAGE_DIGEST;
fs.writeFileSync(process.env.POLICY_REPORT_DIR + '/parameters.json', JSON.stringify(c, null, 2) + '\n');
NODE
```

参数文件生成成功后，生成部署清单：

```sh
pnpm exec tsx scripts/render-openshift.ts "$POLICY_REPORT_DIR/parameters.json" > "$POLICY_REPORT_DIR/candidate.json"
```

**预期结果：**没有报错，资料目录出现 `parameters.json` 和 `candidate.json`。部署清单包含四项配置：应用运行（Deployment）、集群内部访问（Service）、版本网址接入（Route）和网络访问控制（NetworkPolicy）。配置校验失败时，按错误字段修正参数后重新生成。`platformVersion` 和 `internalIngressController` 是环境与验收记录，不会作为集群版本控制或入口独占开关写入资源；`contact` 和 `baseImage` 已在镜像构建时使用，此步不会改写已有镜像。

## 第 9 步：部署应用

先执行服务端配置校验，再创建资源并等待应用就绪：

```sh
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" apply --dry-run=server -f "$POLICY_REPORT_DIR/candidate.json" &&
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" apply -f "$POLICY_REPORT_DIR/candidate.json" &&
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" rollout status "deployment/policy-$POLICY_RELEASE_ID" --timeout=180s &&
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" get pods -l "release=$POLICY_RELEASE_ID"
```

**预期结果：**出现 `successfully rolled out`，Pod 的 `READY` 为 `1/1`、`STATUS` 为 `Running`。

- `ImagePullBackOff`：集群无法拉取镜像，检查项目的镜像拉取凭据、仓库权限和网络。
- `Pending`：请管理员检查节点架构、配额和调度条件。
- `CrashLoopBackOff`：应用反复退出，按文末的日志命令检查。

容器运行状态检查完成后，继续执行网址访问与功能验证。

## 第 10 步：验证版本访问地址

先查看 OpenShift 是否接收了版本网址：

```sh
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" get route "policy-$POLICY_RELEASE_ID" -o jsonpath='{range .status.ingress[*]}{.routerName}{": "}{range .conditions[*]}{.type}{"="}{.status}{" "}{end}{"\n"}{end}'
printf '本次版本网址：https://%s/releases/%s/\n' "$POLICY_HOST" "$POLICY_RELEASE_ID"
```

**预期结果：**管理员指定的内部路由器显示 `Admitted=True`。若另一个入口也显示 `Admitted=True`，先请管理员确认暴露范围，暂不切换固定入口。

用浏览器打开输出的网址。**预期结果：**没有证书警告，显示保单比对页面，能看到样例按钮。遇到证书警告，请管理员处理信任配置。

执行目标网址的自动检查：

```sh
export POLICY_MANIFEST_SHA256="$(node -p "JSON.parse(require('node:fs').readFileSync(process.env.POLICY_REPORT_DIR + '/container.json', 'utf8')).manifestSha256")"
POLICY_BASE_URL="https://$POLICY_HOST/releases/$POLICY_RELEASE_ID/" \
POLICY_ENGINE=mupdf \
POLICY_BROWSER_CHANNEL=bundled \
POLICY_REPORT_DIR="$POLICY_REPORT_DIR/route-check" \
pnpm verify:deployment
```

**预期结果：**命令正常退出，`route-check/verification.json` 中 `status` 为 `PASS`。预期资源摘要取自第 6 步已验证的镜像，用于核对目标网站提供的发布产物。

这套检查允许四项已登记的严格要求保留“未评价”；独立临时服务器的 F7 用例会跳过。这些状态不代表扫描文字、所有复杂表格或业务来源全部验收通过，具体边界见[验收记录](../reports/issue-17/README.md)。

## 第 11 步：执行手工功能检查

**执行位置：**第 10 步验证的版本网址。

先展开“使用说明与版本信息”，核对发布版本、引擎及实际维护渠道与本次候选一致，再执行下面的功能检查。只修改配置文件不会改变已构建网页中的联系信息。

| 操作 | 预期结果 |
|---|---|
| `P02 金额变化` | 自动比较，1315 的 `USD 100 → USD 2000` 可见，点击变化能回到原文；1760 的 `USD 1000` 未改。再搜索 `1315`，尝试导出 JSON。 |
| `P01 相同文件` | 完成比较，没有内容变化卡。 |
| `E03 扫描图片` | 提示图片文字尚未比较；不能把零张文字卡理解为没有变化。 |

点击“关闭任务”，再载入一组授权文档，检查密码、方向、取消和原文定位，并按试用范围核对结果。

**预期结果：**上述操作符合预期；如果结果不对，保留版本网址和操作记录交给维护者，暂不开放固定入口。

## 第 12 步：开放固定网址

切换固定入口前，保存现有入口配置作为回滚依据：

```sh
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" get route policy-entry --ignore-not-found -o json > "$POLICY_REPORT_DIR/entry-before-raw.json" &&
node --input-type=module <<'NODE'
import fs from 'node:fs';
const dir = process.env.POLICY_REPORT_DIR;
const text = fs.readFileSync(dir + '/entry-before-raw.json', 'utf8').trim();
if (!text) {
  console.log('这是首次部署，没有旧入口可回滚。');
} else {
  const old = JSON.parse(text);
  if (old.spec.host !== process.env.POLICY_HOST) throw new Error('已有固定入口属于不同域名，请管理员检查后再操作');
  const {name, namespace, labels, annotations} = old.metadata;
  fs.writeFileSync(dir + '/entry-before.json', JSON.stringify({apiVersion:old.apiVersion, kind:old.kind, metadata:{name, namespace, labels, annotations}, spec:old.spec}, null, 2) + '\n');
  console.log('旧入口已保存为 entry-before.json。');
}
NODE
```

**预期结果：**显示“旧入口已保存”或“这是首次部署”。备份失败时，中止入口切换并处理错误。

再生成并切换固定入口：

```sh
pnpm exec tsx scripts/render-openshift.ts "$POLICY_REPORT_DIR/parameters.json" --entry > "$POLICY_REPORT_DIR/entry.json" &&
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" apply -f "$POLICY_REPORT_DIR/entry.json" &&
printf '使用者访问这个固定网址：https://%s/\n' "$POLICY_HOST"
```

**预期结果：**新开浏览器窗口访问输出的网址，会进入本次版本路径；“使用说明与版本信息”中的版本与第 6 步相同，重新执行 P02 功能检查。

将固定网址提供给授权试用人员。使用者通过浏览器访问，无需安装部署工具。**首次部署流程完成。**

## 版本更新与正式环境推广

1. 在仓库根目录同步 `main`；先处理已有未提交改动，再执行第 3 步的更新命令。
2. 重新执行第 2 步及第 2.1–2.5 步，确认目标并设置当前终端变量；再执行第 4–11 步。每次用新版本号，旧版本保留。重新打开终端后也先恢复这些变量，不能继承另一个集群或旧配置的选择结果。
3. 切入口前，在浏览器保留一个旧版任务；完成第 12 步后，确认旧标签页仍可定位/搜索/开始新任务，新窗口进入新版。
4. 默认保留被替换版本及其镜像、配置和验收记录至少 7 天；回收前由维护者确认回滚目标与通知窗口。保留期内保持旧 Deployment、Service、版本路径 Route 和镜像可用。

推广到另一个正式项目由平台维护者执行，需先确认前面的真实 OpenShift 检查通过，且正式集群能够拉取同一已验镜像。保留原版本号和 `POLICY_IMAGE_DIGEST`，候选仓库地址及路径不变；正式工作节点架构必须与原候选记录一致。将正式环境配置替换到 `tmp/openshift/platform.json`，重新执行第 2 步及第 2.1–2.5 步、再执行第 4 步，确认正式集群、项目、架构、域名、内部入口、网络规则与拉取权限。镜像内的维护渠道和基础镜像不会因参数文件改变而更新。

随后给正式环境建立独立的资料目录，并带上原镜像的校验记录：

```sh
export POLICY_VERIFIED_REPORT_DIR="$POLICY_REPORT_DIR"
export POLICY_REPORT_DIR="$POLICY_VERIFIED_REPORT_DIR/production"
mkdir -p "$POLICY_REPORT_DIR" &&
cp "$POLICY_VERIFIED_REPORT_DIR/container.json" "$POLICY_REPORT_DIR/container.json"
```

然后执行第 8–12 步，复核正式网址与入口。这里不执行第 6、7 步，不重新构建；如果公司要求换仓库或重建，维护者需另行核验实际镜像，不能只凭代码提交相同放行。

## 回滚固定入口

**执行位置：**部署机终端，仓库根目录。将 `POLICY_REPORT_DIR` 设置为待回滚发布的资料目录，检查旧入口备份后执行恢复：

```sh
test -s "$POLICY_REPORT_DIR/entry-before.json" && echo '已找到旧入口备份' &&
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" apply -f "$POLICY_REPORT_DIR/entry-before.json"
```

**预期结果：**新开窗口访问固定网址，进入旧版本；查看版本信息，并重新比较 P02。严重问题版本停止新访问的处理由平台维护者执行，先保留故障证据。

首次部署无旧入口时不适用该回滚操作。入口回滚要求旧版本 Deployment、Service、版本路径 Route 和镜像保持可用。

## 故障排查

记录第 6 步输出的发布资料目录，查询 Pod 状态、应用日志和部署事件：

```sh
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" get pods -l "release=$POLICY_RELEASE_ID"
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" logs "deployment/policy-$POLICY_RELEASE_ID" --tail=100
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" describe "deployment/policy-$POLICY_RELEASE_ID"
```

| 现象 | 排查项与责任方 |
|---|---|
| 命令找不到、Node/pnpm 版本不符 | 部署机维护者安装第 0 步的工具。 |
| 提示 `Forbidden` | OpenShift 管理员授权当前账号操作这个项目。 |
| 基础镜像安装依赖时提示权限或目录错误 | 构建维护者核对基础镜像与 Dockerfile 的用户/目录兼容性，按实际镜像修正后重新构建验证。 |
| 推送失败或 `ImagePullBackOff` | 仓库/平台管理员分别检查推送权限、集群拉取凭据和网络。 |
| 容器 Running，网址却 503/超时 | 平台管理员检查网址是否被内部入口接收、Service 和网络来源选择器。 |
| 证书警告、页面提示网站安全配置不完整 | 平台管理员检查证书信任、实际 HTTPS 入口和响应头。修复证书链与终端信任后复测。 |
| 网页能打开，但金额、高亮或记录归属不对 | 应用维护者按原文核查。保存版本、页码和获准分享的诊断/结果；平台健康不证明比较正确。 |
| 打包提示候选或报告目录已存在 | 从第 6 步生成新版本号；旧证据保留。 |
| 终端关闭，变量丢失 | 从第 2、4 步重新登录和读取配置。已有发布的版本号与资料目录按原记录恢复，回滚使用对应发布的旧入口备份。 |

## 发布验收范围

正式开放前，平台维护者核对：内部入口的可达范围、证书与组织认证、镜像摘要、实际节点架构、平台分配用户、只读文件系统、资源限制、网络规则和重新调度；再由指定办公终端和使用者完成试用。验收结论应以实际环境记录为依据。

PDF 在使用者浏览器内处理，服务器提供网页资源；目前仍有复杂表格与部分来源位置的已知问题。页面处理结束不代表业务正确，扫描图片文字没有被识别。现有证据和未完成项保留在[分层验收记录](../reports/issue-17/README.md)。

供维护者核对平台行为的官方资料：[OpenShift 登录命令](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html/cli_tools/openshift-cli-oc)、[OpenShift 路由配置](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html-single/ingress_and_load_balancing/index)、[Docker 镜像推送](https://docs.docker.com/reference/cli/docker/image/push/)。界面名称及平台限制以实际集群版本为准。
