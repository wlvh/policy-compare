"""Re-runs the shared triage on saved comparison results, with the script before
and after a change, and lists every event whose verdict, accepted cards or
full-row flag differs. Comparison results are only re-triaged, never
re-extracted.

usage: python3 reports/issue-2-validation/retriage.py INPUTS OUT_DIR OLD_REV SET=DIR [SET=DIR ...]
  INPUTS   renewal inputs (testdata/renewal/<case>/changes.json)
  OLD_REV  git revision whose scripts/renewal-triage.py is the "before" script
  SET=DIR  a name and a directory holding <case>-<engine>.json or .json.gz
Writes OUT_DIR/<SET>/<case>-<engine>.{old,new}.summary.json, the new events
(.new.events.json.gz), and OUT_DIR/retriage.json and retriage.md.
The current script reads the identity declaration scripts/renewal-identity.json
(round 8). An old script that takes --identity reads the same declaration, so
only the script differs (round 9); an older one runs as it was. A script that
cannot read a result (an old script on result format 2) is recorded as such.
"""
import gzip
import hashlib
import json
import os
import subprocess
import sys
import tempfile

CASES = ['aviation_2024_vs_2025', 'bizav_2024_vs_2025']
ENGINES = ['mupdf', 'pdfjs']
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NEW = os.path.join(ROOT, 'scripts', 'renewal-triage.py')
IDENTITY = os.path.join(ROOT, 'scripts', 'renewal-identity.json')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(directory, name):
    for path, opener in ((os.path.join(directory, name + '.json'), open),
                         (os.path.join(directory, name + '.json.gz'), gzip.open)):
        if os.path.exists(path):
            with opener(path, 'rb') as f:
                return f.read()
    raise FileNotFoundError(os.path.join(directory, name))


def triage(script, changes, result, tmp, identity):
    events = os.path.join(tmp, 'events.json')
    extra = ['--identity', IDENTITY] if identity else []
    run = subprocess.run([sys.executable, script, changes, result, '--events', events, *extra],
                         capture_output=True, text=True)
    if run.returncode:
        return {'error': run.stderr.strip().splitlines()[-1]}, {}
    with open(events) as f:
        return json.loads(run.stdout), {e['id']: e for e in json.load(f)}


def metrics(summary):
    if 'error' in summary:
        return summary
    return {'verdicts': summary['verdicts'], 'acceptedCards': summary['acceptedCards'],
            'unexplainedCards': summary['unexplainedCards'],
            'fullRowRecovered': len(summary['tableRowEvents']['fullRowRecovered']),
            'changeCorrectlyAttributed': len(summary['tableRowEvents']['changeCorrectlyAttributed'])}


def main(inputs, out, old_rev, sets):
    os.makedirs(out, exist_ok=True)
    old_src = subprocess.run(['git', 'show', f'{old_rev}:scripts/renewal-triage.py'], cwd=ROOT,
                             capture_output=True, check=True).stdout
    old_identity = b'--identity' in old_src
    report = {'identity': {'path': os.path.relpath(IDENTITY, ROOT), 'sha256': sha(open(IDENTITY, 'rb').read()),
                           'readByOldScript': old_identity},
              'oldScript': {'rev': old_rev, 'sha256': sha(old_src)},
              'newScript': {'rev': subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True,
                                                  text=True, check=True).stdout.strip(),
                            'sha256': sha(open(NEW, 'rb').read())},
              'runs': []}
    with tempfile.TemporaryDirectory() as tmp:
        old_script = os.path.join(tmp, 'renewal-triage-old.py')
        with open(old_script, 'wb') as f:
            f.write(old_src)
        for name, directory in sets:
            os.makedirs(os.path.join(out, name), exist_ok=True)
            for case in CASES:
                changes = os.path.join(inputs, 'testdata', 'renewal', case, 'changes.json')
                for engine in ENGINES:
                    raw = load(directory, f'{case}-{engine}')
                    result = os.path.join(tmp, 'result.json')
                    with open(result, 'wb') as f:
                        f.write(raw)
                    (so, eo), (sn, en) = (triage(s, changes, result, tmp, s == NEW or old_identity)
                                          for s in (old_script, NEW))
                    base = os.path.join(out, name, f'{case}-{engine}')
                    for tag, summary in (('old', so), ('new', sn)):
                        if 'error' in summary:
                            with open(f'{base}.{tag}.summary.json', 'w') as f:
                                json.dump(summary, f, indent=1)
                            continue
                        summary['inputs']['result']['path'] = os.path.relpath(os.path.join(directory, f'{case}-{engine}.json'), ROOT)
                        summary['inputs']['changes']['path'] = os.path.relpath(changes, ROOT)
                        with open(f'{base}.{tag}.summary.json', 'w') as f:
                            json.dump(summary, f, indent=1)
                    with gzip.open(f'{base}.new.events.json.gz', 'wt') as f:
                        json.dump(list(en.values()), f)
                    changed = []
                    for k in (eo if eo and en else {}):
                        a, b = eo[k], en[k]
                        fa, fb = ((x.get('row') or {}).get('fullRowRecovered') for x in (a, b))
                        if (a['verdict'], a.get('acceptedCards'), fa) != (b['verdict'], b.get('acceptedCards'), fb):
                            changed.append({'id': k, 'block': a['block'], 'kind': a['kind'],
                                            'verdict': [a['verdict'], b['verdict']],
                                            'acceptedCards': [a.get('acceptedCards'), b.get('acceptedCards')],
                                            'fullRowRecovered': [fa, fb],
                                            'atoms': [a.get('atoms'), b.get('atoms')],
                                            'reasons': sorted({x['reason'] for x in b.get('atomEvidence', []) if x['reason']})})
                    report['runs'].append({'set': name, 'case': case, 'engine': engine,
                                           'resultSha256': sha(raw), 'changesSha256': sha(open(changes, 'rb').read()),
                                           'coreVersion': sn.get('coreVersion') or so.get('coreVersion'),
                                           'old': metrics(so), 'new': metrics(sn), 'changedEvents': changed})
    with open(os.path.join(out, 'retriage.json'), 'w') as f:
        json.dump(report, f, indent=1)
    lines = [f"# Re-triage: {report['oldScript']['rev']} -> {report['newScript']['rev']}"
             f" (declaration {report['identity']['sha256'][:12]}, "
             f"{'both scripts' if old_identity else 'new script only'})", '',
             '| set | run | verdicts (old → new) | accepted | unexplained | fullRow | changed events |',
             '|---|---|---|---|---|---|---|']
    pick = lambda m, k: m.get(k, m.get('error', '—'))
    for r in report['runs']:
        o, n = r['old'], r['new']
        lines.append(f"| {r['set']} | {r['case'].split('_')[0]} {r['engine']} | {pick(o, 'verdicts')} → {pick(n, 'verdicts')} | "
                     f"{pick(o, 'acceptedCards')} → {pick(n, 'acceptedCards')} | {pick(o, 'unexplainedCards')} → "
                     f"{pick(n, 'unexplainedCards')} | {pick(o, 'fullRowRecovered')} → {pick(n, 'fullRowRecovered')} | "
                     f"{len(r['changedEvents'])} |")
    for r in report['runs']:
        for e in r['changedEvents']:
            lines.append(f"- {r['set']} {r['case'].split('_')[0]} {r['engine']} #{e['id']} {e['block']} ({e['kind']}): "
                         f"verdict {e['verdict'][0]} → {e['verdict'][1]}; accepted {e['acceptedCards'][0]} → {e['acceptedCards'][1]}; "
                         f"fullRow {e['fullRowRecovered'][0]} → {e['fullRowRecovered'][1]}"
                         + (f"; {'; '.join(e['reasons'])}" if e['reasons'] else ''))
    with open(os.path.join(out, 'retriage.md'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    inputs, out, old_rev, *pairs = sys.argv[1:]
    main(inputs, out, old_rev, [tuple(p.split('=', 1)) for p in pairs])
