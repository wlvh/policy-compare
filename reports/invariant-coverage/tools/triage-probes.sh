#!/usr/bin/env bash
# Runs every Python triage probe under reports/invariant-coverage/*/probes against one checkout.
# Usage, from the repository root: triage-probes.sh <directory holding tests/ and scripts/>
set -u
cd "$(git rev-parse --show-toplevel)"
for p in $(ls reports/invariant-coverage/*/probes/*.py | sort); do
  echo "## $p"; python3 -I "$p" "$1" 2>&1
done
