"""Package only the selected static runtime; never include validation answers in products."""
from pathlib import Path
import hashlib,json,tarfile,io,argparse,subprocess,re
ROOT=Path(__file__).resolve().parents[1]


def package_current(selected, output):
    engines = ['pdfjs', 'mupdf'] if selected == 'both' else [selected]
    builds = []
    for engine in engines:
        base = ROOT / 'dist' / engine
        info = json.loads((base / 'build-info.json').read_text())
        revision, release = info['revision'], info['releaseId']
        assert re.fullmatch(r'[a-f0-9]{40}', revision), 'Build must identify a source commit'
        assert release != 'development' and info['base'] == f'/releases/{release}/', 'Build a versioned release first'
        assert info['engine'] == engine
        product_paths = [
            'apps', 'packages', 'engines', 'profiles', 'patches', 'deploy/server.mjs',
            'vite.config.ts', 'pnpm-lock.yaml', 'crates', 'Cargo.toml', 'Cargo.lock',
            'rust-toolchain.toml',
        ]
        changed = subprocess.check_output(['git', 'diff', revision, '--', *product_paths], cwd=ROOT)
        assert not changed, 'Runtime sources differ from the identified build commit'
        for item in info['resources']:
            file = base / item['path']
            assert file.resolve().is_relative_to(base.resolve())
            assert file.stat().st_size == item['bytes'] and hashlib.sha256(file.read_bytes()).hexdigest() == item['sha256'], file
        actual = {str(file.relative_to(base)) for file in base.rglob('*') if file.is_file()}
        assert actual == {item['path'] for item in info['resources']} | {'build-info.json'}
        builds.append((engine, base, info))
    revisions = {info['revision'] for _, _, info in builds}
    assert len(revisions) == 1, 'Selected engines must identify the same source commit'
    output = output or ROOT / 'delivery' / f"runtime-{builds[0][2]['releaseId']}"
    assert not output.exists(), 'Choose a new output directory to preserve previous packages'
    output.mkdir(parents=True)
    manifest = {'format': 'policy-runtime/2', 'product_revision': next(iter(revisions)), 'artifacts': []}
    for engine, base, info in builds:
        package = output / f"policy-compare-{engine}-{info['releaseId']}.tar.gz"
        prefix = f'policy-compare-{engine}'
        readme = f"""# {engine} local runtime package

Install Node.js 24 LTS. In the extracted directory, run `node server.mjs`, then open http://127.0.0.1:8080/.
To use a different port on macOS/Linux, run `PORT=8082 node server.mjs`. Press Ctrl+C to stop.
The page includes P01, P02 and E03 sample buttons. You can also select samples/before.pdf and samples/after.pdf from this package.
Both PDFs are parsed, compared, searched and displayed in your browser.
Source commit: {info['revision']}
Release: {info['releaseId']}
BUILD.json, dist/build-info.json and the delivery manifest identify the packaged files.
See SOURCE.txt for source and build instructions; see LICENSE, NOTICE and dist/licenses for license terms.
The accompanying manifest.json and extracted-package verification record describe the checks performed and their results.
"""
        source = (
            f"Source commit: https://github.com/wlvh/policy-compare/tree/{info['revision']}\n"
            "Build: Node 24 LTS, pnpm 10.12.1, Rust 1.93.0 wasm32-unknown-unknown.\n"
            f"pnpm install --frozen-lockfile && pnpm install:{engine}\n"
            f"POLICY_RELEASE_ID={info['releaseId']} POLICY_REVISION={info['revision']} pnpm build:{engine}\n"
            "MuPDF 1.28.1 complete upstream source: https://github.com/ArtifexSoftware/mupdf-downloads/releases/download/1.28.1/mupdf-1.28.1-source.tar.gz\n"
            "Project patches and all dependency lockfiles are supplied at the identified source commit.\n"
        )
        build = {
            'engine': engine,
            'product_revision': info['revision'],
            'releaseId': info['releaseId'],
            'files': {
                str(file.relative_to(base)): hashlib.sha256(file.read_bytes()).hexdigest()
                for file in base.rglob('*') if file.is_file()
            },
        }
        with tarfile.open(package, 'w:gz') as tar:
            for file in sorted(base.rglob('*')):
                if file.is_file():
                    tar.add(file, arcname=f'{prefix}/dist/{file.relative_to(base)}')
            tar.add(ROOT / 'deploy/server.mjs', arcname=f'{prefix}/server.mjs')
            for name in ['LICENSE', 'NOTICE']:
                tar.add(ROOT / name, arcname=f'{prefix}/{name}')
            for name in ['before', 'after']:
                tar.add(ROOT / f'validation/dataset/cases/R32_combined_changes/{name}.pdf', arcname=f'{prefix}/samples/{name}.pdf')
            tar.add(ROOT / 'validation/assets/DejaVu-font-license.txt', arcname=f'{prefix}/samples/DejaVu-font-license.txt')
            patch = 'mupdf@1.28.1.patch' if engine == 'mupdf' else 'pdfjs-dist@6.4.299.patch'
            tar.add(ROOT / 'patches' / patch, arcname=f'{prefix}/{patch}')
            for name, text in [('RUN.md', readme), ('SOURCE.txt', source), ('BUILD.json', json.dumps(build, indent=2)+'\n')]:
                data = text.encode()
                entry = tarfile.TarInfo(f'{prefix}/{name}')
                entry.size = len(data)
                entry.mode = 0o644
                tar.addfile(entry, io.BytesIO(data))
        with tarfile.open(package) as tar:
            names = tar.getnames()
            assert all(not any(part in name.split('/') for part in ['reports', 'tests', 'validation', 'node_modules', 'target', '.git']) for name in names)
        manifest['artifacts'].append({
            'engine': engine,
            'releaseId': info['releaseId'],
            'file': package.name,
            'bytes': package.stat().st_size,
            'sha256': hashlib.sha256(package.read_bytes()).hexdigest(),
            'manifestSha256': hashlib.sha256((base / 'build-info.json').read_bytes()).hexdigest(),
            'entries': len(names),
        })
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


parser = argparse.ArgumentParser()
parser.add_argument('--current', action='store_true', help='Package versioned dist builds independently of historical performance acceptance')
parser.add_argument('--engine', choices=['mupdf', 'pdfjs', 'both'])
parser.add_argument('--out', type=Path)
args = parser.parse_args()
if args.current:
    package_current(args.engine or 'mupdf', args.out)
    raise SystemExit(0)
if args.engine is not None or args.out is not None:
    parser.error('--engine and --out require --current')

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
 readme=f'''# {engine} local runtime package

Requires Node.js 24 LTS. Run `node server.mjs` in this directory, then open http://127.0.0.1:8080/.
You do not need pnpm or the other PDF engine. PDFs are processed only in the browser; the server does not accept uploads.
For an initial trial, choose samples/before.pdf and samples/after.pdf. Both are labeled fictional samples with amount and renewal-date changes.
Worker/WASM/MJS content types and COOP/COEP headers are configured. Long-running tasks use a local shared cancellation flag.

Linux: run `docker build -t policy-compare:{engine} .`, then
`docker run --rm --read-only --user 12345:12345 -p 8080:8080 policy-compare:{engine}`.
For this historical candidate, the local Docker service was unavailable. Actual GitHub Linux CI build and startup results are recorded in reports/ci-review-fixes.json in the accompanying project. Local archive extraction checks do not replace that CI evidence.

Frozen product commit: {ab['commit']}. BUILD.json contains the SHA-256 of every static file.
Dependency versions and licenses are listed in DEPENDENCIES.json. Licenses are preserved in dist/licenses; PDF.js font and decoder licenses also remain in their resource directories.
The engine patch is included. Complete corresponding application source and dependency lockfiles are in the accompanying project. This package is for the recorded local evaluation; it does not by itself establish that public distribution requirements have been met.
Local evaluation of both engines was authorized. Public distribution, shared deployments and production use must satisfy the applicable license terms.
Shared source, the CLI, lockfiles and all tests are in the accompanying project.
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
  for name,content in [('RUN.md',readme),('Dockerfile',docker),('BUILD.json',json.dumps(build,indent=2)+'\n'),('DEPENDENCIES.json',json.dumps(dependencies,indent=2)+'\n')]:
   data=content.encode();info=tarfile.TarInfo(f'policy-compare-{engine}/{name}');info.size=len(data);info.mode=0o644;tar.addfile(info,io.BytesIO(data))
 with tarfile.open(package) as tar:
  names=tar.getnames();assert len(names)==len(files)+9
  assert all('expected.json' not in n and 'source.json' not in n for n in names)
  if engine=='pdfjs':assert all('mupdf' not in n.lower() for n in names)
 manifest['artifacts'].append({'engine':engine,'file':str(package.relative_to(ROOT)),'bytes':package.stat().st_size,'sha256':hashlib.sha256(package.read_bytes()).hexdigest(),'entries':len(names),'archive_inspection':'PASS'})
(ROOT/'DELIVERY_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
