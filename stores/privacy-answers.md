# Privacy answers for the stores

Worked out from what the app actually stores (privacy.html, firestore.rules, index.html) on 7 Nov 2026.
Re-check these whenever the app starts storing something new.

**Common to both:** no tracking, no adverts, no analytics or advertising SDKs, nothing sold or shared with
other companies. Google (Firebase) stores the data for us as our processor, which the stores don't count
as "sharing". Everything is encrypted in transit (HTTPS). Coaches can leave a team in the app, and anyone
can ask for their data or a whole team to be deleted at hello@matchday-app.uk (done within 30 days).

## Apple: App Privacy ("nutrition label")

**Does the app collect data?** Yes. **Used for tracking?** No, for every type below.

| Data type (Apple's names) | What it is in Match Day | Linked to the user? | Purposes |
|---|---|---|---|
| Contact Info → **Name** | the coach's name they choose to show | Yes | App Functionality |
| Contact Info → **Email Address** | only if the coach signs in with email | Yes | App Functionality |
| Identifiers → **User ID** | the sign-in's ID (Firebase), for coaches and supporters | Yes | App Functionality |
| User Content → **Other User Content** | team data the coach enters: players' first names, line-ups, minutes, scores, fixtures, awards, notes, match reports | Yes | App Functionality |
| Usage Data → **Product Interaction** | when each coach last used the app (shown to the team; counted on the Admin page) | Yes | App Functionality, Analytics |
| Diagnostics → **Other Diagnostic Data** | problem reports: the error, where, team, coach's name, app version, phone type; kept 30 days | Yes | App Functionality |

Not collected: location, contacts, photos, health, financial info, browsing history, purchases (yet),
crash logs from a crash SDK, device ID or advertising ID. The iPhone app doesn't use push notifications yet.

## Google Play: Data safety

- **Does your app collect or share any of the required user data types?** Yes (collect); **shared:** No.
- **Is all of the user data collected by your app encrypted in transit?** Yes.
- **Do you provide a way for users to request that their data is deleted?** Yes: in the app (leave the
  team) and by email to hello@matchday-app.uk. Deletion URL to give: https://app.matchday-app.uk/privacy.html

| Category → type | Collected | Optional? | Purpose |
|---|---|---|---|
| Personal info → **Name** | Yes | Required for coaches (shown to their team) | App functionality |
| Personal info → **Email address** | Yes | Optional (only for an account) | App functionality, Account management |
| App activity → **Other user-generated content** | Yes | Required | App functionality |
| App activity → **Other actions** (last used) | Yes | Required | App functionality, Analytics |
| App info and performance → **Diagnostics** | Yes | Required | App functionality |
| Device or other IDs → **Device or other IDs** | Yes (sign-in ID; the push address if notifications are turned on) | Required / optional | App functionality |

Processed ephemerally: no. Data collected from children: the app is for adults (coaches, 18+); a child's
first name is entered by their coach, which the target-audience section should say.

## Before submitting
- Make sure https://app.matchday-app.uk/privacy.html mentions everything above (it does as of v0.29.7:
  problem reports were added).
- If payments, Sign in with Apple or native push are added, update both labels.
