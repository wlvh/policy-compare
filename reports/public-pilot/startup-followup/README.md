# 公网启动修订与验证

当前公开入口为 [compare.huaweidata.com](https://compare.huaweidata.com/)，当前候选为 [r21-startup-a1](https://compare.huaweidata.com/releases/r21-startup-a1/)。部署配置、原始公网证据与启动修订由 [PR #21](https://github.com/wlvh/policy-compare/pull/21) 保存。

## 本轮改动

PDF 引擎首次准备期限由 15 秒调整为 60 秒，每次比较启动时 PDF 与 Rust 核心的准备期限也调整为 60 秒。两处期限包含下载和初始化。页面显示正在下载与初始化，并说明最长等待时间。超时结束线程、显示失败，用户可以重新加载或开始新的任务。

文档提取与比较的 120 秒期限从 PDF 和 Rust 核心均准备完成后开始。取消正在准备的 PDF 引擎时，同时清除定时器、终止线程并结束等待中的 Promise。比较结果与搜索流程继续由原有核心执行。

60 秒是本轮有限加载期限的工程选择。下面的受控慢下载在约 25 秒后完成，新期限覆盖了这个实际验证条件。延长期限没有被计为加载提速，普通终端和指定网络的 P95 目标继续待测。

## 候选身份

| 项目 | 实际值 |
| --- | --- |
| 发布版本 | `r21-startup-a1` |
| 应用源码 | `14a2467d97937c7cca979390d4665d07af65d61c` |
| 固定 Linux ARM64 镜像 | `sha256:836975195cc57f09a1d9facd72fb82814d55c955b438071db3a1c9157efbdb80` |
| 构建清单 SHA-256 | `d067d85742eb9597d46ea879cceeaa5d6c627fab796b377954835fda913d04cc` |
| Rust WASM SHA-256 | `30d737bc7bcf0e7d555811aeae19834e6311c6117fc9b355d572da8f44002898` |
| 新部署编号 | `ca9e77b2-6f7c-44fb-a1c1-5d48db43b2e9` |
| 新部署固定地址 | `https://ca9e77b2.huaweidata-compare.pages.dev/` |

Rust WASM 与原候选哈希相同。本轮产品代码修改集中在 `apps/web/main.tsx` 的启动、状态和清理。PDF 适配器与 Rust 核心源码均有原有 Git 身份可核对。

打包脚本从已检查镜像取出发布文件，核对清单，并保留旧候选全部 90 个文件，包括构建清单。全站共 210 个文件，其中 208 个为可下载文件，两个为 Pages 配置。`site-package.json` 保存完整文件身份。

## 实际网络记录

旧候选在今天的正常访问和请求拦截访问中都成功完成 P02。因此，本轮没有将此前失败描述为每次必现。

在同一台机器和网络上，使用 Chrome DevTools 的页面级网络限速，将下载带宽设为每秒 200,000 字节。`baseline-slow-final.json` 保存旧候选的完整记录。进入页面约 1.88 秒发出 MuPDF 请求，约 2.12 秒开始收到数据。在第 15 秒，已收到约 6.11 MB 解压数据，最近一次接收仍发生在该时刻，完整文件应为 10,409,826 字节。旧应用约 16.32 秒显示 15 秒超时，下载尚未结束。

`public-slow.json` 使用相同控制访问新候选。MuPDF 请求约 2.06 秒发出，约 2.34 秒收到数据，约 25.17 秒完成。PDF 引擎约 25.18 秒就绪，随后首次 P02 比较约 4.80 秒完成。Rust WASM 请求约 25.91 秒发出、约 26.17 秒收到数据、约 29.89 秒完成。

上述限速为人为控制条件，分别保留为受控对照。浏览器事件中的解压字节和最终编码字节使用不同口径，中途编码长度不能当作已完成的传输总量。

正常访问另启两个空缓存浏览器上下文，每个上下文访问两次，所有访问均完成 P02。

| 记录 | 浏览器缓存 | PDF 引擎就绪 | 点击 P02 到结果 |
| --- | --- | --- | --- |
| `public-visits-a.json` 第一次 | 新上下文 | 5.872 秒 | 1.437 秒 |
| 同记录第二次 | 同上下文再次访问 | 0.120 秒 | 0.191 秒 |
| `public-visits-b.json` 第一次 | 新上下文 | 4.168 秒 | 0.985 秒 |
| 同记录第二次 | 同上下文再次访问 | 0.119 秒 | 0.190 秒 |

这些记录来自当前开发 Mac 和访问链路。空浏览器缓存与 Cloudflare 边缘缓存分别存在，记录没有清空边缘缓存。样本数量和设备范围不足以验收普通办公终端的首次打开 P95。

## 针对性检查

| 记录 | 实际结果 |
| --- | --- |
| `candidate/container.json` | 固定镜像检查通过，34 项通过、1 项跳过 |
| `final-regressions/verification.json` | 新增 5 项回归全部通过 |
| `processing-phase-final/verification.json` | 处理阶段确认后推进 120 秒，连续 5 次通过 |
| `existing-core-verified/verification.json` | 原有 Rust 取消、失败、超时及重试 3 项通过，超时用例按 60 秒边界同步 |
| `pages-tests/verification.json` | Wrangler 本地 Pages 上原 4 项部署检查全部通过 |
| `public-deployment-final/verification.json` | 实际公开域名上原 4 项部署检查全部通过 |
| `public-files.json` | 新版本 90 个文件全部核对一致 |
| `original-public-files.json` | 当前同站旧版本 90 个文件全部核对一致 |
| `public-hosting-files.json` | 当前入口、源码归档、构建说明及许可等 8 个文件全部核对一致 |

原部署用例的就绪等待覆盖 60 秒初始化，比较等待覆盖初始化与处理的有限期限。用例先等待实际结束状态，再核对预期结果，应用报错会立即进入结果断言。

新增回归通过真实延迟 20 秒的 PDF Worker 和 Rust WASM 请求验证旧期限之后仍可启动并完成比较。无响应、取消与处理期限使用浏览器时钟推进，核对实际失败状态、线程退出和重试恢复。处理期限检查使用保留原响应头的受控 Worker 响应，使文档处理保持未完成，再检查 120 秒终止。

早期 CI 的两个功能作业还指出原 Rust 超时测试仍将 17 秒等待视为失败。该测试已改为阻塞请求并推进到 60 秒边界，继续核对真实失败、线程退出及重试结果，见 `existing-core-verified`。

本地首次复跑这三项时，误用了主机编译核心的预期清单，三个用例在最后的产物核对处失败。记录保存在 `existing-core-lifecycle`。随后从已固定、已核对的候选构建清单提取 `expected-core-info.json`，通过既有 `POLICY_CORE_INFO` 参数指定该候选的预期产物，`existing-core-verified` 三项通过。断言继续逐项核对实际加载产物。

随后最新 CI 的 MuPDF 作业还发现 120 秒检查可能在初始“正在读取”提示处过早推进时钟，实际先触发了 60 秒准备期限。测试已改为等待“文字提取完成”后再推进，`processing-phase-final` 连续五次通过。

开发中的回归脚本曾因已取消请求上的重复 abort 和受控 Worker 响应缺少原隔离头而失败。已修正脚本并保留早期记录，最终以 `final-regressions` 为本轮回归结果。`package.log` 保留首次 Docker 文件提取遇到只读目录权限的失败，打包改为 Docker tar 流交给本机 tar 提取后，`package-verified.log` 记录成功。

720 次旧算法性能对照保留原版范围。本轮执行加载、任务生命周期和发布验证，相关 CI 结果以 PR 当前提交的 Checks 为准。

## 重现与恢复

构建、从保留部署恢复输入、生成发布目录和回滚步骤见 [Cloudflare 发布说明](../../../deploy/cloudflare/README.md)。

公开部署检查使用候选自身的清单。

```sh
NODE_USE_ENV_PROXY=1 \
POLICY_BROWSER_CHANNEL=bundled \
POLICY_BASE_URL=https://compare.huaweidata.com/releases/r21-startup-a1/ \
POLICY_ENGINE=mupdf POLICY_RELEASE_ID=r21-startup-a1 \
POLICY_MANIFEST_SHA256=d067d85742eb9597d46ea879cceeaa5d6c627fab796b377954835fda913d04cc \
POLICY_REPORT_DIR=reports/public-pilot/r21-recheck-01 \
bash scripts/pnpm-local.sh verify:deployment tests/browser/deployment.spec.ts
```

使用 `scripts/record-startup.ts <版本网址> <输出文件> 2` 记录首次和再次访问，设置 `POLICY_RECORD_BYTES_PER_SECOND=200000` 可重现受控下载。使用 `scripts/verify-release-files.ts <版本网址> <预期清单> <输出文件>` 核对实际发布资源。每次另选报告文件或目录，保留已有记录。

旧路径 `/releases/r20-a3-mupdf/` 及其失败记录继续可查。完整站点回滚目标为 `3350dadc-9f46-4b85-b0e0-7fd8e33309b2`。本轮保存了恢复步骤，实际生产回滚操作尚未执行。

Issue #19 保持开放。真实参与者和业务样本数均为 0，业务文件依用户决定等待后续提供，完整内存和公司环境验收继续沿用原定范围。
