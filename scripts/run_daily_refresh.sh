#!/bin/zsh

set -u

ROOT="/Users/chandni/Documents/CompetitionEngine"
PYTHON="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
LOG_DIR="$ROOT/logs"

mkdir -p "$LOG_DIR"
cd "$ROOT" || exit 1

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Library/Frameworks/Python.framework/Versions/3.14/bin"
export AGILENT_HEADED="1"

if [[ ! -x "$PYTHON" ]]; then
  echo "$(date -Iseconds) Daily refresh failed: Python executable not found at $PYTHON" >&2
  exit 1
fi

echo "$(date -Iseconds) Starting daily competitive-intelligence refresh"
/usr/bin/caffeinate -i "$PYTHON" "$ROOT/scripts/refresh_daily.py"
refresh_status=$?
echo "$(date -Iseconds) Daily refresh finished with status $refresh_status"
exit $refresh_status
