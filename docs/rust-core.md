# Rust 比较核心（Issue #19）

本地提取、比较、搜索和展示仍在浏览器运行。网页从同一站点自动取得 Rust 编译的 WebAssembly 文件，在比较 Worker 中计算；服务器只提供静态资源。用户不需要安装编译器、Node、Python、插件或本地服务。Rust 开发工具只属于开发和镜像构建环境。PDF.js 与 MuPDF 仍各自独立提取和渲染，两份 PDF 必须使用相同提取器、版本和选项。

## 开发与重建

开发要求 Node 24、pnpm 10.12.1、Rust 1.93.0 及 `wasm32-unknown-unknown` 标准库。工具链和直接依赖固定在 `rust-toolchain.toml`、`Cargo.toml` 和 `Cargo.lock`，传递依赖也由锁文件固定。

```sh
rustup toolchain install 1.93.0 --profile minimal --target wasm32-unknown-unknown
pnpm install --frozen-lockfile
pnpm install:mupdf
pnpm install:pdfjs
pnpm build:core
pnpm build:mupdf
pnpm build:pdfjs
pnpm verify:core
pnpm test:rules:mupdf
pnpm test:rules:pdfjs
```

本仓库已有 `scripts/pnpm-local.sh`，可在本机终端使用非 Node 24 时选择现有 Node 24 运行时。`build:core` 明确选用当前平台的 Rust 1.93.0 编译器，避免 Homebrew 的 `rustc` 与 rustup 的目标标准库混用。它只使用已安装工具链，不在构建期间安装或改动系统默认版本。Windows 开发构建未评价；Linux 镜像构建使用固定的 Rust Debian 镜像。

网页构建和测试命令会先构建核心；两种网页包、命令行和正式规则验证都使用 `packages/rust-core/generated/core.wasm`。Rust 依赖许可证随网页发布。生成文件不提交，不能依靠旧的未跟踪文件完成干净构建。Docker 独立 Rust 阶段先编译核心，再交给 Node 阶段生成实际产物信息和网页包；运行镜像不包含 Rust 编译器。

## 输入、原文和格式

`CoreSession` 依次接收每侧 `meta`、每页 `page` 和 `done`，两侧都结束后才能比较。Rust 校验元信息、页序、字符范围、字符归属、提取来源的 Unicode 字符与 UTF-16 偏移、页数和覆盖记录。错误明确返回，不能生成“无差异”结果。原始页面以 Rust 对象保留，计算引用由页、行、字符索引组成；每页转换结束后调用层不再保留页面引用。

原文索引用 Unicode 字符计数；PDF.js 文本项的 DOM 位置用 UTF-16；正则和 Rust 字符串的字节位置只在 Rust 内部切字符串使用，不当作原文位置。规范化保留每个匹配字符对应的原文索引列表。搜索从完整原文及映射读取，保留所有命中，不从差异卡推导。

外部输入仍是 `policy-compare/0.1.0`，输出仍是 `policy-compare-result/2`。`page-merkle/1` 输入快照、配置摘要、差异 ID 和文档排序规则保持原约定。Rust 实现使用 ECMAScript 数字格式和 UTF-16 属性名排序生成相同的规范 JSON，再计算 SHA-256；不是直接用 Rust 默认 JSON 数字格式计算指纹。`coreVersion` 显式标记 Rust 实现。发布清单 `coreArtifact` 记录 ABI、实际核心版本、WASM 字节数和 SHA-256；两种网页包必须含相同核心哈希。浏览器显示层后来补充的 `resolvedGeometry` 属于显示测量，跨入口一致性比较在补充前的核心输出上进行。

配置和预算只从 `profiles/aviation.ts` 传入，Rust 不维护另一份默认配置。预算耗尽、扫描图片覆盖、身份冲突及不完整对应保持原输出语义。语言迁移不等于提高正确性，也不扩大 OCR、文件大小或页数支持。

## 加载、取消与释放

比较 Worker 先安装消息处理器再异步加载 WASM。PDF 的 `ready` 与核心的 `core-ready` 分开；主线程核对任务身份并只打开一次 PDF、只转移一次文件字节和端口。初始化有 15 秒期限；任务保留原有 120 秒期限。阶段信息来自 Rust 实际阶段回调。

主线程取消、超时、关闭或替换任务会终止比较 Worker 和 PDF 客户端，清理定时器及现有渲染资源。停止不依赖繁忙 Worker 接收取消消息；共享中止标志的检查点作为辅助。正常完成后保留 Rust 原文会话供搜索使用，临时对应和差异计算区离开调用作用域即释放。`dispose` 清除 Rust 会话；Worker 终止后整个 WASM 实例可回收。不能把这一点表述为操作系统 RSS 会立即降低。

WASM 加载或哈希校验失败会明确失败，没有旧 TypeScript 回退。正式命令行也只调用 Rust。迁移前 TypeScript 固定在 `packages/legacy-core`，只用于 `scripts/issue19-baseline.ts`、机制测试及结构检查工具；生产 Worker 不导入它。旧路径的三个兼容文件只服务现有开发检查，不能作为正式比对验收。

## 验证与证据

```sh
pnpm exec tsx scripts/issue19-parity.ts
pnpm test:browser:mupdf
pnpm test:browser:pdfjs
pnpm exec tsx scripts/issue19-performance.ts --formal
```

冻结输入和旧结果存于 `validation/migration/issue-19/*.json.gz`，对应清单与内容哈希在 `reports/issue-19/frozen-baseline.json`。对照只允许核心版本标识不同，其余比较事实、来源、未决、覆盖、预算和指纹逐字段比较；旧结果只用于迁移对照，不能代替独立真值。正式规则评价器仍从明确输入、预期和来源记录评分。

`rust-core.spec.ts` 在真实网页包中启动发布 Worker，将同一冻结输入送给 Worker 和正式 `compare:doc` 命令，比较完整核心结果；另外验证初始化取消、失败、超时后重试、网络请求路径和查询参数中没有本地文件名、密码和搜索词。原有浏览器回归继续验证提取、高亮、搜索、导出、连续任务和关闭清理。

Rust 按页接收时已经解析、校验并计算页快照；`inputAdmission` 累计这一接收成本，`snapshot` 阶段只计算根快照。旧 TypeScript 在全部接收后校验和计算页快照，因此两者单个阶段的名称不代表相同计时边界，不能直接逐列比较得出提速结论；端到端比较使用相同的任务开始至首屏可审阅起止。另记录核心输入总字节、最大单次输入字节及调用次数，WASM 线性内存字节数只是该实例的诊断值，不代表浏览器总峰值。

本地功能、迁移一致性、工程性能测量、真实公司 HTTPS、目标办公电脑、OpenShift 和发布回滚分别报告。规则命令退出 2 表示存在已登记未评价项，不能说严格验收全通过。详见 `reports/issue-19/README.md`；Issue #19 依其关闭条件保持开放，直到剩余环境验收有证据或明确移交 #17。
