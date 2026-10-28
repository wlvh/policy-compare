#!/usr/bin/env bash
# Run the current R26/R11 counterexamples against an earlier scorer (default: the fixed start 2ff585b).
# With the test file at c5acdb8:
#   before-fix.sh            -> 18 fail: every wrong-card counterexample, plus the MSN guard (no invariant results yet)
#   before-fix.sh d61461b    -> 13 fail: bare numbers, field mislabels, per-digit, whole-row and partial-cell citations, delete/add swaps
#   before-fix.sh 7ea1fb3    -> 10 fail: field mislabels, per-digit, whole-row and partial-cell citations, delete/add swaps
#   before-fix.sh 74783d6    -> 8 fail: field mislabels, per-digit, whole-row and partial-cell citations
#   before-fix.sh fececbf    -> 4 fail: per-digit and whole-row citations
#   before-fix.sh 28afbd1    -> 3 fail: the whole-row citations
#   before-fix.sh 55e669a    -> 1 fails: only the partial-cell citation (a regression of 55e669a)
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
