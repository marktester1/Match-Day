# Match Day backlog

Ideas and requests to pick up later. Each one goes to the beta link first (see CLAUDE.md).
"Questions" are things to agree before building.

## Waiting on testing

- **v0.23.0 on beta (review fixes), rules on beta only; live rules need the go-ahead.**
  To try: join a team (coach sees name, sign-in and email, Accept/Decline; asker sees waiting /
  not accepted); ☰ → Make a new invite code; Make manager; tap the save status; Undo after a
  goal, and after a later change; restore preview; leave with flight mode on, then reopen;
  **Google sign-in on beta** (the new enforced security policy must not block it) and
  **signing into an existing account on a phone that already has teams** (teams move across,
  the phone accepts the account; can't be tested by Claude because it needs a password).

- **v0.22.0 live:** data safety, join requests, one-tap subs, undo bar, release checks; earlier: Admin page, owner Admin page (☰ → Admin: all teams); rugby, set-up journey, home/away swap, save confirmation, edit saved
  tournaments, sections, game strip, notes, players a side, ☰ menu.
  Beta: https://match-day-beta-17b23.web.app (Beta Test Team code `L9J-Q7H`).
- **Accounts:** Google sign-in works on live. Still to try: signing in on a second phone and
  seeing the teams come back.

## From the code review (do these before more features)

**Step 1: Data safety: done on beta (v0.20.0); rules on beta only, live needs the go-ahead.**
Restore checks every field, previews the change, keeps an undo copy and writes all-or-nothing;
save-status pill (Saving… / Waiting for signal / Some changes not saved / Shared · live);
validated rules with 13 emulator tests (cd tests && npm test); sign-out and leave wipe the
phone's copy (finishing at next start if another window blocks it); backup privacy warning.
Also from scenario testing: subs checked against the live line-up (no duplicate players);
one-tap Undo bar for subs, keeper changes, goals and clock actions; Full time asks first and
shows the final score; the app opens on a live or about-to-start game.

**Joining needs a coach to accept (v0.21.0, beta): done.** The invite code only sends a
request; any coach accepts or declines (banner + ☰ dot); "X joined the team" notice; the
manager can remove a coach. Rules enforce it (14 emulator tests). Push alerts when the app is
closed are under Notifications.

**Step 2: Invite codes and review findings: done on beta (v0.23.0).** 8-character codes for
new teams; manager makes a new code (old one deleted at once) and can hand over the manager
role; a sign-in can have requests waiting in at most 3 teams (joins/{uid}); requests carry the
real sign-in email; entries inside lists (subs, goals, keeper changes, squad, notes, awards,
saved games) are checked by the rules; enforced Content-Security-Policy (script hash, no
unsafe-inline scripts: tools/csp.cjs); saves tracked per document with Try again / Dismiss;
undo names the action and refuses if the game changed since; restore preview and status;
leave / sign-out report what happened and finish removals later; switching to an existing
account moves each team before switching. 31 emulator tests.

**Deferred: needs the Blaze plan (server code) or console set-up**
- **Real rate limiting** of code look-ups and join requests (per IP / per device), e.g. a
  Cloud Function that does the code → team look-up and counts attempts, with `codes/` made
  unreadable to the app. Today: 8-character codes (~1 trillion), ≤3 waiting requests per
  sign-in, a coach must accept, but anyone can make new anonymous sign-ins (Firebase limits
  those per IP) and a team can still be sent many requests from many sign-ins.
- **Firebase App Check** (works on Spark): the user registers a reCAPTCHA v3 / Enterprise site
  key for each project in the console (Build → App Check), we add `initializeAppCheck` to the
  app (plus `https://www.google.com/recaptcha/` and `https://www.gstatic.com/recaptcha/` to the
  security policy), watch the metrics on beta for a week, then turn on enforcement for Firestore
  (beta first). Blocks scripted guessing from outside the app; not a substitute for rate limits.
- **Checking every entry of long lists**: rules can't loop, so a long list (e.g. 30 subs) is
  checked at its newest entry (squad at 7 spread-out places); a tampered app could still hide
  junk in the middle. Fix with a Cloud Function validator, or by storing subs/goals as one
  document each (a bigger change: needs a migration that keeps old backups loading).
- **Drop 6-character codes** once every team has made a new code (or after a season): then
  only 8 are accepted for new teams and joins.
- **Lost manager phone with no account**: if the manager's phone is lost and it had no
  account, nobody can remove coaches or make a new code. Options: any coach can take over when
  the manager has been inactive for N weeks (needs server time checks), or the owner's Admin
  page can reassign. For now: encourage managers to sign in (Google/email), and "Make manager".
- **style-src 'unsafe-inline'** stays (the app builds screens with style="" attributes; styles
  can't run code). Remove by moving those to classes if ever needed.
- Account switching: if moving one team fails part-way, teams already moved are in both
  sign-ins; the user just tries again. A server function could make it one step.

**Step 3: Tests and structure**
- Account recovery tests (anonymous → account, lost phone). Automated tests for subs, minutes,
  score correction, completion and restore. Schema version on stored data and backups with
  explicit migrations. Stop swallowing errors that affect access or data. Split index.html into
  modules (match logic, storage, auth, UI). Review listener lifecycles and re-renders.



1. **Parent view: live score only.** Parents follow a game's score from their own phone, with
   notifications for goals, half time and full time. No children's names, line-ups, minutes,
   notes or scorers, ever.
   - A separate parent link or code per team (or per game), different from the coaches'
     invite code, so parents can't join as coaches.
   - Data: the coaches' app copies just the score, opponent, kick-off and clock state into a
     small public-to-parents record; parents can read only that, never the team's data
     (security rule to match).
   - Notifications: web push via the app's service worker (works on Android, and on iPhone
     once the app is added to the home screen). Parents choose which alerts they want.
   - Decided:
     - One parent link per team per year (a new link each season).
     - Our goals show as just "Goal!" (no scorer name).
     - The opponent's name is shown.
     - £1 per parent per year (one season, matching the yearly link), separate from the team's
       £3.99 unlock. Keeps ~62p via the website or ~71p via the app stores after VAT and fees.
     - Auto-renewing yearly subscription (decided), in the app stores and on the website
       (merchant of record handles renewals and tax). Needs clear price and renewal terms before
       buying, a reminder before each renewal, and easy cancellation (store rules and UK
       subscription rules).

2. **Paid team unlock: £3.99 one-off per team (decided).** Free to try, then the team's
   manager pays once; coaches and parents who join with a code never pay.
   - Decide what's free (e.g. one team, one tournament) and what the unlock adds.
   - Take payment through a merchant of record (Paddle / Lemon Squeezy, ~5% + 50p) so UK and
     overseas VAT/sales tax is handled; app stores later as in-app purchase.
   - Security rule so only unlocked teams get the paid features.
   - The user sets up the payment account and bank details themselves.
   - Sell on the web first (decided direction); app stores later once coaches are paying.
   - **Founding club:** Winscombe team(s) flagged as unlocked for good in the database, so the
     loyal testers never see a paywall on any device.
   - **Voucher codes** (e.g. WINSCOMBE): unlock a team free, with a use limit and optional
     expiry. Web: merchant-of-record discount codes, or codes stored in the app's database.
     iPhone app: must use Apple offer codes instead of our own (store rule).
     - Abuse safeguards: prefer unique single-use codes per invited team (e.g. WIN-U10-7KQ3);
       shared codes only with a small use cap and an end-of-season expiry, and a limited reward
       (e.g. this season free); redeeming needs a Google/email account and works once per team;
       random 8+ character codes plus Firebase App Check against guessing; security rules enforce
       expiry, uses left, one use per team and team membership, and count down by exactly one;
       an admin list of codes and redemptions with a switch-off.

3. **Privacy policy and terms page** (needed before taking any money). First names only, adult
   coaches as users, UK/EU GDPR. Host alongside the app (README plans Cloudflare Pages).

4. **Selling internationally.** Local prices (£3.99 / €4.49 / $4.99 / A$6.99) via the merchant
   of record. Only if those markets show interest: US wording switch (soccer, field, US dates)
   and rugby league scoring (try 4, conversion 2, penalty 2, drop goal 1) next to union.
   - **App stores (international):** Apple and Google act as seller and handle VAT/sales tax in
     every country, with local prices from the £3.99 tier. Needs: Apple Developer Program (£79/yr,
     Paid Apps agreement, bank and tax forms, Small Business Program for 15%), Google Play ($25,
     closed test with ~12–20 testers for 14 days for new personal accounts). Build: Capacitor wrap
     of the same code, £3.99 unlock as an in-app purchase (store rules), Sign in with Apple
     alongside Google, store listing (screenshots, privacy label, privacy policy link, age
     rating), full Xcode on the Mac. Risk: Apple may reject thin web wrappers; offline use, live
     sync and push notifications help.

## Accessibility (from review)
- Larger text: sizes in rem so phone text-size settings apply; check every screen at 200%
  text size (nothing cut off, no sideways scrolling).
- Screen readers: label every icon-only button; announce the save status, undo bar and toasts
  as polite live regions; stop the ticking clock being read out every second; give the pitch
  and bench lists proper headings; move focus into pop-ups and back out again.
- Visible focus outlines for keyboard / switch users; dialogs close with Escape.
- Contrast: check muted grey text and the green on dark against WCAG AA in both themes.
- Clear confirmation of important actions (done: Full time, delete season, restore, remove
  coach, undo bar); keep that pattern for new features.
- Respect "reduce motion" everywhere (already for chips and the swap button).

## Release checks (run before every promote to live)
- Rules: live's deployed rules match firestore.rules (compare via the Firebase CLI).
- Sign-in: Anonymous, Email/Password and Google switched on in both projects.
- Separation: beta's app config can't read or write live (a beta sign-in is refused by live).
- Privacy: a backup holds only first names (no surnames, emails or dates of birth).
- Updates: the service worker cache name changed, and an old version picks up the new one on
  next open (no coach stuck on an old version).
- Isolation: emulator tests prove one team can't read another's data (have them; keep growing).
- Before wider release: dependency check, security headers on Firebase Hosting (CSP, HSTS,
  X-Content-Type-Options, Referrer-Policy), and Firebase usage limits / budget alert.

## Should everyone log in? (question to decide)
Today a phone can use the app with no account (anonymous sign-in); Google or email is optional.
- For requiring it: team data and access survive a lost or reset phone; the Admin page shows
  real people; join requests show a verified name; payments (team unlock, parent subscription)
  need an account to attach the purchase to; removing a coach is clear-cut; App Store review
  expects account deletion if accounts exist (add "Delete my account").
- Against: friction on a cold touchline for helpers who only need to tap subs once; parents
  and assistants may not want to share an email; more support ("I forgot which email").
- Middle ground: required for the manager (who pays and approves) and anyone who wants their
  teams on another phone; optional for helper coaches, who still need accepting by a coach.
- Needs: "Delete my account" in ☰ (also an app store rule), privacy policy wording, and a
  nudge for anonymous coaches before they lose access (e.g. when a team has games saved).

## Usability on the touchline (from review)
- Large tap targets with good spacing (check every button against ~44px).
- High contrast in bright sunlight; works in the dark.
- Don't rely on colour alone for match status (Live / Paused / Full time already have words;
  check the game strip dots and pills).
- Keep the essential controls (score, subs, clock) within thumb reach.
- Short labels, familiar football words, clear icons.
- Immediate feedback for goals, subs, clock changes and saves (undo bar and save pill cover most;
  consider a short vibration on phones).

## Season history and PDF export (requested)

- **More than one season.** Today the Season tab is one running list of saved tournaments and
  awards, and the only way to start afresh is "delete season data". Instead: a season label
  (e.g. 2026/27) on each saved tournament and award, a "Start a new season" step that files the
  current one away (nothing deleted), and a season picker on the Season tab to look back.
  Data: add a `season` field (adding fields only); older records without one count as the
  first season; backups and restore keep loading old files. Ties in with the parent link,
  which is already one per team per season.
- **Export a season as PDF.** A printable season summary: results (W/D/L, goals), playing time
  per player, awards, and optionally each tournament's games. Built in the app (print-friendly
  page and the phone's Save as PDF / share sheet), so no server is needed. Holds children's
  first names, so the same privacy warning as backups.
- Questions: does a season follow the school year (September to July) or does the coach name
  it? Should the PDF include playing time (some clubs prefer not to share it with parents)?

## Notifications
- Match starting soon: reminder before a game's kick-off time. While the app is open this can be
  done in the app; when it's closed it needs web push plus a small scheduled server function
  (Firebase Blaze plan, pennies at this size) and notification permission on each phone.
  Shares the push set-up with the parent view.
- **Push notifications for followers**, even with the app closed: game about to start / kick-off,
  goals (for either team, with the score), cards, half time and full time. Each follower chooses which
  ones they want. No players' names: e.g. "Goal! Example Team 2–1 Riverside", "Yellow card for
  Example Team (12')". Today followers only get alerts while the page is open.
  - Needs: Firebase Cloud Messaging, a small server function that sends a push when the feed changes,
    and the Blaze plan (pennies at this size). Followers allow notifications once; on iPhone they must
    add the follower page to the home screen first (Apple's rule for web push).
  - Cards: add a name-free card count to the follower feed (rules + tests), since followers can't see
    cards at the moment.

## Make it clear it works for tournaments and single matches
- The app reads as tournament-first. Make it obvious it's just as good for a **single match** (e.g. a
  Saturday league game) as for a **one-day tournament** of several games.
- Ideas: at set-up ask "What's today: one match or a tournament?" (one match sets 1 game and skips
  tournament wording); call the section "Match day" rather than "Tournament" when there's one game;
  "Save the match" instead of "Finish tournament"; results and summaries say "match" for single games.
- Update the blurb, the empty screens and the set-up help to mention both.

## Followers: follow several teams
- A follower (e.g. a grandparent with two grandchildren in different teams, or a club official) can
  follow more than one team in the app. Each follower link opened on the phone is remembered; the
  follower screen lists the teams with their live score and status, and tapping one opens its
  scoreboard and games. Live teams go to the top.
- Remove a team from the list. No sign-in needed (the list lives on the phone), but if they sign in,
  the list could follow them to a new phone.
- Alerts (goals, half time, full time) say which team they're for.
- Keep it read-only and name-free, exactly like a single follower link today.

## Yellow and red cards
- Record cards against a player in a game (who, when, which card), shown on their label and in the
  game's timeline, and in the season record.
- **Rugby yellow card** = 10 minutes in the sin bin. The player is off the pitch but **the time still
  counts towards their playing time**. Show a 10-minute countdown on their label, remind the coach when
  it's up, and don't let them be subbed while they're binned (the team plays one short).
- **Red card** = sent off for the rest of the game; the team plays one short (no replacement).
- **Football**: decide how grassroots sin bins (temporary dismissals for dissent) work for the age
  groups using the app, and whether a yellow alone needs anything beyond a record.
- Followers see nothing about cards today (no players' names); name-free card alerts are planned under Notifications.

## Business and branding
- **Company name and address on the pages?** Privacy and terms currently say Mark Miles Consultancy
  Limited (08286044), registered office in Winscombe. Decide whether Match Day should sit under a
  different company or trading name, or show a different address (e.g. a registered office service
  rather than a home address). Update privacy.html, terms.html and Lemon Squeezy's store details.
- **Get a domain name** (e.g. matchday-something.co.uk) instead of match-day-17b23.web.app. Firebase
  Hosting can serve it for free once it's connected. Then: add it to Google sign-in's authorised domains and
  OAuth redirect URIs, update LIVE_HOSTS in firebase-config.js, Lemon Squeezy's links, the parent
  link addresses, and the release checks. Keep the old address redirecting so existing home-screen
  icons and parent links keep working.

## Later

- Combined fixtures view across all of a coach's teams.
- A separate *Match Day Rugby* listing/web address from the same code (starts with rugby
  selected), if rugby coaches take it up.
- Paid-plan automatic database backups once real teams depend on it.
