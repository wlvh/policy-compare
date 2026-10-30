#!/usr/bin/env bash
# Scorer chain, as run for each scorer commit (e.g. c9c6e0c): writes logs and reports into
# reports/invariant-coverage/<name>/. Usage, from the repository root: scorer-chain.sh <name>
set -u
cd "$(git rev-parse --show-toplevel)"
V=reports/invariant-coverage/$1
mkdir -p "$V" tmp
cp reports/invariant-coverage/tools/playwright.local.config.ts tmp/playwright.local.config.ts
{ echo "commit $(git rev-parse HEAD)"; node --version; pnpm --version; } > "$V/tool-versions.txt"
pnpm exec vitest run tests/scorer.test.ts > "$V/vitest-scorer.log" 2>&1; echo "exit $?" >> "$V/vitest-scorer.log"
python3 -m unittest discover -s tests -p "test_renewal_triage.py" > "$V/unittest-renewal-triage.log" 2>&1; echo "exit $?" >> "$V/unittest-renewal-triage.log"
pnpm verify:core > "$V/verify-core.log" 2>&1; echo "exit $?" >> "$V/verify-core.log"; cp reports/core-tests.json "$V/core-tests.json"
npx tsc --noEmit > "$V/tsc.log" 2>&1; echo "exit $?" >> "$V/tsc.log"
for e in mupdf pdfjs; do pnpm test:rules:$e > "$V/rules-$e.log" 2>&1; echo "exit $?" >> "$V/rules-$e.log"; cp reports/rules-$e.json "$V/rules-$e.json"; done
for e in mupdf pdfjs; do
  pnpm build:$e > "$V/build-$e.log" 2>&1; echo "exit $?" >> "$V/build-$e.log"
  POLICY_ENGINE=$e pnpm exec playwright test -c tmp/playwright.local.config.ts tests/browser/rules.spec.ts > "$V/browser-rules-$e.log" 2>&1; echo "exit $?" >> "$V/browser-rules-$e.log"
  cp reports/browser-rules-$e.json "$V/browser-rules-$e.json" 2>/dev/null
done
# The runs rewrite tracked reports outside reports/invariant-coverage; put them back.
git restore reports/ ":!reports/invariant-coverage" 2>/dev/null
git clean -fdq reports/failures 2>/dev/null
