# Match Day

Club coaches use the live app at https://match-day-17b23.web.app with real team data.
README.md has the setup and release commands.

## Releases: always beta first

- Never publish straight to live. Every change goes to the beta preview channel first
  (`firebase hosting:channel:deploy beta --expires 30d`), and the user is given the beta link to
  test before anything is promoted.
- Promote to live only when the user says so, and only by cloning the tested beta
  (`firebase hosting:clone match-day-17b23:beta match-day-17b23:live`), never by a fresh
  `firebase deploy --only hosting`.
- Each release: bump `APP_VERSION` in index.html and `CACHE` in sw.js, merge to `main`, tag `vX.Y.Z`.
- Beta and live share one Firestore database. Test with the Test Team (code `L83-LTJ`), never a club team.
- Hosting publishes only `public/`, built from the allowlist in `tools/build_public.sh` (runs as
  predeploy). Add new app files there; never widen it to the whole folder. `exports/` holds
  children's names and must never be published or committed.

## Data

- Coaches' data is in Firestore (`teams/{teamId}/...`). Changes may add fields but never rename
  or remove them; restore must keep reading old backups.
- `firestore.rules` changes are published separately (`firebase deploy --only firestore:rules`)
  and need the user's go-ahead, since they apply to live data immediately.
