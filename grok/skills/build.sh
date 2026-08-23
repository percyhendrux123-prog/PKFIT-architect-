#!/usr/bin/env bash
# Packages each PKFIT skill as a zip for upload at grok.com/skills.
# Usage: ./build.sh   → writes dist/<name>.zip
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist
for d in pkfit-*/; do
  name="${d%/}"
  (cd "$name" && zip -qr "../dist/${name}.zip" .)
  echo "packaged dist/${name}.zip"
done
