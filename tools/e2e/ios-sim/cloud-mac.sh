#!/bin/sh
# Runs every iPhone journey (two and three simulators at once) on a rented Mac, against the BETA site.
# Needs: Apple silicon, 16 GB memory or more, Xcode installed (with an iOS simulator runtime), and
# Homebrew. Nothing here signs in to anything or uses live data. Run it in Terminal on that Mac:
#
#   curl -fsSL https://raw.githubusercontent.com/marktester1/Match-Day/injury-time/tools/e2e/ios-sim/cloud-mac.sh | sh
#
# or, if the repo is already there: sh tools/e2e/ios-sim/cloud-mac.sh
# The results go to ~/matchday-ios-results.txt (send that file back).
set -e
OUT="$HOME/matchday-ios-results.txt"
say() { printf '\n== %s\n' "$1" | tee -a "$OUT"; }
: > "$OUT"

say "Checking this Mac"
sw_vers | tee -a "$OUT"
sysctl -n hw.memsize | awk '{printf "Memory: %.0f GB\n",$1/1073741824}' | tee -a "$OUT"
xcodebuild -version | head -1 | tee -a "$OUT" || { echo "Xcode isn't installed: install it from the App Store, open it once, then run this again." | tee -a "$OUT"; exit 1; }
sudo xcodebuild -license accept 2>/dev/null || true
xcodebuild -runFirstLaunch 2>/dev/null || true

say "Node.js"
command -v node >/dev/null || brew install node
node --version | tee -a "$OUT"

say "Getting Match Day (the test branch)"
DIR="$HOME/Match-Day"
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin && git -C "$DIR" checkout -q injury-time && git -C "$DIR" reset -q --hard origin/injury-time
else git clone -q --branch injury-time https://github.com/marktester1/Match-Day.git "$DIR"; fi
git -C "$DIR" log --oneline -1 | tee -a "$OUT"

say "Appium and its iPhone driver (first time ~250 MB)"
cd "$DIR/tools/e2e/ios-sim"
npm install --silent
npm run setup --silent

say "Starting the iPhone simulators"
SIMS="${SIMS:-iPhone 17,iPhone Air,iPhone 17e}"
echo "$SIMS" | tr ',' '\n' | while read -r s; do xcrun simctl boot "$s" 2>/dev/null || true; done
xcrun simctl list devices booted | tee -a "$OUT"

say "Appium (the first session builds a helper app: ~15 minutes, once)"
npm run appium > "$HOME/appium.log" 2>&1 &
APPIUM=$!
trap 'kill $APPIUM 2>/dev/null' EXIT
sleep 15

say "Every iPhone journey, against beta"
export SIMS
if npm test 2>&1 | tee -a "$OUT"; then say "ALL PASSED"; else say "SOME FAILED (see above; Appium's log is ~/appium.log)"; exit 1; fi
