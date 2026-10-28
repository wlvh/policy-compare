#!/usr/bin/env bash
# Run the current R26/R11 counterexamples against an earlier scorer (default: the fixed start 2ff585b).
# With the test file at 8ca503f, failures per earlier scorer (logs in reports/invariant-coverage/8ca503f/):
#   before-fix.sh            -> 22 (every wrong-card counterexample, plus the MSN guard: no invariant results yet)
#   before-fix.sh d61461b    -> 17    before-fix.sh 7ea1fb3 -> 14    before-fix.sh 74783d6 -> 12
#   before-fix.sh fececbf    -> 7     before-fix.sh 28afbd1 -> 6     before-fix.sh 55e669a -> 5
#   before-fix.sh c5acdb8    -> 4: reordered glyphs, run-level geometry, partial claims via delete + add cards
#   before-fix.sh f2d953f    -> 1: partial claims via delete + add cards
set -u
repo=$(git rev-parse --show-toplevel)
dir=$(mktemp -d)
git -C "$repo" worktree add --detach "$dir" "${1:-2ff585bce56e5b43a6fb00572ad9d99b98e4fefc}" >/dev/null
ln -s "$repo/node_modules" "$dir/node_modules"
cp "$repo/tests/scorer.test.ts" "$dir/tests/scorer.test.ts"
(cd "$dir" && pnpm exec vitest run tests/scorer.test.ts -t "one correct event card cannot offset" --reporter verbose)
status=$?
git -C "$repo" worktree remove --force "$dir"
exit $status
