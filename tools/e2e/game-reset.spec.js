// A coach who has been trying the app out resets a game: the pop-up says what goes and what stays,
// Cancel changes nothing, Reset clears the score, goals, cards, subs and clock but keeps the line-up
// and fixture, Undo brings it all back, and a reset sticks after a reload. Beta only; the phone
// leaves at the end.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Reset U10s';
const SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay'];

test('a game can be reset, with a pop-up first and Undo afterwards', async ({page}, info) => {
  const c = app(page, info), {view, press, btn, modal, toast, chip, score, pill} = c;
  let joined = false, finished = false;
  const resetBtn = () => btn('Reset this game…');
  try {
    await c.createTeam(TEAM, SQUAD);
    joined = true;
    await c.setUpGames({len: '20', count: '1', periods: '2'});
    await c.fixtures([['9:30', 'Riverside', '2']]);
    await c.openGame(1);
    await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli'], ['Fay']);
    await expect(resetBtn()).toHaveCount(0); // nothing to reset before kick-off

    // Play a bit: kick off, a goal, a sub and a card
    await press(btn('Kick off'));
    await toast('Kicked off.');
    await c.goal('Ben');
    await press(chip('Cal'));
    await press(modal.locator('.qp').filter({has: page.locator('b').getByText('Fay', {exact: true})}));
    await expect(view.locator('.log').filter({hasText: 'Subs'})).toContainText('▲ Fay');
    await press(chip('Dev'));
    await press(btn('🟨 Yellow card', modal));
    await toast('Dev: yellow card.');
    await expect(score('us')).toHaveText('1');

    // The pop-up says what's cleared and what's kept; Cancel changes nothing
    await press(resetBtn());
    await expect(modal.locator('h3')).toHaveText('Reset game 1?');
    await expect(modal).toContainText('Cleared: the score, goals, cards, subs and the clock');
    await expect(modal).toContainText('Kept: the line-up, opponent, kick-off time and pitch');
    await press(btn('Cancel', modal));
    await expect(modal).toHaveCount(0);
    await expect(score('us')).toHaveText('1');
    await expect(pill()).toHaveText('Live');

    // Reset: back to Not started with the starting line-up and the fixture
    await press(resetBtn());
    await press(btn('Reset game', modal));
    await expect(pill()).toHaveText('Not started');
    await expect(score('us')).toHaveText('0');
    await expect(view.locator('.log')).toHaveCount(0); // no goals, subs or cards listed
    await expect(chip('Cal')).toBeVisible(); // the starter is back on, Fay back on the bench
    await expect(chip('Fay', '.benchbox')).toBeVisible();
    await expect(page.locator('#opponent-g1')).toHaveValue('Riverside');
    await expect(page.locator('#time-g1')).toHaveValue('9:30');
    await expect(page.locator('#pitch-g1')).toHaveValue('2');
    await expect(btn('Kick off')).toBeEnabled();

    // Undo brings the game back as it was
    await expect(view.locator('.undobar')).toContainText('Game 1 reset');
    await press(view.locator('.undobar button'));
    await expect(score('us')).toHaveText('1');
    await expect(pill()).toHaveText('Live');
    await expect(view.locator('.log').filter({hasText: 'Subs'})).toContainText('▲ Fay');

    // Reset again, and it stays reset after a reload
    await press(resetBtn());
    await press(btn('Reset game', modal));
    await expect(pill()).toHaveText('Not started');
    await c.reload(TEAM);
    await c.openGame(1);
    await expect(pill()).toHaveText('Not started');
    await expect(score('us')).toHaveText('0');
    await expect(page.locator('#opponent-g1')).toHaveValue('Riverside');
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
