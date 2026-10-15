# Match Day

A touchline app for grassroots football coaches: fixtures, line-ups, drag-and-drop subs,
live scores, playing time per player, awards, and a season record. Built for
Winscombe U9 Girls (5-a-side tournaments of 6 games); works for any team size from 3 to 11.

## What's here

| File | What it is |
|---|---|
| `index.html` | The whole app: one self-contained page (HTML, CSS and JavaScript) |
| `tools/make_copy.py` | Makes a blank copy for another team (`python3 tools/make_copy.py "Sven's Team Match Day" sven.html`) |

## Running it on your Mac

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Outside Claude the header shows **Not syncing**: everything works, but changes live only in
that browser tab and are lost on reload.

## How it stores data today

The live version runs as a Claude artifact. It uses three Claude runtime features through
`window.claude.use(...)`:

- `db`: shared, live storage, so every coach sees the same squad, games and subs.
  Documents: `club/settings`, `club/squad`, `club/tournament`, `games/g1..g10`,
  `awards/<id>`, `archive/<id>`.
- `user`: whether the viewer may edit.
- `sample`: reading a team-sheet photo with Claude to fill in fixtures.

All of this is in the `/* ---------- saving ---------- */` and `/* connect */` sections of
`index.html`. To run it as a standalone app, swap those calls for your own backend.

## Running it outside Claude with Firebase (free plan)

Outside Claude the app saves to Firebase Firestore, so every coach on a team sees the same
squad and games live, and it keeps working with no signal (changes upload when it's back).
Each phone signs in anonymously, with no passwords. A coach creates a team and gets a 6-character
invite code, and other coaches join with that code. Teams can't see each other's data.

| File | What it is |
|---|---|
| `firebase-config.js` | Which Firebase project to use. Empty `apiKey` = run without syncing. |
| `firestore.rules` | Who can read and write what. Paste into the Firebase console. |

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
