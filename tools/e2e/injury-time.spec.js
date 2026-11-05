// Added (injury) time: the clock pauses itself at half time as before; "Play added time" carries the
// 1st half on ("+1:30 added time"), a goal in it reads 10+2', Half time ends it, the 2nd half starts
// on screen at 0:00 (10:00 from kick-off on the usual clock), players' minutes include the added time,
// and saved results keep the 10+2'. Beta data only (needs the
// beta rules that allow a game's `added` field); the phone leaves at the end.
const {test, expect} = require('./test');
const {app, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Injury Time U10s';
const SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay'];

test('added time at half time and full time', async ({page}, info) => {
  await page.clock.install();
  const c = app(page, info), {view, press, btn, modal, toast} = c;
  const sub = () => view.locator('.clock .lenbtn');
  const clock = () => view.locator('.clock .t');
  let joined = false, finished = false;
  try {
    await c.createTeam(TEAM, SQUAD);
    joined = true;
    await c.setUpGames({len: '20', count: '1', periods: '2'});
    await c.openGame(1);
    await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli'], ['Fay']);
    await c.saved();
    await press(btn('Kick off'));
    await c.saved();

    // 10 minutes: the clock pauses itself, as before, and offers added time
    await page.clock.fastForward(10 * 60000 + 2000);
    await toast('Half time in game 1. Added time? Tap Play added time.');
    await expect(c.pill()).toHaveText('Half time');
    await expect(btn('Start 2nd half')).toBeVisible();
    await press(btn('Play added time'));
    await toast('Added time. Tap Half time when the referee blows.');
    await expect(c.pill()).toHaveText('Live');

    // 1:30 of added time, with a goal in it
    await page.clock.fastForward(75 * 1000);
    await c.goal('Ben');
    await page.clock.fastForward(15 * 1000);
    await expect(clock()).toHaveText('10:00');
    await expect(sub()).toHaveText(/^\+1:3\d added time$/);
    await expect(view.locator('.gmin').first()).toHaveText("10+2'");
    await press(btn('Half time'));
    await toast(/Half time in game 1, after 1:3\d added time\./);
    await expect(c.pill()).toHaveText('Half time');
    await expect(btn('Play added time')).toHaveCount(0); // already ended: straight on to the 2nd half
    await c.saved();

    // 2nd half starts on screen at 0:00 of 10:00
    await press(btn('Start 2nd half'));
    await page.clock.fastForward(4 * 60000);
    await expect(clock()).toHaveText(/^4:0\d$/);
    await expect(sub()).toHaveText('2nd half · of 10:00');
    await c.saved();

    // Full time at the usual time, plus 1 minute added: minutes include both lots of added time
    await page.clock.fastForward(7 * 60000);
    await expect(sub()).toHaveText(/^\+1:0\d added time$/);
    await press(btn('Full time'));
    await press(modal.locator('[data-act=ftyes]:not([data-full])'));
    await expect(c.pill()).toHaveText('Full time');
    // on the pitch all game: 10 + 1:30 + 10 + 1:00 = 22:30 (give or take the seconds)
    await expect(c.chip('Ben').locator('.m')).toHaveText(/^22:3\d$/);
    await c.saved();

    // Saved results keep the added time: Ben's goal is 10+2'
    await c.goTab('games');
    await press(btn('Finish tournament and save to Results'));
    await press(btn('Tap again to save and start fresh'));
    await press(btn('Write it later', modal));
    await c.reload(TEAM);
    await c.goTab('season');
    const tc = view.locator('.tcard').first();
    await press(tc.locator('[data-act=topen]'));
    await expect(tc.locator('.gls').filter({hasText: '⚽'})).toContainText("Ben 10+2'");
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
