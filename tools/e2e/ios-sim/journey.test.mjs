// A coach's match day in real Safari on the iOS Simulator, driven by Appium. Beta only.
// Shorter than the Playwright journey (one game, no follower): it checks the app in the real iPhone
// browser: Safari's layout, real taps, the keyboard's Return key, live redraws during a game.
// Limits of Safari's automation, stepped around below: typed text doesn't mark a box as edited (so
// leaving a box fires its "change" here), number boxes are emptied by script, and the date wheel is
// set by script. The Playwright tests cover those paths in WebKit.
// Run: cd tools/e2e/ios-sim && npm test   (Appium must be running: npm run appium, see README)
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {remote} from 'webdriverio';
import {mkdirSync} from 'node:fs';

const BASE = (process.env.MATCHDAY_URL || 'https://match-day-beta-17b23.web.app').replace(/\/$/, '');
if (/match-day-17b23\.(web\.app|firebaseapp\.com)/.test(BASE)) throw new Error('Never run against live. Use beta or localhost.');
const UDID = process.env.SIM_UDID; // optional: a particular simulator; otherwise Appium picks by name
const DEVICE = process.env.SIM_DEVICE || 'iPhone 17';
const TEAM = 'Claude E2E Sim U9s', SHORT = 'Claude E2E Sim';
const SQUAD = ['Alfie Smith', 'Alfie Jones', 'Player 7', 'Bea', 'Cormac', 'Dara', 'Esme', 'Finn'];
const PROTECTED_CODES = ['L9J-Q7H', '4VT-AWE', 'L83-LTJ'];
const DAY = new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-CA');

let b, joined = false;
const css = s => b.$(s);
// Wait until a check (run in the page) is true; the message says what was expected.
const until = (fn, what, ms = 20000, ...args) => b.waitUntil(async () => !!(await b.execute(fn, ...args)), {timeout: ms, interval: 250, timeoutMsg: `timed out waiting for ${what}`});
const text = sel => b.execute(s => document.querySelector(s)?.innerText ?? '', sel);
// Messages show for 3.5 s, and Appium can be slower than that, so the page keeps a list of every one.
const watchToasts = () => b.execute(() => { const t = document.getElementById('toast'), root = document.documentElement;
  if (root.dataset.e2eToasts !== undefined) return; root.dataset.e2eToasts = ''; // kept on the page: each Appium call runs in its own script context
  new MutationObserver(() => { if (!t.hidden) root.dataset.e2eToasts += t.textContent + '\n'; })
    .observe(t, {attributes: true, childList: true, characterData: true, subtree: true}); });
const toast = msg => until(m => (document.documentElement.dataset.e2eToasts || '').includes(m), `toast "${msg}"`, 20000, msg)
  .then(() => b.execute(() => { document.documentElement.dataset.e2eToasts = ''; }));
const saved = () => until(() => document.getElementById('sync')?.textContent === 'Shared · live', 'everything saved', 30000);
// Tap a button by its exact text (optionally inside a container).
const tapText = (label, within = 'body') => tapFound((l, w) => [...document.querySelectorAll(`${w} button`)].find(x => x.textContent.trim() === l && x.offsetParent), `the "${label}" button`, label, within);
// Find something in the page, mark it and tap it, all again if the screen redraws in between (live
// updates redraw the game screen while the clock runs). find(...args) runs in the page and returns
// the element or null.
async function tapFound(find, what, ...args) {
  for (let i = 0; i < 6; i++) {
    // (built as a script string: the app's security policy blocks new Function() inside the page)
    const ok = await b.execute(`document.querySelectorAll('[data-e2e]').forEach(e => e.removeAttribute('data-e2e'));
      const el = (${find.toString()})(...arguments); if (el) el.setAttribute('data-e2e', 'go'); return !!el;`, ...args);
    if (ok) { try { const el = await css('[data-e2e=go]'); await el.waitForDisplayed({timeout: 3000}); await el.click(); return; } catch (_) {} }
    await b.pause(500);
  }
  throw new Error(`couldn't tap ${what}`);
}
const tap = async sel => { const el = await css(sel); await el.waitForDisplayed({timeout: 20000}); await el.click(); };
// Type into a box, finding it again if the screen redraws mid-way (as live updates arrive).
async function type(sel, v) {
  for (let i = 0; ; i++) {
    try {
      const el = await css(sel); await el.waitForDisplayed({timeout: 20000});
      // Empty the box without firing events (clearing it the WebDriver way fires a change that redraws
      // the screen, and Safari's automation can't send Backspace to number boxes), then type for real.
      await b.execute(s => { document.querySelector(s).value = ''; }, sel);
      await el.click(); // a real tap, so leaving the box later counts as a change
      await el.addValue(v);
      const got = await b.execute(s => document.querySelector(s)?.value, sel);
      if (got === v) return;
      console.log(`type ${sel}: wanted "${v}", box has "${got}"`);
    } catch (e) { console.log(`type ${sel} try ${i}: ${e.message.split('\n')[0]}`); if (i >= 3 || !/stale|no longer attached/i.test(e.message)) throw e; await b.pause(500); }
    if (i >= 3) throw new Error(`couldn't type "${v}" into ${sel}`);
  }
}
// Leave a box so it saves. Safari's automation types without marking the box as edited, so leaving it
// doesn't fire the "change" a real keyboard would; fire it here, then blur, as a real tap-away does.
const leaveBox = async sel => {
  await b.execute(s => { const el = document.querySelector(s); if (!el) return;
    el.dispatchEvent(new Event('change', {bubbles: true})); el.blur(); }, sel);
  await b.pause(300);
};
const reload = async () => {
  await saved();
  await b.execute(() => { document.documentElement.dataset.e2eOld = '1'; }); // gone once the new page is in
  await b.refresh();
  await until(t => !document.documentElement.dataset.e2eOld && document.readyState === 'complete' && document.getElementById('hteam')?.textContent === t, 'the team after reload', 30000, TEAM);
  await watchToasts();
};
const goTab = async t => {
  const season = ['season', 'awards', 'squad'].includes(t);
  // the section tap can land before the page is ready after a reload: tap again until its tabs show
  await b.waitUntil(async () => {
    if (await b.execute(x => !!document.querySelector(`#subtabs [data-t=${x}]`), t)) return true;
    await tap(`#sections [data-s=${season ? 'season' : 'tournament'}]`); await b.pause(500);
    return b.execute(x => !!document.querySelector(`#subtabs [data-t=${x}]`), t);
  }, {timeout: 20000, interval: 500, timeoutMsg: `the ${t} tab`});
  await tap(`#subtabs [data-t=${t}]`);
  if (t === 'games' && await b.execute(() => !!document.querySelector('.gstrip'))) await tap(`#subtabs [data-t=games]`);
};
const role = async (name, r) => {
  await tapFound((n, r) => [...document.querySelectorAll('#view .row')].find(x => x.querySelector('.who')?.textContent === n)?.querySelector(`[data-r=${r}]`), `${name} ${r}`, name, r);
  await until((n, r) => [...document.querySelectorAll('#view .row')].find(x => x.querySelector('.who')?.textContent === n)?.querySelector(`[data-r=${r}]`)?.classList.contains('on'), `${name} as ${r}`, 20000, name, r);
  await saved();
};
const chipSel = (name, where = '.pitch') => b.execute((n, w) => { document.querySelectorAll('[data-e2e]').forEach(e => e.removeAttribute('data-e2e'));
  const c = [...document.querySelectorAll(`#view ${w} .chip`)].find(x => x.querySelector('.n')?.textContent === n); if (c) c.setAttribute('data-e2e', 'chip'); return !!c; }, name, where);
const tapChip = (name, where = '.pitch') => tapFound((n, w) => [...document.querySelectorAll(`#view ${w} .chip`)].find(x => x.querySelector('.n')?.textContent === n), `${name} in ${where}`, name, where);

before(async () => {
  b = await remote({hostname: '127.0.0.1', port: 4723, logLevel: 'warn', connectionRetryCount: 0, connectionRetryTimeout: 900000,
    capabilities: {platformName: 'iOS', browserName: 'Safari', 'appium:automationName': 'XCUITest', 'appium:deviceName': DEVICE,
      ...(UDID ? {'appium:udid': UDID} : {}), 'appium:wdaLaunchTimeout': 600000, 'appium:safariInitialUrl': 'about:blank',
      'appium:safariAllowPopups': true, 'appium:safariIgnoreFraudWarning': true, 'appium:webviewConnectTimeout': 30000}});
  // a fresh coach: nothing left over from an earlier run on this simulator
  await b.url(BASE + '/privacy.html');
  await b.setTimeout({script: 30000});
  await b.waitUntil(async () => (await b.getUrl()).startsWith(BASE) && await b.execute(() => document.readyState === 'complete').catch(() => false),
    {timeout: 30000, interval: 500, timeoutMsg: 'the first page to load'});
  await b.execute(() => { localStorage.clear(); sessionStorage.clear();
    indexedDB.databases?.().then(l => l.forEach(d => indexedDB.deleteDatabase(d.name))); });
  await b.pause(1500);
});

let failed = false;
after(async () => {
  if (b && failed) console.log('page state', JSON.stringify(await b.execute(() => ({toasts: document.documentElement.dataset.e2eToasts, now: document.getElementById('toast')?.textContent, hidden: document.getElementById('toast')?.hidden})).catch(e => e.message)));
  if (b && failed) { mkdirSync('test-results', {recursive: true}); await b.saveScreenshot('test-results/failed.png').catch(() => {}); }
  if (b && joined) {
    try {
      await saved().catch(() => {});
      if (!(await b.execute(() => !!document.querySelector('[data-act=menuclose]')))) await tap('#menubtn');
      await tap('[data-act=leave]');
      await until(() => document.querySelector('[data-act=leave]')?.textContent === 'Tap again to leave this team on this phone', 'the leave confirm');
      await tap('[data-act=leave]');
      await until(t => document.getElementById('view')?.innerText.includes('You left ' + t), 'leaving the team', 30000, TEAM);
    } catch (e) { console.warn('Clean-up did not finish:', e.message); }
  }
  await b?.deleteSession();
});

test('a coach runs a match day in iPhone Safari', async () => { try { await journey(); } catch (e) { failed = true; throw e; } });

async function journey() {
  // 1. Create a team with a squad
  await b.url(BASE + '/');
  await watchToasts();
  // v0.27.0 on: the new team's manager gives their name first
  await until(() => !!document.querySelector('[data-act=mkteam]'), 'the start screen', 30000);
  if (await b.execute(() => !!document.getElementById('mkname'))) { await type('#mkname', 'Claude (tests)'); await leaveBox('#mkname'); }
  await tapText('Create a team');
  await until(() => !!document.getElementById('cfg-team'), 'the team set-up', 30000);
  joined = true;
  await type('#cfg-team', TEAM);
  await type('#cfg-size', '5');
  await type('#bulknames', SQUAD.join('\n'));
  await tapText('Start using the app'); // tapped while the keyboard is up
  await toast('All set.');
  assert.equal(await text('#hteam'), TEAM);
  await reload();
  await goTab('squad');
  const names = () => b.execute(() => [...document.querySelectorAll('#view .rows .row .who')].map(x => x.textContent));
  await until(() => document.querySelectorAll('#view .rows .row .who').length >= 8, 'the squad list');
  assert.deepEqual(await names(), ['Alfie J', 'Alfie S', 'Bea', 'Cormac', 'Dara', 'Esme', 'Finn', 'Player 7']);

  // 2. Add a player with the keyboard's Go key, and with the Add button while the keyboard is up
  await type('#newname', 'Gus');
  await b.elementSendKeys((await css('#newname')).elementId, '\uE007') // the keyboard's Return key, sent once
    .catch(e => { if (!/no longer attached|stale/i.test(e.message)) throw e; }); // the box redraws as it saves
  await toast('Gus added.');
  await until(() => [...document.querySelectorAll('#view .rows .row .who')].some(x => x.textContent === 'Gus'), 'Gus in the list');
  await type('#newname', 'Hana');
  await tap('#addf button[type=submit]');
  await toast('Hana added.');
  await until(() => [...document.querySelectorAll('#view .rows .row .who')].some(x => x.textContent === 'Hana'), 'Hana in the list');
  await type('#newname', 'Bea');
  await tap('#addf button[type=submit]');
  await toast('Bea is already in the squad.');
  await leaveBox('#newname');

  // the invite code is a fresh team's, never one of the user's own
  await tap('#menubtn');
  const code = (await text('#view p b.num')).trim();
  assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.ok(!PROTECTED_CODES.includes(code));
  await tap('[data-act=menuclose]');

  // 3. One game, two halves, with a fixture
  await goTab('games');
  for (const [sel, v] of [['#tname', 'Sim Cup'], ['#len', '20'], ['#cnt', '1'], ['#tsize', '5']]) { await type(sel, v); await leaveBox(sel); }
  await b.execute((d) => { const i = document.getElementById('tdate'); i.value = d; i.dispatchEvent(new Event('change', {bubbles: true})); }, DAY); // iOS date wheel can't be typed into
  await tap('[data-act=periods][data-v="2"]');
  await tapText('Set up games');
  await toast('1 game ready.');
  await tapText('Enter opponents and kick-off times');
  for (const [sel, v] of [['#fx-t-g1', '9:30'], ['#fx-o-g1', 'Riverside'], ['#fx-p-g1', '2']]) { await type(sel, v); await leaveBox(sel); }
  await saved();
  await tapText('← All games');
  await until(s => document.querySelector('.gcard')?.innerText.includes(s + ' v Riverside'), 'the fixture', 20000, SHORT);

  // 4. Game 1: pick the team, kick off, goal, sub, yellow card, full time
  await tap('[data-act=open][data-g=g1]');
  await role('Alfie S', 'gk');
  for (const n of ['Bea', 'Cormac', 'Dara', 'Esme']) await role(n, 'start');
  await role('Finn', 'bench');
  await tap('.board [data-act=score][data-k=us][data-d="1"]');
  await toast('Tap Kick off first');
  await tapText('Kick off');
  await toast('Kicked off.');
  await tap('.board [data-act=score][data-k=us][data-d="1"]');
  await until(() => document.querySelector('.hint.scorer')?.innerText.includes('Who scored?'), 'the scorer picker');
  await tapFound(() => [...document.querySelectorAll('.hint.scorer [data-act=scorer]')].find(x => x.textContent === 'Bea'), 'Bea as scorer');
  assert.ok(await chipSel('Bea'));
  await until(() => document.querySelector('[data-e2e=chip] .gl')?.textContent === '⚽ 1', 'Bea ⚽ 1');
  await tapChip('Cormac');
  await until(() => document.querySelector('.modal h3')?.textContent === "Cormac off. Who's coming on?", 'the sub pop-up');
  await tapFound(() => [...document.querySelectorAll('.modal .qp')].find(x => x.querySelector('b')?.textContent === 'Finn'), 'Finn coming on');
  assert.ok(await chipSel('Finn'), 'Finn on the pitch');
  await tapChip('Dara');
  await tapText('🟨 Yellow card', '.modal');
  await toast('Dara: yellow card.');
  await tapText('Full time');
  await tapText('End game', '.modal');
  await until(() => document.querySelector('#view .ghead .pill')?.textContent === 'Full time', 'full time');

  // 5. It all saved
  await reload();
  await tap('[data-act=open][data-g=g1]');
  await until(() => document.querySelector('#view .board .side b')?.textContent === '1', 'the score after reload');
  assert.ok(await chipSel('Bea'));
  assert.equal(await text('[data-e2e=chip] .gl'), '⚽ 1');
  assert.ok((await text('#view')).includes('▲ Finn'));
}
