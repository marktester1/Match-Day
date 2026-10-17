#!/bin/sh
# Builds the beta copy of the website (site-beta/, not committed) from site/: the same page, but its
# buttons open the beta app, with a "Beta, for testers" banner and kept out of search engines.
# Publish: sh tools/build_site_beta.sh && firebase deploy --only hosting --config site-beta/firebase.json --project match-day-beta-17b23
# The live-facing copy is site/ (matchday-website-preview.web.app).
set -e
cd "$(dirname "$0")/.."
rm -rf site-beta
mkdir -p site-beta/img
cp site/img/*.png site-beta/img/
sed -e 's#https://match-day-17b23.web.app#https://match-day-beta-17b23.web.app#g' \
    -e 's#<meta name="viewport"#<meta name="robots" content="noindex,nofollow">\
<meta name="viewport"#' \
    -e 's#<title>Match Day#<title>Match Day (beta)#' \
    -e 's#<header class="hero">#<div class="betabar"><b>Beta, for testers.</b> This version opens the beta app, with its own test data. Coaches using Match Day for real: <a href="https://matchday-website-preview.web.app">go to the main site</a>.</div>\
<header class="hero">#' \
    -e 's#^\.hero{#.betabar{background:\#b06a10;color:\#fff;text-align:center;padding:10px 16px;font-size:15px}.betabar a{color:\#fff;font-weight:700}\
.hero{#' \
    site/index.html > site-beta/index.html
sed -e 's#"site": "matchday-website-preview"#"site": "matchday-website-beta"#' \
    -e 's#https://match-day-17b23.web.app#https://match-day-beta-17b23.web.app#g' \
    site/firebase.json > site-beta/firebase.json
grep -q 'match-day-beta-17b23.web.app' site-beta/index.html
! grep -q 'href="https://match-day-17b23.web.app"' site-beta/index.html
echo "site-beta built"
