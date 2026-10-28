#!/usr/bin/env bash
# Four renewal comparisons (2 sample pairs x 2 engines) on the committed HEAD,
# followed by the shared triage script. Writes into
# reports/issue-2-validation/<HEAD SHA>/ and records exit codes, timings,
# environment and SHA-256 of every result. The product reads only the PDFs;
# changes.json is read only by the triage script.
set -euo pipefail
cd "$(dirname "$0")/../.."
inputs=${INPUTS:-tmp/renewal-inputs}
if [ -n "$(git status --porcelain -- packages apps engines profiles)" ]; then
  echo "product code has uncommitted changes; commit first" >&2
  exit 1
fi
rev=$(git rev-parse HEAD)
out="reports/issue-2-validation/$rev"
mkdir -p "$out"
node scripts/fetch-renewal-samples.mjs --out "$inputs" |
  python3 -c 'import json,os,sys; d=json.load(sys.stdin); d["output"]=os.path.relpath(d["output"]); print(json.dumps(d,indent=1))' > "$out/inputs.json"
runs=()
for e in mupdf pdfjs; do
  for c in aviation_2024_vs_2025 bizav_2024_vs_2025; do
    start=$(date +%s.%N)
    set +e
    pnpm exec tsx packages/cli/run.ts --engine "$e" \
      --left "$inputs/testdata/renewal/$c/left.pdf" \
      --right "$inputs/testdata/renewal/$c/right.pdf" \
      --out "$out/$c-$e.json" > "$out/$c-$e.stdout.txt" 2> "$out/$c-$e.stderr.txt"
    code=$?
    set -e
    end=$(date +%s.%N)
    python3 scripts/renewal-triage.py \
      "$inputs/testdata/renewal/$c/changes.json" \
      "$out/$c-$e.json" \
      --events "$out/$c-$e.events.json" \
      > "$out/$c-$e.summary.json"
    runs+=("{\"case\":\"$c\",\"engine\":\"$e\",\"exitCode\":$code,\"seconds\":$(python3 -c "print(round($end-$start,2))"),\"resultSha256\":\"$(sha256sum "$out/$c-$e.json" | cut -d' ' -f1)\"}")
  done
done
python3 - "$out" "$rev" "${runs[@]}" <<'PY'
import json, os, platform, subprocess, sys
out, rev, *runs = sys.argv[1:]
def cmd(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout.strip()
json.dump({
  "testedCommit": rev,
  "node": cmd("node", "--version"),
  "pnpm": cmd("pnpm", "--version"),
  "python": platform.python_version(),
  "platform": f"{platform.system()} {platform.machine()}",
  "engines": {
    "pdfjs-dist": json.load(open("engines/pdfjs/node_modules/pdfjs-dist/package.json"))["version"],
    "mupdf": json.load(open("engines/mupdf/node_modules/mupdf/package.json"))["version"],
  },
  "inputs": json.load(open(os.path.join(out, "inputs.json"))),
  "exitCodeMeaning": "0 complete_for_scope, 2 partial (coverage or unresolved groups present), 3 failed",
  "runs": [json.loads(r) for r in runs],
}, open(os.path.join(out, "environment.json"), "w"), indent=1)
PY
gzip -kf9n "$out"/*_2024_vs_2025-mupdf.json "$out"/*_2024_vs_2025-pdfjs.json
cat "$out/environment.json"
