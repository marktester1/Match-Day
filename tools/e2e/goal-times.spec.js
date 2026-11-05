// A coach corrects a goal's time: during the game (from the goals list) and afterwards in the
// saved results. Times can't be after the clock until full time; after it, any time goes. Beta only; the phone leaves at the end.
const {test, expect} = require('@playwright/test');
const {app, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Goal Times U10s';
const SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay'];

test('goal times can be corrected in the game and in saved results', async ({page}, info) => {
  await page.clock.install();
  const c = app(page, info);
  let joined = false, finished = false;
  const goalTime = () => c.view.locator('[data-goalat]').first();
  try {
    await c.createTeam(TEAM, SQUAD);
    joined = true;
    await c.setUpGames({len: '20', count: '1', periods: '1'});
    await c.openGame(1);
    await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli'], ['Fay']);
    await c.saved();
    await c.press(c.btn('Kick off'));
    await c.saved();
    await page.clock.fastForward(8 * 60000);
    await c.goal('Ben');
    await c.saved();
    await expect(goalTime()).toHaveValue(/^8:0\d$/);

    // During the game: move it to 6:30; a time after the clock is refused
    await goalTime().fill('6:30');
    await goalTime().press('Enter');
    await goalTime().blur();
    await c.toast('Moved to 6:30.');
    await expect(goalTime()).toHaveValue('6:30');
    await goalTime().fill('30:00');
    await goalTime().blur();
    await c.toast("That's after the clock");
    await expect(goalTime()).toHaveValue('6:30');
    await c.saved();
    await c.reload(TEAM);
    await c.openGame(1);
    await expect(goalTime()).toHaveValue('6:30');

    // Afterwards, in the saved results
    await c.fullTime(1);
    // After full time any time goes, even past the 20 minutes (games run over, or the clock was stopped early)
    await goalTime().fill('25:30');
    await goalTime().blur();
    await c.toast('Moved to 25:30.');
    await expect(goalTime()).toHaveValue('25:30');
    await c.saved();
    await c.goTab('games');
    await c.press(c.btn('Finish tournament and save to Results'));
    await c.press(c.btn('Tap again to save and start fresh'));
    await c.press(c.btn('Write it later', c.modal));
    await c.reload(TEAM);
    await c.goTab('season');
    await expect(c.view.locator('.summary')).toContainText('Match days 1');
    const tc = c.view.locator('.tcard').first();
    await c.press(tc.locator('[data-act=topen]'));
    await expect(tc.locator('.tb')).toBeVisible();
    await expect(tc.locator('.gls').filter({hasText: '⚽'})).toContainText("Ben 20+6'"); // after the 20 minutes: added time
    await c.press(tc.getByRole('button', {name: 'Edit'}));
    const t = c.view.locator('[data-ed^="gat|"]').first();
    await expect(t).toHaveValue('25:30');
    await t.fill('15:10');
    await t.blur();
    await c.press(c.btn('Save changes'));
    await c.saved();
    await c.reload(TEAM);
    await c.goTab('season');
    await c.press(c.view.locator('.tcard').first().locator('[data-act=topen]'));
    await expect(c.view.locator('.tcard').first().locator('.gls').filter({hasText: '⚽'})).toContainText("Ben 16'");
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});

test('Half time can be tapped early, and Full time can end the game at its full length', async ({page}, info) => {
  await page.clock.install();
  const c = app(page, info), {view, press, btn, modal, toast} = c;
  const T = 'Claude E2E Half Time U10s';
  let joined = false, finished = false;
  try {
    await c.createTeam(T, SQUAD);
    joined = true;
    await c.setUpGames({len: '20', count: '1', periods: '2'});
    await c.openGame(1);
    await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli'], ['Fay']);
    await c.saved();
    await expect(btn('Half time')).toHaveCount(0); // nothing to end before kick-off
    await press(btn('Kick off'));
    await c.saved();

    // The referee blows at 7 minutes: Half time puts the clock at 10:00, so the 2nd half starts there
    await page.clock.fastForward(7 * 60000);
    await press(btn('Half time'));
    await toast('Half time in game 1.');
    await expect(c.pill()).toHaveText('Half time');
    await expect(btn('Half time')).toHaveCount(0);
    await press(btn('Start 2nd half'));
    await expect(btn('Half time')).toHaveCount(0); // not in the last period
    await c.saved();

    // Full time after 3 more minutes: the pop-up offers 13:00 as it is, or the full 20:00
    await page.clock.fastForward(3 * 60000);
    await press(btn('Full time'));
    await expect(modal).toContainText('The clock shows 3:00 into the 2nd half (of 10:00).');
    await press(btn('End at 10:00', modal));
    await expect(c.pill()).toHaveText('Full time');
    await expect(c.chip('Ben').locator('.m')).toHaveText('20:00'); // on all game: minutes up to 20:00

    // Afterwards the match time can still be changed, e.g. the game ran on
    await press(btn('Change match time'));
    await expect(page.locator('#clkset')).toBeVisible();
    await page.locator('#clkset').fill('22:30');
    await press(btn('Set clock'));
    await toast('Clock set to 22:30.');
    await expect(c.chip('Ben').locator('.m')).toHaveText('22:30');
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(T); }]);
  }
});
