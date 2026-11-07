// The supporters' page, mirroring the coach's tests: for each thing a coach can do, what a supporter's
// phone shows (follower.spec.js covers the day from first link to saved results; injury-time.spec.js added
// time). Every step also checks that no player's name ever reaches the supporter. Beta only; the coach
// leaves at the end.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app, newPhone, cleanUp, nameRe, DAY} = require('./helpers');

const SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay'];
const niceDay = d => 'Sun Mon Tue Wed Thu Fri Sat'.split(' ')[d.getDay()] + ' ' + d.getDate() + ' ' + 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[d.getMonth()];

// A coach with a team and a supporters' link, and a supporter's phone on it
async function setUp(page, browser, info, team, {sport} = {}) {
  const c = app(page, info);
  await c.createTeam(team, SQUAD);
  if (sport === 'rugby') { await c.goTab('squad'); await c.press(page.locator('[data-act=sport][data-v=rugby]')); await c.saved(); }
  await c.press(page.locator('#menubtn'));
  await c.press(c.view.getByRole('button', {name: /Create a supporters' link/}));
  await c.toast("Supporters' link ready.");
  const link = (await c.view.locator('.plink').textContent()).trim();
  await c.saved();
  await c.press(page.locator('[data-act=menuclose]'));
  const fan = await newPhone(browser, info);
  await fan.page.goto(link);
  const board = fan.page.locator('.pboard');
  await expect(board).toBeVisible({timeout: 30000});
  const noNames = async () => {
    const text = await fan.page.locator('body').innerText();
    for (const n of SQUAD) expect(text, `the supporter sees ${n}`).not.toMatch(nameRe(n));
  };
  return {c, fan, board, status: board.locator('.pst'), big: board.locator('.big'), rows: fan.page.locator('.prow'), noNames};
}
const kickOff = async (c, n, gk = 'Ava') => {
  await c.openGame(n);
  await c.pickTeam(gk, gk ? ['Ben', 'Cal', 'Dev', 'Eli'] : ['Ava', 'Ben', 'Cal', 'Dev', 'Eli'], ['Fay']); // rugby: no keeper, five start
  await c.press(c.btn('Kick off'));
  await c.toast('Kicked off.');
};

test('football in halves: every state of a game, and fixture changes, reach supporters', async ({page, browser}, info) => {
  test.setTimeout(5 * 60 * 1000);
  const TEAM = 'Claude E2E Mirror U10s';
  let joined = false, finished = false, s;
  try {
    s = await setUp(page, browser, info, TEAM);
    joined = true;
    const {c, fan, board, status, big, rows, noNames} = s;
    await c.setUpGames({name: 'Mirror Cup', len: '20', count: '2', periods: '2'});
    await c.fixtures([['9:30', 'Riverside', '2'], ['10:15', 'Hillside', '4']]);

    // Before kick-off: the date (not today) and kick-off time; both games still to play
    await expect(status).toHaveText(`${niceDay(new Date(DAY + 'T12:00'))} · 9:30`);
    await expect(rows).toHaveCount(2);
    await expect(fan.page.locator('#view')).toContainText('Still to play');
    await noNames();

    // Kick-off: 1st half, the clock running
    await kickOff(c, 1);
    await expect(status).toHaveText('1st half', {timeout: 30000});
    const clock = board.locator('.pclock');
    const t1 = await clock.textContent();
    await expect.poll(() => clock.textContent(), {timeout: 10000}).not.toBe(t1);

    // Paused: says so, and the clock stands still; resumed: running again
    await c.press(c.btn('Pause'));
    await expect(status).toHaveText('Clock paused', {timeout: 30000});
    const p1 = await clock.textContent();
    await fan.page.waitForTimeout(2500);
    await expect(clock).toHaveText(p1);
    await c.press(c.btn('Resume'));
    await expect(status).toHaveText('1st half', {timeout: 30000});

    // Goals both ways, and one taken back: the score follows
    await c.goal('Ben');
    await expect(big).toHaveText('1–0', {timeout: 30000});
    await c.press(c.plus('them'));
    await expect(big).toHaveText('1–1', {timeout: 30000});
    await c.press(c.view.locator('.board [data-act=score][data-k=them][data-d="-1"]'));
    await expect(big).toHaveText('1–0', {timeout: 30000});

    // Cards: yellow then red, and the banners say so (never who)
    await c.press(c.chip('Dev'));
    await c.press(c.btn('🟨 Yellow card', c.modal));
    await expect.poll(() => fan.page.locator('.pbanner').textContent().catch(() => ''), {timeout: 30000}).toContain('Yellow card');
    await c.press(c.chip('Eli'));
    await c.press(c.btn('🟥 Red card', c.modal));
    await expect.poll(() => fan.page.locator('.pbanner').textContent().catch(() => ''), {timeout: 30000}).toContain('Red card');
    await noNames();

    // Half time, 2nd half, full time: each shows, and the game moves to Played with its score
    await c.press(c.btn('Half time'));
    await expect(status).toHaveText('Half time', {timeout: 30000});
    await c.press(c.btn('Start 2nd half'));
    await expect(status).toHaveText('2nd half', {timeout: 30000});
    await c.fullTime(1);
    await expect(status).toHaveText('Full time', {timeout: 30000});
    await expect(rows.nth(0)).toContainText('1–0');
    await expect(fan.page.locator('#view')).toContainText('Played');

    // Reopened (a mistake): not Full time any more; reset: back to 0–0 before kick-off
    await c.press(c.btn('Reopen game'));
    await expect(status).not.toHaveText('Full time', {timeout: 30000});
    await c.press(c.btn('Reset this game…'));
    await c.press(c.btn('Reset game', c.modal));
    await expect(big).toHaveText('0–0', {timeout: 30000});
    await expect(status).toHaveText(`${niceDay(new Date(DAY + 'T12:00'))} · 9:30`, {timeout: 30000});

    // Fixture changes on the day: opponent, time, pitch, home or away, a game added and taken off
    await c.goTab('games');
    await c.press(c.btn('Enter opponents and kick-off times'));
    await c.enter('#fx-o-g2', 'Oakfield');
    await c.enter('#fx-t-g2', '10:45');
    await c.enter('#fx-p-g2', '5');
    await expect(rows.nth(1)).toContainText('Oakfield', {timeout: 30000});
    await expect(rows.nth(1)).toContainText('Pitch 5');
    await c.press(page.locator('[data-act=fxside][data-g=g2][data-v=away]'));
    await expect(rows.nth(1)).toContainText(/Oakfield v /, {timeout: 30000}); // away: they're the home side
    await c.press(c.btn('+ Add a game'));
    await c.enter('#fx-o-g3', 'Westbury');
    await expect(rows).toHaveCount(3, {timeout: 30000});
    await c.press(c.btn('Remove last game'));
    await expect(rows).toHaveCount(2, {timeout: 30000});
    await c.press(c.btn('Save fixtures'));

    // The team's scoreboard name changes: supporters see the new one
    await c.goTab('squad');
    await c.enter('#cfg-short', 'Mirror Town');
    await expect(fan.page.locator('#view')).toContainText('Mirror Town', {timeout: 30000});
    await noNames();
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await s.c.leave(TEAM); }, async () => { if (s) await s.fan.ctx.close(); }]);
  }
});

test('quarters, one period, and a single match today: the right words for each', async ({page, browser}, info) => {
  test.setTimeout(5 * 60 * 1000);
  const TEAM = 'Claude E2E Quarters U9s';
  let joined = false, finished = false, s;
  try {
    s = await setUp(page, browser, info, TEAM);
    joined = true;
    const {c, status, noNames} = s;
    await c.setUpGames({name: 'Quarter Cup', len: '20', count: '1', periods: '4'});
    await c.fixtures([['9:30', 'Riverside', '2']]);
    await kickOff(c, 1);
    await expect(status).toHaveText('Quarter 1', {timeout: 30000});
    await c.press(c.btn('End of Q1'));
    await expect(status).toHaveText('End of quarter 1', {timeout: 30000});
    await c.press(c.page.getByRole('button', {name: /^Start (Q2|quarter 2|2nd quarter)$/i}));
    await expect(status).toHaveText('Quarter 2', {timeout: 30000});
    await c.fullTime(1);
    await expect(status).toHaveText('Full time', {timeout: 30000});

    // Next match day: one match, today, one period: before kick-off just the time; then "Live"
    await c.goTab('games');
    await c.press(c.btn('Finish tournament and save to Results'));
    await c.press(c.page.getByRole('button', {name: /Tap again to save/}));
    await c.press(c.btn('Write it later', c.modal));
    await c.goTab('games');
    await c.press(c.btn('Change something'));
    const today = new Date().toLocaleDateString('en-CA');
    for (const [sel, v] of [['#tname', 'Friendly'], ['#tdate', today], ['#len', '20'], ['#cnt', '1'], ['#tsize', '5']]) await c.enter(sel, v);
    await c.press(page.locator('[data-act=periods][data-v="1"]'));
    await c.press(c.btn('Set up games'));
    await c.press(c.btn('Enter opponents and kick-off times'));
    await c.enter('#fx-t-g1', '14:00');
    await c.enter('#fx-o-g1', 'Hillside');
    await c.press(c.btn('Save fixtures'));
    await expect(status).toHaveText('14:00', {timeout: 30000}); // today: no date
    await c.openGame(1);
    await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli'], ['Fay']);
    await c.press(c.btn('Kick off'));
    await expect(status).toHaveText('Live', {timeout: 30000});
    await noNames();
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await s.c.leave(TEAM); }, async () => { if (s) await s.fan.ctx.close(); }]);
  }
});

test('rugby: supporters see the points, and alerts say Scores not Goals', async ({page, browser}, info) => {
  const TEAM = 'Claude E2E Rugby Mirror U12s';
  let joined = false, finished = false, s;
  try {
    s = await setUp(page, browser, info, TEAM, {sport: 'rugby'});
    joined = true;
    const {c, fan, big, noNames} = s;
    await c.setUpGames({name: 'Sevens', len: '20', count: '1', periods: '1'});
    await c.fixtures([['9:30', 'Riverside', '2']]);
    await kickOff(c, 1, null);
    await c.press(c.plus('us'));
    await c.press(c.view.locator('.hint.scorer [data-act=rtype][data-type=try]'));
    await c.press(c.view.locator('.hint.scorer [data-act=scorer]').filter({hasText: /^Ben$/}));
    await c.press(c.plus('us'));
    await c.press(c.view.locator('.hint.scorer [data-act=rtype][data-type=con]'));
    await c.press(c.view.locator('.hint.scorer [data-act=scorer]').filter({hasText: /^Ben$/}));
    await expect(big).toHaveText('7–0', {timeout: 30000});
    await expect(fan.page.locator('.kinds button')).toContainText(['Kick-off', 'Scores', 'Cards', 'Full time']);
    await noNames();
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await s.c.leave(TEAM); }, async () => { if (s) await s.fan.ctx.close(); }]);
  }
});

test('saving the day, Undo, and clearing without saving: what supporters see', async ({page, browser}, info) => {
  test.setTimeout(5 * 60 * 1000);
  const TEAM = 'Claude E2E Undo Mirror U10s';
  let joined = false, finished = false, s;
  try {
    s = await setUp(page, browser, info, TEAM);
    joined = true;
    const {c, fan, status, big, rows} = s;
    await c.setUpGames({name: 'Undo Cup', len: '20', count: '2', periods: '1'});
    await c.fixtures([['9:30', 'Riverside', '2'], ['10:00', 'Hillside', '3']]);
    for (const n of [1, 2]) { await kickOff(c, n); if (n === 1) await c.goal('Ben'); await c.fullTime(n); }
    await expect(rows.nth(0)).toContainText('1–0', {timeout: 30000});

    // Saved: the results stay up; Undo: still the same day (nothing lost for supporters)
    await c.press(c.btn("Save today's results"));
    await expect(c.modal.locator('h3')).toHaveText('Tournament saved ✓');
    await fan.page.reload();
    await expect(rows.nth(0)).toContainText('1–0', {timeout: 30000});
    await c.press(c.btn('Undo: put the day back', c.modal));
    await c.toast('The day is back, and taken out of Results.');
    await fan.page.reload();
    await expect(rows).toHaveCount(2, {timeout: 30000});
    await expect(rows.nth(0)).toContainText('1–0');

    // Clear without saving: the fixtures stay, the scores go
    await c.press(c.btn('Clear scores and line-ups without saving'));
    await c.press(c.btn('Tap again to clear without saving'));
    await expect(rows.nth(0)).not.toContainText('1–0', {timeout: 30000});
    await expect(rows.nth(0)).toContainText('Riverside');
    await expect(big).toHaveText('0–0');
    await expect(status).not.toHaveText('Full time');
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await s.c.leave(TEAM); }, async () => { if (s) await s.fan.ctx.close(); }]);
  }
});

test("iPhone Safari: the notifications card says to add the page to the Home Screen first", async ({browser}, info) => {
  test.skip(info.project.name !== 'iphone-webkit' || !!process.env.ANDROID, 'an iPhone browser only');
  const ctx = await browser.newContext({...info.project.use});
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('#mkname')).toBeVisible({timeout: 30000});
  const card = await page.evaluate(() => { S.fpush = null; return followPushCard({sport: 'football'}); });
  expect(card).toContain('add this page to your Home Screen');
  expect(card).not.toContain('Open in Chrome');
  await ctx.close();
});
