#!/usr/bin/env bash
# Saved from the issue-2 session scratch directory at handoff. OUT/scratch defaults to tmp/issue-2-chain
# (ignored by git); set NODE_ENV_SH to a file that puts Node 24 on PATH if the default node is older.
# CI-equivalent gates on HEAD (both engines). Copies each rewritten reports/ file
# into OUT, then restores the tracked reports/ files these commands rewrote.
set -u
cd "$(git rev-parse --show-toplevel)"
[ -n "${NODE_ENV_SH:-}" ] && source "$NODE_ENV_SH"
OUT=$1; mkdir -p "$OUT"
rev=$(git rev-parse HEAD); echo "commit $rev" > "$OUT/summary.txt"
node --version >> "$OUT/summary.txt"
pnpm verify:core > "$OUT/verify-core.log" 2>&1; echo "verify:core $?" >> "$OUT/summary.txt"; cp reports/core-tests.json "$OUT/"
python3 -m unittest discover -s tests -p 'test_renewal_triage.py' -v > "$OUT/unittest-renewal-triage.log" 2>&1; echo "triage-unittest $?" >> "$OUT/summary.txt"
pnpm exec tsc --noEmit -p tsconfig.json > "$OUT/tsc.log" 2>&1; echo "tsc $?" >> "$OUT/summary.txt"
for e in pdfjs mupdf; do
  pnpm build:$e > "$OUT/build-$e.log" 2>&1; echo "build:$e $?" >> "$OUT/summary.txt"
  pnpm exec tsx scripts/pdf-check.ts $e > "$OUT/pdf-check-$e.log" 2>&1; echo "pdf-check:$e $?" >> "$OUT/summary.txt"
  pnpm test:rules:$e > "$OUT/rules-$e.log" 2>&1; echo "rules:$e $?" >> "$OUT/summary.txt"
  pnpm exec tsx scripts/review-check.ts $e > "$OUT/review-check-$e.log" 2>&1; echo "review-check:$e $?" >> "$OUT/summary.txt"
  POLICY_BROWSER_CHANNEL=bundled pnpm test:browser:$e > "$OUT/browser-$e.log" 2>&1; echo "browser:$e $?" >> "$OUT/summary.txt"
  for f in pdf-checks-$e.json rules-$e.json review-regressions-$e.json browser-tests-$e.json browser-rules-$e.json browser-review-regressions-$e.json cancellation-$e.json; do cp reports/$f "$OUT/" 2>/dev/null; done
done
git checkout -- $(git status --porcelain reports/ | awk '$1=="M" && $2 !~ /^reports\/issue-2-validation\//{print $2}') 2>/dev/null
git status --short reports/ | grep -v "issue-2-validation" >> "$OUT/summary.txt"
cat "$OUT/summary.txt"
