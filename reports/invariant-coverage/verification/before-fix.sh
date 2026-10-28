#!/usr/bin/env bash
# Run the current R26/R11 counterexamples against an earlier scorer (default: the fixed start 2ff585b).
# With the test file at 402e66e, failures per earlier scorer (logs in reports/invariant-coverage/402e66e/):
#   before-fix.sh            -> 24 (every wrong-card counterexample, plus the MSN guard: no invariant results yet)
#   before-fix.sh d61461b    -> 19    before-fix.sh 7ea1fb3 -> 16    before-fix.sh 74783d6 -> 14
#   before-fix.sh fececbf    -> 9     before-fix.sh 28afbd1 -> 8     before-fix.sh 55e669a -> 7
#   before-fix.sh c5acdb8    -> 6     before-fix.sh f2d953f -> 3     before-fix.sh 8ca503f -> 2
#   before-fix.sh bb85bc4    -> 1: a declared-field claim split across delete/add cards
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
