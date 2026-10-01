#!/bin/sh
# Runs a k6 script against the local test server (saved SEC filings, no network) and saves k6's HTML report.
#   npm run load                  API load test (load/ramp.js): 7 steps of 1 minute
#   npm run load:ui               browser load test (load/ui-ramp.js)
#   STEP=20s npm run load         quick run
set -eu
cd "$(dirname "$0")/.."
PY=.venv/bin/python; [ -x "$PY" ] || PY=python3
PORT=8765 "$PY" tests/e2e_server.py >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -sf -o /dev/null http://127.0.0.1:8765/ && break; sleep 0.5; done
SCRIPT="${SCRIPT:-load/ramp.js}"
REPORT="${REPORT:-load/report.html}"
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT="$REPORT" k6 run "$@" "$SCRIPT"
echo "HTML report: $REPORT"
