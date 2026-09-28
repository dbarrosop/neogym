#!/usr/bin/env bash
set -euo pipefail
exec /usr/bin/python3 "$(dirname "$0")/verify-release-archive.py" "$@"
