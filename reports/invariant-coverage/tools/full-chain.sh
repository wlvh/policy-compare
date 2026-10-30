#!/usr/bin/env bash
# Full joint chain, as run for the joint tree 88718d0: the scorer chain, PDF and review checks, the
# full browser suite, then renewal re-extraction on both engines and triage. Needs the renewal
# samples in tmp/renewal-inputs (scripts/fetch-renewal-samples.mjs).
# Usage, from the repository root: full-chain.sh <name> <directory for the product result JSONs>
set -u
cd "$(git rev-parse --show-toplevel)"
V=reports/invariant-coverage/$1; OUT=$2
mkdir -p "$V/renewal" "$OUT" tmp
cp reports/invariant-coverage/tools/playwright.local.config.ts tmp/playwright.local.config.ts
{ echo "commit $(git rev-parse HEAD)"; node --version; pnpm --version; python3 --version; } > "$V/tool-versions.txt"
pnpm exec vitest run tests/scorer.test.ts > "$V/vitest-scorer.log" 2>&1; echo "exit $?" >> "$V/vitest-scorer.log"
python3 -m unittest discover -s tests -p 'test_renewal_triage.py' > "$V/unittest-renewal-triage.log" 2>&1; echo "exit $?" >> "$V/unittest-renewal-triage.log"
pnpm verify:core > "$V/verify-core.log" 2>&1; echo "exit $?" >> "$V/verify-core.log"; cp reports/core-tests.json "$V/core-tests.json"
npx tsc --noEmit > "$V/tsc.log" 2>&1; echo "exit $?" >> "$V/tsc.log"
for e in mupdf pdfjs; do pnpm test:rules:$e > "$V/rules-$e.log" 2>&1; echo "exit $?" >> "$V/rules-$e.log"; cp reports/rules-$e.json "$V/rules-$e.json"; done
for e in mupdf pdfjs; do
  pnpm build:$e > "$V/build-$e.log" 2>&1; echo "exit $?" >> "$V/build-$e.log"
  pnpm exec tsx scripts/pdf-check.ts $e > "$V/pdf-check-$e.log" 2>&1; echo "exit $?" >> "$V/pdf-check-$e.log"
  pnpm exec tsx scripts/review-check.ts $e > "$V/review-check-$e.log" 2>&1; echo "exit $?" >> "$V/review-check-$e.log"
  POLICY_ENGINE=$e pnpm exec playwright test -c tmp/playwright.local.config.ts > "$V/browser-$e.log" 2>&1; echo "exit $?" >> "$V/browser-$e.log"
  cp reports/browser-rules-$e.json "$V/browser-rules-$e.json" 2>/dev/null
done
for e in mupdf pdfjs; do for c in aviation_2024_vs_2025 bizav_2024_vs_2025; do
  pnpm exec tsx packages/cli/run.ts --engine "$e" --left tmp/renewal-inputs/testdata/renewal/$c/left.pdf --right tmp/renewal-inputs/testdata/renewal/$c/right.pdf --out "$OUT/$c-$e.json" > "$V/renewal/$c-$e.stdout.txt" 2> "$V/renewal/$c-$e.stderr.txt"
  echo "exit $?" >> "$V/renewal/$c-$e.stdout.txt"
  sha256sum "$OUT/$c-$e.json" | cut -d' ' -f1 > "$V/renewal/$c-$e.result.sha256"
  python3 scripts/renewal-triage.py tmp/renewal-inputs/testdata/renewal/$c/changes.json "$OUT/$c-$e.json" --events "$V/renewal/$c-$e.events.json" --identity scripts/renewal-identity.json > "$V/renewal/$c-$e.summary.json"
  echo "$c $e triage exit $?" >> "$V/renewal/triage-exit.txt"
done; done
git restore reports/ ":!reports/invariant-coverage" 2>/dev/null
git clean -fdq reports/failures 2>/dev/null
