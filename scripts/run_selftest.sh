#!/usr/bin/env bash
# Headless-Chrome selftest: loads index.html?selftest=1, lets the scripted
# playthrough run, and prints #selftest-report. Exit code reflects PASS/FAIL.
set -uo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ -n "${CHROME_OVERRIDE:-}" ]; then CHROME="$CHROME_OVERRIDE"; fi
mkdir -p logs
URL="file://$PWD/index.html?selftest=1"
"$CHROME" --headless=new --disable-gpu --enable-logging=stderr --no-first-run --window-size=900,620 \
  --virtual-time-budget=300000 --dump-dom "$URL" > logs/selftest-dom.html 2> logs/selftest-console.log || true
# also surface any console errors
grep -Eo 'SELFTEST (PASS|FAIL|CRASH)' logs/selftest-dom.html | tail -1 || echo "SELFTEST NOT REPORTED"
if grep -q "SELFTEST PASS" logs/selftest-dom.html; then
  echo "selftest: PASS"; exit 0
else
  echo "selftest: FAIL (see logs/selftest-dom.html, logs/selftest-console.log)"
  # extract report text for convenience
  perl -0ne 'print $1 if /id="selftest-report"[^>]*>(.*?)<\/pre>/s' logs/selftest-dom.html | head -80
  exit 1
fi
