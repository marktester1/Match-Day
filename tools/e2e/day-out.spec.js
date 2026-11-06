// At a tournament everyone who turns up plays or is a sub, so a game nobody has picked yet starts with
// the whole squad on the bench, and Out is for the whole day: one tap takes a player out of every game
// not yet kicked off, and putting them back in brings them back on the bench in those games.
// Also the Save fixtures button. Beta only; the phone leaves at the end.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Day Out U9s';
const SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay', 'Isabelle'];

test('everyone starts on the bench, and Out lasts the whole day', async ({page}, info) => {
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

    // Game 2 has not been picked: everyone but Isabelle on the bench
    await c.openGame(2);
    expect(await roles()).toEqual({...Object.fromEntries(SQUAD.map(n => [n, 'bench'])), Isabelle: 'out'});

    // Isabelle turns up after all: back on the bench in game 1 too
    await c.role('Isabelle', 'bench');
    await toast('Isabelle is back in for the day, on the bench.');
    await c.openGame(1);
    expect(await roles()).toMatchObject({Ava: 'gk', Ben: 'start', Fay: 'bench', Isabelle: 'bench'});

    // It all sticks after a reload, and game 3 (never opened) follows when it is
    await c.reload(TEAM);
    await c.openGame(3);
    expect(await roles()).toEqual(Object.fromEntries(SQUAD.map(n => [n, 'bench'])));
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
