// The first-time set-up wizard: a manager picks Quick start, is interrupted halfway (the page
// reloads) and carries on from the same step, finishes, and next time sets up the match day with
// last time's settings in one tap. Beta only; the phone leaves at the end.
const {test, expect} = require('@playwright/test');
const {app, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Wizard U9s';

test('quick start survives an interruption, and the next match day reuses the settings', async ({page}, info) => {
  const c = app(page, info), {view, press, btn, toast} = c;
  let joined = false, finished = false;
  try {
    await page.goto('/');
    await page.locator('#mkname').fill('Claude (test coach)');
    await press(btn('Create a team'));
    const quick = page.locator('[data-act=wizroute][data-v=quick]');
    await expect(quick).toBeVisible({timeout: 30000});
    joined = true;
    await press(quick);

    // Step 1: a team name is needed; 7-a-side in one tap
    await expect(view.locator('h2')).toHaveText('Your team');
    await press(btn('Next'));
    await toast('Add a team name first.');
    await page.locator('#cfg-team').fill(TEAM);
    await press(page.locator('[data-act=wizsize][data-v="7"]'));
    await press(btn('Next'));

    // Step 2: a messy paste is tidied, and a name already in the squad isn't added twice
    await expect(view.locator('h2')).toHaveText('Your players');
    await page.locator('#bulknames').fill('Ava\n  Ben \n\nCal\nben\nDev\nEli\nFay\nGus');
    await press(btn('Add these names'));
    await expect(view.locator('.wizcount')).toHaveText('7 players');

    // Interrupted: the app opens again on the same step, with the players still there
    await c.saved();
    await page.reload();
    await expect(view.locator('h2')).toHaveText('Your players', {timeout: 30000});
    await expect(view.locator('.wizcount')).toHaveText('7 players');
    await expect(page.locator('#hteam')).toHaveText(TEAM);

    // Finish: quick start uses the usual 7-a-side match (50 minutes in halves)
    await press(btn('Finish'));
    await expect(view).toContainText('Your match day is ready!');
    await expect(view.locator('.wizlist')).toContainText('7 players added');
    await expect(view.locator('.wizlist')).toContainText('1 match set up, 50 minutes in halves');
    await press(btn('Start match day'));
    await expect(view).toContainText('Played 0 of 1');
    await expect(view.locator('[data-act=open]')).toHaveCount(1);

    // The match is played and the match day finished; the next one is set up with the same
    // settings in one tap, and the opponent is offered again
    await c.fixtures([['9:30', 'Riverside', '1']]);
    await c.openGame(1);
    await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli', 'Fay', 'Gus']);
    await c.saved();
    await press(btn('Kick off'));
    await toast('Kicked off.');
    await c.fullTime(1);
    await c.goTab('games');
    await press(btn('Finish tournament and save to Results'));
    await press(btn('Tap again to save and start fresh'));
    await press(btn('Write it later', c.modal));
    await c.goTab('games');
    await expect(view).toContainText('Next match day: same as last time?');
    await expect(view.locator('.setupcard .wizlist')).toContainText('50 minutes a game, halves');
    await expect(view.locator('.setupcard .wizlist')).toContainText('7-a-side · 7 players');
    await press(btn('Yes, same settings'));
    await expect(view.locator('h2')).toHaveText('Fixtures');
    await expect(page.locator('#opps option[value="Riverside"]')).toHaveCount(1);
    await press(btn('← All games'));
    await expect(view).toContainText('Played 0 of 1');
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
