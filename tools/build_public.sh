#!/bin/sh
# Copies ONLY the app's own files into public/, which is all Firebase Hosting publishes.
# Anything not listed here (team exports, notes, git history) can never go online.
# Runs automatically before every `firebase deploy` / `hosting:channel:deploy` (see firebase.json).
set -e
cd "$(dirname "$0")/.."
rm -rf public
mkdir -p public/icons
for f in index.html firebase-config.js manifest.webmanifest sw.js privacy.html terms.html legal.css \
         icons/icon.svg icons/icon-192.png icons/icon-512.png icons/apple-touch-icon.png; do
  cp "$f" "public/$f"
done
echo "public/: $(find public -type f | wc -l | tr -d ' ') files"
