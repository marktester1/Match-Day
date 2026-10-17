// A second coach joins with the invite code on their own iPhone (a second simulator), is accepted,
// and runs a match while the manager follows it live. Port of ../coach-joins.spec.js. Beta only.
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {phone, cleanUp, run, guardBeta} from './lib.mjs';

guardBeta();
const TEAM = 'Claude E2E Sim Join U10s', SHORT = 'Claude E2E Sim Join', COACH = 'Sam (coach)';
const SQUAD = ['Bea', 'Cormac', 'Dara', 'Esme', 'Finn', 'Gus', 'Hana'];

let mgr, sam, mgrIn = false, samIn = false, finished = false;
after(async () => {
  await cleanUp(finished, [
    async () => { if (samIn) await sam.leave(TEAM); },
    async () => { if (mgrIn) await mgr.leave(TEAM); },
    async () => { if (sam && !samIn) await sam.tapFound(() => document.querySelector('[data-act=reqcancel]'), 'cancel the request'); },
  ]);
  await mgr?.close(); await sam?.close();
});

test('a coach joins with the invite code and starts a match, in iPhone Safari', {timeout: 20 * 60000}, () => run(() => [mgr, sam], async () => {
  mgr = await phone(0);
  // The manager makes the team and gets its invite code
  await mgr.createTeam(TEAM, SQUAD);
  mgrIn = true;
  const code = await mgr.inviteCode();

  // The new coach opens the invite link: the code is filled in
  sam = await phone(1);
  await sam.goto('/?join=' + code.replace('-', ''));
  await sam.until(c => document.getElementById('joincode')?.value === c, 'the code filled in', 30000, code);
  await sam.until(() => document.getElementById('sync')?.textContent === 'No team yet', 'No team yet');
  assert.equal(await sam.b.execute(() => getComputedStyle(document.getElementById('menubtn')).display), 'none'); // no ☰ before there's a team
  // a wrong code, then no name, then the real thing
  await sam.type('#joincode', 'ZZZZ-ZZZ2');
  await sam.type('#joinname', COACH);
  await sam.tapText('Ask to join');
  await sam.toast("That code didn't match a team.");
  await sam.type('#joincode', code);
  await sam.b.execute(() => { document.getElementById('joinname').value = ''; localStorage.removeItem('matchday-name'); });
  await sam.tapText('Ask to join');
  await sam.toast('Add your name first, so the coaches know who is asking.');
  await sam.type('#joinname', COACH);
  await sam.tapText('Ask to join');
  await sam.toast('Request sent. A coach in the team needs to accept you.', 60000); // a phone's first request can take a while in the simulator
  await sam.until(c => { const t = document.getElementById('view')?.innerText || ''; return t.includes('Waiting for a coach to accept you.') && t.includes('with code ' + c); }, 'waiting to be accepted', 20000, code);
  await sam.reload(); // still waiting after a reload
  await sam.until(() => document.getElementById('view')?.textContent.includes('Waiting for a coach to accept you.'), 'still waiting', 30000);

  // The manager sees the request on the Games screen (and a dot on ☰) and accepts it
  await mgr.until(() => document.getElementById('menubtn')?.classList.contains('dot'), 'the dot on ☰', 30000);
  assert.equal(await mgr.b.execute(() => document.getElementById('menubtn').getAttribute('aria-label')), 'Menu, 1 join request');
  await mgr.until(c => [...document.querySelectorAll('#view .req')].some(x => x.textContent.includes(`${c} wants to join the team`) && x.textContent.includes('No account: just a name typed on their phone')), 'the request', 20000, COACH);
  await mgr.tapFound(c => [...document.querySelectorAll('#view .req')].find(x => x.textContent.includes(c))?.querySelector('[data-act=reqok]'), 'Accept', COACH);
  await mgr.toast(`${COACH} is in the team.`);
  await mgr.until(() => !document.querySelector('#view .req') && !document.getElementById('menubtn').classList.contains('dot'), 'the request gone');
  await mgr.menu();
  await mgr.until(c => [...document.querySelectorAll('#view .member')].some(x => x.textContent.includes(c) && x.textContent.includes('No account')), 'the new coach in the members', 20000, COACH);
  await mgr.closeMenu();

  // The new coach is let in by itself and sees the same squad
  await sam.until(t => document.getElementById('hteam')?.textContent === t, 'the team on the new coach\'s phone', 30000, TEAM);
  samIn = true;
  await sam.watchToasts();
  await sam.goTab('squad');
  await sam.until(n => document.querySelectorAll('#view .rows .row .who').length >= n, 'the squad', 20000, SQUAD.length);
  assert.deepEqual(await sam.squadNames(), SQUAD);
  await sam.menu();
  await sam.until(c => [...document.querySelectorAll('#view .member')].some(x => x.textContent.includes(c) && x.textContent.includes('you')), 'you in the members', 20000, COACH);
  assert.ok(await sam.b.execute(() => [...document.querySelectorAll('#view .member')].some(x => x.textContent.includes('Manager'))));
  assert.doesNotMatch(await sam.text('#view'), /Make a new invite code/); // only managers can
  await sam.closeMenu();

  // ...sets up the day and starts game 1
  await sam.setUpGames({count: '2'});
  await sam.fixtures([['9:30', 'Riverside', '2'], ['10:15', 'Hillside', '1']]);
  await mgr.until(s => document.querySelector('#view .gcard')?.textContent.includes(`${s} v Riverside`), 'the fixture on the manager\'s phone', 30000, SHORT);
  await sam.openGame(1);
  await sam.pickTeam('Bea', ['Cormac', 'Dara', 'Esme', 'Finn'], ['Gus', 'Hana']);
  await sam.tapText('Kick off');
  await sam.toast('Kicked off.');
  await sam.waitPill('Live');
  await sam.goal('Dara');
  await sam.waitScore('us', '1');

  // The manager's phone follows the game live, and they can make the sub themselves
  await mgr.until(() => { const g = document.querySelector('#view .gcard'); return g?.querySelector('.pill')?.textContent === 'Live' && g.querySelector('.scr')?.textContent === '1–0'; }, 'game 1 live, 1–0, on the manager\'s phone', 30000);
  await mgr.openGame(1);
  await mgr.until(() => [...document.querySelectorAll('#view .pitch .chip')].find(x => x.querySelector('.n')?.textContent === 'Dara')?.querySelector('.gl')?.textContent === '⚽ 1', 'Dara ⚽ 1 on the manager\'s phone');
  await mgr.tapChip('Esme');
  await mgr.tapQp('Gus');
  await mgr.waitChip('Gus');
  await sam.waitChip('Gus');            // and it appears on the new coach's phone
  await sam.waitChip('Esme', '.benchbox');

  await sam.fullTime(1);
  await mgr.waitPill('Full time');
  await sam.reload(TEAM);
  await sam.openGame(1);
  await sam.waitScore('us', '1');
  await sam.until(() => [...document.querySelectorAll('#view .log')].some(x => x.textContent.includes('Subs') && x.textContent.includes('▲ Gus')), 'the sub saved');
  finished = true;
}));
