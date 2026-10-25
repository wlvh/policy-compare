#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
POLICY_NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
if [[ "$POLICY_NODE_MAJOR" != 24 ]]; then
  POLICY_NODE_BIN="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
  if [[ -x "$POLICY_NODE_BIN/node" ]] && [[ "$("$POLICY_NODE_BIN/node" -p 'process.versions.node.split(".")[0]')" == 24 ]]; then
    export PATH="$POLICY_NODE_BIN:$PATH"
  else
    echo '需要 Node 24 LTS。此脚本不会修改系统 Node 安装。' >&2
    exit 1
  fi
fi
exec pnpm "$@"
