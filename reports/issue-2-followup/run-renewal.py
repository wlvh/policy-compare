"""Re-extract four comparisons on the committed candidate; preserve per-step results.
Run from repository root: python3 reports/issue-2-followup/run-renewal.py
Node 24 and pnpm must be on PATH. No source/expected edits or report cleanup.
"""
import gzip
import hashlib
import json
import pathlib
import platform
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/issue-2-followup/renewal'
BASE = ROOT / 'reports/issue-2-joint/renewal'
OUT.mkdir(parents=True, exist_ok=True)
revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
if subprocess.check_output(['git', 'diff', 'HEAD', '--', 'packages', 'engines', 'profiles', 'scripts/renewal-triage.py'], cwd=ROOT):
    raise SystemExit('Commit runtime changes before recording evidence')
subprocess.run(['node', 'scripts/fetch-renewal-samples.mjs', '--out', 'tmp/renewal-inputs'], cwd=ROOT, check=True)
records = []
for engine in ('pdfjs', 'mupdf'):
    for pair in ('aviation_2024_vs_2025', 'bizav_2024_vs_2025'):
        name = pair + '-' + engine
        src = ROOT / 'tmp/renewal-inputs/testdata/renewal' / pair
        dest = OUT / (name + '.json')
        commands = [
            ['pnpm', 'exec', 'tsx', 'packages/cli/run.ts', '--engine', engine,
             '--left', str(src / 'left.pdf'), '--right', str(src / 'right.pdf'), '--out', str(dest)],
            ['python3', 'scripts/renewal-triage.py', str(src / 'changes.json'), str(dest),
             '--events', str(OUT / (name + '.events.json')), '--identity', 'scripts/renewal-identity.json'],
        ]
        codes = []
        started = time.monotonic()
        for i, cmd in enumerate(commands):
            stdout = OUT / (name + ('.stdout.txt' if i == 0 else '.summary.json'))
            with stdout.open('w') as out, (OUT / (name + f'.{i}.stderr.txt')).open('w') as err:
                code = subprocess.run(cmd, cwd=ROOT, stdout=out, stderr=err).returncode
            codes.append(code)
            if code not in ((0, 2) if i == 0 else (0,)):
                raise SystemExit(f'{name} step {i}: exit {code}; see stderr')
        raw = dest.read_bytes()
        result = json.loads(raw)
        baseline = json.loads(gzip.decompress((BASE / (name + '.json.gz')).read_bytes()))
        events = json.loads((OUT / (name + '.events.json')).read_text())
        previous = json.loads((BASE / (name + '.events.json')).read_text())
        by = lambda es: {str(e['id']): e for e in es}
        a, b = by(previous), by(events)
        # Include ALL event fields, not just verdicts; keep the complete changed events below.
        changes = [{'event': k, 'before': a.get(k), 'after': b.get(k)} for k in sorted(set(a) | set(b)) if a.get(k) != b.get(k)]
        (OUT / (name + '.event-delta.json')).write_text(json.dumps(changes, ensure_ascii=False, indent=2) + '\n')
        product_fields = [k for k in sorted(set(result) | set(baseline)) if k != 'coreVersion' and result.get(k) != baseline.get(k)]
        record = {'pair': pair, 'engine': engine, 'commands': commands, 'exitCodes': codes,
                  'seconds': round(time.monotonic() - started, 2), 'sha256': hashlib.sha256(raw).hexdigest(),
                  'status': result['status'], 'cards': len(result['differences']),
                  'baselineCards': len(baseline['differences']), 'changedProductFieldsExceptVersion': product_fields,
                  'changedEvents': [e['event'] for e in changes],
                  'summary': json.loads((OUT / (name + '.summary.json')).read_text())}
        records.append(record)
        (OUT / (name + '.json.gz')).write_bytes(gzip.compress(raw, mtime=0))
        dest.unlink()
        print(name, record['status'], 'cards', record['baselineCards'], '->', record['cards'],
              'product fields', product_fields, 'event changes', record['changedEvents'], flush=True)
(OUT / 'runs.json').write_text(json.dumps({'codeRevision': revision, 'baselineRevision': '39735225004d4bafd9087c39076bd34964ead02c',
    'node': subprocess.check_output(['node', '-v'], text=True).strip(), 'platform': platform.platform(),
    'runs': records}, ensure_ascii=False, indent=2) + '\n')
