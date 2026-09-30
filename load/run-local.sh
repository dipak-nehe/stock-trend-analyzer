#!/bin/sh
# Runs load/ramp.js against the local test server (saved SEC filings, no network) and saves k6's HTML report.
#   npm run load                  full run: 7 steps of 1 minute
#   STEP=20s npm run load         quick run
set -eu
cd "$(dirname "$0")/.."
PY=.venv/bin/python; [ -x "$PY" ] || PY=python3
PORT=8765 "$PY" tests/e2e_server.py >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -sf -o /dev/null http://127.0.0.1:8765/ && break; sleep 0.5; done
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=load/report.html k6 run "$@" load/ramp.js
echo "HTML report: load/report.html"
