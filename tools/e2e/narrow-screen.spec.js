// On a 360-wide phone (Galaxy S24, Pixel 9) nothing is wider than the screen, even with a long team
// name: if anything is, the whole page slides sideways and its left edge is cut off. Beta only; the
// phone leaves at the end.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Narrow Screen Wanderers U10s';
const SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay'];
test.use({viewport: {width: 360, height: 780}});

test('every screen fits a 360-wide phone, even with a long team name', async ({page}, info) => {
  const c = app(page, info);
  let joined = false, finished = false;
  const fits = async where => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${where}: wider than the screen`).toBeLessThanOrEqual(0);
  try {
    await c.createTeam(TEAM, SQUAD);
    joined = true;
    await fits('Games, before set-up');
    await c.press(page.locator('#menubtn')); // the ☰ menu at the far right can be tapped
    await expect(c.view).toContainText('Invite code');
    await fits('the menu');
    await c.press(page.locator('[data-act=menuclose]'));
    await c.setUpGames({len: '20', count: '1', periods: '2'});
    await fits('Games');
    await c.openGame(1);
    await fits('a game');
    for (const t of ['minutes', 'notes', 'season', 'awards', 'squad']) { await c.goTab(t); await fits(t); }
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
