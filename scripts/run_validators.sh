#!/usr/bin/env bash
# Node content validators: data references and map reachability.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
echo "=== validate_data ==="
node validators/validate_data.js | tee logs/validate_data.log
echo "=== validate_maps ==="
node validators/validate_maps.js | tee logs/validate_maps.log
echo "validators: OK"
