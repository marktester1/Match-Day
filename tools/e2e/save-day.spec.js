// Saving the day: when the last game reaches full time, the game screen offers to save the day there and then.
// Saving says so and shows it in Season → Results; Undo puts the whole day back (and takes it out of Results).
// Saving from the Games list with games not finished names them before the second tap. Beta only.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Save Day U9s';
const SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay'];

test('the last game offers to save the day, and Undo puts it back', async ({page}, info) => {
  const c = app(page, info), {view, press, btn, modal, toast} = c;
  let joined = false, finished = false;
  const play = async n => {
    await c.openGame(n);
    await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli']);
    await press(btn('Kick off'));
    await toast('Kicked off.');
    if (n === 1) await c.goal('Ben');
    await c.fullTime(n);
  };
  try {
    await c.createTeam(TEAM, SQUAD);
    joined = true;
    await c.setUpGames({name: 'Spring Cup', len: '10', count: '2', periods: '1'});
    await c.fixtures([['9:30', 'Riverside', '2'], ['10:00', 'Hillside', '3']]);

    // Game 1 isn't the last: no offer. From the Games list, saving names the game not finished yet
    await play(1);
    await expect(btn("Save today's results")).toHaveCount(0);
    await c.goTab('games');
    await press(btn('Finish tournament and save to Results'));
    await expect(btn('Game 2 not finished. Tap again to save anyway')).toBeVisible();

    // The last game's full time: save right there, in one tap
    await play(2);
    await expect(view.locator('.card h3', {hasText: 'That was the last game'})).toBeVisible();
    await press(btn("Save today's results"));
    await expect(modal.locator('h3')).toHaveText('Tournament saved ✓');
    await expect(modal).toContainText('Spring Cup');
    await expect(modal).toContainText('W1 D1 L0');
    await expect(view.locator('.tcard .tn', {hasText: 'Spring Cup'})).toBeVisible(); // Season → Results, behind the message

    // Saved too soon? Undo puts the day back, and takes it out of Results
    await press(btn('Undo: put the day back', modal));
    await toast('The day is back, and taken out of Results.');
    await expect(view.locator('.gcard')).toHaveCount(2);
    await expect(view.locator('.gcard').nth(0)).toContainText('1–0');
    await expect(view.locator('.gcard').nth(1)).toContainText('Full time');
    await c.reload(TEAM);
    await expect(view.locator('.gcard').nth(0)).toContainText('1–0'); // it stuck
    await c.goTab('season');
    await expect(view.locator('.tcard')).toHaveCount(0);

    // Save it for real
    await c.openGame(2);
    await press(btn("Save today's results"));
    await expect(modal.locator('h3')).toHaveText('Tournament saved ✓');
    await press(btn('Write it later', modal));
    await expect(view.locator('.tcard .tn', {hasText: 'Spring Cup'})).toBeVisible();
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
