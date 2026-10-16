# Monetisation and parent view: branch plan

Branch: `monetisation`. Test address: https://match-day-beta-17b23--monetise-86lnqmwh.web.app
(a preview channel on the **beta** project, so beta data only; expires 30 days after each
deploy). Nothing here goes near live until it's merged, tested on beta and released as usual.

Deploy this branch's app: `firebase hosting:channel:deploy monetise --project beta --expires 30d`
Rules from this branch go to beta only while testing. Afterwards, re-deploy main's rules to beta
(`git switch main && firebase deploy --only firestore:rules --project beta`).

## 1. Team unlock: £3.99 one-off per team

**What's free and what's paid** (to agree):
- Proposal: free to try = one team, the current tournament, up to 2 saved tournaments.
  Unlock = unlimited saved tournaments, season results, notes and backups, for that team for good.
- Coaches who join by invite never pay; the unlock is per team, not per coach.

**How a team is marked as unlocked**
- `teams/{t}/billing/state`: `{unlocked: true, source: 'purchase' | 'voucher' | 'founding', at}`.
- Coaches can read it; they can never write it themselves (security rule). Only:
  - the payment provider's confirmation (webhook → small Firebase server function), or
  - a valid voucher (checked by the rules, see 2), or
  - the owner's Admin page (founding club, refunds, support).

**Taking payment** (web first)
- A merchant of record handles checkout, receipts, refunds and VAT/sales tax in every country.
  Recommended: **Lemon Squeezy** (~5% + 50p, individuals welcome, test mode). Alternatives:
  Paddle (similar, stricter onboarding), Stripe + Stripe Tax (cheaper, but VAT is your job).
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

## Build order on this branch
1. Parent view prototype (feeds + follow link + parent screen), free, on the test address.
2. Paywall and unlock screens with owner-only "Test unlock"; founding-club switch on Admin.
3. Vouchers with the atomic redeem rule and emulator tests.
4. Blaze on beta, payment provider in test mode, webhook function; then parent subscription
   and push notifications.
5. Review together, then merge into main and release through beta as usual.

## Needed from you
- Choice of payment provider (recommended Lemon Squeezy), and later its account in your name.
- The free tier (proposal above).
- OK to switch the **beta** project to Blaze when we reach step 4 (with a budget alert).
