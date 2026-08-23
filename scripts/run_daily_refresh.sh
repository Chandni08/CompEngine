#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT="${COMPETITION_ENGINE_ROOT:-$(dirname -- "$SCRIPT_DIR")}" # Repository root; override for non-standard installs.
PYTHON="${COMPETITION_ENGINE_PYTHON:-$(command -v python3 || true)}"
LOG_DIR="$ROOT/logs"
LOCK_DIR="$LOG_DIR/.daily-refresh.lock"
PUBLISH=1

case "${1:-}" in
  "") ;;
  --refresh-only) PUBLISH=0 ;;
  *)
    echo "Usage: $0 [--refresh-only]" >&2
    exit 2
    ;;
esac

mkdir -p "$LOG_DIR"
cd "$ROOT" || exit 1

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  existing_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "$(date -Iseconds) Daily refresh already running as PID $existing_pid; skipping duplicate trigger"
    exit 0
  fi
  rm -f "$LOCK_DIR/pid"
  rmdir "$LOCK_DIR" 2>/dev/null || true
  mkdir "$LOCK_DIR" || exit 1
fi
echo $$ > "$LOCK_DIR/pid"
cleanup_lock() {
  rm -f "$LOCK_DIR/pid"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup_lock EXIT INT TERM

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export AGILENT_HEADED="${AGILENT_HEADED:-1}"

if [[ -z "$PYTHON" || ! -x "$PYTHON" ]]; then
  echo "$(date -Iseconds) Daily refresh failed: no Python 3 executable was found" >&2
  exit 1
fi

echo "$(date -Iseconds) Starting daily competitive-intelligence refresh"
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -i "$PYTHON" "$ROOT/scripts/refresh_daily.py"
else
  "$PYTHON" "$ROOT/scripts/refresh_daily.py"
fi
refresh_status=$?
if [[ $refresh_status -ne 0 ]]; then
  echo "$(date -Iseconds) Daily refresh failed validation; the live site was not changed" >&2
  exit $refresh_status
fi

if [[ $PUBLISH -eq 0 ]]; then
  echo "$(date -Iseconds) Daily refresh passed; publication is delegated to the calling scheduler"
  exit 0
fi

echo "$(date -Iseconds) Daily refresh passed; publishing validated data"
"$ROOT/scripts/deploy_refreshed_site.sh"
deploy_status=$?
echo "$(date -Iseconds) Daily refresh and deployment finished with status $deploy_status"
exit $deploy_status
