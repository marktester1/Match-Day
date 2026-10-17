// A coach's whole match day in real iPhone Safari (iOS Simulator), with a follower watching on a
// second simulator. Port of ../journey.spec.js. Beta only; the coach leaves the team at the end.
// Not here (Playwright covers it): the "Share results" text, because Share opens iOS's own share sheet.
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {phone, cleanUp, run, guardBeta, nameRe, sortNames} from './lib.mjs';

guardBeta();
const TEAM = 'Claude E2E Sim U9s', SHORT = 'Claude E2E Sim';
const PASTED = ['Alfie Smith', 'Alfie Jones', 'Player 7', 'Bea Lane, Cormac', 'Dara', 'Esme', 'Finn'];
const FIRST_SQUAD = ['Alfie J', 'Alfie S', 'Bea', 'Cormac', 'Dara', 'Esme', 'Finn', 'Player 7'];
const ALL_NAMES = [...FIRST_SQUAD, 'Gus', 'Hana', 'Ivo', 'Jude', 'Kit'];
const FIXTURES = [['9:30', 'Riverside', '2'], ['10:00', 'Hillside', '3'], ['10:30', 'Oakfield', '1']];
const REPORT = 'Brilliant effort in the rain. Great passing in game 1.';

let c, f, joined = false, finished = false;
after(async () => { await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]); await c?.close(); await f?.close(); });

test('a coach runs a whole match day in iPhone Safari', {timeout: 30 * 60000}, () => run(() => [c, f], async () => {
  c = await phone(0);
  const view = sel => c.text('#view' + (sel ? ' ' + sel : ''));

  // 1. Create a team and set it up
  await c.createTeam(TEAM, PASTED);
  joined = true;
  assert.match(await view(), /Set up today's games/);
  await c.reload(TEAM);
  await c.goTab('squad');
  await c.until(n => document.querySelectorAll('#view .rows .row .who').length >= n, 'the squad', 20000, 8);
  assert.deepEqual(await c.squadNames(), FIRST_SQUAD); // "Player 7" kept, the two Alfies told apart, surnames dropped
  assert.equal(await c.b.execute(() => document.getElementById('cfg-short').value), SHORT);

  // 2. Squad tab: add players in each way a coach might
  const inList = n => c.until(n => [...document.querySelectorAll('#view .rows .row .who')].some(x => x.textContent === n), `${n} in the squad`, 20000, n);
  await c.type('#newname', 'Gus');
  await c.pressReturn('#newname');
  await c.toast('Gus added.');
  await inList('Gus');
  await c.until(() => document.activeElement?.id === 'newname', 'the box ready for the next name');
  await c.type('#newname', 'Bea');
  await c.pressReturn('#newname');
  await c.toast('Bea is already in the squad.');
  await c.b.execute(() => { document.getElementById('newname').value = ''; });
  await c.tap('#addf button[type=submit]');
  await c.toast('Type a name first.');
  await c.type('#newname', 'Hana');
  await c.tap('#addf button[type=submit]'); // tapped with the keyboard up
  await c.toast('Hana added.');
  await inList('Hana');
  await c.type('#newname', 'Ivo');
  await c.tapText('Add to squad'); // the big button under the paste box takes the top box's name too
  await c.toast('1 added to the squad.');
  await inList('Ivo');
  await c.reload(TEAM);
  await c.goTab('squad');
  await c.until(() => document.querySelectorAll('#view .rows .row .who').length >= 11, 'the squad');
  assert.deepEqual(await c.squadNames(), sortNames([...FIRST_SQUAD, 'Gus', 'Hana', 'Ivo']));
  assert.match(await view(), /11 in the squad\./);

  // 3. Followers: make the link and keep it open on another phone, like a parent would
  const code = await c.inviteCode();
  assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await c.menu();
  await c.tapTextLike(/^Create a follower link/);
  await c.toast('Follower link ready.');
  const link = (await c.text('.plink')).trim();
  assert.match(link, /\?follow=[A-Za-z0-9]{24}$/);
  await c.saved();
  await c.closeMenu();
  f = await phone(1);
  await f.goto(link);
  await f.watchBanners();
  await f.until(s => document.querySelector('.pboard')?.textContent.includes(s), 'the follower board', 30000, SHORT);
  const noNamesForFollowers = async () => { const t = await f.bodyText(); for (const n of ALL_NAMES) assert.doesNotMatch(t, nameRe(n), `follower page shows ${n}`); };

  // 4. Set up a tournament: 3 games of two halves, with fixtures
  await c.setUpGames({count: '3'});
  await c.fixtures(FIXTURES);
  await f.until(() => document.getElementById('view')?.textContent.includes('Still to play') && document.getElementById('view').textContent.includes('Riverside'), 'the fixtures on the follower page', 30000);
  await f.until(() => document.querySelector('.pboard')?.textContent.includes('Kick-off soon'), 'Kick-off soon');
  const checkFixtures = () => c.until(fx => { const cards = [...document.querySelectorAll('#view .gcard')];
    return cards.length === 3 && fx.every(([t, o, p], i) => cards[i].textContent.includes(` v ${o}`) && cards[i].textContent.includes(`${t} · Pitch ${p}`)); }, 'the three fixtures', 20000, FIXTURES);
  await checkFixtures();
  await c.reload(TEAM);
  await checkFixtures();
  assert.match(await c.text('.setupline'), /Autumn Cup/);
  assert.match(await c.text('.setupline'), /3 games × 20 min · 5-a-side · Halves/);

  // 5. Game 1: pick the team, play it, follower watching
  await c.openGame(1);
  await c.pickTeam('Alfie S', ['Bea', 'Cormac', 'Dara', 'Esme'], ['Finn', 'Player 7']);
  assert.equal(await c.text('#view .pitch .cnt'), '5/5');
  await c.plus('us');
  await c.toast('Tap Kick off first, then add the goal.');
  assert.equal(await c.score('us'), '0');
  await c.tapText('Kick off');
  await c.toast('Kicked off.');
  await c.waitPill('Live');
  await f.until(() => document.querySelector('.pboard .pst')?.textContent === '1st half', '1st half on the follower page', 30000);
  await f.sawBanner('Kick-off');

  await c.goal('Bea');
  await c.waitScore('us', '1');
  await f.sawBanner(`Goal! ${SHORT}`);
  await f.until(() => document.querySelector('.pboard .big')?.textContent === '1–0', '1–0 for followers');

  await c.tapChip('Cormac');
  await c.until(() => document.querySelector('.modal h3')?.textContent === "Cormac off. Who's coming on?", 'the sub pop-up');
  await c.tapQp('Finn');
  await c.waitChip('Finn');
  await c.waitChip('Cormac', '.benchbox');
  await c.until(() => [...document.querySelectorAll('#view .log')].some(x => x.textContent.includes('Subs') && x.textContent.includes('▲ Finn')), 'the sub in the log');

  await c.card('Dara', 'y');
  await c.toast('Dara: yellow card.');
  assert.ok(await c.chipPart('Dara', '.cd.y') !== null, 'Dara has a yellow card');
  await f.sawBanner(`Yellow card for ${SHORT}`);

  await c.card('Esme', 'r');
  await c.toast('Esme sent off. The team plays one short.');
  await c.until(() => [...document.querySelectorAll('#view .benchbox .chip')].some(x => x.querySelector('.n')?.textContent === 'Esme' && x.querySelector('.cd.r')), 'Esme sent off');
  assert.equal(await c.text('#view .pitch .cnt'), '4/5');
  await c.tapChip('Esme', '.benchbox');
  await c.until(() => document.querySelector('.modal h3')?.textContent === 'Esme was sent off', 'the sent-off pop-up');
  await c.tapText('OK', '.modal');
  await c.tapChip('Bea');
  await c.until(() => document.querySelectorAll('.modal .qp').length === 2, 'two on the bench to choose from'); // Cormac and Player 7, not Esme
  assert.doesNotMatch(await c.text('.modal'), /Esme/);
  await c.tapText('Cancel', '.modal');

  await c.plus('them');
  await c.waitScore('them', '1');
  await f.until(() => document.querySelector('.pboard .big')?.textContent === '1–1', '1–1 for followers');
  await c.fullTime(1);
  await f.until(() => document.querySelector('.pboard')?.textContent.includes('Full time'), 'full time for followers');
  await noNamesForFollowers();

  await c.reload(TEAM);
  await c.openGame(1);
  await c.waitScore('us', '1');
  assert.equal(await c.score('them'), '1');
  assert.equal(await c.pill(), 'Full time');
  assert.equal(await c.chipPart('Bea', '.gl'), '⚽ 1');
  const cards = await c.b.execute(() => [...document.querySelectorAll('#view .log')].find(x => x.textContent.includes('Cards'))?.innerText || '');
  assert.match(cards, /🟥 Esme/);
  assert.match(cards, /🟨 Dara/);

  // 6. New players mid-tournament: from the Squad tab, and straight onto a game's bench
  await c.openGame(2);
  await c.pickTeam('Alfie J', ['Gus', 'Hana', 'Ivo', 'Cormac']);
  await c.goTab('squad');
  await c.type('#newname', 'Jude');
  await c.pressReturn('#newname');
  await c.until(() => document.querySelector('#view .benchask')?.textContent.includes('Put Jude on the bench?'), 'the bench question');
  assert.match(await c.text('.benchask'), /The team is already picked for game 2\./);
  await c.tapText('Add to the bench');
  await c.toast('On the bench for 1 game.');
  await c.openGame(2);
  await c.waitChip('Jude', '.benchbox');
  await c.tapText('Add a player to the bench');
  await c.type('#latename', 'Kit');
  await c.tapText('Add to bench');
  await c.toast('Kit is on the bench and in the squad.');
  await c.waitChip('Kit', '.benchbox');
  await c.reload(TEAM);
  await c.openGame(2);
  await c.waitChip('Jude', '.benchbox');
  await c.waitChip('Kit', '.benchbox');
  await c.goTab('squad');
  await c.until(() => document.getElementById('view')?.textContent.includes('13 in the squad.'), '13 in the squad');

  // 7. Finish the tournament, write the report, check the results
  await c.goTab('games');
  await c.tapText('Finish tournament and save to Results');
  await c.tapText('Tap again to save and start fresh');
  await c.until(() => document.querySelector('.modal h3')?.textContent === 'Tournament saved ✓', 'Tournament saved');
  assert.match(await c.text('.modal'), /W0 D1 L0/);
  await c.type('#rptnew', REPORT);
  await c.tapText('Save report', '.modal');
  await c.toast('Match report saved.');
  await c.reload(TEAM);
  await c.goTab('season');
  await c.tapFound(() => [...document.querySelectorAll('#view .tcard')].find(x => x.textContent.includes('Autumn Cup'))?.querySelector('[data-act=topen]'), 'the tournament');
  await c.until(() => !!document.querySelector('#view .tcard .tb'), 'the tournament summary');
  const tb = await c.text('#view .tcard');
  assert.match(tb, /W0 D1 L0/);
  assert.equal(await c.text('#view .tcard .tb .report'), REPORT);
  assert.ok(tb.includes(`9:30 ${SHORT} v Riverside`), 'game 1 in the results');
  assert.match(tb, /⚽ Bea \d+'/);
  assert.match(tb, /🟨 Dara \d+'/);
  assert.match(tb, /🟥 Esme \d+'/);
  const flag = who => c.b.execute(n => [...document.querySelectorAll('#view .tcard .tb .mrow')].find(x => x.querySelector('.who')?.firstChild?.textContent === n)?.querySelector('.flag')?.textContent ?? null, who);
  assert.equal(await flag('Player 7'), 'Less time'); // on the bench all game
  assert.equal(await flag('Bea'), null);
  assert.ok(await c.has('#view .tcard .tb [data-act=tshare]'), 'Share results is offered');
  assert.match(tb, /Playing time, least first/);

  // 8. Rugby: try, sin bin countdown, playing time keeps counting
  await c.goTab('squad');
  await c.tap('[data-act=sport][data-v=rugby]');
  await c.until(() => document.querySelector('[data-act=rscore][data-v=points]')?.classList.contains('on'), 'rugby points scoring');
  await c.goTab('games');
  await c.tapText('Set up games');
  await c.openGame(1);
  assert.equal(await c.count('#view [data-act=role][data-r=gk]'), 0); // no keeper in rugby
  await c.pickTeam(null, ['Bea', 'Cormac', 'Dara', 'Esme', 'Finn']);
  await c.tapText('Kick off');
  await c.toast('Kicked off.');
  await c.plus('us');
  await c.until(() => document.querySelector('.hint.scorer')?.textContent.includes('What did we score?'), 'what did we score');
  await c.tap('.hint.scorer [data-act=rtype][data-type=try]');
  await c.until(() => document.querySelector('.hint.scorer')?.textContent.includes('Who scored the try?'), 'who scored the try');
  await c.tapFound(() => [...document.querySelectorAll('.hint.scorer [data-act=scorer]')].find(x => x.textContent === 'Bea'), 'Bea as scorer');
  await c.waitScore('us', '5');
  await c.until(() => [...document.querySelectorAll('#view .pitch .chip')].find(x => x.querySelector('.n')?.textContent === 'Bea')?.querySelector('.gl')?.textContent === '5 pts', 'Bea 5 pts');
  await c.card('Dara', 'y');
  await c.toast('Dara: yellow card, 10 minutes in the sin bin.');
  const secs = t => { const m = String(t).match(/(\d+):(\d\d)/); return m ? +m[1] * 60 + +m[2] : NaN; };
  await c.until(() => /🟨 9:\d\d/.test([...document.querySelectorAll('#view .pitch .chip')].find(x => x.querySelector('.n')?.textContent === 'Dara')?.querySelector('.cd.y')?.textContent || ''), 'the sin-bin countdown');
  const bin1 = secs(await c.chipPart('Dara', '.cd.y')), min1 = secs(await c.chipPart('Dara', '.m'));
  await c.b.waitUntil(async () => secs(await c.chipPart('Dara', '.cd.y')) < bin1 - 1 && secs(await c.chipPart('Dara', '.m')) > min1 + 1,
    {timeout: 20000, interval: 500, timeoutMsg: 'the sin bin counting down while playing time counts up'});
  await c.tapChip('Dara');
  await c.until(() => document.querySelector('.modal .warnline')?.textContent.includes('Dara is in the sin bin for another 9:'), 'the sin-bin note');
  await c.tapText('Cancel', '.modal');
  await c.fullTime(1);
  await c.reload(TEAM);
  await c.goTab('squad');
  await c.until(() => document.querySelector('[data-act=sport][data-v=rugby]')?.classList.contains('on'), 'rugby after reload');
  finished = true;
}));
