"""Re-evaluate the four frozen product outputs; never extract or modify a PDF.
Run from repository root: python3 reports/issue-2-amount-binding/retriage.py
"""
import gzip
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = ROOT / 'reports/issue-2-followup/renewal'
OUT = ROOT / 'reports/issue-2-amount-binding/retriage'
TEMP = ROOT / 'tmp/issue-2-amount-binding'
OUT.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)
runs = json.loads((BASE / 'runs.json').read_text())
records = []
for run in runs['runs']:
    name = run['pair'] + '-' + run['engine']
    raw = gzip.decompress((BASE / (name + '.json.gz')).read_bytes())
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == run['sha256']
    product = TEMP / (name + '.json')
    product.write_bytes(raw)
    changes = ROOT / 'tmp/renewal-inputs/testdata/renewal' / run['pair'] / 'changes.json'
    assert hashlib.sha256(changes.read_bytes()).hexdigest() == run['summary']['inputs']['changes']['sha256']
    events_path = TEMP / (name + '.events.json')
    cmd = ['python3', 'scripts/renewal-triage.py', str(changes.relative_to(ROOT)), str(product.relative_to(ROOT)),
           '--events', str(events_path.relative_to(ROOT)), '--identity', 'scripts/renewal-identity.json']
    with (OUT / (name + '.summary.json')).open('w') as out, (OUT / (name + '.stderr.txt')).open('w') as err:
        code = subprocess.run(cmd, cwd=ROOT, stdout=out, stderr=err).returncode
    assert code == 0, (name, code)
    before_raw = (BASE / (name + '.events.json')).read_bytes()
    after_raw = events_path.read_bytes()
    before = json.loads(before_raw)
    after = json.loads(after_raw)
    by_id = lambda es: {str(e['id']): e for e in es}
    a, b = by_id(before), by_id(after)
    delta = [{'id': k, 'before': a.get(k), 'after': b.get(k)} for k in sorted(set(a) | set(b)) if a.get(k) != b.get(k)]
    (OUT / (name + '.delta.json')).write_text(json.dumps(delta, ensure_ascii=False, indent=2) + '\n')
    (OUT / (name + '.events.json.gz')).write_bytes(gzip.compress(after_raw, mtime=0))
    row = {'name': name, 'command': cmd, 'exitCode': code, 'fixedProductSha256': sha,
           'productSource': str((BASE / (name + '.json.gz')).relative_to(ROOT)),
           'beforeEventsSha256': hashlib.sha256(before_raw).hexdigest(),
           'afterEventsSha256': hashlib.sha256(after_raw).hexdigest(),
           'eventFieldsEqual': before == after, 'eventBytesEqual': before_raw == after_raw,
           'changedEvents': [d['id'] for d in delta]}
    records.append(row)
    print(name, 'exit', code, 'events fields equal', row['eventFieldsEqual'], 'bytes equal', row['eventBytesEqual'],
          'changed', row['changedEvents'], flush=True)
(OUT / 'runs.json').write_text(json.dumps({'codeRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'fixedProductRevision': 'a6043d90dd30f360be6fac5350c374a1d4ee72a4',
    'baselineTriageRevision': '3a520c1b0880943e31e20d4c1d2e0a5ae4794e1a', 'extractionPerformed': False,
    'runs': records}, ensure_ascii=False, indent=2) + '\n')
