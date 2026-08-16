#!/bin/zsh

set -eu

ROOT="${COMPETITION_ENGINE_ROOT:-/Users/chandni/Documents/CompetitionEngine}"
DEPLOY_ROOT="$ROOT/deploy-site"
VERCEL_VERSION="${VERCEL_VERSION:-57.0.0}"
WATERS_HOST="${WATERS_HOST:-waters-nextgen-competitive-engine.vercel.app}"

export CI=1
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Library/Frameworks/Python.framework/Versions/3.14/bin"

echo "$(date -Iseconds) Validating refreshed production data"
(
  cd "$DEPLOY_ROOT"
  node scripts/validate_deploy.mjs
)

echo "$(date -Iseconds) Running regression checks"
node --test "$ROOT"/tests/*.test.mjs

echo "$(date -Iseconds) Publishing refreshed data"
deployment_output=$(
  cd "$DEPLOY_ROOT"
  npx --yes "vercel@$VERCEL_VERSION" deploy --prod --yes
)
printf '%s\n' "$deployment_output"

deployment_url=$(printf '%s\n' "$deployment_output" | /usr/bin/grep -Eo 'https://[^[:space:]]+\.vercel\.app' | /usr/bin/tail -n 1)
if [[ -z "$deployment_url" ]]; then
  echo "$(date -Iseconds) Daily deployment failed: Vercel did not return a production URL" >&2
  exit 1
fi

echo "$(date -Iseconds) Pointing the Waters URL to the refreshed build"
(
  cd "$DEPLOY_ROOT"
  npx --yes "vercel@$VERCEL_VERSION" alias set "$deployment_url" "$WATERS_HOST"
)

echo "$(date -Iseconds) Verifying refreshed data on the Waters URL"
live_status=$(/usr/bin/curl --fail --silent --show-error --location --retry 10 --retry-delay 2 "https://$WATERS_HOST/data/refresh_status.json?verify=$(date +%s)")
case "$live_status" in
  *'"status": "success"'*) ;;
  *)
    echo "$(date -Iseconds) Daily deployment failed: live refresh status is not publishable" >&2
    exit 1
    ;;
esac

echo "$(date -Iseconds) Daily refresh is live at https://$WATERS_HOST/"
