# Saved from the issue-2 session scratch directory at handoff. OUT/scratch defaults to tmp/issue-2-chain
# (ignored by git); set NODE_ENV_SH to a file that puts Node 24 on PATH if the default node is older.
# Compare two checkpoints: renewal results (minus version/timing), triage events, rules, retriage.
import json, sys, os, glob
P = 'reports/issue-2-validation'
old, new = sys.argv[1], sys.argv[2]
S = os.path.dirname(os.path.abspath(__file__))
def strip(x, drop=('coreVersion', 'generatedAt', 'seconds', 'tool', 'testedCommit', 'commit', 'path', 'sha256', 'resultSha256', 'durationMs', 'elapsedMs', 'ms', 'maxMs', 'finishedAt', 'startedAt')):
    if isinstance(x, dict): return {k: strip(v, drop) for k, v in x.items() if k not in drop}
    if isinstance(x, list): return [strip(v, drop) for v in x]
    return x
o, n = glob.glob(f'{P}/{old}*')[0], glob.glob(f'{P}/{new}*')[0]
for c in ['aviation_2024_vs_2025', 'bizav_2024_vs_2025']:
    for e in ['mupdf', 'pdfjs']:
        a, b = json.load(open(f'{o}/{c}-{e}.json')), json.load(open(f'{n}/{c}-{e}.json'))
        ea, eb = json.load(open(f'{o}/{c}-{e}.events.json')), json.load(open(f'{n}/{c}-{e}.events.json'))
        print(c, e, 'result', 'same' if strip(a) == strip(b) else 'DIFF', '| events', 'same' if strip(ea) == strip(eb) else 'DIFF')
for e in ['mupdf', 'pdfjs']:
    a, b = json.load(open(f'{o}/regression/rules-{e}.json')), json.load(open(f'{n}/regression/rules-{e}.json'))
    print('rules', e, 'same' if strip(a) == strip(b) else 'DIFF', b.get('summary', '') if isinstance(b, dict) else '')
