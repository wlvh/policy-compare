# 本地与 Linux 运行

应用默认在浏览器处理 PDF。静态服务只有 GET/HEAD 和健康检查，不接收 PDF 上传。Worker、JavaScript 和 WASM 均随构建产物部署，不依赖 CDN。

本地生产资源验证：`pnpm build` 后 `STATIC_ROOT=dist/pdfjs node deploy/server.mjs`，打开 http://localhost:8080。默认读取 STATIC_ROOT 指向的引擎构建目录，可用 STATIC_ROOT 和 PORT 改路径与端口。只读目录、任意非 root UID 与无 HOME 写入是设计要求。

Linux 镜像：

```sh
docker build --build-arg ENGINE=pdfjs -f deploy/Dockerfile -t policy-compare:pdfjs .
docker build --build-arg ENGINE=mupdf -f deploy/Dockerfile -t policy-compare:mupdf .
docker run --rm --read-only --user 12345:12345 -p 8080:8080 policy-compare:pdfjs
curl http://localhost:8080/healthz
```

`pnpm test:container` 会实际构建、按任意非 root UID 启动、检查健康并停止自己创建的容器。Docker 服务缺失/不响应记 BLOCKED；可用 Docker 上构建失败或应用启动失败记 FAIL。配置文件存在不代表 Linux 已验证。

OpenShift 配置在 deploy/openshift.yaml。镜像构建平台必须和节点 CPU 架构一致；通过 image digest 固定发布版本。正式使用前替换镜像地址、组织命名空间、入口/TLS 与可选 SSO。示例没有设置固定 runAsUser，允许平台分配 UID。当前未连接组织平台，未部署生产。

回滚：保留上一版本镜像 digest 和部署配置；Harness/现有流水线部署指定 digest。失败时恢复旧 digest 并等待 readiness 通过。手动 OpenShift 可执行 `oc rollout undo deployment/policy-compare`，随后核对实际镜像、健康、页面资源和本地 PDF 流程；这条命令仅供获准管理员执行。本任务没有执行组织发布或回滚。

关闭浏览器任务会销毁 Worker、MuPDF 文档句柄与页面对象、释放 Blob URL。默认不写入文档存储、浏览器数据库或服务器日志；这不是对物理内存安全擦除的承诺。JSON 导出由用户主动触发，包含差异原文。

为满足长任务取消预算，服务器配置 Cross-Origin-Opener-Policy: same-origin 与 Cross-Origin-Embedder-Policy: require-corp，并在 localhost 或 HTTPS 下运行。4 字节共享取消标记只在本次页面与比较 Worker 内使用。Vite 开发/预览与附带生产服务器都设置了这些头；替换静态托管时需要保留。
