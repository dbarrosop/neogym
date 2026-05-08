#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/backend"

exec nhost \
    --local-subdomain 192-168-1-108 \
    up \
    --apply-seeds \
    --run-service nhost/run-mcp.toml \
    "$@"
