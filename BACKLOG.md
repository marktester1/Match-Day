# Match Day backlog

Ideas and requests to pick up later. Each one goes to the beta link first (see CLAUDE.md).
"Questions" are things to agree before building.

## Waiting on testing

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

**Step 2: Invite codes**
- Firebase App Check against scripted guessing; 8-character codes; manager can make a new code
  (old one stops working) and remove a coach. Real rate limiting needs Cloud Functions (paid
  Blaze plan); revisit then. Optional: approval to join.

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

## Notifications
- Match starting soon: reminder before a game's kick-off time. While the app is open this can be
  done in the app; when it's closed it needs web push plus a small scheduled server function
  (Firebase Blaze plan, pennies at this size) and notification permission on each phone.
  Shares the push set-up with the parent view.

## Later

- Combined fixtures view across all of a coach's teams.
- A separate *Match Day Rugby* listing/web address from the same code (starts with rugby
  selected), if rugby coaches take it up.
- Paid-plan automatic database backups once real teams depend on it.
