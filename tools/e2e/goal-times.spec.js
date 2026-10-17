// A coach corrects a goal's time: during the game (from the goals list) and afterwards in the
// saved results. Times can't be after the clock. Beta only; the phone leaves at the end.
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
    await c.saved();
    await c.goTab('games');
    await c.press(c.btn('Finish tournament and save to Results'));
    await c.press(c.btn('Tap again to save and start fresh'));
    await c.press(c.btn('Write it later', c.modal));
    await c.reload(TEAM);
    await c.goTab('season');
    const tc = c.view.locator('.tcard').first();
    await c.press(tc.locator('[data-act=topen]'));
    await expect(tc.locator('.tb')).toBeVisible();
    await expect(tc.locator('.gls').filter({hasText: '⚽'})).toContainText("Ben 7'");
    await c.press(tc.getByRole('button', {name: 'Edit'}));
    const t = c.view.locator('[data-ed^="gat|"]').first();
    await expect(t).toHaveValue('6:30');
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
