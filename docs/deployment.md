# 在 OpenShift 部署保单比对工具：一步一步操作

目标：把这个仓库部署成一个内网 HTTPS 网站。完成后，使用者打开网址、选择两份 PDF 就能使用。

本指南只写部署操作。首次请使用平台管理员给你的测试/试用项目；测试通过后，正式环境继续使用同一份已验证镜像。**下面的源码一律从 `main` 获取，相关 PR 合入主干后再执行。**

你会按顺序完成：**登录集群 → 下载主干代码 → 读取平台配置 → 打包并检查 → 推送镜像 → 部署 → 检查网址 → 开放固定入口。**

## 第 0 步：让平台管理员先准备好这些东西

这一步需要公司的 OpenShift 管理员配合，不需要你猜集群参数。可以把本节直接发给他。

1. 给你一个 OpenShift 控制台网址和登录账号，以及一个本工具专用的测试项目。
2. 提供一个本工具专用的内网域名，并配置好 DNS、受信任的 HTTPS 证书和内部访问入口。
3. 提供可推送镜像的仓库及账号，并让上述 OpenShift 项目的默认服务账号有权拉取这个仓库的镜像。**你在部署机上登录 Docker，不会自动给集群配置拉取权限。**
4. 填好 [平台配置示例](../deploy/openshift/operator-settings.example.json)，交给你一个名为 `platform.json` 的文件。所有 `REPLACE_...` 都必须替换，里面不要放密码或令牌。
5. 确认下面这台“部署机”能访问集群、镜像仓库、GitHub、构建所需的 npm 包和基础镜像；若公司禁止直接访问外网，由管理员先准备对应的内部制品来源。

**部署机**就是你接下来打开终端执行命令的电脑或服务器。本文使用 macOS/Linux 的 Bash 终端；Windows 使用已准备好的 WSL/Linux 部署机。管理员在部署机上安装：Git、Docker、Node.js 24、pnpm 10.12.1、OpenShift 命令行工具 `oc`。浏览器自动检查所需组件会在第 5 步安装。

管理员填写配置时参考下表；你收到文件后，后续命令会自动读取这些值。

| 配置项 | 管理员填写什么 |
|---|---|
| `namespace` | 测试项目的真实名称。 |
| `architecture` | 应用节点架构：`amd64` 或 `arm64`。部署机也需能实际运行该架构镜像；本机模拟不能代替目标架构验收。 |
| `host` | 给本工具使用的内网域名，只填主机名，不带 `https://`、端口或路径。 |
| `replicas` | 首次试用保留 `1`。 |
| `routeLabels` | 平台内部入口用于选择本应用网址的实际标签。 |
| `ingressPeers` | 允许内部入口访问容器的实际来源选择器；按集群网络配置填写，示例结构不能照搬。 |
| `platformVersion` | 实际 OpenShift 版本。 |
| `internalIngressController` | 应当接收本应用网址的内部路由器名称。 |
| `contact` | 使用者遇到问题时联系谁。 |
| `registryServer` | 镜像仓库主机名，必要时包含端口；不带 `https://` 或项目路径。 |
| `imageRepository` | 镜像完整仓库路径，例如 `registry.example.internal/team/policy-compare`；不带版本标签。 |
| `baseImage` | 组织批准、且与项目 Dockerfile 兼容的 Node.js 24 基础镜像，必须带 `@sha256:...` 内容标识。 |

若组织批准使用项目当前的公共基础镜像，`baseImage` 可填以下完整值；否则由管理员提供内部镜像的实际地址和摘要：

```text
node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
```

**这一步完成标志：**你有登录账号、填好的 `platform.json`、镜像推送账号，以及已安装工具的部署机。尚未取得这些条件时，先请管理员补齐；后面的命令不能自动推断它们。

## 第 1 步：检查部署机的工具

**在哪里操作：**部署机的 Bash 终端。后续步骤使用同一个终端；每个代码框逐行执行，任一命令报错就停在该步。

```sh
git --version
docker info
node --version
pnpm --version
oc version --client
```

**成功标志：**五条命令均成功；Node 显示 `v24.x.x`，pnpm 显示 `10.12.1`，`docker info` 能显示 Server 信息。若 Docker 提示无法连接，先启动 Docker 服务。

## 第 2 步：登录 OpenShift

**在哪里操作：**先用浏览器登录管理员提供的 OpenShift 控制台。

点击右上角用户名菜单 → **Copy login command（复制登录命令）**，按页面提示取得登录命令。回到部署机终端，执行该命令；它已经包含你的集群地址和登录信息。不要把这条带令牌的命令贴进仓库或反馈截图。

然后执行：

```sh
oc whoami
oc whoami --show-server
export POLICY_CONTEXT="$(oc config current-context)"
```

**成功标志：**第一条显示你的账号，第二条显示管理员给你的集群地址。地址不对时重新登录正确集群，再继续。

## 第 3 步：下载主干代码

**在哪里操作：**部署机终端。先进入你用于保存项目的目录；首次下载执行：

```sh
git clone --branch main --single-branch https://github.com/wlvh/policy-compare.git &&
cd policy-compare
```

已有这个仓库时，改为进入仓库根目录，处理好自己的未提交改动后执行：

```sh
git switch main &&
git pull --ff-only origin main
```

下面所有命令都在这个 `policy-compare` 目录执行：

```sh
git branch --show-current
test -f deploy/Dockerfile && test -f scripts/render-openshift.ts && echo '部署文件已找到'
```

**成功标志：**分支显示 `main`，并显示“部署文件已找到”。如果主干缺少部署文件，先确认相关 PR 已合入 `main`。

## 第 4 步：放入管理员填好的配置

创建一个保存本次部署资料的目录：

```sh
mkdir -p tmp/openshift
```

用文件管理器把管理员给你的 **`platform.json`** 放到仓库中的 **`tmp/openshift/`**，文件的最终位置应为 `policy-compare/tmp/openshift/platform.json`。这个目录已被 Git 忽略。

复制执行以下检查，它会找出漏填的值：

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('tmp/openshift/platform.json', 'utf8'));
const required = ['namespace', 'architecture', 'host', 'routeLabels', 'ingressPeers', 'platformVersion', 'internalIngressController', 'contact', 'registryServer', 'imageRepository', 'baseImage'];
for (const name of required) {
  const v = c[name];
  if (!v || (typeof v === 'object' && !Object.keys(v).length)) throw new Error(`请管理员填写 ${name}`);
}
if (/REPLACE_|待填/.test(JSON.stringify(c))) throw new Error('配置里还有未替换的占位值');
if (!['amd64', 'arm64'].includes(c.architecture)) throw new Error('architecture 必须是 amd64 或 arm64');
if (!/@sha256:[a-f0-9]{64}$/.test(c.baseImage)) throw new Error('baseImage 必须带实际 SHA-256 摘要');
if (!c.imageRepository.startsWith(c.registryServer + '/')) throw new Error('imageRepository 必须位于 registryServer 下');
console.log('配置已填齐；真实入口标签和网络来源仍以管理员确认为准。');
NODE
```

再复制这一整段，把配置读入当前终端；不用手工修改其中的变量名：

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

**成功标志：**配置检查通过；最后一条命令显示正在使用管理员给你的项目。若提示没有权限，请管理员授权，不要换成别人的项目试运行。

## 第 5 步：安装打包和自动检查需要的依赖

**在哪里操作：**仍在部署机、仓库根目录。这里安装的是发布工具，没有启动本地开发服务。

```sh
pnpm install --frozen-lockfile &&
pnpm install:mupdf &&
pnpm exec playwright install --with-deps chromium
```

**成功标志：**三条命令均成功退出。Linux 安装浏览器依赖可能要求管理员权限。若下载失败，请管理员检查构建网络或提供内部制品，不要跳过失败继续部署。

本指南固定使用 MuPDF；组织需要换引擎时，由维护者明确修改并重新验证。本次打包和部署不等于实际组织使用条件已核实。

## 第 6 步：打包并自动检查候选镜像

镜像是包含网页和静态服务器的运行包。这一步会构建它，启动临时容器，自动操作浏览器检查，最后停止该临时容器。

先生成本次版本号并记录主干提交：

```sh
export POLICY_REVISION="$(git rev-parse HEAD)"
export POLICY_RELEASE_ID="r$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short=7 HEAD)"
export POLICY_PLATFORM="linux/$POLICY_ARCH"
export POLICY_REPORT_DIR="$PWD/tmp/openshift/$POLICY_RELEASE_ID"
export POLICY_IMAGE_TAG="$POLICY_IMAGE_REPO:$POLICY_RELEASE_ID"
printf '本次版本：%s\n主干提交：%s\n资料目录：%s\n' "$POLICY_RELEASE_ID" "$POLICY_REVISION" "$POLICY_REPORT_DIR"
```

然后执行自动打包检查，等待它结束：

```sh
POLICY_BROWSER_CHANNEL=bundled pnpm test:container mupdf
```

**成功标志：**命令正常退出，末尾 JSON 中 `status` 是 `PASS`。它验证的是临时容器，下一步才会把同一个镜像交给 OpenShift。

读取已验证镜像的编号：

```sh
POLICY_IMAGE_ID="$(node -p "JSON.parse(require('node:fs').readFileSync(process.env.POLICY_REPORT_DIR + '/container.json', 'utf8')).imageId")" &&
export POLICY_IMAGE_ID &&
printf '已验证镜像：%s\n' "$POLICY_IMAGE_ID"
```

**成功标志：**输出一个以 `sha256:` 开头的编号。若检查失败，看本次资料目录中的 `failure.log`；不要把失败改成 PASS。需要重新打包时，从本步重新生成新版本号，保留旧记录。

## 第 7 步：把已验证镜像推送到公司仓库

**在哪里操作：**部署机终端。按提示输入管理员给你的仓库账号和密码/访问令牌：

```sh
docker login "$POLICY_REGISTRY" &&
docker tag "$POLICY_IMAGE_ID" "$POLICY_IMAGE_TAG" &&
docker push "$POLICY_IMAGE_TAG"
```

**成功标志：**登录提示 `Login Succeeded`；推送结束显示 `digest: sha256:...`。推送失败时先处理账号、权限或网络问题。

复制以下命令，自动取得这个仓库中镜像的固定地址。不要自己抄写那串摘要：

```sh
docker image inspect "$POLICY_IMAGE_TAG" > "$POLICY_REPORT_DIR/registry-image.json" &&
POLICY_IMAGE_DIGEST="$(node -e "const fs=require('node:fs'); const images=JSON.parse(fs.readFileSync(process.env.POLICY_REPORT_DIR+'/registry-image.json','utf8')); const digest=images[0].RepoDigests.find(x=>x.startsWith(process.env.POLICY_IMAGE_REPO+'@sha256:')); if(!digest)throw new Error('没有找到推送后的仓库摘要'); process.stdout.write(digest);")" &&
export POLICY_IMAGE_DIGEST &&
printf 'OpenShift 将使用：%s\n' "$POLICY_IMAGE_DIGEST"
```

**成功标志：**输出 `你的内部仓库/路径/policy-compare@sha256:...`。这才是交给 OpenShift 的镜像地址。

## 第 8 步：生成 OpenShift 部署文件

以下命令自动把平台配置、本次版本和镜像地址组合起来：

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('tmp/openshift/platform.json', 'utf8'));
c.releaseId = process.env.POLICY_RELEASE_ID;
c.image = process.env.POLICY_IMAGE_DIGEST;
fs.writeFileSync(process.env.POLICY_REPORT_DIR + '/parameters.json', JSON.stringify(c, null, 2) + '\n');
NODE
```

没有报错后，再生成部署清单：

```sh
pnpm exec tsx scripts/render-openshift.ts "$POLICY_REPORT_DIR/parameters.json" > "$POLICY_REPORT_DIR/candidate.json"
```

**成功标志：**没有报错，资料目录出现 `parameters.json` 和 `candidate.json`。后者包含启动应用、集群内部访问、版本网址和网络规则四项配置。配置未填齐时生成器会报错，按错误字段请管理员修正。

## 第 9 步：让 OpenShift 启动应用

先只让集群检查配置，再实际创建应用：

```sh
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" apply --dry-run=server -f "$POLICY_REPORT_DIR/candidate.json" &&
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" apply -f "$POLICY_REPORT_DIR/candidate.json" &&
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" rollout status "deployment/policy-$POLICY_RELEASE_ID" --timeout=180s &&
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" get pods -l "release=$POLICY_RELEASE_ID"
```

**成功标志：**出现 `successfully rolled out`，应用行的 `READY` 为 `1/1`、`STATUS` 为 `Running`。

- `ImagePullBackOff`：集群拉不到镜像，检查集群的仓库凭据和网络；部署机的 `docker login` 不负责这件事。
- `Pending`：请管理员检查节点架构、配额和调度条件。
- `CrashLoopBackOff`：应用反复退出，按文末的日志命令检查。

**看到 Running 只说明容器启动了；继续检查真实网址。**

## 第 10 步：检查版本网址，再运行浏览器检查

先查看 OpenShift 是否接收了版本网址：

```sh
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" get route "policy-$POLICY_RELEASE_ID" -o jsonpath='{range .status.ingress[*]}{.routerName}{": "}{range .conditions[*]}{.type}{"="}{.status}{" "}{end}{"\n"}{end}'
printf '本次版本网址：https://%s/releases/%s/\n' "$POLICY_HOST" "$POLICY_RELEASE_ID"
```

**成功标志：**管理员指定的内部路由器显示 `Admitted=True`。若另一个入口也显示 `Admitted=True`，先请管理员确认暴露范围，暂不切换固定入口。

用浏览器打开输出的网址。**成功标志：**没有证书警告，显示保单比对页面，能看到样例按钮。遇到证书警告，请管理员处理信任配置。

然后复制执行真实网址的自动检查：

```sh
export POLICY_MANIFEST_SHA256="$(node -p "JSON.parse(require('node:fs').readFileSync(process.env.POLICY_REPORT_DIR + '/container.json', 'utf8')).manifestSha256")"
POLICY_BASE_URL="https://$POLICY_HOST/releases/$POLICY_RELEASE_ID/" \
POLICY_ENGINE=mupdf \
POLICY_BROWSER_CHANNEL=bundled \
POLICY_REPORT_DIR="$POLICY_REPORT_DIR/route-check" \
pnpm verify:deployment
```

**成功标志：**命令正常退出，`route-check/verification.json` 中 `status` 为 `PASS`。校验用的资源标识来自第 6 步已验证的镜像，不从未知网站现取一个值凑通过。

这套检查允许四项已登记的严格要求保留“未评价”；独立临时服务器的 F7 用例会跳过。这些状态不代表扫描文字、所有复杂表格或业务来源全部验收通过，具体边界见[验收记录](../reports/issue-17/README.md)。

## 第 11 步：手工试用三个按钮

**在哪里操作：**刚才打开的版本网址。

| 你点击什么 | 应当看到什么 |
|---|---|
| `P02 金额变化` | 自动比较，1315 的 `USD 100 → USD 2000` 可见，点击变化能回到原文；1760 的 `USD 1000` 未改。再搜索 `1315`，尝试导出 JSON。 |
| `P01 相同文件` | 完成比较，没有内容变化卡。 |
| `E03 扫描图片` | 提示图片文字尚未比较；不能把零张文字卡理解为没有变化。 |

最后点“关闭任务”，再载入一组你有权使用的文档，检查密码、方向、取消和原文定位。先按试用范围人工核对结果。

**成功标志：**上述操作符合预期；如果结果不对，保留版本网址和操作记录交给维护者，暂不开放固定入口。

## 第 12 步：开放固定网址

先备份已有固定入口，便于回滚。下面命令只保存入口配置：

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

**成功标志：**显示“旧入口已保存”或“这是首次部署”。如果报错，停在这里。

再生成并切换固定入口：

```sh
pnpm exec tsx scripts/render-openshift.ts "$POLICY_REPORT_DIR/parameters.json" --entry > "$POLICY_REPORT_DIR/entry.json" &&
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" apply -f "$POLICY_REPORT_DIR/entry.json" &&
printf '使用者访问这个固定网址：https://%s/\n' "$POLICY_HOST"
```

**成功标志：**新开浏览器窗口访问输出的网址，会进入本次版本路径；“使用说明与版本信息”中的版本与第 6 步相同，再试一次 P02。

把这个固定网址发给获准试用的人。他们只需要浏览器，无需安装上面的部署工具。**到这里，首次部署操作结束。**

## 以后更新：沿用同一套步骤

1. 在仓库根目录同步 `main`；先处理已有未提交改动，再执行第 3 步的更新命令。
2. 从第 4 步开始，重新读取配置、生成新版本并完成第 6–11 步。每次用新版本号，旧版本保留。
3. 切入口前，在浏览器保留一个旧版任务；完成第 12 步后，确认旧标签页仍可定位/搜索/开始新任务，新窗口进入新版。
4. 默认保留被替换版本及其镜像、配置和验收记录至少 7 天；回收前由维护者确认回滚目标与通知窗口。不要一更新就删除旧 Deployment、Service 或版本网址。

推广到另一个正式项目由平台维护者执行，需先确认前面的真实 OpenShift 检查通过，且正式集群能够拉取同一已验镜像。保留原版本号和 `POLICY_IMAGE_DIGEST`；把正式环境配置替换到 `tmp/openshift/platform.json`，重新执行第 2、4 步，确认登录的是正式集群和正式项目。

随后给正式环境建立独立的资料目录，并带上原镜像的校验记录：

```sh
export POLICY_VERIFIED_REPORT_DIR="$POLICY_REPORT_DIR"
export POLICY_REPORT_DIR="$POLICY_VERIFIED_REPORT_DIR/production"
mkdir -p "$POLICY_REPORT_DIR" &&
cp "$POLICY_VERIFIED_REPORT_DIR/container.json" "$POLICY_REPORT_DIR/container.json"
```

然后执行第 8–12 步，复核正式网址与入口。这里不执行第 6、7 步，不重新构建；如果公司要求换仓库或重建，维护者需另行核验实际镜像，不能只凭代码提交相同放行。

## 如果新版本出问题：切回旧入口

**在哪里操作：**部署机、仓库根目录。使用出问题这次发布的资料目录，先确认其中确实有旧入口：

```sh
test -s "$POLICY_REPORT_DIR/entry-before.json" && echo '已找到旧入口备份' &&
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" apply -f "$POLICY_REPORT_DIR/entry-before.json"
```

**成功标志：**新开窗口访问固定网址，进入旧版本；查看版本信息，并重新比较 P02。严重问题版本停止新访问的处理由平台维护者执行，先保留故障证据。

首次部署没有旧入口时，不执行这段回滚命令。回滚依赖旧版本的应用、服务和镜像仍然存在；不是只改一个版本号就能恢复。

## 遇到问题，先收集这三项

先记下第 6 步打印的资料目录，再执行：

```sh
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" get pods -l "release=$POLICY_RELEASE_ID"
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" logs "deployment/policy-$POLICY_RELEASE_ID" --tail=100
oc --context "$POLICY_CONTEXT" -n "$POLICY_NAMESPACE" describe "deployment/policy-$POLICY_RELEASE_ID"
```

| 现象 | 下一步找谁、检查什么 |
|---|---|
| 命令找不到、Node/pnpm 版本不符 | 部署机维护者安装第 0 步的工具。 |
| 提示 `Forbidden` | OpenShift 管理员授权当前账号操作这个项目。 |
| 基础镜像安装依赖时提示权限或目录错误 | 构建维护者核对基础镜像与 Dockerfile 的用户/目录兼容性，按实际镜像修正后重新构建验证。 |
| 推送失败或 `ImagePullBackOff` | 仓库/平台管理员分别检查推送权限、集群拉取凭据和网络。 |
| 容器 Running，网址却 503/超时 | 平台管理员检查网址是否被内部入口接收、Service 和网络来源选择器。 |
| 证书警告、页面提示网站安全配置不完整 | 平台管理员检查证书信任、实际 HTTPS 入口和响应头。不要通过忽略证书警告绕过。 |
| 网页能打开，但金额、高亮或记录归属不对 | 应用维护者按原文核查。保存版本、页码和获准分享的诊断/结果；平台健康不证明比较正确。 |
| 打包提示候选或报告目录已存在 | 从第 6 步生成新版本号；旧证据保留。 |
| 终端关闭，变量丢失 | 从第 2、4 步重新登录和读取配置。已有发布的版本号与资料目录需按原记录重新设置，再继续维护；不要把新生成版本当旧发布回滚。 |

## 给平台维护者的最后确认

正式开放前，平台维护者核对：内部入口的可达范围、证书与组织认证、镜像摘要、实际节点架构、平台分配用户、只读文件系统、资源限制、网络规则和重新调度；再由指定办公终端和使用者完成试用。这里的步骤不代替这些真实环境证据。

PDF 在使用者浏览器内处理，服务器提供网页资源；目前仍有复杂表格与部分来源位置的已知问题。页面处理结束不代表业务正确，扫描图片文字没有被识别。现有证据和未完成项保留在[分层验收记录](../reports/issue-17/README.md)。

供维护者核对平台行为的官方资料：[OpenShift 登录命令](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html/cli_tools/openshift-cli-oc)、[OpenShift 路由配置](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html-single/ingress_and_load_balancing/index)、[Docker 镜像推送](https://docs.docker.com/reference/cli/docker/image/push/)。界面名称及平台限制以实际集群版本为准。
