// At a tournament everyone who turns up plays or is a sub, so a game nobody has picked yet starts with
// the whole squad on the bench, and Out is for the whole day: one tap takes a player out of every game
// not yet kicked off, and putting them back in brings them back on the bench in those games.
// Also the Save fixtures button. Beta only; the phone leaves at the end.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app, newPhone, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Day Out U9s';
const SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay', 'Isabelle'];

test('everyone starts on the bench, and Out lasts the whole day', async ({page, browser}, info) => {
  const c = app(page, info), {view, press, btn, toast} = c;
  let joined = false, finished = false;
  const roleOf = async name => {
    const row = view.locator('.row').filter({has: page.locator('.who').getByText(name, {exact: true})});
    return row.locator('[data-act=role].on').getAttribute('data-r');
  };
  const roles = async () => Object.fromEntries(await Promise.all(SQUAD.map(async n => [n, await roleOf(n)])));
  try {
    await c.createTeam(TEAM, SQUAD);
    joined = true;
    await c.setUpGames({len: '10', count: '3', periods: '1'});

    // Fixtures: Save keeps the box still being typed in and goes back to all games
    await press(btn('Enter opponents and kick-off times'));
    await c.enter('#fx-o-g1', 'Riverside');
    const last = page.locator('#fx-o-g2');
    await last.fill('Hillside'); // not left yet
    await press(btn('Save fixtures'));
    await toast('Fixtures saved.');
    await expect(view.locator('.gcard')).toHaveCount(3);
    await expect(view.locator('.gcard').nth(1)).toContainText('Hillside');

    // Game 1: the whole squad is on the bench; Isabelle out is one tap
    await c.openGame(1);
    expect(await roles()).toEqual(Object.fromEntries(SQUAD.map(n => [n, 'bench'])));
    await c.role('Isabelle', 'out');
    await toast('Isabelle is out for the day.');
    await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli']);
    expect(await roles()).toMatchObject({Fay: 'bench', Isabelle: 'out'});

    // Minutes: Isabelle is out, so she isn't listed (or counted), and the minutes count up live
    await c.goTab('minutes');
    const mrow = n => view.locator('.mrow').filter({has: page.locator('.who').getByText(n, {exact: true})});
    await expect(view.locator('.mrow')).toHaveCount(6);
    await expect(mrow('Isabelle')).toHaveCount(0);
    await expect(view).toContainText('Out today: Isabelle.');

    // Game 2 has not been picked: everyone but Isabelle on the bench
    await c.openGame(2);
    expect(await roles()).toEqual({...Object.fromEntries(SQUAD.map(n => [n, 'bench'])), Isabelle: 'out'});

    // Isabelle turns up after all: back on the bench in game 1 too
    await c.role('Isabelle', 'bench');
    await toast('Isabelle is back in for the day, on the bench.');
    await c.openGame(1);
    expect(await roles()).toMatchObject({Ava: 'gk', Ben: 'start', Fay: 'bench', Isabelle: 'bench'});

    await c.goTab('minutes');
    await expect(mrow('Isabelle')).toHaveCount(1); // brought back in: listed again
    await expect(view).not.toContainText('Out today');

    // During play the minutes count up live, in seconds
    await c.openGame(1);
    await press(btn('Kick off'));
    await toast('Kicked off.');
    await c.goTab('minutes');
    await expect(mrow('Ben').locator('.tot')).toHaveText(/^0:0[2-9]$/, {timeout: 15000});
    await c.openGame(1);
    await press(btn('Pause'));
    // Each player's button shows their minutes for the whole day: in game 2, Ben's are from game 1
    await expect(c.chip('Ben').locator('.d')).toHaveText('today');
    const ben1 = await c.chip('Ben').locator('.m').textContent();
    await c.openGame(2);
    await expect(c.chip('Ben', '.benchbox').locator('.m')).toHaveText(ben1);
    await expect(c.chip('Ben', '.benchbox').locator('.m')).not.toHaveText('0:00');

    // It all sticks after a reload, and game 3 (never opened) follows when it is
    await c.reload(TEAM);
    await c.openGame(3);
    expect(await roles()).toEqual(Object.fromEntries(SQUAD.map(n => [n, 'bench'])));

    // Supporters: a game taken off the day after a reload (so this phone hadn't sent it this visit) goes from their list
    await press(page.locator('#menubtn'));
    await press(view.getByRole('button', {name: /Create a supporters' link/}));
    await toast("Supporters' link ready.");
    const link = (await view.locator('.plink').textContent()).trim();
    await c.saved();
    await press(page.locator('[data-act=menuclose]'));
    const fan = await newPhone(browser, info);
    await fan.page.goto(link);
    await expect(fan.page.locator('.prow')).toHaveCount(3, {timeout: 30000});
    await c.reload(TEAM);
    await c.goTab('games');
    await press(btn('Enter opponents and kick-off times'));
    await press(btn('Remove last game'));
    await expect(fan.page.locator('.prow')).toHaveCount(2, {timeout: 30000});
    await fan.ctx.close();
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
