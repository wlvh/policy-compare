"""Package the unchanged supplemental inputs and raw observations for handoff."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile

ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--source',type=Path,required=True,help='Directory created for the original falcon renewal intake')
ap.add_argument('--out',type=Path,default=Path('delivery/policy-compare-renewal-baseline.tar.gz'))
args=ap.parse_args()
root=args.source.resolve()
sha=lambda data:hashlib.sha256(data).hexdigest()
source_manifest=json.loads((root/'source-manifest.json').read_text())
for item in source_manifest['files']:
    data=(root/'source'/item['path']).read_bytes()
    if sha(data)!=item['sha256']:
        raise SystemExit('Original source differs: '+item['path'])
contents={}
for directory in ['source','results','records','page-previews','reproduction']:
    for p in sorted((root/directory).rglob('*')):
        if p.is_symlink():
            raise SystemExit('Unexpected symlink: '+str(p))
        if p.is_file():
            contents[p.relative_to(root).as_posix()]=p.read_bytes()
for name in ['source-manifest.json','amount-location-reference.json','pdf-inventory.json','environment.json','intake-summary.json','README.md']:
    contents[name]=(root/name).read_bytes()
contents['HANDOFF_README.zh-CN.md']=('''# 续保合成样本原始证据

来源固定 jiehuan/falcon-mini @ 0eef67dd6cbe477ab625885220686c674640fb88。
产品固定 1ce93d4dd41d1d46d5dd4b49a35f73d1b74a7183；原试跑目录和日志按原样保存。
source/testdata/renewal 下是两对合成 PDF 与未修改的作者答案。
results 下是四次 CLI 与四次浏览器的原始结果、日志和截图。
各次均为 partial。工作流和选定金额位置抽查通过不等于177项正文/5项页眉事件全部通过。

旧原始记录中的绝对路径用于说明当时环境；接收者使用本包内的相对路径。
reproduction 中保存当时的临时脚本。新的可移植脚本已在配套 Git 仓库 scripts 下，见交接手册。
新增的公司—份额结构诊断和页码问题说明也在配套仓库 reports/renewal-intake 中。
不要运行原生成器重写这些 PDF 后再称为同一输入；不要改写 changes.json 迎合输出。

本包只包含用户指定的虚构测试资料，没有真实保单。来源和作者说明保留，不另行宣称上游生产授权。
配套源码、使用/观察方法、当前难点：https://github.com/wlvh/policy-compare/blob/handoff-20261026/docs/handoff.zh-CN.md
''').encode()
manifest={'sourceRevision':source_manifest['ref'],'productRevision':'1ce93d4dd41d1d46d5dd4b49a35f73d1b74a7183','scope':'synthetic inputs and unchanged original observations; not full business acceptance','files':{name:{'bytes':len(data),'sha256':sha(data)} for name,data in sorted(contents.items())}}
contents['ARCHIVE_MANIFEST.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
prefix='policy-compare-renewal-baseline/'
args.out.parent.mkdir(parents=True,exist_ok=True)
if args.out.exists():
    raise SystemExit('Choose a new --out; existing evidence archive is preserved')
with args.out.open('xb') as raw,gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as compressed,tarfile.open(fileobj=compressed,mode='w') as archive:
    for name,data in sorted(contents.items()):
        info=tarfile.TarInfo(prefix+name);info.size=len(data);info.mode=0o644;info.mtime=0
        archive.addfile(info,io.BytesIO(data))
with tempfile.TemporaryDirectory(prefix='policy-renewal-extract-') as target,tarfile.open(args.out) as archive:
    archive.extractall(target,filter='data')
    for name,item in manifest['files'].items():
        if sha((Path(target)/prefix/name).read_bytes())!=item['sha256']:
            raise SystemExit('Extraction hash differs: '+name)
record={'file':args.out.name,'bytes':args.out.stat().st_size,'sha256':sha(args.out.read_bytes()),'archiveEntries':len(contents),'payloadFilesVerified':len(manifest['files']),'originalSourceFilesVerified':len(source_manifest['files']),'sourceRevision':manifest['sourceRevision'],'productRevision':manifest['productRevision'],'testExtraction':'PASS','originalReportsUnchanged':True}
dest=Path(__file__).resolve().parents[1]/'reports/renewal-intake/raw-artifact.json'
dest.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(record,ensure_ascii=False))
