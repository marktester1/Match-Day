// A follower's day in iPhone Safari (second simulator) while a coach runs two games (first simulator),
// and a new follower link replacing the old one. Port of ../follower.spec.js. Beta only.
// Halves are 1 minute here (30 seconds in Playwright), as Appium is slower.
import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {phone, cleanUp, run, guardBeta, nameRe} from './lib.mjs';

guardBeta();
const TEAM = 'Claude E2E Sim Follow U11s', SHORT = 'Claude E2E Sim Follow';
const SQUAD = ['Bea', 'Cormac', 'Dara', 'Esme', 'Finn', 'Gus'];

let coach, fp, joined = false, finished = false;
afterEach(async () => {
  await cleanUp(finished, [async () => { if (joined) await coach.leave(TEAM); }]);
  await coach?.close(); await fp?.close();
  coach = fp = null; joined = finished = false;
});
const board = sel => fp.text('.pboard' + (sel ? ' ' + sel : ''));
const status = v => fp.until(v => document.querySelector('.pboard .pst')?.textContent === v, `the follower board to say ${v}`, 30000, v);
const big = v => fp.until(v => document.querySelector('.pboard .big')?.textContent === v, `${v} on the follower board`, 30000, v);
const noNames = async () => { const t = await fp.bodyText(); for (const n of SQUAD) assert.doesNotMatch(t, nameRe(n), `the follower sees ${n}`); };
const canChangeNothing = async () => {
  assert.equal(await fp.b.execute(() => getComputedStyle(document.getElementById('tabs')).display), 'none');
  assert.equal(await fp.b.execute(() => getComputedStyle(document.getElementById('menubtn')).display), 'none');
  assert.equal(await fp.count('#view [data-act=score], #view [data-act=kick], #view [data-act=tap], #view input'), 0);
};
async function teamWithLink() {
  await coach.createTeam(TEAM, SQUAD);
  joined = true;
  await coach.menu();
  await coach.tapTextLike(/^Create a supporters' link/);
  await coach.toast("Supporters' link ready.");
  const link = (await coach.text('.plink')).trim();
  await coach.saved();
  return link;
}

test('a follower watches the day from the link, in iPhone Safari', {timeout: 30 * 60000}, () => run(() => [coach, fp], async () => {
  coach = await phone(0);
  fp = await phone(1);
  // A link that doesn't exist
  await fp.goto('/?follow=' + 'Zz9'.repeat(8));
  await fp.until(() => { const t = document.getElementById('view')?.innerText || ''; return t.includes("This link isn't working") && t.includes("Ask the coach for the new supporters' link."); }, 'the dead-link message', 30000);

  // The coach makes a team and a follower link before any games are set up
  const link = await teamWithLink();
  await coach.closeMenu();
  await fp.goto(link);
  await fp.watchBanners();
  await fp.until(s => document.querySelector('.pboard')?.textContent.includes(s), 'the team on the board', 30000, SHORT);
  assert.match(await board(), /No game yet\. The score shows here when a game starts\./);
  assert.ok(await fp.b.execute(() => [...document.querySelectorAll('#view .card h3')].some(x => x.textContent.includes('Get notifications'))));
  assert.deepEqual(await fp.b.execute(() => [...document.querySelectorAll('#view .kinds button')].map(x => x.textContent)), ['Kick-off', 'Goals', 'Cards', 'Half time', 'Full time']);
  const cardsPressed = () => fp.b.execute(() => [...document.querySelectorAll('#view .kinds button')].find(x => x.textContent === 'Cards')?.getAttribute('aria-pressed'));
  await fp.tapFound(() => [...document.querySelectorAll('#view .kinds button')].find(x => x.textContent === 'Cards'), 'Cards'); // no permission needed until they're turned on
  await fp.until(() => [...document.querySelectorAll('#view .kinds button')].find(x => x.textContent === 'Cards')?.getAttribute('aria-pressed') === 'false', 'Cards off');
  await fp.tapFound(() => [...document.querySelectorAll('#view .kinds button')].find(x => x.textContent === 'Cards'), 'Cards');
  assert.equal(await cardsPressed(), 'true');
  assert.match(await fp.text('#view'), /add this page to your Home Screen/); // iPhone: notifications need the Home Screen app
  await canChangeNothing();

  // Fixtures appear: game 1 at home, game 2 away
  await coach.setUpGames({name: 'Winter Cup', len: '2', count: '2', periods: '2'}); // two halves of a minute
  await coach.fixtures([['9:30', 'Riverside', '2'], ['10:15', 'Hillside', '4', true]]);
  await fp.until(() => document.querySelectorAll('#view .prow').length === 2 && document.getElementById('view').textContent.includes('Winter Cup'), 'the two fixtures', 30000);
  const row = i => fp.b.execute(i => document.querySelectorAll('#view .prow')[i]?.innerText || '', i);
  assert.ok((await row(0)).includes(`${SHORT} v Riverside`) && (await row(0)).includes('9:30'));
  assert.ok((await row(1)).includes(`Hillside v ${SHORT}`) && (await row(1)).includes('10:15')); // away: they're the home side
  assert.match(await fp.text('#view'), /Still to play/);
  await fp.until(() => document.querySelector('.pboard')?.textContent.includes('Kick-off soon'), 'Kick-off soon');

  // Game 1: kick-off, a goal each way, a card, half time by itself, second half, full time
  await coach.openGame(1);
  await coach.pickTeam('Bea', ['Cormac', 'Dara', 'Esme', 'Finn'], ['Gus']);
  await coach.tapText('Kick off');
  await fp.sawBanner('Kick-off', 30000);
  await status('1st half');
  await big('0–0');
  const t1 = await board('.pclock');
  await fp.until(t => document.querySelector('.pboard .pclock')?.textContent !== t, 'the clock running on the follower\'s phone', 20000, t1);
  await coach.goal('Dara');
  await fp.sawBanner(`Goal! ${SHORT}`);
  await fp.sawBanner(`${SHORT} 1–0 Riverside`);
  await big('1–0');
  await coach.card('Esme', 'y');
  await fp.sawBanner(`Yellow card for ${SHORT}`);
  await noNames();

  // after the half's usual time the clock keeps going into added time; supporters see it, then the coach taps Half time
  await fp.until(() => document.querySelector('.pboard .pst')?.textContent === 'Added time', 'added time', 90000);
  await coach.tapText('Half time');
  await status('Half time').catch(() => fp.until(() => document.querySelector('.pboard .pst')?.textContent === 'Half time', 'half time', 90000));
  await fp.sawBanner('Half time');
  await coach.waitPill('Half time');
  await coach.tapText('Start 2nd half');
  await status('2nd half');
  await coach.plus('them');
  await big('1–1');
  await coach.fullTime(1);
  await status('Full time');
  await fp.sawBanner('Full time');
  assert.match(await fp.text('#view'), /Played/);
  assert.equal(await fp.b.execute(() => document.querySelector('#view .prow .psc')?.textContent), '1–1');
  assert.equal(await fp.b.execute(() => document.querySelector('#view .prow .flag')?.textContent), 'Full time');

  // The follower reloads: still the same picture
  await fp.reload();
  await fp.watchBanners();
  await status('Full time');
  await big('1–1');

  // Game 2, away: the board switches games, home side on the left
  await coach.openGame(2);
  await coach.pickTeam('Gus', ['Bea', 'Cormac', 'Dara', 'Finn'], ['Esme']);
  await coach.tapText('Kick off');
  await fp.until(() => document.querySelector('.pboard')?.textContent.includes('Game 2'), 'game 2 on the board', 60000);
  await fp.sawBanner('Kick-off');
  await fp.sawBanner('Hillside');
  assert.match(await fp.b.execute(() => document.querySelector('.pboard .tn')?.textContent || ''), /Hillside/);
  await coach.goal('Bea');
  await fp.sawBanner(`Goal! ${SHORT}`);
  await big('0–1');
  await fp.until(() => document.querySelectorAll('#view .prow')[1]?.querySelector('.flag')?.textContent === 'Live', 'game 2 live in the list');
  await coach.fullTime(2);
  await status('Full time');
  await noNames();
  await canChangeNothing();

  // The coach saves the tournament: followers keep the day's results
  await coach.goTab('games');
  await coach.tapText('Finish tournament and save to Results');
  await coach.tapText('Tap again to save and start fresh');
  await coach.tapText('Write it later', '.modal');
  await fp.reload();
  await status('Full time');
  assert.equal(await fp.count('#view .prow'), 2);
  finished = true;
}));

test('a new follower link replaces the old one, in iPhone Safari', {timeout: 15 * 60000}, () => run(() => [coach, fp], async () => {
  coach = await phone(0);
  fp = await phone(1);
  const link = await teamWithLink();
  await fp.goto(link);
  await fp.until(s => document.querySelector('.pboard')?.textContent.includes(s), 'the team on the board', 30000, SHORT);
  // the old one stops working at once, the new one works
  await coach.tapText('Make a new link');
  await coach.tapText('Tap again: the old link stops working');
  await coach.toast("Supporters' link ready.");
  await coach.until(l => (document.querySelector('.plink')?.textContent || '').trim() !== l, 'a new link', 20000, link);
  const link2 = (await coach.text('.plink')).trim();
  await fp.until(() => document.getElementById('view')?.textContent.includes("This link isn't working"), 'the old link to stop', 30000);
  await coach.saved();
  await fp.goto(link2);
  await fp.until(s => document.querySelector('.pboard')?.textContent.includes(s), 'the new link working', 30000, SHORT);
  finished = true;
}));
