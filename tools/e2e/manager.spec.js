// The manager role is never lost: a manager who leaves picks who takes over, and if the manager's
// sign-in disappears some other way (Safari clearing a website's data after 7 days unused), a
// coach still in the team can take over. Beta only; every phone leaves at the end.
const {test, expect} = require('@playwright/test');
const {app, newPhone, cleanUp} = require('./helpers');

const TEAM = 'Claude E2E Manager U10s', SAM = 'Sam (coach)', KIM = 'Kim (coach)';
const SQUAD = ['Bea', 'Cormac', 'Dara', 'Esme', 'Finn'];

// A new coach asks with the code and a coach already in the team accepts.
async function join(asker, name, code, accepter) {
  await asker.page.goto('/?join=' + code.replace('-', ''));
  await expect(asker.page.locator('#joincode')).toHaveValue(code, {timeout: 30000});
  await asker.page.locator('#joinname').fill(name);
  await asker.press(asker.btn('Ask to join'));
  await asker.toast('Request sent.');
  const req = accepter.view.locator('.req').filter({hasText: `${name} wants to join the team`});
  await accepter.press(accepter.btn('Accept', req));
  await accepter.toast(`${name} is in the team.`);
  await expect(asker.page.locator('#hteam')).toHaveText(TEAM, {timeout: 30000});
}
const managerIs = (a, name) => expect(a.view.locator('.member').filter({has: a.page.locator('.tag.mgr')})).toContainText(name);

test('the manager role is handed over on leaving, and can be taken over if the manager has gone', async ({page, browser}, info) => {
  const mgr = app(page, info);
  const p2 = await newPhone(browser, info), sam = app(p2.page, info);
  const p3 = await newPhone(browser, info), kim = app(p3.page, info);
  let mgrIn = false, samIn = false, kimIn = false, finished = false;
  try {
    await mgr.createTeam(TEAM, SQUAD);
    mgrIn = true;
    const code = await mgr.inviteCode();
    await join(sam, SAM, code, mgr);
    samIn = true;

    // 1. The manager leaves: first they choose who takes over (and can change their mind)
    await mgr.saved();
    await mgr.press(mgr.page.locator('#menubtn'));
    await managerIs(mgr, 'you');
    await mgr.press(mgr.page.locator('[data-act=leave]'));
    await expect(mgr.view).toContainText('Who takes over as manager?');
    await mgr.press(mgr.btn('Cancel'));
    await expect(mgr.view).not.toContainText('Who takes over as manager?');
    await mgr.press(mgr.page.locator('[data-act=leave]'));
    await mgr.press(mgr.btn(SAM));
    await expect(mgr.view).toContainText(`You left ${TEAM}`, {timeout: 30000});
    mgrIn = false;

    // Sam is the manager now: the badge, and the manager's buttons
    await sam.press(sam.page.locator('#menubtn'));
    await managerIs(sam, SAM);
    await expect(sam.view).toContainText('Make a new invite code');
    await expect(sam.view).not.toContainText('This team has no manager');
    await sam.press(sam.page.locator('[data-act=menuclose]'));

    // 2. Kim joins; then Sam's sign-in disappears without leaving properly (as when Safari
    //    clears a website's data), so the team points at a manager who isn't in it any more
    await join(kim, KIM, code, sam);
    kimIn = true;
    await sam.saved();
    await sam.page.evaluate(async () => {
      const {F, fs, auth} = FB;
      await F.deleteDoc(F.doc(fs, 'teams', S.teamId, 'members', auth.currentUser.uid));
    });
    samIn = false;

    // Kim sees the team has no manager and takes over (two taps)
    await kim.press(kim.page.locator('#menubtn'));
    await expect(kim.view).toContainText('This team has no manager.', {timeout: 30000});
    await expect(kim.view).not.toContainText('Make a new invite code');
    await kim.press(kim.btn('Become the manager'));
    await kim.press(kim.btn('Tap again to become the manager'));
    await kim.toast("You're now the manager.");
    await expect(kim.view).not.toContainText('This team has no manager.');
    await managerIs(kim, KIM);
    await expect(kim.view).toContainText('Make a new invite code');
    // and it's on the server: still the manager after a reload
    await kim.reload(TEAM);
    await kim.press(kim.page.locator('#menubtn'));
    await managerIs(kim, KIM);
    await kim.press(kim.page.locator('[data-act=menuclose]'));
    finished = true;
  } finally {
    await cleanUp(finished, [
      async () => { if (kimIn) await kim.leave(TEAM); },   // the last coach: no one to hand over to
      async () => { if (samIn) await sam.leave(TEAM); },
      async () => { if (mgrIn) await mgr.leave(TEAM); },
      () => p2.ctx.close(),
      () => p3.ctx.close(),
    ]);
  }
});
