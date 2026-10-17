// A second coach joins a team with its invite code, is accepted, and runs a match while the
// team's manager watches it live on their own phone. Beta only; both phones leave at the end.
const {test, expect} = require('@playwright/test');
const {app, newPhone, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Join U10s', SHORT = 'Claude E2E Join', COACH = 'Sam (coach)';
const SQUAD = ['Bea', 'Cormac', 'Dara', 'Esme', 'Finn', 'Gus', 'Hana'];

test('a coach joins with the invite code and starts a match', async ({page, browser}, info) => {
  const mgr = app(page, info);                       // the manager, who made the team
  const phone = await newPhone(browser, info), sam = app(phone.page, info); // the new coach
  let mgrIn = false, samIn = false, finished = false;
  try {
    // The manager makes the team and gets its invite code
    await mgr.createTeam(TEAM, SQUAD);
    mgrIn = true;
    const code = await mgr.inviteCode();

    // The new coach opens the invite link: the code is filled in
    await sam.page.goto('/?join=' + code.replace('-', ''));
    await expect(sam.page.locator('#joincode')).toHaveValue(code, {timeout: 30000});
    await expect(sam.page.locator('#sync')).toHaveText('No team yet');
    // a wrong code, then no name, then the real thing
    await sam.page.locator('#joincode').fill('ZZZZ-ZZZ2');
    await sam.page.locator('#joinname').fill(COACH);
    await sam.press(sam.btn('Ask to join'));
    await sam.toast("That code didn't match a team.");
    await sam.page.locator('#joincode').fill(code);
    await sam.page.locator('#joinname').fill('');
    await sam.page.evaluate(() => localStorage.removeItem('matchday-name'));
    await sam.press(sam.btn('Ask to join'));
    await sam.toast('Add your name first, so the coaches know who is asking.');
    await sam.page.locator('#joinname').fill(COACH);
    await sam.press(sam.btn('Ask to join'));
    await sam.toast('Request sent. A coach in the team needs to accept you.');
    await expect(sam.view).toContainText('Waiting for a coach to accept you.');
    await expect(sam.view).toContainText(`with code ${code}`);
    // still waiting after a reload
    await sam.page.reload();
    await expect(sam.view).toContainText('Waiting for a coach to accept you.', {timeout: 30000});

    // The manager sees the request on the Games screen (and a dot on ☰) and accepts it
    await expect(mgr.page.locator('#menubtn')).toHaveClass(/\bdot\b/);
    await expect(mgr.page.locator('#menubtn')).toHaveAttribute('aria-label', 'Menu, 1 join request');
    const req = mgr.view.locator('.req').filter({hasText: `${COACH} wants to join the team`});
    await expect(req).toContainText('No account: just a name typed on their phone');
    await mgr.press(mgr.btn('Accept', req));
    await mgr.toast(`${COACH} is in the team.`);
    await expect(mgr.view.locator('.req')).toHaveCount(0);
    await expect(mgr.page.locator('#menubtn')).not.toHaveClass(/\bdot\b/);
    await mgr.press(mgr.page.locator('#menubtn'));
    await expect(mgr.view.locator('.member').filter({hasText: COACH})).toContainText('No account');
    await mgr.press(mgr.page.locator('[data-act=menuclose]'));

    // The new coach is let in by itself and sees the same squad
    await expect(sam.page.locator('#hteam')).toHaveText(TEAM, {timeout: 30000});
    samIn = true;
    await sam.goTab('squad');
    await expect.poll(sam.squadNames).toEqual(SQUAD);
    await sam.press(sam.page.locator('#menubtn'));
    await expect(sam.view.locator('.member').filter({hasText: COACH})).toContainText('you');
    await expect(sam.view.locator('.member').filter({hasText: 'Manager'})).toBeVisible();
    await expect(sam.view).not.toContainText('Make a new invite code'); // only the manager can
    await sam.press(sam.page.locator('[data-act=menuclose]'));

    // ...sets up the day and starts game 1
    await sam.setUpGames({count: '2'});
    await sam.fixtures([['9:30', 'Riverside', '2'], ['10:15', 'Hillside', '1']]);
    await expect(mgr.view.locator('.gcard').first()).toContainText(`${SHORT} v Riverside`); // live on the manager's phone
    await sam.openGame(1);
    await sam.pickTeam('Bea', ['Cormac', 'Dara', 'Esme', 'Finn'], ['Gus', 'Hana']);
    await sam.press(sam.btn('Kick off'));
    await sam.toast('Kicked off.');
    await expect(sam.pill()).toHaveText('Live');
    await sam.goal('Dara');
    await expect(sam.score('us')).toHaveText('1');

    // The manager's phone follows the game live, and they can make the sub themselves
    const g1 = mgr.view.locator('.gcard').first();
    await expect(g1.locator('.pill')).toHaveText('Live');
    await expect(g1.locator('.scr')).toHaveText('1–0');
    await mgr.openGame(1);
    await expect(mgr.chip('Dara').locator('.gl')).toHaveText('⚽ 1');
    await mgr.press(mgr.chip('Esme'));
    await mgr.press(mgr.modal.locator('.qp').filter({has: mgr.page.locator('b').getByText('Gus', {exact: true})}));
    await expect(mgr.chip('Gus')).toBeVisible();
    await expect(sam.chip('Gus')).toBeVisible();          // and it appears on the new coach's phone
    await expect(sam.chip('Esme', '.benchbox')).toBeVisible();

    await sam.fullTime(1);
    await expect(mgr.pill()).toHaveText('Full time');
    await sam.reload(TEAM);
    await sam.openGame(1);
    await expect(sam.score('us')).toHaveText('1');
    await expect(sam.view.locator('.log').filter({hasText: 'Subs'})).toContainText('▲ Gus');
    finished = true;
  } finally {
    await cleanUp(finished, [
      async () => { if (samIn) await sam.leave(TEAM); },
      async () => { if (samIn && mgrIn) { await mgr.press(mgr.page.locator('#menubtn')); await expect(mgr.view.locator('.member').filter({hasText: COACH})).toHaveCount(0); } },
      async () => { if (mgrIn) await mgr.leave(TEAM); },
      async () => { if (!samIn) await sam.page.evaluate(() => document.querySelector('[data-act=reqcancel]')?.click()); }, // a request still waiting
      () => phone.ctx.close(),
    ]);
  }
});
