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
    await c.press(c.plus('them'));
    await pick('pen');
    await expect(c.score('them')).toHaveText('10');
    await c.saved();

    // What they scored is shown, by type, for countback
    const theirs = c.view.locator('section.log').filter({has: page.locator('h3', {hasText: 'Their scores'})});
    await expect(theirs.locator('.row')).toHaveCount(3);
    await expect(theirs).toContainText('1 try, 1 conversion, 1 penalty');
    await expect(c.view.locator('section.log').filter({has: page.locator('h3', {hasText: 'Our points'})})).toContainText('1 try, 1 conversion');

    // ...in saved results, the summary and what's shared (no names in the plain share)
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
    await expect(tc.locator('.gls').filter({hasText: 'Them:'})).toContainText('Them: 1 try, 1 conversion, 1 penalty');
    await expect(tc.locator('.tsum .summary')).toContainText('Tries 1–1');
    await page.evaluate(() => Object.defineProperty(navigator, 'share', {configurable: true, value: async d => { window.__shared = d.text; }}));
    await c.press(c.btn('Share results', tc));
    await expect.poll(() => page.evaluate(() => window.__shared)).toContain('Tries 1–1');
    const shared = await page.evaluate(() => window.__shared);
    expect(shared).toContain('Them: 1 try, 1 conversion, 1 penalty');
    for (const n of SQUAD) expect(shared).not.toContain(n);
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
