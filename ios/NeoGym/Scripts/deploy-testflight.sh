#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

unset SDKROOT CC CXX LD AR LDFLAGS
DEVELOPER_DIR="$(
	python3 - "$ROOT/Scripts/read-build-settings.py" <<'PY'
import importlib.util
import os
import sys
from pathlib import Path

path = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("neogym_read_build_settings", path)
if spec is None or spec.loader is None:
    raise SystemExit(1)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
try:
    print(module.select_developer_dir(os.environ.copy()))
except (OSError, RuntimeError):
    raise SystemExit(1)
PY
)" || {
	echo "deployment error: compatible Xcode is unavailable" >&2
	exit 1
}
export DEVELOPER_DIR

arguments=(beta environment:production)
if [[ -n "${VERSION:-}" ]]; then
	arguments+=("version:$VERSION")
fi

fastlane "${arguments[@]}"
