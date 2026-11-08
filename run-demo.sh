#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"

npm test

node server.mjs &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM

for _ in {1..20}; do
  if curl --silent --fail http://localhost:4173 >/dev/null; then
    break
  fi
  sleep 0.1
done

open http://localhost:4173
wait "$server_pid"
