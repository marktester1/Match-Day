# Match Day backlog

Ideas and requests to pick up later. Each one goes to the beta link first (see CLAUDE.md).
"Questions" are things to agree before building.

## Waiting on testing

- **v0.10.0 on beta, not yet live:** Home v Away; halves and quarters; game screen order; keeper pop-up at kick-off (centred); British "v" in fixtures example.
- **v0.8.1 live:** goal scorers, icon fix. Beta (https://match-day-beta-17b23.web.app) is its own Firebase project;
  beta test team invite code: `L9J-Q7H`.
- **Accounts:** Google sign-in works on live. Still to try: signing in on a second phone and
  seeing the teams come back.

## Features

1. **Season stats per player (master list).** One player list for the whole season, with
   games played, minutes, goals and awards adding up across every tournament.
   - The squad and saved tournaments already hold most of this; it needs a per-player
     season view.
   - Question: should players removed from the squad keep their season stats?

3. **Sport per team, chosen when the team is set up (football or rugby).** A choice on the
   team set-up screen; each team keeps its own sport, and words, scoring and the keeper change with it.
   - Scoring buttons for tries, conversions and penalties instead of goals.
   - Questions: points per score (union 5 / 2 / 3?), or just count tries for younger age
     groups? Drop goals? Does "keeper" disappear for rugby?
   - Word changes: "goals" → "points", "pitch" stays, "GK" hidden.

5. **Edit saved tournaments.** Change results, opponents and scorers on a tournament
   already saved to the Season tab.

6. **Change the number of games after it's set.** Add or remove a game mid-tournament
   without losing the games already played.
   - Question: the Games count can already be changed at the bottom of the Games list;
     is the problem with saved tournaments, or something else?

7. **Awards outside tournaments.** Awards that aren't tied to a tournament or training
   (e.g. end of season, player of the month).
   - Question: is that the meaning, or should the awards screen move somewhere else?

8. **Players a side per match.** Change how many play on each side for a single game
   (e.g. 5-a-side normally, 7-a-side in one fixture), without changing the team default.
   - Today "Players a side" is one setting for the whole team (Squad → Team settings).
   - Question: set it per game, or per tournament?

## Later

- Combined fixtures view across all of a coach's teams.
- Paid-plan automatic database backups once real teams depend on it.
- A separate test Firebase project so beta testing never touches live data.
