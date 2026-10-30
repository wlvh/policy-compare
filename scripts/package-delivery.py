"""Package only the selected static runtime; never include validation answers in products."""
from pathlib import Path
import hashlib,json,tarfile,io
ROOT=Path(__file__).resolve().parents[1]
ab=json.loads((ROOT/'reports/engine-ab.json').read_text())
OUT=ROOT/'delivery';OUT.mkdir(exist_ok=True)
manifest={'product_revision':ab['commit'],'scope':'local technical evaluation; not a production approval','artifacts':[]}
for engine in ['pdfjs','mupdf']:
 base=ROOT/'dist'/engine;files=sorted(p for p in base.rglob('*') if p.is_file())
 package=OUT/f'policy-compare-{engine}.tar.gz'
 build={'engine':engine,'product_revision':ab['commit'],'files':{str(p.relative_to(base)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
 assert {f'dist/{engine}/{name}':digest for name,digest in build['files'].items()}==ab['builds'][engine], 'Re-run the browser benchmark for these exact product builds before packaging.'
 common_names=set(json.loads((ROOT/'package.json').read_text())['dependencies'])|{'scheduler'}
 compact=lambda obj:[{k:v for k,v in item.items() if k in ['name','versions','license','homepage']} for group in obj.values() for item in group]
 dependencies={'common_browser_runtime':[x for x in compact(json.loads((ROOT/'reports/dependency-licenses.json').read_text())) if x['name'] in common_names],
  'engine_installation':compact(json.loads((ROOT/f'reports/licenses-{engine}.json').read_text())),
  'note':'@napi-rs/canvas and platform packages, when listed, are Node-only optional dependencies; not shipped in this browser archive. Actual browser component licenses are preserved in dist.'}
 readme=f'''# {engine} 本地运行包

需要 Node 24 LTS。在此目录执行 `node server.mjs`，打开 http://127.0.0.1:8080。
无需 pnpm 或下载另一引擎。PDF 仅在浏览器处理，服务器不接收上传。
首次试用可选择 samples/before.pdf 与 samples/after.pdf，均为明确标注的虚构样本，含金额和续期变化。
默认已配置 Worker/WASM/MJS MIME 与 COOP/COEP，长任务取消使用本地共享标记。

Linux: `docker build -t policy-compare:{engine} .`，然后
`docker run --rm --read-only --user 12345:12345 -p 8080:8080 policy-compare:{engine}`。
本机 Docker 服务仍不可用；对应产品的 GitHub Linux CI 实际构建与启动结果见配套项目 reports/ci-review-fixes.json。本运行包的本地解压检查不能替代该 CI 证据。

产品冻结提交：{ab['commit']}。BUILD.json 包含所有静态文件 SHA-256。
依赖版本与许可清单在 DEPENDENCIES.json；许可在 dist/licenses，PDF.js 的字体/解码器许可亦在各资源目录。
本引擎的实际改动补丁随运行包附带；完整对应应用源代码和依赖锁文件在配套项目中。本包只供本次本地评估，不能单独据此认定已满足对外分发条件。
本地双引擎评估已授权；对外分发、共享部署和生产范围须按实际许可条件落实。
公共源代码、CLI、锁文件与全部测试在配套项目中。
'''
 docker='''FROM node:24.22.1-alpine
WORKDIR /app
COPY dist ./dist
COPY server.mjs ./server.mjs
RUN chmod -R a=rX /app
ENV HOST=0.0.0.0 PORT=8080 STATIC_ROOT=/app/dist NODE_ENV=production
USER 10001:10001
EXPOSE 8080
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
'''
 with tarfile.open(package,'w:gz') as tar:
  for p in files:tar.add(p,arcname=f'policy-compare-{engine}/dist/{p.relative_to(base)}')
  tar.add(ROOT/'deploy/server.mjs',arcname=f'policy-compare-{engine}/server.mjs')
  for name in ['before','after']:tar.add(ROOT/f'validation/dataset/cases/R32_combined_changes/{name}.pdf',arcname=f'policy-compare-{engine}/samples/{name}.pdf')
  tar.add(ROOT/'validation/assets/DejaVu-font-license.txt',arcname=f'policy-compare-{engine}/samples/DejaVu-font-license.txt')
  patch='mupdf@1.28.1.patch' if engine=='mupdf' else 'pdfjs-dist@6.4.299.patch'
  tar.add(ROOT/'patches'/patch,arcname=f'policy-compare-{engine}/{patch}')
  for name,content in [('RUN.zh-CN.md',readme),('Dockerfile',docker),('BUILD.json',json.dumps(build,indent=2)+'\n'),('DEPENDENCIES.json',json.dumps(dependencies,indent=2)+'\n')]:
   data=content.encode();info=tarfile.TarInfo(f'policy-compare-{engine}/{name}');info.size=len(data);info.mode=0o644;tar.addfile(info,io.BytesIO(data))
 with tarfile.open(package) as tar:
  names=tar.getnames();assert len(names)==len(files)+9
  assert all('expected.json' not in n and 'source.json' not in n for n in names)
  if engine=='pdfjs':assert all('mupdf' not in n.lower() for n in names)
 manifest['artifacts'].append({'engine':engine,'file':str(package.relative_to(ROOT)),'bytes':package.stat().st_size,'sha256':hashlib.sha256(package.read_bytes()).hexdigest(),'entries':len(names),'archive_inspection':'PASS'})
(ROOT/'DELIVERY_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
