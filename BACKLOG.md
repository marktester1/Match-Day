# Match Day backlog

Only what's still to do. Each change goes to beta first (see CLAUDE.md). "Questions" are things to
agree before building. Done work is in the git history and the release tags.

## Now

- **Releases:** live is **v0.29.7** (7 Nov 2026). Beta has **v0.29.8**: supporters keep the last
  results until a new match day has a fixture, and their page catches up when a coach opens the app.
  Release it once every GitHub test passes on it.
- **In progress (not committed):** team data listeners (settings, squad, games…) try again when
  refused just after a coach is accepted. Seen on Android: a new coach's phone kept the placeholder
  team name. Also fix the 5/5 counter contrast check, which misreads colours in Android Chrome.
- **Alert logging on live:** the push function logs how many phones each alert reached and why any
  failed. On beta's server only; live needs `firebase deploy --only functions --project live` with
  the user's go-ahead.
- **Still to try on real phones:** supporters' alerts (Android: in Chrome, not inside WhatsApp;
  iPhone: from the Home Screen) for kick-off, goals, cards, half time and full time; a coach's alert
  for a join request, and the asker's when accepted; signing in to an existing account on a phone
  that already has teams, and on a second phone (needs a password, so Claude can't).
- **Notifications in set-up:** offer "Turn on notifications" (join requests) on the wizard's last screen.
- **Coach name on a new address or phone:** the name is kept per address, so it's blank on
  app.matchday-app.uk. If the phone has no name but is in a team, fill it from the team's member entry.
- **Supporters' list:** a game being played shows under "Played"; maybe "Now" or "Today" instead.

## Website and marketing

- **Videos:** four clips (pick the team, a sub, minutes, supporters' goal) are on the preview and beta
  websites and in the guide there; not yet on matchday-app.uk. Publish when the user says.
- **Testimonials:** a "What coaches say" section once coaches reply to the WhatsApp request
  (marketing/whatsapp-messages.md). Real quotes only, with permission and how they'd like to be named.
- **Facebook page:** the pack is in marketing/facebook (page details, cover, profile picture, posts).
  The user creates the page.
- **Google Analytics on the website (requested 7 Nov 2026):** visitors, where they come from
  (Facebook, WhatsApp, search), which pages they read, and how many tap "Open the app".
  - Website only (matchday-app.uk), not the app or the supporters' link: those stay cookie-free.
  - Google Analytics sets cookies, so UK law (PECR/UK GDPR) needs a consent banner first, with
    analytics off until the visitor says yes ("Consent Mode" in Analytics). Update the privacy
    notice, and allow googletagmanager.com / google-analytics.com in the website's security policy
    (site/firebase.json and firebase.live.json).
  - The user creates the Analytics account (analytics.google.com, under the same Google account as
    Search Console) and sends the Measurement ID (G-XXXXXXX); link it to Search Console for search terms.
  - Cookie-free alternatives with no banner: Cloudflare Web Analytics (free; the domain is already on
    Cloudflare) or Plausible (paid). Fewer details than Google, but no pop-up for visitors.
- Make it clear it's an app: people read "app" and think it's a normal website.
- Rugby feels like an afterthought. Separate rugby website or listing? (see Later)

## App stores (started 7 Nov 2026)

- **Apple:** Developer Program enrolment (organisation, Mark Miles Consultancy Limited) under review.
  Then: agreements in App Store Connect, the app record (bundle ID `com.markmilesconsultancy.matchday`),
  a TestFlight build for the user and a few coaches.
- **iPhone app (`ios-app/`) before review:** automated tests of the app shell on the simulator (needs
  `isInspectable` in test builds only), the App Store build pointing at live, native push
  notifications and Sign in with Apple (both help Apple's review; web push and Google sign-in don't
  work inside the app).
- **Google Play:** organisation account and identity check. The app is a Trusted Web Activity
  (`android-app/`, steps in its README): the user installs Bubblewrap, makes the signing key
  (kept in `~/matchday-keys`, never in the repo), builds, uploads to internal testing, then sends the
  app signing key's SHA-256 so `/.well-known/assetlinks.json` can go on the website (needs adding to
  `tools/build_public.sh`; beta first). Without it the app shows a browser address bar.
- **Store listings:** name, descriptions, keywords, screenshots at each store's sizes, category Sports
  (not Kids: the users are adult coaches), age rating, Apple's privacy label and Google's Data safety
  answers (team data with first names, coaches' names and emails, problem reports kept 30 days, push
  tokens; no tracking or ads), privacy policy link, "Delete my account" in the app (both stores require it).

## Monetisation

**Decided (7 Nov 2026):** **one team per subscription**: each team has its own yearly subscription
(**£5 a year**, as decided before), and every coach in the team uses it; invited coaches and
**supporters stay free**. **Six-week free trial** for each new team (`TRIAL_DAYS=42` on the
`monetisation` branch, which was written for one subscription per manager covering all their teams:
change it to per team). **Referral scheme:** when a referred team **makes its first payment**, the team that
referred it gets **two months free**, and the new team gets **two months free** too. **No limit** on
referrals, as long as each referred team pays. Still to decide: a club price, and what's free versus paid. Details in
MONETISATION.md on that branch.

- **One payment unlocks the team everywhere (requested 7 Nov 2026).** Paying in the iPhone app, the
  Android app or on the website unlocks the team for every coach on every platform.
  - The server records it on the team (e.g. `paidUntil` on `teams/{id}`); rules let only the server
    write it. Apple, Google and Paddle (the website) report purchases, renewals, cancellations and
    refunds to a Cloud Function. Suggested: **RevenueCat** (one entitlement across App Store, Google
    Play and Stripe/web; free up to ~$2.5k a month of revenue).
  - Store rules: in-app purchases inside the apps (they take 15%), no pointing to a cheaper web price;
    using a purchase on another platform is allowed (Apple 3.1.3(b)). The web uses its own payment service.
  - The payer must be signed in (Google, email, or Sign in with Apple), asked only at the moment they pay.
- **Founding club:** Winscombe team(s) flagged as paid for good, so the testers never see a paywall.
- **Voucher codes** (e.g. WINSCOMBE) setting the same paid mark, with a use limit and optional expiry.
  iPhone app: Apple offer codes instead (store rule). Safeguards: prefer unique single-use codes per
  team; shared codes only with a small cap, a season expiry and a limited reward; redeeming needs an
  account and works once per team; random 8+ character codes plus App Check; rules enforce expiry,
  uses left, one use per team and membership, counting down by exactly one; an admin list with a
  switch-off.
- **Referral scheme (decided):** each team gets a referral link or code to share. When a team that came
  through it **makes its first payment**, both teams get **two months free**: each team's `paidUntil`
  moves on by two months, set by the server (the Cloud Function that hears about payments), never by a
  phone. No limit on how many teams one team refers. Safeguards: a team can't refer itself, each
  referred team counts once (its first payment only), and a refund of that payment takes the months back. In the iPhone app the free
  months come from our server, not an Apple purchase: check Apple's rules allow this for an
  auto-renewing subscription (Apple's own offer codes and promotional offers are the safe route).
- **Admin checklist (the user):**
  - [ ] **Paddle** account for website payments (decided 7 Nov 2026): a merchant of record, so it handles
    UK and overseas VAT/sales tax, and it plugs into RevenueCat with the App Store and Google Play. Use
    Paddle's sandbox first. Order: app-store purchases first (Apple and Google handle VAT everywhere),
    then the website through Paddle. Paddle needs the business verified (company, website, refund policy
    and terms pages), so add a refund policy to terms.html before applying.
  - [ ] **RevenueCat** account: connect App Store Connect, Google Play and Paddle; one "team paid"
    entitlement; its webhook to a Cloud Function that sets `paidUntil` on the team.
  - [ ] Webhook signing secret: `firebase functions:secrets:set` (never in chat).
  - [ ] Budget alerts on both Firebase projects (both are on Blaze).
  - [ ] **Backups of live data:** none today (no schedule, point-in-time recovery off). Turn on a daily
    backup kept 14 days (`firebase firestore:backups:schedules:create --project live --recurrence DAILY
    --retention 14d`) and point-in-time recovery (7 days). Needs the go-ahead (it changes live).
  - [ ] **Bigger Mac for the iPhone tests:** GitHub's larger Macs ($0.102 a minute, about $3–5 a full
    run) need a GitHub organisation on the Team plan ($4/user a month); move the repo there, then point
    ios-sim.yml at it and run `npm test` in tools/e2e/ios-sim in full. Or a rented Mac with
    `tools/e2e/ios-sim/cloud-mac.sh`. This Mac (8 GB) can't run them.
  - [ ] Off-Mac copies: `exports/` (children's names) somewhere private (iCloud Drive), never GitHub.
  - [ ] Apple Paid Apps agreement, bank and tax details, Small Business Program (15%); Google payments profile.
  - [ ] HMRC (self-employment over the £1,000 trading allowance) and the ICO data protection fee (the
    app stores children's first names): check whether each applies.
  - [ ] Privacy notice and terms: update for payments and the stores.
  - [ ] Before the first payment: make the GitHub repository private (switch the device test runs to
    by-hand, or budget for minutes), and shrink the Feedback button (an icon, or into the ☰ menu).
- **Selling internationally:** local prices via the stores or the payment service. Only if those
  markets show interest: US wording (soccer, field, US dates) and rugby league scoring (try 4,
  conversion 2, penalty 2, drop goal 1) next to union.

## Security (deferred: server code or console set-up)

- **Rate limiting** of code look-ups and join requests (per IP or device): a Cloud Function doing the
  code → team look-up and counting attempts, with `codes/` unreadable to the app.
- **Firebase App Check:** register a reCAPTCHA site key per project (Build → App Check), add
  `initializeAppCheck` (plus the reCAPTCHA addresses to the security policy), watch beta's metrics for
  a week, then enforce for Firestore (beta first).
- **Long lists:** rules can't loop, so a long list (e.g. 30 subs) is checked at its newest entry; a
  tampered app could hide junk in the middle. Fix with a Cloud Function validator, or one document per
  sub/goal (needs a migration that keeps old backups loading).
- **Drop 6-character codes** once every team has made a new code (or after a season).
- `style-src 'unsafe-inline'` stays (screens use style="" attributes, which can't run code).
- Account switching: if moving one team fails part-way, the teams already moved are in both sign-ins;
  the user just tries again. A server function could make it one step.

## Tests and structure

- Tests for account recovery (no account → account, lost phone) and restore from a backup.
- Schema version on stored data and backups, with explicit migrations.
- Stop swallowing errors that affect access or data (the issues log now records many of them).
- Split index.html into modules (match logic, storage, sign-in, screens); review listener lifecycles
  and re-renders.

## In the app (from testers)

- Make the journey step by step on match day too, so the next action is obvious (set-up has the wizard).
- A back button where screens lack one.
- Put picking the team at the top at the start of a game.
- **Make it clear it works for single matches as well as tournaments:** call the section "Match day"
  when there's one game; "Save the match" for single games; results and summaries say "match"; mention
  both in the blurb, empty screens and help.

## Formations and positions (requested 7 Nov 2026)

- Optional, per game: pick a formation for the game's size (e.g. 5-a-side 1-2-1 or 2-1-1, 7-a-side
  2-3-1 or 3-2-1, 9-a-side 3-3-2, 11-a-side 4-4-2 / 4-3-3), or none (today's layout).
- The pitch view lays the players out in rows (keeper, defence, midfield, attack); a sub goes into the
  position of the player coming off; drag to swap positions.
- Minutes by position for the day and the season, so every child gets a go in different positions.
- Remember each team's usual formation and each player's usual position, so it costs no extra taps.
- Supporters never see positions or names. Data: add fields only (e.g. `formation` on the game, `pos`
  per player); old games and backups read as "no formation". Rugby positions by number, later.

## Season history and PDF export (requested)

- **Decided:** billing and seasons are separate. A season is the coach's own, from their first
  tournament to their last; results, awards, the season record and the PDF are grouped by it.
- **More than one season:** a season label (e.g. 2026/27) on each saved tournament and award, a
  "Start a new season" step that files the current one away (nothing deleted), and a season picker on
  the Season tab. Data: add a `season` field; records without one count as the first season.
- **Export a season as PDF:** results, playing time per player, awards, optionally each tournament's
  games. A print-friendly page and the phone's Save as PDF / share sheet; holds first names, so the
  same privacy warning as backups.
- Questions: does a season follow the school year or does the coach name it? Should the PDF include
  playing time (some clubs prefer not to share it with parents)?

## Supporters

- **Follow several teams:** each supporters' link opened on the phone is remembered; the page lists the
  teams with their live score and status (live ones first); tap one for its scoreboard and games;
  remove a team from the list. No sign-in needed. Alerts say which team they're for. Read-only and
  name-free, as now.
- **"Game about to start" reminder** before kick-off (needs a scheduled server function).

## Business and branding

- **Company name and address on the pages?** Privacy and terms say Mark Miles Consultancy Limited
  (08286044), registered office in Winscombe. Decide whether Match Day should sit under a different
  company or show a different address (e.g. a registered office service rather than a home address).
- **Change the company name to something less personal?** The App Store shows the legal name as the
  seller (no trading names). Options: rename the company (special resolution + form NM01, about £20;
  number, bank and tax stay the same), or a separate company for Match Day (about £50; its own D-U-N-S
  number, bank account and accounts). Check the name at Companies House, the UK IPO trade mark register
  (nothing near "Match of the Day") and as a domain. After a rename: tell Dun & Bradstreet (the
  D-U-N-S number stays the same), the bank and HMRC; update privacy.html, terms.html and the website.
- **Move coaches to app.matchday-app.uk (plan agreed 4 Nov 2026).** Each address has its own storage on
  a phone, so opening the new one signs the phone out; anonymous coaches could only rejoin with the
  invite code. 1. A **handover**: the old address offers "Move to the new address"; a Cloud Function
  mints a one-time sign-in for the same user, so the new address opens signed in to the same teams
  (supporters' links too). Beta first (needs e.g. beta.matchday-app.uk). 2. Then point the website's
  buttons at app.matchday-app.uk and have the old address offer the move. 3. **Never redirect or switch
  off** match-day-17b23.web.app (home-screen icons and old links). Before public launch and the stores.
- **Email:** hello@matchday-app.uk receives (Cloudflare forwarding to Gmail). To reply *from* it, add a
  sending service (a mailbox at Zoho, Fastmail, Google Workspace or iCloud+), then tighten DMARC from
  `p=none` to `p=quarantine`. Then Firebase's sign-in emails, the store listings and the payment service.

## Accessibility (from review)

- Larger text: sizes in rem so phone text-size settings apply; check every screen at 200%.
- Screen readers: label icon-only buttons; announce the save status, undo bar and toasts politely; stop
  the ticking clock being read out every second; headings for the pitch and bench; move focus into
  pop-ups and back.
- Visible focus outlines for keyboard / switch users; dialogs close with Escape.
- Contrast: check muted grey text and green on dark against WCAG AA in both themes.
- Respect "reduce motion" everywhere.

## Usability on the touchline (from review)

- Tap targets of ~44px with good spacing on every button.
- High contrast in bright sunlight; works in the dark.
- Don't rely on colour alone (check the game strip dots and pills).
- Essential controls (score, subs, clock) within thumb reach.
- Consider a short vibration on goals, subs and clock changes.

## Questions to decide

- **Should everyone log in?** Today a phone can use the app with no account. For: data survives a lost
  phone, real names on the Admin page, payments need an account, store review expects "Delete my
  account". Against: friction for helpers who only tap subs, more support. Middle ground: required for
  managers (who pay and approve) and anyone wanting their teams on another phone; optional for helpers.
- **Football sin bins:** how grassroots temporary dismissals work for the age groups using the app, and
  whether a yellow needs anything beyond a record.
- **Feedback button** smaller once the app is paid for (see the monetisation checklist).

## Later

- Combined fixtures view across all of a coach's teams.
- A separate *Match Day Rugby* listing or web address from the same code (starts with rugby selected),
  if rugby coaches take it up.
