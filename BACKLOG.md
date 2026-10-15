# Match Day backlog

Ideas and requests to pick up later. Each one goes to the beta link first (see CLAUDE.md).
"Questions" are things to agree before building.

## Waiting on testing

- **v0.4.1 on beta, not yet live:** multiple teams per phone, A–Z squad, optional email
  accounts, iPhone date-box fix, generic examples. Needs Email/Password switched on in Firebase (Security → Authentication →
  Sign-in method), then a try of create account / sign in on a second browser.

## Features

1. **Season stats per player (master list).** One player list for the whole season, with
   games played, minutes, goals and awards adding up across every tournament.
   - The squad and saved tournaments already hold most of this; it needs a per-player
     season view.
   - Question: should players removed from the squad keep their season stats?

2. **Record who scores.** Tapping + for our team asks who scored (or "own goal / not
   sure"). Goals then show per game and in season stats.

3. **Rugby option, chosen when the team is set up.**
   - Scoring buttons for tries, conversions and penalties instead of goals.
   - Questions: points per score (union 5 / 2 / 3?), or just count tries for younger age
     groups? Drop goals? Does "keeper" disappear for rugby?
   - Word changes: "goals" → "points", "pitch" stays, "GK" hidden.

4. **Halves and quarters.** Choose 1, 2 or 4 periods per game; the clock runs per period
   with a break between, and subs/minutes still add up.
   - Question: should the clock stop by itself at the end of each period?

5. **Edit saved tournaments.** Change results, opponents and scorers on a tournament
   already saved to the Season tab.

6. **Change the number of games after it's set.** Add or remove a game mid-tournament
   without losing the games already played.
   - Question: the Games count can already be changed at the bottom of the Games list;
     is the problem with saved tournaments, or something else?

7. **Awards outside tournaments.** Awards that aren't tied to a tournament or training
   (e.g. end of season, player of the month).
   - Question: is that the meaning, or should the awards screen move somewhere else?

## Later

- Combined fixtures view across all of a coach's teams.
- Paid-plan automatic database backups once real teams depend on it.
- A separate test Firebase project so beta testing never touches live data.
