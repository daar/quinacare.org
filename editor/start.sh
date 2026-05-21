#!/usr/bin/env bash
# QuinaCare Blog Editor — starts the local server, which then opens the
# editor in your browser. Equivalent to: node editor/server.mjs
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js was not found on your PATH." >&2
  echo "Install it from https://nodejs.org and run this script again." >&2
  exit 1
fi

echo "Starting the QuinaCare Blog Editor…"
exec node server.mjs
