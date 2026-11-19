#!/usr/bin/env bash
# Screenshots of real play scenes into docs/screens/.
set -uo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mkdir -p docs/screens logs/screens
for scene in menu town dungeon combat overland campaign; do
  "$CHROME" --headless=new --disable-gpu --no-first-run --window-size=900,620 \
    --hide-scrollbars --virtual-time-budget=9000 \
    --screenshot="docs/screens/$scene.png" \
    "file://$PWD/index.html?scene=$scene" > "logs/screens/$scene.log" 2>&1 || true
  echo "shot: docs/screens/$scene.png"
done
ls -la docs/screens
