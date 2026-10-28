#!/usr/bin/env bash
# Run the current R26/R11 counterexamples against an earlier scorer (default: the fixed start 2ff585b).
#   before-fix.sh            -> every "plus a wrong ... card fails" test fails with "expected 'PASS' to be 'FAIL'"
#   before-fix.sh d61461b    -> the bare-number variants and the delete/add swaps fail
#   before-fix.sh 7ea1fb3    -> only the two delete/add swap tests fail
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
