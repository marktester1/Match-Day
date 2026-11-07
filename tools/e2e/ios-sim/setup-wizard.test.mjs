// The first-time set-up wizard in real iPhone Safari: Quick start interrupted and carried on, then the
// next match day with last time's settings; Full set-up for rugby with a tournament and fixtures,
// interrupted on the last step; and "Do this later". Port of ../setup-wizard.spec.js. Beta only.
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {phone, cleanUp, run, guardBeta} from './lib.mjs';

guardBeta();
const TEAM = 'Claude E2E Sim Wizard U9s', RUGBY = 'Claude E2E Sim Wizard Rugby U8s', LATER = 'Claude E2E Sim Wizard Later U12s';

let c;
after(async () => { await c?.close(); });

// Waits written once: the step's heading, and text anywhere in the view (as written, not CSS capitals)
const heading = t => c.until(t => document.querySelector('#view h2')?.textContent === t, `the heading "${t}"`, 30000, t);
const sees = (s, sel = '#view') => c.until((s, sel) => (document.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').includes(s), `"${s}"`, 20000, s, sel);
const value = sel => c.b.execute(s => document.querySelector(s)?.value, sel);
const isOn = sel => c.b.execute(s => !!document.querySelector(s)?.classList.contains('on'), sel);
async function start(route) {
  await c.goto('/');
  await c.until(() => !!document.querySelector('[data-act=mkteam]'), 'the start screen', 30000);
  if (await c.has('#mkname')) await c.enter('#mkname', 'Claude (test coach)');
  await c.tapText('Create a team');
  await c.until(() => !!document.querySelector('[data-act=wizroute]'), 'the set-up wizard', 30000);
  if (route) await c.tap(`[data-act=wizroute][data-v=${route}]`);
}

test('quick start survives an interruption, and the next match day reuses the settings, in iPhone Safari', {timeout: 20 * 60000}, async () => {
  let joined = false, finished = false;
  try {
    await run(() => [c], async () => {
      c = await phone(0);
      await start();
      joined = true;
      await c.tap('[data-act=wizroute][data-v=quick]');

      // Step 1: a team name is needed; 7-a-side in one tap
      await heading('Your team');
      await c.tap('[data-act=wiznext]');
      await c.toast('Add a team name first.');
      await c.type('#cfg-team', TEAM);
      await c.tap('[data-act=wizsize][data-v="7"]');
      await c.tap('[data-act=wiznext]');

      // Step 2: a messy paste is tidied, and a name already in the squad isn't added twice
      await heading('Your players');
      await c.type('#bulknames', 'Ava\n  Ben \n\nCal\nben\nDev\nEli\nFay\nGus');
      await c.tapText('Add these names');
      await sees('7 players', '#view .wizcount');

      // Interrupted: the app opens again on the same step, with the players still there
      await c.reload(TEAM);
      await heading('Your players');
      await sees('7 players', '#view .wizcount');

      // Finish: quick start uses the usual 7-a-side match (50 minutes in halves)
      await c.tap('[data-act=wiznext]'); // Finish
      await sees('Your match day is ready!');
      await sees('7 players added', '#view .wizlist');
      await sees('1 match set up, 50 minutes in halves', '#view .wizlist');
      await sees('Tip: put Match Day on your Home Screen'); // Safari, not yet on the Home Screen
      await c.tapText('Start match day');
      await sees('Played 0 of 1');

      // The match is played and the match day finished; the next one is set up with the same settings
      await c.fixtures([['9:30', 'Riverside', '1']]);
      await c.openGame(1);
      await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli', 'Fay', 'Gus']);
      await c.saved();
      await c.tapText('Kick off');
      await c.toast('Kicked off.');
      await c.fullTime(1);
      await c.goTab('games');
      await c.tapText('Finish tournament and save to Results');
      await c.tapTextLike(/Tap again to save/);
      await c.tapText('Write it later', '.modal');
      await c.goTab('games');
      await sees('Next match day: same as last time?');
      await sees('50 minutes a game, halves', '#view .setupcard .wizlist');
      await sees('7-a-side · 7 players', '#view .setupcard .wizlist');
      await c.tapText('Yes, same settings');
      await heading('Fixtures');
      assert.ok(await c.has('#opps option[value="Riverside"]'), 'the opponent is offered again');
      await c.tapText('← All games');
      await sees('Played 0 of 1');
      finished = true;
    });
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});

test('full set-up: rugby, a size of our own, a tournament with fixtures, interrupted on the last step, in iPhone Safari', {timeout: 20 * 60000}, async () => {
  let joined = false, finished = false;
  try {
    await run(() => [c], async () => {
      await c?.close();
      c = await phone(0);
      await start('full');
      joined = true;

      // Step 1 of 4: rugby has its own sizes; "Other" takes any size from 3 to 11
      await sees('Step 1 of 4');
      await c.type('#cfg-team', RUGBY);
      await c.leaveBox('#cfg-team');
      await c.tap('[data-act=sport][data-v=rugby]');
      await c.until(() => [...document.querySelectorAll('[data-act=wizsize]')].map(x => x.textContent).join() === '4,6,7,8,9,10,Other', 'the rugby sizes');
      assert.equal(await value('#cfg-team'), RUGBY); // typed name kept through the redraw
      await c.tap('[data-act=wizsize][data-v=other]');
      await c.enter('#wizsize', '3');
      await c.tap('[data-act=wiznext]');

      // Step 2 of 4: no players yet is caught; names typed but not "added" still count on Next
      await heading('Your players');
      await sees('Step 2 of 4');
      await c.tap('[data-act=wiznext]');
      await c.toast('Add at least one player.');
      await c.type('#bulknames', 'Ava Smith\nBen\nCal');
      await c.tap('[data-act=wiznext]');
      await heading('Your match day');

      // Back keeps everything: three players (surname dropped), and the team step remembers rugby and 3-a-side
      await c.tap('[data-act=wizback]');
      await sees('3 players', '#view .wizcount');
      assert.deepEqual(await c.squadNames(), ['Ava', 'Ben', 'Cal']);
      await c.tap('[data-act=wizback]');
      await heading('Your team');
      assert.equal(await value('#cfg-team'), RUGBY);
      assert.ok(await isOn('[data-act=sport][data-v=rugby]'), 'rugby still chosen');
      assert.equal(await value('#wizsize'), '3');
      await c.tap('[data-act=wiznext]');
      await heading('Your players');
      await c.tap('[data-act=wiznext]');

      // Step 3 of 4: one match in halves by default (40 minutes for a small side); then a tournament
      await heading('Your match day');
      assert.equal(await value('#len'), '40');
      assert.ok(await isOn('[data-act=periods][data-v="2"]'), 'halves');
      await c.tap('[data-act=wizkind][data-v="0"]');
      await c.until(() => document.getElementById('cnt')?.value === '6', 'six games for a tournament');
      await c.enter('#cnt', '3');
      await c.enter('#len', '12');
      await c.tap('[data-act=wiznext]');

      // Step 4 of 4: fixtures for two of the three games, then an interruption
      await heading('Fixtures');
      assert.equal(await c.count('#view [data-fx$="|opponent"]'), 3);
      await c.enter('#fx-t-g1', '9:30');
      await c.enter('#fx-o-g1', 'Riverside');
      await c.enter('#fx-o-g2', 'Hillside');
      await c.enter('#fx-p-g2', '3');
      await c.reload(RUGBY);
      await heading('Fixtures');
      assert.equal(await value('#fx-o-g1'), 'Riverside');
      assert.equal(await value('#fx-p-g2'), '3');
      await c.tap('[data-act=wiznext]'); // Finish

      // Done: what was set up, then the games list as set up
      await heading('Your match day is ready!');
      await sees('3 players added', '#view .wizlist');
      await sees('3 games set up, 12 minutes', '#view .wizlist');
      await sees('2 opponents added', '#view .wizlist');
      await sees('Invite other coaches');
      await c.tapText('Start match day');
      await sees('Played 0 of 3');
      const cards = await c.b.execute(() => [...document.querySelectorAll('#view .gcard')].map(x => x.textContent.replace(/\s+/g, ' ')));
      assert.match(cards[0], /v Riverside/);
      assert.match(cards[1], /v Hillside/);
      assert.match(cards[1], /Pitch 3/);
      assert.match(cards[2], /Opponent not set/);
      await sees('3 games × 12 min · 3-a-side', '#view .setupline');

      // and it stays set up: no wizard after a reload, rugby in the team settings
      await c.reload(RUGBY);
      await sees('Played 0 of 3');
      await c.goTab('squad');
      await c.until(() => !!document.querySelector('[data-act=sport][data-v=rugby].on'), 'rugby in the team settings');
      finished = true;
    });
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(RUGBY); }]);
  }
});

test('"Do this later" leaves the wizard for good, and Back goes all the way to the start, in iPhone Safari', {timeout: 20 * 60000}, async () => {
  let joined = false, finished = false;
  try {
    await run(() => [c], async () => {
      await c?.close();
      c = await phone(0);
      await start('quick');
      joined = true;

      // Quick start, then Back to change our mind
      await sees('Step 1 of 2');
      assert.equal(await c.b.execute(() => document.getElementById('tabs')?.offsetParent === null), true, 'no tabs during the wizard');
      await c.tap('[data-act=wizback]');
      await heading('How much do you want to set up now?');
      await c.tap('[data-act=wizroute][data-v=full]');
      await sees('Step 1 of 4');
      await c.type('#cfg-team', LATER);
      await c.tap('[data-act=wizsize][data-v="11"]');
      await c.tap('[data-act=wiznext]');
      await heading('Your players');
      await c.type('#bulknames', 'Ava\nBen');
      await c.tapText('Add these names');
      await sees('2 players', '#view .wizcount');
      await sees('You need at least 11 for 11-a-side: 9 more to go.');
      assert.equal(await value('#bulknames'), ''); // the box empties once the names are in
      await c.tap('[data-act=wiznext]');
      await heading('Your match day');
      assert.equal(await value('#len'), '60'); // the usual 11-a-side match, as long as a game can be
      await c.tap('[data-act=wizlater]');

      // The games can be set up from the Games tab, and the wizard doesn't come back
      await sees('Set up your games');
      await c.reload(LATER);
      await sees('Set up your games');
      assert.ok(!(await c.text('#view')).includes('How much do you want to set up now?'));
      finished = true;
    });
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(LATER); }]);
  }
});
