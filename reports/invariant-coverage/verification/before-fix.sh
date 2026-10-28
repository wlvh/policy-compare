#!/usr/bin/env bash
# Run this change's R26/R11 counterexamples against the scorer at the fixed start 2ff585b.
# Expected: the four "plus a wrong ... card fails" tests fail with "expected 'PASS' to be 'FAIL'".
set -u
repo=$(git rev-parse --show-toplevel)
dir=$(mktemp -d)
git -C "$repo" worktree add --detach "$dir" 2ff585bce56e5b43a6fb00572ad9d99b98e4fefc >/dev/null
ln -s "$repo/node_modules" "$dir/node_modules"
cp "$repo/tests/scorer.test.ts" "$dir/tests/scorer.test.ts"
(cd "$dir" && pnpm exec vitest run tests/scorer.test.ts -t "one correct event card cannot offset" --reporter verbose)
status=$?
git -C "$repo" worktree remove --force "$dir"
exit $status
