"""Create and test an exact Git snapshot plus the measured synthetic PDF inputs."""
from pathlib import Path
import hashlib
import io
import json
import subprocess
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TAG = 'review-20261026'
PREFIX = 'policy-compare-review/'
OUT = ROOT / f'policy-compare-review-20261026.zip'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def digest(data):
    return hashlib.sha256(data).hexdigest()

revision = git('rev-parse', 'HEAD').decode().strip()
if git('status', '--porcelain').strip():
    raise SystemExit('Commit the reviewed source and documents before packaging.')
ab = json.loads((ROOT / 'reports/engine-ab.json').read_text())
frozen = ab['commit']
if git('diff', frozen, revision, '--', 'apps', 'packages', 'engines', 'profiles', 'deploy', 'vite.config.ts').strip():
    raise SystemExit('Product sources changed after the measured product revision; review the provenance before packaging.')
inputs = json.loads((ROOT / 'bench/generated/manifest.json').read_text())
input_hashes = {item['name']: item['sha256'] for item in inputs}
for attempt in ab['attempts']:
    if attempt['pdfHashes'] != input_hashes[attempt['workload']]:
        raise SystemExit(f'Measured input hash differs: {attempt["workload"]}')
for item in inputs:
    for path, expected in zip(item['paths'], item['sha256']):
        if digest((ROOT / path).read_bytes()) != expected:
            raise SystemExit(f'Frozen benchmark input differs: {path}')
delivery = json.loads((ROOT / 'DELIVERY_MANIFEST.json').read_text())
for artifact in delivery['artifacts']:
    if digest((ROOT / artifact['file']).read_bytes()) != artifact['sha256']:
        raise SystemExit(f'Runtime archive differs: {artifact["file"]}')

contents = {}
modes = {}
with tarfile.open(fileobj=io.BytesIO(git('archive', '--format=tar', revision))) as archive:
    for member in archive.getmembers():
        if member.isfile():
            contents[member.name] = archive.extractfile(member).read()
            modes[member.name] = member.mode
        elif not member.isdir():
            raise SystemExit(f'Unexpected source entry type: {member.name}')
for path in sorted((ROOT / 'bench/generated').rglob('*')):
    if path.is_file():
        name = path.relative_to(ROOT).as_posix()
        contents[name] = path.read_bytes()
        modes[name] = 0o644
for name in contents:
    if name.endswith(('.zip', '.sha256', '.pyc')) or any(part in ['.git','node_modules','.venv','__pycache__','.DS_Store','delivery','evidence'] for part in Path(name).parts):
        raise SystemExit(f'Unexpected review archive entry: {name}')

manifest = {
    'source_revision': revision,
    'measured_product_revision': frozen,
    'tag': TAG,
    'archive_filename': OUT.name,
    'archive_root': PREFIX,
    'input_scope': 'synthetic validation and exact measured benchmark PDFs; no real policy documents',
    'files': {name: {'sha256': digest(data), 'bytes': len(data)} for name, data in sorted(contents.items())},
}
contents['ARCHIVE_MANIFEST.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2)+'\n').encode()
modes['ARCHIVE_MANIFEST.json'] = 0o644
with zipfile.ZipFile(OUT, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name, data in sorted(contents.items()):
        info = zipfile.ZipInfo(PREFIX + name, date_time=(2026,10,26,0,0,0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100000 | modes[name]) << 16
        archive.writestr(info, data)

with zipfile.ZipFile(OUT) as archive, tempfile.TemporaryDirectory(prefix='policy-review-extract-') as target:
    if archive.testzip() is not None:
        raise SystemExit('ZIP CRC validation failed')
    if set(archive.namelist()) != {PREFIX + name for name in contents}:
        raise SystemExit('ZIP path inventory differs')
    archive.extractall(target)
    for name, value in manifest['files'].items():
        if digest((Path(target) / PREFIX / name).read_bytes()) != value['sha256']:
            raise SystemExit(f'Extracted file mismatch: {name}')
    required = ['docs/reviewer-guide.zh-CN.md','tests/fixtures/mechanisms/unicode.pdf','validation/dataset/cases/R25_duplicate_keys/expected.json','bench/generated/template_change-standard/before.pdf','reports/engine-ab.json']
    if not all((Path(target) / PREFIX / name).is_file() for name in required):
        raise SystemExit('Required reviewer paths are missing after extraction')

benchmark_archive = ROOT / 'delivery/policy-compare-benchmark-inputs.tar.gz'
with tarfile.open(benchmark_archive,'w:gz') as archive:
    for name in sorted(n for n in contents if n.startswith('bench/generated/')):
        data = contents[name]
        info = tarfile.TarInfo(name)
        info.size = len(data)
        info.mode = 0o644
        archive.addfile(info,io.BytesIO(data))
with tarfile.open(benchmark_archive) as archive, tempfile.TemporaryDirectory(prefix='policy-bench-extract-') as target:
    archive.extractall(target,filter='data')
    for item in inputs:
        for name, expected in zip(item['paths'],item['sha256']):
            if digest((Path(target)/name).read_bytes()) != expected:
                raise SystemExit(f'Extracted benchmark PDF mismatch: {name}')

artifacts = [OUT,benchmark_archive,ROOT/'DELIVERY_MANIFEST.json'] + [ROOT/a['file'] for a in delivery['artifacts']]
release = {
    'source_revision': revision,
    'measured_product_revision': frozen,
    'repository': 'https://github.com/wlvh/policy-compare',
    'release_tag': TAG,
    'scope': 'private technical review; not production approval',
    'archive_validation': {'status':'PASS','zip_entries':len(contents),'crc_check':'PASS','test_extraction':'PASS','source_file_hashes':'PASS','frozen_pdf_hashes':'PASS','validation_answers':'unchanged'},
    'artifacts': [{'file':p.name,'local_path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':digest(p.read_bytes())} for p in artifacts],
}
(ROOT/'REVIEW_ARTIFACTS.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(release,ensure_ascii=False,indent=2))
