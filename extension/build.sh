#!/bin/sh
# Builds the Chrome Web Store zip. Never ships key.local.json (your API key) or test files.
set -e
cd "$(dirname "$0")"
if grep -q REPLACE_ME ui.js; then echo "ABORT: set SERVER in ui.js to the deployed Worker URL first"; exit 1; fi
v=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
out="../dist/review-lens-$v.zip"
mkdir -p ../dist && rm -f "$out"
zip -qr "$out" manifest.json *.html *.js *.css icons -x key.local.json -x test.mjs
if unzip -l "$out" | grep -q key.local; then rm "$out"; echo "ABORT: key file in zip"; exit 1; fi
unzip -l "$out"
echo "built $out"
