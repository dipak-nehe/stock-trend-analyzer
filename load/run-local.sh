#!/bin/sh
# Runs a k6 script against the local test server (saved SEC filings, no network) and saves k6's HTML report.
#   npm run load                  API load test (load/ramp.js): 7 steps of 1 minute
#   npm run load:ui               browser load test (load/ui-ramp.js)
#   STEP=20s npm run load         quick run
#   LEVELS=3,6,9 npm run load:ui  other user levels (default 5,10,15)
set -eu                                  # stop at the first error; treat unset variables as errors
cd "$(dirname "$0")/.."                  # run from the project root, wherever it's called from

# Start the test server in the background on port 8765: the real Python server, with SEC replaced by the saved
# filings in tests/fixtures. Use the project's virtualenv Python if there is one.
PY=.venv/bin/python; [ -x "$PY" ] || PY=python3
PORT=8765 "$PY" tests/e2e_server.py >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT     # stop the server when this script ends, even if k6 fails

# Wait up to 5 s for the server to answer before starting the load.
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -sf -o /dev/null http://127.0.0.1:8765/ && break; sleep 0.5; done

# Which k6 script to run (npm run load:ui sets the browser one) and where to save its HTML report.
SCRIPT="${SCRIPT:-load/ramp.js}"
REPORT="${REPORT:-load/report.html}"
# K6_WEB_DASHBOARD_EXPORT saves k6's dashboard as one HTML file at the end; extra arguments go to k6 run.
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT="$REPORT" k6 run "$@" "$SCRIPT"
echo "HTML report: $REPORT"
