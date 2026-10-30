#!/usr/bin/env bash
# Saved from the issue-2 session scratch directory at handoff. OUT/scratch defaults to tmp/issue-2-chain
# (ignored by git); set NODE_ENV_SH to a file that puts Node 24 on PATH if the default node is older.
# Four renewal comparisons on the working tree into OUT, then triage, then compare with REF evidence.
set -u
cd "$(git rev-parse --show-toplevel)"
[ -n "${NODE_ENV_SH:-}" ] && source "$NODE_ENV_SH"
OUT=$1; REF=$2; mkdir -p $OUT
I=tmp/renewal-inputs/testdata/renewal
for e in mupdf pdfjs; do for c in aviation_2024_vs_2025 bizav_2024_vs_2025; do
  pnpm exec tsx packages/cli/run.ts --engine $e --left $I/$c/left.pdf --right $I/$c/right.pdf --out $OUT/$c-$e.json > /dev/null 2>$OUT/$c-$e.err &
done; done; wait
for e in mupdf pdfjs; do for c in aviation_2024_vs_2025 bizav_2024_vs_2025; do
  python3 scripts/renewal-triage.py $I/$c/changes.json $OUT/$c-$e.json --events $OUT/$c-$e.events.json --identity scripts/renewal-identity.json > $OUT/$c-$e.summary.json
done; done
python3 - $OUT $REF <<'PY'
import json, sys
def strip(x, drop=('coreVersion','generatedAt','seconds','tool','durationMs','elapsedMs')):
    if isinstance(x, dict): return {k: strip(v, drop) for k, v in x.items() if k not in drop}
    if isinstance(x, list): return [strip(v, drop) for v in x]
    return x
o, r = sys.argv[1], sys.argv[2]
for c in ['aviation_2024_vs_2025', 'bizav_2024_vs_2025']:
    for e in ['mupdf', 'pdfjs']:
        a, b = json.load(open(f'{r}/{c}-{e}.json')), json.load(open(f'{o}/{c}-{e}.json'))
        ea, eb = json.load(open(f'{r}/{c}-{e}.events.json')), json.load(open(f'{o}/{c}-{e}.events.json'))
        print(c, e, 'result', 'same' if strip(a) == strip(b) else 'DIFF', '| events', 'same' if strip(ea) == strip(eb) else 'DIFF')
PY
