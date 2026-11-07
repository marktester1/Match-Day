// The first-time set-up wizard: a manager picks Quick start, is interrupted halfway (the page
// reloads) and carries on from the same step, finishes, and next time sets up the match day with
// last time's settings in one tap. Beta only; the phone leaves at the end.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Wizard U9s', RUGBY = 'Claude E2E Wizard Rugby U8s', LATER = 'Claude E2E Wizard Later U12s', ONE = 'Claude E2E Wizard One Match U10s';

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
    await press(page.getByRole('button', {name: /^(Tap again to save and start fresh|Games? [0-9, ]+ not finished\. Tap again to save anyway)$/}));
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

test('full set-up: rugby, a size of our own, a tournament with fixtures, interrupted on the last step', async ({page}, info) => {
  const c = app(page, info), {view, press, btn, toast} = c;
  const h2 = () => view.locator('h2');
  let joined = false, finished = false;
  try {
    await page.goto('/');
    await page.locator('#mkname').fill('Claude (test coach)');
    await press(btn('Create a team'));
    await expect(page.locator('[data-act=wizroute][data-v=full]')).toBeVisible({timeout: 30000});
    joined = true;
    await press(page.locator('[data-act=wizroute][data-v=full]'));

    // Step 1 of 4: rugby has its own sizes; "Other" takes any size from 3 to 11
    await expect(view).toContainText('Step 1 of 4');
    await page.locator('#cfg-team').fill(RUGBY);
    await press(page.locator('[data-act=sport][data-v=rugby]'));
    await expect(page.locator('[data-act=wizsize]')).toHaveText(['4', '6', '7', '8', '9', '10', 'Other']);
    await expect(page.locator('#cfg-team')).toHaveValue(RUGBY); // typed name kept through the redraw
    await press(page.locator('[data-act=wizsize][data-v=other]'));
    await page.locator('#wizsize').fill('3');
    await press(btn('Next'));

    // Step 2 of 4: no players yet is caught; names typed but not "added" still count on Next
    await expect(h2()).toHaveText('Your players');
    await expect(view).toContainText('Step 2 of 4');
    await press(btn('Next'));
    await toast('Add at least one player.');
    await page.locator('#bulknames').fill('Ava Smith\nBen\nCal');
    await press(btn('Next'));
    await expect(h2()).toHaveText('Your match day');

    // Back keeps everything: three players (surname dropped), and the team step remembers rugby and 3-a-side
    await press(btn('← Back'));
    await expect(view.locator('.wizcount')).toHaveText('3 players');
    await expect(view.locator('.rows .who')).toHaveText(['Ava', 'Ben', 'Cal']);
    await press(btn('← Back'));
    await expect(h2()).toHaveText('Your team');
    await expect(page.locator('#cfg-team')).toHaveValue(RUGBY);
    await expect(page.locator('[data-act=sport][data-v=rugby]')).toHaveClass(/\bon\b/);
    await expect(page.locator('#wizsize')).toHaveValue('3');
    await press(btn('Next'));
    await press(btn('Next'));

    // Step 3 of 4: one match in halves by default (40 minutes for a small side); then a tournament
    await expect(h2()).toHaveText('Your match day');
    await expect(page.locator('#len')).toHaveValue('40');
    await expect(page.locator('[data-act=periods][data-v="2"]')).toHaveClass(/\bon\b/);
    await press(page.locator('[data-act=wizkind][data-v="0"]'));
    await expect(page.locator('#cnt')).toHaveValue('6');
    await c.enter('#cnt', '3');
    await c.enter('#len', '12');
    await press(btn('Next'));

    // Step 4 of 4: fixtures for two of the three games, then an interruption
    await expect(h2()).toHaveText('Fixtures');
    await expect(view.locator('[data-fx$="|opponent"]')).toHaveCount(3);
    await expect(page.locator('#fxpaste')).toBeVisible(); // a tournament can paste the organisers' list
    await c.enter('#fx-t-g1', '9:30');
    await c.enter('#fx-o-g1', 'Riverside');
    await c.enter('#fx-o-g2', 'Hillside');
    await c.enter('#fx-p-g2', '3');
    await c.saved();
    await page.reload();
    await expect(h2()).toHaveText('Fixtures', {timeout: 30000});
    await expect(page.locator('#fx-o-g1')).toHaveValue('Riverside');
    await expect(page.locator('#fx-p-g2')).toHaveValue('3');
    await press(btn('Finish'));

    // Done: what was set up, then the games list as set up
    await expect(h2()).toHaveText('Your match day is ready!');
    const done = view.locator('.wizlist');
    await expect(done).toContainText('3 players added');
    await expect(done).toContainText('3 games set up, 12 minutes');
    await expect(done).toContainText('2 opponents added');
    await expect(view).toContainText('Invite other coaches');
    await expect(view).toContainText('Tip: put Match Day on your Home Screen'); // a browser, not yet on the Home Screen
    await press(btn('Start match day'));
    await expect(view).toContainText('Played 0 of 3');
    await expect(view.locator('.gcard').nth(0)).toContainText('v Riverside');
    await expect(view.locator('.gcard').nth(1)).toContainText('v Hillside');
    await expect(view.locator('.gcard').nth(1)).toContainText('Pitch 3');
    await expect(view.locator('.gcard').nth(2)).toContainText('Opponent not set');
    await expect(view.locator('.setupline')).toContainText('3 games × 12 min · 3-a-side');

    // and it stays set up: no wizard after a reload, rugby in the team settings
    await c.reload(RUGBY);
    await expect(view).toContainText('Played 0 of 3');
    await c.goTab('squad');
    await expect(page.locator('[data-act=sport][data-v=rugby]')).toHaveClass(/\bon\b/);
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(RUGBY); }]);
  }
});

test('"Do this later" leaves the wizard for good, and Back goes all the way to the start', async ({page}, info) => {
  const c = app(page, info), {view, press, btn} = c;
  const h2 = () => view.locator('h2');
  let joined = false, finished = false;
  try {
    await page.goto('/');
    await page.locator('#mkname').fill('Claude (test coach)');
    await press(btn('Create a team'));
    await expect(page.locator('[data-act=wizroute][data-v=quick]')).toBeVisible({timeout: 30000});
    joined = true;

    // Quick start, then Back to change our mind
    await press(page.locator('[data-act=wizroute][data-v=quick]'));
    await expect(view).toContainText('Step 1 of 2');
    await expect(page.locator('#tabs')).toBeHidden(); // the wizard stands alone: no tabs to wander off to
    await press(btn('← Back'));
    await expect(h2()).toHaveText('How much do you want to set up now?');
    await press(page.locator('[data-act=wizroute][data-v=full]'));
    await expect(view).toContainText('Step 1 of 4');
    await page.locator('#cfg-team').fill(LATER);
    await press(page.locator('[data-act=wizsize][data-v="11"]'));
    await press(btn('Next'));
    await page.locator('#bulknames').fill('Ava\nBen');
    await press(btn('Add these names'));
    await expect(view.locator('.wizcount')).toHaveText('2 players');
    await expect(view).toContainText('You need at least 11 for 11-a-side: 9 more to go.');
    await expect(page.locator('#bulknames')).toHaveValue(''); // the box empties once the names are in
    await press(btn('Next'));
    await expect(h2()).toHaveText('Your match day');
    await expect(page.locator('#len')).toHaveValue('60'); // the usual 11-a-side match, as long as a game can be
    await press(btn('Do this later'));

    // The games can be set up from the Games tab, and the wizard doesn't come back
    await expect(page.locator('#tabs')).toBeVisible();
    await expect(view).toContainText('Set up your games');
    await c.reload(LATER);
    await expect(view).toContainText('Set up your games');
    await expect(view).not.toContainText('How much do you want to set up now?');
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(LATER); }]);
  }
});

test('one match: the last step is "Your match", with a Home | Away switch and no fixture list to paste', async ({page}, info) => {
  const c = app(page, info), {view, press, btn} = c;
  const h2 = () => view.locator('h2');
  let joined = false, finished = false;
  try {
    await page.goto('/');
    await page.locator('#mkname').fill('Claude (test coach)');
    await press(btn('Create a team'));
    await expect(page.locator('[data-act=wizroute][data-v=full]')).toBeVisible({timeout: 30000});
    joined = true;
    await press(page.locator('[data-act=wizroute][data-v=full]'));
    await page.locator('#cfg-team').fill(ONE);
    await press(btn('Next'));
    await page.locator('#bulknames').fill('Ava\nBen\nCal\nDev\nEli');
    await press(btn('Next'));
    await expect(h2()).toHaveText('Your match day');
    await press(btn('Next')); // one match is the default

    await expect(h2()).toHaveText('Your match');
    await expect(view).toContainText("Who you're playing and when, if you know. Or add it on the day.");
    await expect(page.locator('#fxpaste')).toHaveCount(0);
    await expect(view.locator('[data-fx$="|opponent"]')).toHaveCount(1);

    // Both choices on show, Home picked to start with
    const home = page.locator('[data-act=fxside][data-g=g1][data-v=home]'), away = page.locator('[data-act=fxside][data-g=g1][data-v=away]');
    await expect(home).toHaveText('Home');
    await expect(away).toHaveText('Away');
    await expect(home).toHaveClass(/\bon\b/);
    await expect(away).not.toHaveClass(/\bon\b/);
    await expect(home).toHaveAttribute('aria-pressed', 'true');
    const size = await away.boundingBox();
    expect(size.height).toBeGreaterThanOrEqual(40); // big enough for a thumb

    // Away picks away; tapping it again keeps it (no flipping back by accident); it survives a reload
    await c.enter('#fx-o-g1', 'Riverside');
    await press(away);
    await expect(away).toHaveClass(/\bon\b/);
    await expect(home).not.toHaveClass(/\bon\b/);
    await press(away);
    await expect(away).toHaveClass(/\bon\b/);
    await c.saved();
    await page.reload();
    await expect(h2()).toHaveText('Your match', {timeout: 30000});
    await expect(page.locator('[data-act=fxside][data-g=g1][data-v=away]')).toHaveClass(/\bon\b/);
    await press(btn('Finish'));
    await expect(h2()).toHaveText('Your match day is ready!');
    await press(btn('Start match day'));
    await expect(view.locator('.gcard').nth(0)).toContainText('Riverside');

    // Home again from the Games screen's fixture list
    await press(btn('Enter opponents and kick-off times'));
    await press(page.locator('[data-act=fxside][data-g=g1][data-v=home]'));
    await expect(page.locator('[data-act=fxside][data-g=g1][data-v=home]')).toHaveClass(/\bon\b/);
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(ONE); }]);
  }
});
