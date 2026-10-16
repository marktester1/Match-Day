# Monetisation and parent view: branch plan

Branch: `monetisation`. Test address: https://match-day-beta-17b23--monetise-86lnqmwh.web.app
(a preview channel on the **beta** project, so beta data only; expires 30 days after each
deploy). Nothing here goes near live until it's merged, tested on beta and released as usual.

Deploy this branch's app: `firebase hosting:channel:deploy monetise --project beta --expires 30d`
Rules from this branch go to beta only while testing. Afterwards, re-deploy main's rules to beta
(`git switch main && firebase deploy --only firestore:rules --project beta`).

## 1. Team unlock: £3.99 one-off per team

**What's free and what's paid** (decided: 30-day free trial):
- Every feature is free for 30 days from when the team is created (`teams/{t}.created`).
- After that, without the unlock, the team becomes **view-only**: coaches can still see games,
  results and the season record and save a backup, but can't start or change games until the
  team is unlocked. Nothing is ever deleted.
- Teams created before this launches start their 30 days on the launch date, not their creation
  date. Winscombe is a founding club (never pays).
- Reminders in the app at 7 days and 1 day before the trial ends.
- Coaches who join by invite never pay; the unlock is per team, not per coach.

**How a team is marked as unlocked**
- `teams/{t}/billing/state`: `{unlocked: true, source: 'purchase' | 'voucher' | 'founding', at}`.
- Coaches can read it; they can never write it themselves (security rule). Only:
  - the payment provider's confirmation (webhook → small Firebase server function), or
  - a valid voucher (checked by the rules, see 2), or
  - the owner's Admin page (founding club, refunds, support).

**Taking payment** (web first)
- A merchant of record handles checkout, receipts, refunds and VAT/sales tax in every country.
  **Decided: Lemon Squeezy** (~5% + 50p, individuals welcome, test mode).
- Flow: Unlock button → provider's hosted checkout (in test mode while on beta) → provider tells
  our server function → it writes `billing/state` → every coach's app unlocks within seconds.
- The server function needs Firebase's **Blaze** (pay-as-you-go) plan on the beta project
  (and later live). At this size it's pennies a month; set a £1 budget alert.

**Prototype first, without money**: the branch starts with the paywall and unlock screens, and
an owner-only "Test unlock" on the Admin page, so the whole experience can be tried before any
payment account exists.

## 2. Founding club and vouchers

- Winscombe: `source: 'founding'`, set from the Admin page.
- Vouchers: `vouchers/{CODE}` = `{usesLeft, expires, reward: 'unlock' | 'season'}`, created by the
  owner. A coach redeems one for their team: in one atomic write, `billing/state` is set and
  `usesLeft` goes down by exactly 1. The rules allow that only if the code exists, hasn't
  expired, has uses left, the team isn't already unlocked and the person is a coach in the team.
  No server needed. Codes are random, 8+ characters; App Check against guessing.

## 3. Parent view: £1 a year per parent, auto-renewing

**What parents see**: our team v opponent, the score ("Goal!", no scorer), the clock and status
(kick-off, half time, full time). Never names, line-ups, minutes or notes.

**How the privacy holds**
- Coaches' phones copy just those fields into a small public record `feeds/{feedId}` whenever
  the score, clock or status changes. `feedId` is long and random: the parent link is
  `…/?follow=<feedId>`, one per team per season (a new link each season).
- Rules: anyone signed in can read a feed by its exact ID (never list them); only coaches in that
  team can write it, and only the allowed fields.
- The parent screen is a separate, simple view of the same app: no tabs, no team data.

**Notifications**: goal, half time, full time. Needs web push (Firebase Cloud Messaging) and the
same server function (Blaze). On iPhone, parents must add the app to the home screen first.

**Payment**: £1/year subscription through the same provider; the parent link checks the parent's
subscription before showing live updates. Prototype first without payment.

## Progress
- **Step 1 done**: parent link (☰ → Parent link), `feeds/{id}` + `feeds/{id}/games/g1..g10`, parent
  scoreboard with Played / Still to play. Current tournament only (earlier tournaments: not wanted for now).
- **Step 2 done**: 30-day trial from `teams/{t}.created` (or `PLAN_FROM` in index.html for older teams:
  **set the real launch date before release**), reminder banner in the last 7 days, view-only after
  (a game already under way can be finished), unlock screen (payment button is a placeholder),
  ☰ plan card, owner-only Test unlock, Admin buttons per team: Test unlock, Founding club, End trial
  now, Reset. `teams/{t}/billing/state` is written by the owner only (rules + tests).
- **Step 3 done**: vouchers. Admin → Vouchers makes 10-character codes (uses, days valid, private
  note), lists them with uses left and last team, deletes them. Coaches redeem on the Unlock screen.
  Redeeming is one atomic write (voucher use −1 and team unlocked; each half checks the other).
  Coaches can't read or list vouchers. Rules tests cover expired, used up, made up, topping up,
  claiming a purchase, using without unlocking, unlocking without using, other teams.
  Still to add before launch: App Check (stops scripted guessing; codes are ~10^15 combinations).
- **Before launch**: view-only is enforced by the app only. Also enforce it in the rules (writes to
  club/games/awards/archive need an unlocked team or an unexpired trial), allowing for writes queued
  offline just before the trial ended.

- **Step 4a built (team unlock payments)**: `functions/` holds the `lemonSqueezy` webhook (London
  region). It checks Lemon Squeezy's signature, the product variant and test/live mode, then writes
  `billing/state {unlocked, source: 'purchase', at, order}`; a refund of that order re-locks the team.
  Only the order number is stored (no names, emails or card details). Tests: `cd functions && npm test`.
  The Unlock button opens the checkout link from `SHOP.checkout` in firebase-config.js with the team
  ID attached; the app thanks the coach when the unlock arrives. Not deployed yet: needs the setup below.
- **Step 4b (next)**: parent £1/year subscription and push notifications.

## Payment setup (you do these; about 20 minutes)

1. **Switch beta to Blaze** (pay-as-you-go; at this size it should cost pennies or nothing):
   https://console.firebase.google.com/project/match-day-beta-17b23/usage/details → Modify plan →
   Blaze → choose or create a billing account. Then Google Cloud console → Billing → Budgets & alerts
   → create a **£1 budget** with email alerts. Leave live on the free plan for now.
2. **Lemon Squeezy** (https://app.lemonsqueezy.com): create the account and a store, and keep
   **Test mode** switched on (toggle at the bottom left).
3. **Product**: Products → New product → "Match Day team unlock", single payment, **£3.99**.
   - Under the product's options, set the confirmation **button link / redirect** to
     https://match-day-beta-17b23--monetise-86lnqmwh.web.app/ (the test address).
   - Publish it, then copy two things: the **variant ID** (number) and the **checkout link**
     (Share → "Checkout URL", like `https://yourstore.lemonsqueezy.com/buy/…`).
4. **Webhook**: Settings → Webhooks → +. Callback URL: I'll give you the function's address after the
   first deploy. Signing secret: make up a long random string (keep it somewhere safe). Events:
   `order_created` and `order_refunded`.
5. Tell me the variant ID and checkout link (neither is secret). Set the signing secret yourself so it
   never passes through chat:
   `firebase functions:secrets:set LEMONSQUEEZY_SIGNING_SECRET --project beta` (paste it when asked).
6. I then fill in `functions/.env.match-day-beta-17b23` and `SHOP.checkout` (beta), deploy the function
   to beta (`firebase deploy --only functions --project beta`), and we test with Lemon Squeezy's test
   card on the test address, including a refund.

## Build order on this branch
1. Parent view prototype (feeds + follow link + parent screen), free, on the test address.
2. Paywall and unlock screens with owner-only "Test unlock"; founding-club switch on Admin.
3. Vouchers with the atomic redeem rule and emulator tests.
4. Blaze on beta, payment provider in test mode, webhook function (4a); then parent subscription
   and push notifications (4b).
5. Review together, then merge into main and release through beta as usual.

## Needed from you
- A Lemon Squeezy account in your name (test mode first) when we reach step 4.
- OK to switch the **beta** project to Blaze when we reach step 4 (with a budget alert).
