// Rugby: a conversion can only follow a try that hasn't been converted yet, for either side.
// Beta only; the phone leaves at the end.
const {test, expect} = require('@playwright/test');
const {app, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Conversions U10s';
const SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay'];

test('a conversion needs an unconverted try, for us and for them', async ({page}, info) => {
  const c = app(page, info);
  let joined = false, finished = false;
  const con = () => c.view.locator('.hint.scorer [data-act=rtype][data-type=con]');
  const pick = async t => { await c.press(c.view.locator(`.hint.scorer [data-act=rtype][data-type=${t}]`)); };
  try {
    await c.createTeam(TEAM, SQUAD);
    joined = true;
    await c.goTab('squad');
    await c.press(page.locator('[data-act=sport][data-v=rugby]'));
    await c.saved();
    await c.setUpGames({len: '20', count: '1', periods: '1'});
    await c.openGame(1);
    await c.pickTeam(null, ['Ava', 'Ben', 'Cal', 'Dev', 'Eli'], ['Fay']);
    await c.saved();
    await c.press(c.btn('Kick off'));
    await c.saved();

    // Us: no try yet, so no conversion
    await c.press(c.plus('us'));
    await expect(con()).toBeDisabled();
    await expect(c.view.locator('.hint.scorer')).toContainText('A conversion needs a try first.');
    await pick('try');
    await c.press(c.view.locator('.hint.scorer [data-act=scorer]').filter({hasText: /^Ben$/}));
    await c.press(c.plus('us'));
    await expect(con()).toBeEnabled();
    await pick('con');
    await c.press(c.view.locator('.hint.scorer [data-act=scorer]').filter({hasText: /^Ben$/}));
    await expect(c.score('us')).toHaveText('7');
    await c.press(c.plus('us'));
    await expect(con()).toBeDisabled(); // that try is already converted
    await c.press(c.view.locator('.hint.scorer [data-act=rcancel]'));

    // Them: the same, counted separately
    await c.press(c.plus('them'));
    await expect(con()).toBeDisabled();
    await pick('try');
    await c.press(c.plus('them'));
    await expect(con()).toBeEnabled();
    await pick('con');
    await expect(c.score('them')).toHaveText('7');
    await c.saved();
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
