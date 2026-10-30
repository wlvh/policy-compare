#!/usr/bin/env python3
"""Run existing product APIs and renewal-triage; record evidence, never assign business PASS."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo', required=True, type=Path)
parser.add_argument('--manifest', type=Path, default=Path(__file__).with_name('manifest.json'))
parser.add_argument('--out', required=True, type=Path, help='new output directory')
parser.add_argument('--engine', choices=['both', 'pdfjs', 'mupdf'], default='both')
args = parser.parse_args()
repo, manifest_path, out = args.repo.resolve(), args.manifest.resolve(), args.out.resolve()
read = lambda p: json.loads(p.read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = read(manifest_path)
helper = Path(__file__).with_name('compare-pair.mts').resolve()
inputs = []
for case in manifest['cases']:
    files = {key: (manifest_path.parent / case[key]).resolve() for key in ['left', 'right', 'changes', 'identity']}
    hashes = {key: sha(file) for key, file in files.items()}
    if hashes != case['sha256']:
        raise SystemExit(f"Frozen input SHA-256 mismatch: {case['id']}")
    inputs.append((case, files, hashes))
out.mkdir(parents=True, exist_ok=False)
git = lambda *cmd: subprocess.run(['git', *cmd], cwd=repo, capture_output=True, text=True).stdout.strip()
report = {'suiteVersion': manifest['suiteVersion'], 'baselineCode': manifest['baselineCode'],
          'actualCommit': git('rev-parse', 'HEAD'), 'gitStatus': git('status', '--porcelain'),
          'manifestSha256': sha(manifest_path), 'helperSha256': sha(helper), 'runnerSha256': sha(Path(__file__)),
          'purpose': 'Execution and raw evidence only; manual expectations remain to be reviewed.', 'records': []}

def invoke(command, directory, name):
    with (directory / f'{name}.stdout.log').open('w') as stdout, (directory / f'{name}.stderr.log').open('w') as stderr:
        run = subprocess.run(command, cwd=repo, stdout=stdout, stderr=stderr)
    return {'command': command, 'cwd': str(repo), 'exitCode': run.returncode}

for case, files, hashes in inputs:
    for engine in (['pdfjs', 'mupdf'] if args.engine == 'both' else [args.engine]):
        directory = out / case['id'] / engine
        directory.mkdir(parents=True)
        command = ['node', '--import', 'tsx', str(helper), '--repo', str(repo), '--engine', engine,
                   '--left', str(files['left']), '--right', str(files['right']), '--out', str(directory)]
        record = {'case': case['id'], 'engine': engine, 'sha256': hashes, 'evidenceDirectory': str(directory),
                  'compare': invoke(command, directory, 'compare'), 'triage': None}
        if record['compare']['exitCode'] in (0, 2) and (directory / 'result.json').exists():
            result = read(directory / 'result.json')
            record.update(status=result['status'], coreVersion=result.get('coreVersion'),
                          extractors=result.get('extractors'), differences=len(result['differences']),
                          coverage=len(result['coverage']), unresolved=len(result['unresolved']))
            command = [sys.executable, str(repo / 'scripts/renewal-triage.py'), str(files['changes']),
                       str(directory / 'result.json'), '--identity', str(files['identity']),
                       '--events', str(directory / 'triage-events.json')]
            record['triage'] = invoke(command, directory, 'triage')
            if record['triage']['exitCode'] == 0:
                (directory / 'triage.stdout.log').rename(directory / 'triage-summary.json')
                record['triageSummary'] = read(directory / 'triage-summary.json')
        report['records'].append(record)
        (out / 'run-summary.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps({k: record[k] for k in ['case', 'engine', 'compare', 'triage']}, ensure_ascii=False))
sys.exit(any(r['compare']['exitCode'] not in (0, 2) or not r['triage'] or r['triage']['exitCode'] != 0
             for r in report['records']))
