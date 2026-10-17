// A follower's day (a parent, carer or friend with the follower link), seen from their phone while a
// coach runs two games: no game yet, fixtures, kick-off, goals, a card, half time, full time, an
// away game, and the results staying up after the tournament is saved; and a new link replacing
// the old one. They must never see a player's name or be able to change anything. Beta only; the coach leaves the team at the end.
const {test, expect} = require('@playwright/test');
const {app, newPhone, cleanUp, nameRe} = require('./helpers');

const TEAM = 'Claude E2E Follow U11s', SHORT = 'Claude E2E Follow';
const SQUAD = ['Bea', 'Cormac', 'Dara', 'Esme', 'Finn', 'Gus'];

test('a follower watches the day from the link', async ({page, browser}, info) => {
  test.setTimeout(4 * 60 * 1000); // includes a real 30-second half
  const coach = app(page, info);
  const phone = await newPhone(browser, info), fp = phone.page;
  const fview = fp.locator('#view'), board = fp.locator('.pboard');
  const status = board.locator('.pst'), big = board.locator('.big');
  // Banners show for 6 seconds; keep a list of every one this page has shown, to check against.
  await phone.ctx.addInitScript(() => {
    window.__banners = [];
    new MutationObserver(() => { const b = document.querySelector('.pbanner'); const t = b && b.innerText.replace(/\s+/g, ' ').trim();
      if (t && window.__banners[window.__banners.length - 1] !== t) window.__banners.push(t); })
      .observe(document, {childList: true, subtree: true});
  });
  const sawBanner = text => expect.poll(() => fp.evaluate(() => window.__banners.join(' | ')), {message: `follower banner "${text}"`}).toContain(text);
  const noNames = async () => {
    const text = await fp.locator('body').innerText();
    for (const n of SQUAD) expect(text, `the follower sees ${n}`).not.toMatch(nameRe(n));
  };
  const canChangeNothing = async () => {
    await expect(fp.locator('#tabs')).toBeHidden();
    await expect(fp.locator('#menubtn')).toBeHidden();
    await expect(fview.locator('[data-act=score], [data-act=kick], [data-act=tap], input')).toHaveCount(0);
  };
  let joined = false, finished = false;
  try {
    // A link that doesn't exist
    await fp.goto('/?follow=' + 'Zz9'.repeat(8));
    await expect(fview).toContainText("This link isn't working", {timeout: 30000});
    await expect(fview).toContainText('Ask the coach for the new follower link.');

    // The coach makes a team and a follower link before any games are set up
    await coach.createTeam(TEAM, SQUAD);
    joined = true;
    await coach.press(page.locator('#menubtn'));
    await coach.press(coach.view.getByRole('button', {name: /Create a follower link/}));
    await coach.toast('Follower link ready.');
    const link = (await coach.view.locator('.plink').textContent()).trim();
    await coach.saved();
    await coach.press(page.locator('[data-act=menuclose]'));

    await fp.goto(link);
    await expect(board).toContainText(SHORT, {timeout: 30000});
    await expect(board).toContainText('No game yet. The score shows here when a game starts.');
    await expect(fview.locator('.card h3').filter({hasText: 'Get notifications'})).toBeVisible();
    const kinds = fview.locator('.kinds button');
    await expect(kinds).toHaveText(['Kick-off', 'Goals', 'Cards', 'Half time', 'Full time']);
    const cards = kinds.filter({hasText: 'Cards'});
    await coach.press(cards); // choosing alerts needs no permission until they're turned on
    await expect(cards).toHaveAttribute('aria-pressed', 'false');
    await coach.press(cards);
    await expect(cards).toHaveAttribute('aria-pressed', 'true');
    await canChangeNothing();

    // Fixtures appear: game 1 at home, game 2 away
    await coach.setUpGames({name: 'Winter Cup', len: '1', count: '2', periods: '2'}); // 1 minute: two halves of 30 seconds
    await coach.fixtures([['9:30', 'Riverside', '2'], ['10:15', 'Hillside', '4', true]]);
    await expect(fview).toContainText('Winter Cup');
    const rows = fview.locator('.prow');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(`${SHORT} v Riverside`);
    await expect(rows.nth(0)).toContainText('9:30');
    await expect(rows.nth(1)).toContainText(`Hillside v ${SHORT}`); // away: they're the home side
    await expect(rows.nth(1)).toContainText('10:15');
    await expect(fview.locator('.lbl', {hasText: 'Still to play'})).toBeVisible();
    await expect(board).toContainText('Kick-off soon');

    // Game 1: kick-off, a goal each way, a card, half time by itself, second half, full time
    await coach.openGame(1);
    await coach.pickTeam('Bea', ['Cormac', 'Dara', 'Esme', 'Finn'], ['Gus']);
    await coach.press(coach.btn('Kick off'));
    await sawBanner('Kick-off');
    await expect(status).toHaveText('1st half');
    await expect(big).toHaveText('0–0');
    const clock = board.locator('.pclock');
    const t1 = await clock.textContent();
    await expect.poll(() => clock.textContent()).not.toBe(t1); // the clock runs on the follower's phone
    await coach.goal('Dara');
    await sawBanner(`Goal! ${SHORT}`);
    await sawBanner(`${SHORT} 1–0 Riverside`);
    await expect(big).toHaveText('1–0');
    await coach.press(coach.chip('Esme'));
    await coach.press(coach.btn('🟨 Yellow card', coach.modal));
    await sawBanner(`Yellow card for ${SHORT}`);
    await noNames();

    // half time comes by itself after 30 seconds
    await expect(status).toHaveText('Half time', {timeout: 45000});
    await sawBanner('Half time');
    await expect(coach.pill()).toHaveText('Half time');
    await coach.press(coach.btn('Start 2nd half'));
    await expect(status).toHaveText('2nd half');
    await coach.press(coach.plus('them'));
    await expect(big).toHaveText('1–1');
    await coach.fullTime(1);
    await expect(status).toHaveText('Full time');
    await sawBanner('Full time');
    await expect(fview.locator('.lbl', {hasText: 'Played'})).toBeVisible();
    await expect(rows.nth(0).locator('.psc')).toHaveText('1–1');
    await expect(rows.nth(0).locator('.flag')).toHaveText('Full time');

    // The follower reloads: still the same picture
    await fp.reload();
    await expect(status).toHaveText('Full time', {timeout: 30000});
    await expect(big).toHaveText('1–1');

    // Game 2, away: the board switches games, home side on the left
    await coach.openGame(2);
    await coach.pickTeam('Gus', ['Bea', 'Cormac', 'Dara', 'Finn'], ['Esme']);
    await coach.press(coach.btn('Kick off'));
    // After a reload, WebKit's live connection sometimes takes up to ~30 s to catch up (seen with 4
    // browsers running at once), so the first update after it gets longer.
    await expect(board).toContainText('Game 2', {timeout: 60000});
    await sawBanner('Kick-off'); // "Game 2: Hillside v …", or the score if the board had already moved to game 2
    await sawBanner('Hillside');
    await expect(board).toContainText('Game 2');
    await expect(board.locator('.tn').first()).toContainText('Hillside');
    await coach.goal('Bea');
    await sawBanner(`Goal! ${SHORT}`);
    await expect(big).toHaveText('0–1');
    await expect(rows.nth(1).locator('.flag')).toHaveText('Live');
    await coach.fullTime(2);
    await expect(status).toHaveText('Full time');
    await noNames();
    await canChangeNothing();

    // The coach saves the tournament: followers keep the day's results
    await coach.goTab('games');
    await coach.press(coach.btn('Finish tournament and save to Results'));
    await coach.press(coach.btn('Tap again to save and start fresh'));
    await coach.press(coach.btn('Write it later', coach.modal));
    await fp.reload();
    await expect(status).toHaveText('Full time', {timeout: 30000});
    await expect(rows).toHaveCount(2);

    finished = true;
  } finally {
    if (!finished) console.log('Coach', JSON.stringify(await page.evaluate(() => ({last: feedLast && JSON.parse(feedLast).gameN + ' ' + JSON.parse(feedLast).status, failed: Object.keys(sync.failed)})).catch(e => e.message)));
    if (!finished) console.log('Follower', JSON.stringify(await fp.evaluate(() => ({banners: window.__banners, feed: S.pfeed && {n: S.pfeed.gameN, st: S.pfeed.status}, sync: document.getElementById('sync').textContent, games: S.pgames.map(g => g.status).join(',')})).catch(e => e.message)));
    await cleanUp(finished, [async () => { if (joined) await coach.leave(TEAM); }, () => phone.ctx.close()]);
  }
});

test('a new follower link replaces the old one', async ({page, browser}, info) => {
  const coach = app(page, info);
  const phone = await newPhone(browser, info), fp = phone.page;
  const fview = fp.locator('#view'), board = fp.locator('.pboard');
  let joined = false, finished = false;
  try {
    await coach.createTeam(TEAM, SQUAD);
    joined = true;
    await coach.press(page.locator('#menubtn'));
    await coach.press(coach.view.getByRole('button', {name: /Create a follower link/}));
    await coach.toast('Follower link ready.');
    const link = (await coach.view.locator('.plink').textContent()).trim();
    await coach.saved();
    await fp.goto(link);
    await expect(board).toContainText(SHORT, {timeout: 30000});
    // the old one stops working at once, the new one works
    await coach.press(coach.btn('Make a new link'));
    await coach.press(coach.btn('Tap again: the old link stops working'));
    await coach.toast('Follower link ready.');
    await expect(coach.view.locator('.plink')).not.toHaveText(link);
    const link2 = (await coach.view.locator('.plink').textContent()).trim();
    await expect(fview).toContainText("This link isn't working", {timeout: 30000});
    await coach.saved();
    await fp.goto(link2);
    await expect(board).toContainText(SHORT, {timeout: 30000});
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await coach.leave(TEAM); }, () => phone.ctx.close()]);
  }
});
