#!/bin/zsh

set -u

ROOT="/Users/chandni/Documents/CompetitionEngine"
PYTHON="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
LOG_DIR="$ROOT/logs"
LOCK_DIR="$LOG_DIR/.daily-refresh.lock"

mkdir -p "$LOG_DIR"
cd "$ROOT" || exit 1

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  existing_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "$(date -Iseconds) Daily refresh already running as PID $existing_pid; skipping duplicate trigger"
    exit 0
  fi
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" || exit 1
fi
echo $$ > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR"' EXIT INT TERM

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Library/Frameworks/Python.framework/Versions/3.14/bin"
export AGILENT_HEADED="1"

if [[ ! -x "$PYTHON" ]]; then
  echo "$(date -Iseconds) Daily refresh failed: Python executable not found at $PYTHON" >&2
  exit 1
fi

echo "$(date -Iseconds) Starting daily competitive-intelligence refresh"
/usr/bin/caffeinate -i "$PYTHON" "$ROOT/scripts/refresh_daily.py"
refresh_status=$?
if [[ $refresh_status -ne 0 ]]; then
  echo "$(date -Iseconds) Daily refresh failed validation; the live site was not changed" >&2
  exit $refresh_status
fi

echo "$(date -Iseconds) Daily refresh passed; publishing validated data"
/bin/zsh "$ROOT/scripts/deploy_refreshed_site.sh"
deploy_status=$?
echo "$(date -Iseconds) Daily refresh and deployment finished with status $deploy_status"
exit $deploy_status
