# Match Day backlog

Ideas and requests to pick up later. Each one goes to the beta link first (see CLAUDE.md).
"Questions" are things to agree before building.

## Waiting on testing

- **v0.17.2 live:** rugby, set-up journey, home/away swap, save confirmation, edit saved
  tournaments, sections, game strip, notes, players a side, ☰ menu.
  Beta: https://match-day-beta-17b23.web.app (Beta Test Team code `L9J-Q7H`).
- **Accounts:** Google sign-in works on live. Still to try: signing in on a second phone and
  seeing the teams come back.

## Features

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
     - £1 per parent download, separate from the team's £3.99 unlock. Keeps ~62p via the website
       or ~71p via the app stores after VAT and fees.
   - Open: does the £1 cover one season (matching the yearly link) or for good?

2. **Paid team unlock: £3.99 one-off per team (decided).** Free to try, then the team's
   manager pays once; coaches and parents who join with a code never pay.
   - Decide what's free (e.g. one team, one tournament) and what the unlock adds.
   - Take payment through a merchant of record (Paddle / Lemon Squeezy, ~5% + 50p) so UK and
     overseas VAT/sales tax is handled; app stores later as in-app purchase.
   - Security rule so only unlocked teams get the paid features.
   - The user sets up the payment account and bank details themselves.

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

## Later

- Combined fixtures view across all of a coach's teams.
- A separate *Match Day Rugby* listing/web address from the same code (starts with rugby
  selected), if rugby coaches take it up.
- Paid-plan automatic database backups once real teams depend on it.
