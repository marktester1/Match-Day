// A clock left running (no Full time) must never stop the game saving. The server refuses game
// times over 10 hours, so the app stops the clock by itself an hour after the game should have
// ended, and everything after that still saves. Beta only; the phone leaves at the end.
const {test, expect} = require('@playwright/test');
const {app, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Clock U10s';
const SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay', 'Gus'];

test('a clock left running for 12 hours stops itself, and subs and full time still save', async ({page}, info) => {
  await page.clock.install();
  const c = app(page, info);
  let joined = false, finished = false;
  try {
    await c.createTeam(TEAM, SQUAD);
    joined = true;
    await c.setUpGames({len: '20', count: '1', periods: '1'});
    await c.openGame(1);
    await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli'], ['Fay', 'Gus']);
    await c.saved();
    await c.press(c.btn('Kick off'));
    await c.toast('Kicked off.');
    await c.saved();

    // Nobody taps Full time; the phone comes back 12 hours later
    await page.clock.fastForward(12 * 3600000);
    await c.toast("Game 1's clock stopped by itself. Did you forget Full time?");
    await expect(c.view.locator('.board .t')).toHaveText('80:00'); // 20 minutes, plus an hour
    await expect(c.view).toContainText('The clock stopped by itself');

    // A sub and full time both reach the server
    await c.press(c.chip('Ben'));
    await c.press(c.modal.locator('.qp').filter({has: page.locator('b').getByText('Fay', {exact: true})}));
    await expect(c.chip('Fay')).toBeVisible();
    await c.fullTime(1);
    await c.saved();
    await expect(page.locator('body')).not.toContainText('Not saved');
    await c.reload(TEAM);
    await c.openGame(1);
    await expect(c.pill()).toHaveText('Full time');
    await expect(c.view.locator('.log').filter({hasText: 'Subs'})).toContainText('▲ Fay');
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
