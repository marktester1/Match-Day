# Match Day

Club coaches use the live app at https://match-day-17b23.web.app with real team data.
README.md has the setup and release commands.

## Releases: always beta first

- Beta is a separate Firebase project (`match-day-beta-17b23`, https://match-day-beta-17b23.web.app)
  with its own database and sign-ins. `firebase-config.js` picks live or beta from the address,
  so the same files run on both; localhost uses beta.
- Never publish straight to live. Every change goes to beta first
  (`firebase deploy --only hosting --project beta`), and the user is given the beta link to
  test before anything is promoted.
- Promote to live only when the user says so, and only by copying the tested beta
  (`firebase hosting:clone match-day-beta-17b23:live match-day-17b23:live`). If a cross-project
  clone isn't possible, deploy the same commit with `firebase deploy --only hosting --project live`
  and check live's index.html matches beta's byte for byte.
- Each release: bump `APP_VERSION` in index.html and `CACHE` in sw.js, merge to `main`, tag `vX.Y.Z`.
- Release checks: run `node tools/release-check.cjs pre` before promoting (all PASS except the
  expected "live rules differ" when the release changes rules), then rules to live, then
  `hosting:clone`, then `node tools/release-check.cjs post` (must be all PASS).
- Rules changes go to beta first too (and a release that needs a new rule must not reach live before the rule does): `firebase deploy --only firestore:rules --project beta`, then
  `--project live` with the user's go-ahead.
- The Beta Test Team (code `L9J-Q7H`) is the user's to play with: don't change its data. Claude's own
  automated checks use **Claude Test Team** (code `4VT-AWE`), opened at http://127.0.0.1:8000 (beta data). The old Test Team (code `L83-LTJ`)
  is in the live database from before the split; don't use it.
- Match Day is web-app only: no Claude artifact version, no `window.claude` code.
- Hosting publishes only `public/`, built from the allowlist in `tools/build_public.sh` (runs as
  predeploy). Add new app files there; never widen it to the whole folder. `exports/` holds
  children's names and must never be published or committed.

## Data

- Coaches' data is in Firestore (`teams/{teamId}/...`). Changes may add fields but never rename
  or remove them; restore must keep reading old backups.
- `firestore.rules` changes are published separately (`firebase deploy --only firestore:rules`)
  and need the user's go-ahead, since they apply to live data immediately.

## Style

- App text is British English (football terms: kick-off, full time, pitch, fixtures, "v" not "vs"; dates as Thu 15 Oct).
