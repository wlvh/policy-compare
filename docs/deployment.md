# OpenShift 部署操作指南

目标：将保单比对工具部署到 OpenShift，通过内网 HTTPS 地址提供浏览器访问。

本指南适用于首次部署、版本更新和入口回滚。首次部署使用平台分配的测试/试用项目，正式环境推广使用已验证的同架构镜像。**源码统一从 `main` 获取，相关 PR 合入主干后执行。**

操作顺序：**登录集群 → 下载主干代码 → 读取平台配置 → 打包并自动检查 → 同镜像人工试用 → 推送镜像 → 部署 → 检查网址 → 开放固定入口。**

暂无集群时，可先执行[候选发布镜像测试流程](release-image-testing.md)，在 Docker 中试用同一候选镜像；无需 Red Hat 账号。该阶段的结果单独记录。

## 第 0 步：确认部署前置条件

部署前需落实以下平台配置与权限，由平台管理员提供或确认。

1. 确认 OpenShift 控制台地址、登录账号及本工具专用的测试项目。已有项目使用实际项目名称；需要新建时，在第 2.1 步创建，并确认账号具有项目内的部署权限。
2. 为本工具分配独立内网域名，并配置 DNS、受信任的 HTTPS 证书和内部访问入口。
3. 提供镜像仓库与推送凭据，并为目标项目的默认服务账号配置镜像拉取权限。部署机的 Docker 登录状态与集群的镜像拉取凭据分别配置。
4. 根据 [平台配置示例](../deploy/openshift/operator-settings.example.json) 生成 `platform.json`，替换全部 `REPLACE_...` 占位值。该文件仅保存环境参数，不保存密码或访问令牌。
5. 确认部署机可访问集群、镜像仓库、GitHub、构建所需的 npm 包和基础镜像；构建环境禁止直接访问外网时，预先准备内部制品来源。

**部署机**指执行本指南命令的工作站或服务器。本文命令适用于 macOS/Linux 的 Bash 终端；Windows 环境使用已配置的 WSL/Linux 部署机。部署机需安装 Git、Docker、Node.js 24、pnpm 10.12.1 和 OpenShift 命令行工具 `oc`。浏览器自动检查组件在第 5 步安装。

平台配置字段如下，后续命令从 `platform.json` 读取。

| 配置项 | 配置要求 |
|---|---|
| `namespace` | 已创建、且当前账号具有部署权限的 OpenShift 项目实际名称，例如 `policy-compare-test`。使用已有项目时填写分配的名称；使用新名称时须先完成第 2.1 步创建。不得填写项目的中文展示名称。 |
| `architecture` | 实际承载应用的 OpenShift 工作节点 CPU 架构，按第 2.2 步查询并确认后填写 `amd64` 或 `arm64`。镜像必须与该架构一致；不得根据访问网页的电脑或当前 Mac 的架构填写。 |
| `host` | 平台批准分配给本工具的完整内网域名，按第 2.3 步确认 DNS、内部入口和证书后填写，例如 `policy-compare.apps.internal.example.com`。不包含 `https://`、端口或路径，不填写 IP、`localhost` 或 OpenShift 控制台地址。 |
| `replicas` | 首次试用保留 `1`。 |
| `routeLabels` | 平台内部入口用于选择本应用网址的实际标签。 |
| `ingressPeers` | 允许内部入口访问容器的来源选择器，按实际集群网络配置填写。 |
| `platformVersion` | 实际 OpenShift 版本。 |
| `internalIngressController` | 应当接收本应用网址的内部路由器名称。 |
| `contact` | 应用维护联系人或反馈渠道。 |
| `registryServer` | 镜像仓库主机名，必要时包含端口；不带 `https://` 或项目路径。 |
| `imageRepository` | 镜像完整仓库路径，例如 `registry.example.internal/team/policy-compare`；不带版本标签。 |
| `baseImage` | 组织批准、且与项目 Dockerfile 兼容的 Node.js 24 基础镜像，必须带 `@sha256:...` 内容标识。 |

OpenShift 项目是放置本工具运行实例、内部服务和访问入口等资源的工作区，其实际名称对应 `namespace`（命名空间）。该名称与 GitHub 仓库名称没有绑定关系；填写 `platform.json` 或运行本项目的部署脚本都不会自动创建项目。

若组织批准使用项目当前的公共基础镜像，`baseImage` 可填以下完整值；否则由管理员提供内部镜像的实际地址和摘要：

```text
node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
```

**完成条件：**登录账号、已填充的 `platform.json`、镜像推送凭据及部署机工具均已就绪。

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
```

将已填充的 `platform.json` 保存至仓库的 `tmp/openshift/` 目录。最终路径为 `policy-compare/tmp/openshift/platform.json`，该目录已被 Git 忽略。

执行配置完整性检查：

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { isIP } from 'node:net';
const c = JSON.parse(fs.readFileSync('tmp/openshift/platform.json', 'utf8'));
const required = ['namespace', 'architecture', 'host', 'routeLabels', 'ingressPeers', 'platformVersion', 'internalIngressController', 'contact', 'registryServer', 'imageRepository', 'baseImage'];
for (const name of required) {
  const v = c[name];
  if (!v || (typeof v === 'object' && !Object.keys(v).length)) throw new Error(`缺少必填配置：${name}`);
}
if (/REPLACE_|待填/.test(JSON.stringify(c))) throw new Error('配置包含未替换的占位值');
if (c.namespace !== process.env.POLICY_NAMESPACE) throw new Error('namespace 与第 2.1 步选定的 POLICY_NAMESPACE 不一致，请确认项目名称');
if (!['amd64', 'arm64'].includes(c.architecture)) throw new Error('architecture 必须是 amd64 或 arm64');
if (c.architecture !== process.env.POLICY_ARCH) throw new Error('architecture 与第 2.2 步确认的 POLICY_ARCH 不一致，请确认目标节点架构');
if (typeof c.host !== 'string' || c.host.length > 253 || !c.host.includes('.') || isIP(c.host) ||
    c.host.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
  throw new Error('host 必须是完整域名，不填写协议、端口、路径、IP 或 localhost');
}
if (c.host !== process.env.POLICY_HOST) throw new Error('host 与第 2.3 步确认的 POLICY_HOST 不一致，请确认访问域名');
if (!/@sha256:[a-f0-9]{64}$/.test(c.baseImage)) throw new Error('baseImage 必须带实际 SHA-256 摘要');
if (!c.imageRepository.startsWith(c.registryServer + '/')) throw new Error('imageRepository 必须位于 registryServer 下');
console.log('配置完整性校验通过；入口标签与网络来源以平台审核结果为准。');
NODE
```

将配置加载为当前终端的环境变量，并选择目标项目：

```sh
export POLICY_NAMESPACE="$(node -p "require('./tmp/openshift/platform.json').namespace")"
export POLICY_ARCH="$(node -p "require('./tmp/openshift/platform.json').architecture")"
export POLICY_HOST="$(node -p "require('./tmp/openshift/platform.json').host")"
export POLICY_REGISTRY="$(node -p "require('./tmp/openshift/platform.json').registryServer")"
export POLICY_IMAGE_REPO="$(node -p "require('./tmp/openshift/platform.json').imageRepository")"
export POLICY_CONTACT="$(node -p "require('./tmp/openshift/platform.json').contact")"
export POLICY_NODE_IMAGE="$(node -p "require('./tmp/openshift/platform.json').baseImage")"
oc --context "$POLICY_CONTEXT" project "$POLICY_NAMESPACE"
```

**预期结果：**配置检查通过，最后一条命令显示第 2.1 步确认的目标项目。项目不存在时返回第 2.1 步完成创建；权限不足时申请该项目所需权限，处理后再继续。

## 第 5 步：安装打包和自动检查需要的依赖

**执行位置：**部署机终端，仓库根目录。

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

### 第 6.1 步：人工试用同一候选镜像

```sh
pnpm preview:release "$POLICY_REPORT_DIR/container.json" 8088
```

**预期结果：**终端显示体验地址、记录目录和 `READY_FOR_MANUAL_REVIEW`。命令复用第 6 步记录的镜像编号，不重新构建；启动后容器继续运行。端口占用时可改用其他空闲端口。

在浏览器打开输出地址，按[检查清单及结果记录步骤](release-image-testing.md#第-3-步在浏览器逐项检查)执行 P02/P01/E03、来源、搜索、导出、方向交换、取消重开及关闭任务。填写生成的 `manual-review.json`，保留版本及镜像标识。人工项初始均为未评价，启动成功不计为人工验收通过。发现失败先修复并创建新候选；未评价项按项目放行要求处理。完成本轮后，使用输出的停止命令关闭体验容器，再进入下一步。

## 第 7 步：推送已验证镜像

**执行位置：**部署机终端。使用镜像仓库账号及密码/访问令牌完成登录：

```sh
docker login "$POLICY_REGISTRY" &&
docker tag "$POLICY_IMAGE_ID" "$POLICY_IMAGE_TAG" &&
docker push "$POLICY_IMAGE_TAG"
```

**预期结果：**登录提示 `Login Succeeded`；推送结束显示 `digest: sha256:...`。推送失败时先处理账号、权限或网络问题。

从 Docker 镜像元数据中读取仓库摘要，生成固定镜像地址：

```sh
docker image inspect "$POLICY_IMAGE_TAG" > "$POLICY_REPORT_DIR/registry-image.json" &&
POLICY_IMAGE_DIGEST="$(node -e "const fs=require('node:fs'); const images=JSON.parse(fs.readFileSync(process.env.POLICY_REPORT_DIR+'/registry-image.json','utf8')); const digest=images[0].RepoDigests.find(x=>x.startsWith(process.env.POLICY_IMAGE_REPO+'@sha256:')); if(!digest)throw new Error('没有找到推送后的仓库摘要'); process.stdout.write(digest);")" &&
export POLICY_IMAGE_DIGEST &&
printf 'OpenShift 将使用：%s\n' "$POLICY_IMAGE_DIGEST"
```

**预期结果：**输出完整的 `仓库主机/项目/policy-compare@sha256:...` 地址，后续 OpenShift 配置使用该地址。

## 第 8 步：生成 OpenShift 部署文件

将平台配置、发布版本和镜像地址写入发布参数文件：

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('tmp/openshift/platform.json', 'utf8'));
c.releaseId = process.env.POLICY_RELEASE_ID;
c.image = process.env.POLICY_IMAGE_DIGEST;
fs.writeFileSync(process.env.POLICY_REPORT_DIR + '/parameters.json', JSON.stringify(c, null, 2) + '\n');
NODE
```

参数文件生成成功后，生成部署清单：

```sh
pnpm exec tsx scripts/render-openshift.ts "$POLICY_REPORT_DIR/parameters.json" > "$POLICY_REPORT_DIR/candidate.json"
```

**预期结果：**没有报错，资料目录出现 `parameters.json` 和 `candidate.json`。部署清单包含四项配置：应用运行（Deployment）、集群内部访问（Service）、版本网址接入（Route）和网络访问控制（NetworkPolicy）。配置校验失败时，按错误字段修正参数后重新生成。

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
2. 从第 4 步开始，重新读取配置、生成新版本并完成第 6–11 步。每次用新版本号，旧版本保留。
3. 切入口前，在浏览器保留一个旧版任务；完成第 12 步后，确认旧标签页仍可定位/搜索/开始新任务，新窗口进入新版。
4. 默认保留被替换版本及其镜像、配置和验收记录至少 7 天；回收前由维护者确认回滚目标与通知窗口。保留期内保持旧 Deployment、Service、版本路径 Route 和镜像可用。

推广到另一个正式项目由平台维护者执行，需先确认前面的真实 OpenShift 检查通过，且正式集群能够拉取同一已验镜像。保留原版本号和 `POLICY_IMAGE_DIGEST`；把正式环境配置替换到 `tmp/openshift/platform.json`，重新执行第 2、4 步，确认登录的是正式集群和正式项目。

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
