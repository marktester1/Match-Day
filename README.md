# Match Day

A touchline app for grassroots football coaches: fixtures, line-ups, drag-and-drop subs,
live scores, playing time per player, awards, and a season record. Built for
youth 5-a-side tournaments of 6 games; works for any team size from 3 to 11.

## What's here

| File | What it is |
|---|---|
| `index.html` | The whole app: one self-contained page (HTML, CSS and JavaScript) |
| `firebase-config.js` | Live and beta Firebase settings; the app picks one from its web address |
| `firestore.rules` | Who can read and write what (published to both projects) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Home-screen app: offline opening, name and whistle icon |
| `tools/build_public.sh` | The list of files that get published (runs before every publish) |
| `tools/csp.cjs` | Keeps the security policy in `firebase.json` matching index.html's script: run `node tools/csp.cjs` after editing index.html |
| `tools/make_icons.mjs` | Draws the icon and renders its sizes |

## Running it on your Mac

Serve the folder (it must be served, not opened as a file):

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

On localhost the app uses the **beta** project, so local testing never touches live data.

## How it stores data

Match Day is a web app on Firebase (free Spark plan). Every coach on a team sees the same
squad and games live, and it keeps working with no signal (changes upload when it's back).
Each phone signs in anonymously; coaches can add Google or email sign-in so their teams
follow them to a new phone. A coach creates a team and gets an 8-character invite code; other
coaches ask to join with it and a coach in the team accepts them. Teams can't see each other's data.

Firestore layout:

- `teams/{teamId}`: invite code and creator; `teams/{teamId}/members/{uid}`: who's in the team
- `teams/{teamId}/club/settings|squad|tournament`, `games/g1..g10`, `awards/<id>`, `archive/<id>`
- `codes/{CODE}`: invite code → team id
- `joins/{uid}`: the teams a sign-in is waiting to join (at most 3)
- `users/{uid}`: the teams each sign-in belongs to

## Setting up a Firebase project from scratch

One-time setup (Spark plan, no card needed):

1. Go to https://console.firebase.google.com, click **Create a project** (e.g. `match-day`).
   Google Analytics can be turned off.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Firestore Database → Create database**, location **europe-west2 (London)**,
   start in **production mode**.
4. In Firestore, open the **Rules** tab, replace everything with `firestore.rules`, click **Publish**.
5. **Project settings (cog) → Your apps → Web (`</>`)**, register an app (no hosting needed),
   and copy the `firebaseConfig` values into `firebase-config.js`.
6. Run `python3 -m http.server 8000` and open http://localhost:8000 (it must be served, not
   opened as a file).

## Publishing the web app

Live at https://match-day-17b23.web.app (Firebase Hosting, free plan). Coaches open the link
on their phone and use **Share → Add to Home Screen** (iPhone, Safari) or **⋮ → Add to Home
screen / Install app** (Android, Chrome). It then opens full-screen with its own icon, and
`sw.js` lets it open with no signal.

### Releasing a new version

Coaches' data lives in Firestore, separate from the code, so publishing never touches it.
What can hurt it is a new version that reads old data wrongly, so every release goes to a
beta link first. `main` always matches what's live.

1. Bump `APP_VERSION` in `index.html` (shown at the bottom of the Squad tab) and the cache
   name in `sw.js`.
2. Publish to beta (live is untouched):
   ```sh
   firebase deploy --only hosting --project beta
   ```
   Beta (https://match-day-beta-17b23.web.app) is its own Firebase project with its **own
   database and sign-ins**, so testing never touches coaches' data. It shows a BETA label.
3. Commit, merge to `main`, tag and push: `git tag v0.2.0 && git push --tags`.
4. Promote exactly what you tested on beta to live:
   ```sh
   firebase hosting:clone match-day-beta-17b23:live match-day-17b23:live
   ```
5. If something goes wrong: Firebase console → Hosting → release history → **Rollback**.

Security rules publish separately: `firebase deploy --only firestore:rules`.

### Testing a whole match day automatically (beta only)

`tools/e2e/` runs three journeys on the beta site with Playwright, in WebKit (Safari's engine,
iPhone screen and touch) and Chromium:

- `journey.spec.js`, a coach's whole day: create a team and squad, add players, a follower link
  open in a second browser, a 3-game tournament with fixtures, a game with goals, a sub, yellow
  and red cards and full time, new players mid-tournament, finishing with a match report and
  Results, then rugby with a try and the sin bin.
- `coach-joins.spec.js`, a second coach: opens the invite link, asks to join (a wrong code and a
  missing name first), the manager accepts, then the new coach sets up the day and starts a
  match while the manager's phone follows it live and makes a sub.
- `follower.spec.js`, a parent with the follower link: a dead link, "No game yet", fixtures, kick-off,
  goals, a card, half time and full time (with their banners), an away game, a reload, and the
  results staying up after the tournament is saved. A second test checks "Make a new link"; it is
  marked as expected to fail until that bug is fixed (see the note in the file).

They check each step saved (by reloading), that followers never see a player's name or anything
they can change, and that "Share results" holds no names. Every phone gets a fresh sign-in, and
each test leaves the "Claude E2E …" teams it makes. It refuses to run against live and never opens
the Beta Test Team. About 3 minutes for all three in both browsers.

```sh
cd tools/e2e && npm install && npm run setup   # once: Playwright and its browsers (not published)
cd tools/e2e && npx playwright test            # all three, both browsers; or npm run test:webkit
cd tools/e2e && npx playwright test follower    # just one journey (file name)
cd tools/e2e && npm run test:phones            # iPhone 17, 16, 15, Galaxy S24, A55, Pixel 9, Z Flip 7
node tools/release-check.cjs pre --e2e         # the release checks plus these journeys
```

Set `MATCHDAY_URL=http://127.0.0.1:8000` to test a local copy (localhost uses beta data). On
a failure, `npx playwright show-trace test-results/*/trace.zip` replays every step. The phones
are Playwright's engines (WebKit for iPhones, Chromium for Android) at each phone's screen size and with touch,
not the real devices; real Safari and Chrome need the iOS Simulator or Android Emulator.

#### Real iPhone Safari in the iOS Simulator (Appium)

`tools/e2e/ios-sim/` plays the same journeys in real Mobile Safari on Xcode's iPhone simulators,
through Appium: the coach's whole match day (with a follower on a second simulator), a coach joining
with the invite code, a follower's day and a new follower link, the set-up wizard, and the manager tests (three
simulators). Beta only; each leaves the "Claude E2E Sim …" teams it makes. They use the "iPhone 17",
"iPhone Air" and "iPhone 17e" simulators (`SIMS="…,…,…"` to choose). About 11 minutes in all once Appium's helper app is built.

```sh
cd tools/e2e/ios-sim && npm install && npm run setup   # once: Appium and its iPhone driver (~250 MB)
cd tools/e2e/ios-sim && npm run appium                 # leave running; the first session builds a helper app (~15 min, once)
cd tools/e2e/ios-sim && npm test                       # in a second terminal: every journey
cd tools/e2e/ios-sim && node --test follower.test.mjs  # or just one
```

Not ported: the "Share results" text (Share opens iOS's own share sheet) and the 12-hour clock
test (it needs a fake clock). Safari's own `safaridriver` can't drive these simulators while the
Mac's Safari is a version behind iOS in Xcode, hence Appium. Safari's automation doesn't mark typed
text as an edit, so the tests fire each box's change when leaving it (see the notes in `lib.mjs`).

#### On GitHub

Every push runs the checks, the rules tests and the Playwright tests (`.github/workflows/tests.yml`).
Pushes to `main`, pull requests that change the tests, and Actions → Run workflow also run:

- **iPhone Simulator** (`ios-sim.yml`): the set-up wizard and the coach's whole day in real iPhone Safari on a GitHub Mac (the tests with a second coach or three managers need more simulators than it can start in time; run those with `npm test` on a Mac).
- **Android** (`android.yml`): every Playwright test with the coach in real Chrome on an Android
  emulator, once each at the screen of a Galaxy S24, Galaxy A55 and Pixel 9 (`ANDROID=1`, see `test.js`).

All of them serve the commit on the runner's localhost (beta data, never live) and keep only
screenshots of a failure, since the repository is public.

#### In the release checks

| | Before promoting (`pre`) | After promoting (`post`) |
|---|---|---|
| `--e2e` | Playwright journeys on beta (WebKit and Chromium, ~3 min) | |
| `--ios-sim` | every iPhone journey on beta (~11 min) | opens **live** in iPhone Safari: right version, no BETA label, start screen and legal pages |

```sh
node tools/release-check.cjs pre --e2e --ios-sim
node tools/release-check.cjs post --ios-sim
```

The journeys never run on live: they create teams, which must not happen in coaches' database. The
live check only opens the app (which signs the phone in anonymously, as for any visitor) and deletes
that sign-in afterwards. `--ios-sim` starts Appium itself if it isn't running.

### Keeping data safe between versions

- New versions may **add** fields but never rename or remove them. The app fills in missing
  fields with defaults (`blank()`, `DEFAULT_CFG`), so old games still load.
- The free plan has no automatic database backups. Coaches can use **Squad → Backup → Save a
  backup** (a JSON file of everything) and **Restore from a backup**. Restore must keep
  reading backups from older versions.
- A phone that loses its sign-in (cleared browser data, new phone) rejoins with the invite
  code; the data is safe. Email sign-in before real customers would remove that risk.

Only the files listed in `tools/build_public.sh` go online: Firebase runs it before every
publish and uploads just the `public/` folder it makes (11 files today). A new app file must be
added to that list; anything else (team exports, notes, git history) can't be published.

## Moving to a store app (plan)

1. Replace `put()` / `remove()` / the `onSnapshot` listeners with Firebase Firestore
   (London region, `europe-west2`). The document paths above map across one-to-one.
2. Add sign-in (Firebase Auth) and a team invite code so other coaches join a team.
3. Wrap the page as a mobile app (Expo / React Native, or Capacitor around the existing page).
4. Team unlock as an in-app purchase (RevenueCat to share the unlock across iOS and Android).
5. Privacy policy and support page on Cloudflare Pages; children's first names only.

## Data and privacy

No player data is stored in this repository. Squads and results live only in the app's
storage. Keep it that way: don't commit exports, screenshots or team sheets with names.
