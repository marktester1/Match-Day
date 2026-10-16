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
   - Price: free, or 99p. At 99p the website keeps ~61p after VAT and card fees (~70p via the
     app stores at 15%). Alternatives: free for parents as part of the team's £3.99 unlock, or
     99p per parent as a season pass.
   - Questions: one link for the whole season or per tournament? Show our goals as "Goal!"
     with no scorer name? Include the opponent's name?

## Later

- Combined fixtures view across all of a coach's teams.
- A separate *Match Day Rugby* listing/web address from the same code (starts with rugby
  selected), if rugby coaches take it up.
- Paid-plan automatic database backups once real teams depend on it.
