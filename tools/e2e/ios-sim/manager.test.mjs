// The manager role on three iPhones (three simulators): handed over on leaving, taken over when the
// manager has gone, and several managers per team. Port of ../manager.spec.js. Beta only.
import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {phone, cleanUp, run, guardBeta} from './lib.mjs';

guardBeta();
const TEAM = 'Claude E2E Sim Manager U10s', SAM = 'Sam (coach)', KIM = 'Kim (coach)';
const SQUAD = ['Bea', 'Cormac', 'Dara', 'Esme', 'Finn'];

let mgr, sam, kim, inTeam = {}, finished = false;
afterEach(async () => {
  await cleanUp(finished, [
    async () => { if (inTeam.kim) await kim.leave(TEAM); },
    async () => { if (inTeam.sam) await sam.leave(TEAM); },
    async () => { if (inTeam.mgr) await mgr.leave(TEAM); },
  ]);
  for (const p of [mgr, sam, kim]) await p?.close();
  mgr = sam = kim = null; inTeam = {}; finished = false;
});

// A new coach asks with the code and a coach already in the team accepts.
async function join(asker, name, code, accepter) {
  await asker.goto('/?join=' + code.replace('-', ''));
  await asker.until(c => document.getElementById('joincode')?.value === c, 'the code filled in', 30000, code);
  await asker.type('#joinname', name);
  await asker.tapText('Ask to join');
  await asker.toast('Request sent.');
  await accepter.until(n => [...document.querySelectorAll('#view .req')].some(x => x.textContent.includes(`${n} wants to join the team`)), `${name}'s request`, 30000, name);
  await accepter.tapFound(n => [...document.querySelectorAll('#view .req')].find(x => x.textContent.includes(n))?.querySelector('[data-act=reqok]'), 'Accept', name);
  await accepter.toast(`${name} is in the team.`);
  await asker.until(t => document.getElementById('hteam')?.textContent === t, `${name} in the team`, 30000, TEAM);
  await asker.watchToasts();
}
const managerIs = (p, name) => p.until(n => [...document.querySelectorAll('#view .member')].some(x => x.querySelector('.tag.mgr') && x.textContent.includes(n)), `${name} as manager`, 30000, name);
const view = p => p.text('#view');

test('the manager role is handed over on leaving, and can be taken over if the manager has gone (iPhone Safari)', {timeout: 30 * 60000}, () => run(() => [mgr, sam, kim], async () => {
  mgr = await phone(0); sam = await phone(1); kim = await phone(2);
  await mgr.createTeam(TEAM, SQUAD);
  inTeam.mgr = true;
  const code = await mgr.inviteCode();
  await join(sam, SAM, code, mgr);
  inTeam.sam = true;

  // 1. The manager leaves: first they choose who takes over (and can change their mind)
  await mgr.saved();
  await mgr.menu();
  await managerIs(mgr, 'you');
  await mgr.tap('[data-act=leave]');
  await mgr.until(() => document.getElementById('view')?.textContent.includes('Who takes over as manager?'), 'who takes over');
  await mgr.tapText('Cancel');
  await mgr.until(() => !document.getElementById('view')?.textContent.includes('Who takes over as manager?'), 'the question gone');
  await mgr.tap('[data-act=leave]');
  await mgr.tapText(SAM);
  await mgr.until(t => document.getElementById('view')?.textContent.includes('You left ' + t), 'the manager gone', 30000, TEAM);
  inTeam.mgr = false;

  // Sam is the manager now: the badge, and the manager's buttons
  await sam.menu();
  await managerIs(sam, SAM);
  assert.match(await view(sam), /Make a new invite code/);
  assert.doesNotMatch(await view(sam), /This team has no manager/);
  await sam.closeMenu();

  // 2. Kim joins; then Sam's sign-in disappears without leaving properly (as when Safari clears a
  //    website's data), so the team points at a manager who isn't in it any more. Done through
  //    Firestore's web API with Sam's own sign-in (Appium can't reach the app's code).
  await join(kim, KIM, code, sam);
  inTeam.kim = true;
  await sam.saved();
  const gone = await sam.b.execute(async () => {
    const team = localStorage.getItem('matchday-team');
    const db = await new Promise((ok, no) => { const r = indexedDB.open('firebaseLocalStorageDb'); r.onsuccess = () => ok(r.result); r.onerror = no; });
    const rows = await new Promise((ok, no) => { const r = db.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll(); r.onsuccess = () => ok(r.result); r.onerror = no; });
    const user = rows.map(x => x.value).find(v => v && v.uid && v.stsTokenManager);
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/match-day-beta-17b23/databases/(default)/documents/teams/${team}/members/${user.uid}`,
      {method: 'DELETE', headers: {Authorization: 'Bearer ' + user.stsTokenManager.accessToken}});
    return res.status;
  });
  assert.equal(gone, 200, "Sam's membership removed");
  inTeam.sam = false;

  // Kim sees the team has no manager and takes over (two taps)
  await kim.menu();
  await kim.until(() => document.getElementById('view')?.textContent.includes('This team has no manager.'), 'no manager', 30000);
  assert.doesNotMatch(await view(kim), /Make a new invite code/);
  await kim.tapText('Become the manager');
  await kim.tapText('Tap again to become the manager');
  await kim.toast("You're now the manager.");
  await kim.until(() => !document.getElementById('view')?.textContent.includes('This team has no manager.'), 'a manager again');
  await managerIs(kim, KIM);
  assert.match(await view(kim), /Make a new invite code/);
  // and it's on the server: still the manager after a reload
  await kim.reload(TEAM);
  await kim.menu();
  await managerIs(kim, KIM);
  await kim.closeMenu();
  finished = true;
}));

test('a team can have several managers (iPhone Safari)', {timeout: 30 * 60000}, () => run(() => [mgr, sam, kim], async () => {
  mgr = await phone(0); sam = await phone(1); kim = await phone(2);
  // A name is needed to create a team
  await mgr.goto('/');
  await mgr.until(() => !!document.querySelector('[data-act=mkteam]'), 'the start screen', 30000);
  await mgr.b.execute(() => { document.getElementById('mkname').value = ''; localStorage.removeItem('matchday-name'); });
  await mgr.tapText('Create a team');
  await mgr.toast('Add your name first');
  await mgr.createTeam(TEAM, SQUAD);
  inTeam.mgr = true;
  const code = await mgr.inviteCode();
  await join(sam, SAM, code, mgr);
  inTeam.sam = true;
  await join(kim, KIM, code, mgr);
  inTeam.kim = true;

  // The manager makes Sam a manager too: both are managers now
  await mgr.saved();
  await mgr.menu();
  const samBtn = label => mgr.tapFound((n, l) => { const r = [...document.querySelectorAll('#view .member')].find(x => x.textContent.includes(n));
    return r && [...r.querySelectorAll('button')].find(b => b.textContent === l); }, label, SAM, label);
  await samBtn('Make manager');
  await samBtn('Tap to make a manager');
  await mgr.toast(`${SAM} is now a manager.`);
  await mgr.until(() => [...document.querySelectorAll('#view .member')].filter(x => x.querySelector('.tag.mgr')).length === 2, 'two managers');
  assert.match(await view(mgr), /Make a new invite code/); // still a manager
  await mgr.closeMenu();

  // Sam has the manager's powers; Kim (not a manager) doesn't
  await sam.menu();
  await sam.until(() => document.getElementById('view')?.textContent.includes('Make a new invite code'), "Sam's manager buttons", 30000);
  assert.ok(await sam.b.execute(k => [...[...document.querySelectorAll('#view .member')].find(x => x.textContent.includes(k))?.querySelectorAll('button') || []].some(b => b.textContent === 'Make manager'), KIM));
  await sam.closeMenu();
  await kim.menu();
  assert.doesNotMatch(await view(kim), /Make a new invite code/);
  await kim.closeMenu();

  // The first manager leaves: Sam is still a manager, so there's nobody to choose
  await mgr.leave(TEAM);
  inTeam.mgr = false;
  await sam.menu();
  await managerIs(sam, SAM);
  assert.doesNotMatch(await view(sam), /This team has no manager/);
  await sam.closeMenu();
  finished = true;
}));
