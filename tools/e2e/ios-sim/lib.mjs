// Shared steps for the iOS Simulator tests: each "phone" is real Mobile Safari on one Xcode simulator,
// driven through Appium (npm run appium must be running). Beta only. These mirror tools/e2e/helpers.js.
//
// Limits of Safari's automation that these steps work around (the Playwright tests cover the same
// paths in WebKit):
// - typed text doesn't mark a box as edited, so leaving a box fires its "change" here;
// - number boxes can't be cleared by typing, so a box is emptied by script before typing;
// - the date wheel is set by script;
// - each script runs walled off from the page's own variables, so state is kept on the page (data-*);
// - a tap can land just as a live update redraws the screen, so finding and tapping are retried together.
import assert from 'node:assert/strict';
import {execSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {remote} from 'webdriverio';

export const BASE = (process.env.MATCHDAY_URL || 'https://match-day-beta-17b23.web.app').replace(/\/$/, '');
export const LIVE = 'https://match-day-17b23.web.app';
export const PROTECTED_CODES = ['L9J-Q7H', '4VT-AWE', 'L83-LTJ']; // the user's teams and Claude's shared one
export const DAY = new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-CA'); // not today: no auto-open of a game
export const nameRe = n => new RegExp(`(^|[^A-Za-z])${n.replace(' ', '\\s')}([^A-Za-z]|$)`, 'i'); // any case: names could be shown in capitals
export const sortNames = l => [...l].sort((a, b) => a.localeCompare(b, 'en', {sensitivity: 'base'}));
export const guardBeta = () => { if (/match-day-17b23\.(web\.app|firebaseapp\.com)/.test(BASE)) throw new Error('These journeys never run against live. Use beta or localhost.'); };

// The simulators, by name (SIMS="iPhone 17,iPhone Air,iPhone 17e" to choose). Phone 1 is the coach.
const SIM_NAMES = (process.env.SIMS || 'iPhone 17,iPhone Air,iPhone 17e').split(',').map(s => s.trim());
function simUdid(name) {
  const all = JSON.parse(execSync('xcrun simctl list devices available -j').toString()).devices;
  const found = Object.entries(all).filter(([rt]) => /iOS/.test(rt)).flatMap(([, l]) => l).filter(d => d.name === name);
  if (!found.length) throw new Error(`No "${name}" simulator. Make one in Xcode, or set SIMS.`);
  const d = found.find(x => x.state === 'Booted') || found[found.length - 1];
  if (d.state !== 'Booted') execSync(`xcrun simctl boot ${d.udid} && xcrun simctl bootstatus ${d.udid} -b`, {stdio: 'ignore'});
  return d.udid;
}

// Start phone i (0, 1, 2) and clear anything an earlier run left in its Safari for this site.
export async function phone(i = 0, {fresh = true} = {}) {
  const udid = simUdid(SIM_NAMES[i]);
  // Safari's inspector connection sometimes isn't ready in time (a fixed 5 s in Appium): try again
  let b;
  for (let tries = 1; ; tries++) {
    try { b = await startSession(udid, i); break; }
    catch (e) { if (tries >= 3 || !/remote debugger|connected web applications|not connectable/i.test(e.message)) throw e; await new Promise(r => setTimeout(r, 5000)); }
  }
  await b.setTimeout({script: 30000});
  const p = makePhone(b, SIM_NAMES[i]);
  if (fresh) { // a new coach: nothing left from an earlier run (an old tab can block deleting stored data)
    const tabs = await b.getWindowHandles().catch(() => []);
    for (const h of tabs.slice(1)) { await b.switchToWindow(h).catch(() => {}); await b.closeWindow().catch(() => {}); }
    if (tabs.length > 1) await b.switchToWindow((await b.getWindowHandles())[0]).catch(() => {});
    await p.goto('/privacy.html');
    for (let i = 0; i < 5; i++) {
      const left = await b.execute(async () => { localStorage.clear(); sessionStorage.clear();
        const l = (await indexedDB.databases?.()) || [];
        await Promise.all(l.map(d => new Promise(ok => { const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = ok; })));
        return ((await indexedDB.databases?.()) || []).length; }).catch(() => -1);
      if (left === 0) break;
      await b.pause(1000);
    }
  }
  return p;
}
const startSession = (udid, i) => remote({hostname: '127.0.0.1', port: 4723, logLevel: 'warn', connectionRetryCount: 0, connectionRetryTimeout: 900000,
    capabilities: {platformName: 'iOS', browserName: 'Safari', 'appium:automationName': 'XCUITest', 'appium:udid': udid,
      'appium:wdaLocalPort': 8100 + i, 'appium:wdaLaunchTimeout': 600000, 'appium:webviewConnectTimeout': 30000,
      'appium:simulatorStartupTimeout': 600000, // GitHub's Mac can take over the default 2 minutes to start one
      'appium:newCommandTimeout': 1800, // a phone may sit idle for minutes while another simulator starts
      'appium:safariInitialUrl': 'about:blank', 'appium:safariIgnoreFraudWarning': true}});

function makePhone(b, name) {
  const css = s => b.$(s);
  const p = {
    b, name,
    // Wait until a check (run in the page) is true; `what` says what was expected.
    until: (fn, what, ms = 20000, ...args) => b.waitUntil(async () => !!(await b.execute(fn, ...args).catch(() => false)),
      {timeout: ms, interval: 250, timeoutMsg: `${name}: timed out waiting for ${what}`}),
    // the text as written (Safari's innerText applies CSS capitals: "STILL TO PLAY")
    text: sel => b.execute(s => document.querySelector(s)?.textContent.replace(/\s+/g, ' ') ?? '', sel),
    has: sel => b.execute(s => !!document.querySelector(s), sel),
    count: sel => b.execute(s => document.querySelectorAll(s).length, sel),
    bodyText: () => b.execute(() => document.body.innerText),

    // Messages show for 3.5 s and Appium can be slower, so the page keeps a list of every one.
    watchToasts: () => b.execute(() => { const t = document.getElementById('toast'), root = document.documentElement;
      if (!t || root.dataset.e2eToasts !== undefined) return; root.dataset.e2eToasts = '';
      new MutationObserver(() => { if (!t.hidden) root.dataset.e2eToasts += t.textContent + '\n'; })
        .observe(t, {attributes: true, childList: true, characterData: true, subtree: true}); }),
    toast: (msg, ms = 20000) => p.until(m => (document.documentElement.dataset.e2eToasts || '').includes(m), `message "${msg}"`, ms, msg)
      .then(() => b.execute(() => { document.documentElement.dataset.e2eToasts = ''; })),
    // Follower banners show for 6 s: the same idea.
    watchBanners: () => b.execute(() => { const root = document.documentElement; if (root.dataset.e2eBanners !== undefined) return; root.dataset.e2eBanners = '';
      let last = ''; new MutationObserver(() => { const x = document.querySelector('.pbanner'); const t = x && x.innerText.replace(/\s+/g, ' ').trim();
        if (t && t !== last) { last = t; root.dataset.e2eBanners += t + '\n'; } }).observe(document.body, {childList: true, subtree: true}); }),
    sawBanner: (msg, ms = 20000) => p.until(m => (document.documentElement.dataset.e2eBanners || '').includes(m), `banner "${msg}"`, ms, msg),
    // The header says "Shared · live" once every change has reached the server.
    saved: () => p.until(() => document.getElementById('sync')?.textContent === 'Shared · live', 'everything saved', 30000)
      .catch(async e => { throw new Error(e.message + ` (the header says "${await p.text('#sync').catch(() => '?')}")`); }),

    async goto(path) {
      await b.url(path.startsWith('http') ? path : BASE + path);
      await b.waitUntil(async () => await b.execute(() => document.readyState === 'complete').catch(() => false), {timeout: 30000, interval: 300});
      await p.watchToasts();
    },
    async reload(team) {
      if (team) await p.saved(); // (a phone not in a team yet has nothing to save)
      await b.execute(() => { document.documentElement.dataset.e2eOld = '1'; }); // gone once the new page is in
      await b.refresh();
      await p.until(t => !document.documentElement.dataset.e2eOld && document.readyState === 'complete' && (!t || document.getElementById('hteam')?.textContent === t), 'the page after reload', 30000, team);
      await p.watchToasts();
    },

    // Find something in the page, mark it and tap it; all again if the screen redraws in between.
    // find(...args) runs in the page and returns the element or null.
    async tapFound(find, what, ...args) {
      for (let i = 0; i < 8; i++) {
        const ok = await b.execute(`document.querySelectorAll('[data-e2e]').forEach(e => e.removeAttribute('data-e2e'));
          const el = (${find.toString()})(...arguments); if (el) el.setAttribute('data-e2e', 'go'); return !!el;`, ...args).catch(() => false);
        if (ok) { try { const el = await css('[data-e2e=go]'); await el.waitForDisplayed({timeout: 3000}); await el.click(); return; } catch (_) {} }
        await b.pause(500);
      }
      throw new Error(`${name}: couldn't tap ${what}`);
    },
    tap: sel => p.tapFound(s => document.querySelector(s), sel, sel),
    tapText: (label, within = 'body') => p.tapFound((l, w) => [...document.querySelectorAll(`${w} button, ${w} a.btn`)].find(x => x.textContent.trim() === l && x.offsetParent),
      `the "${label}" button`, label, within),
    tapTextLike: (re, within = 'body') => p.tapFound((s, w) => [...document.querySelectorAll(`${w} button`)].find(x => new RegExp(s).test(x.textContent.trim()) && x.offsetParent),
      `a button like ${re}`, re.source, within),

    // Type into a box: empty it (by script: number boxes can't be cleared by typing), tap it, type.
    async type(sel, v) {
      for (let i = 0; ; i++) {
        try {
          const el = await css(sel); await el.waitForDisplayed({timeout: 20000});
          await b.execute(s => { document.querySelector(s).value = ''; }, sel);
          await el.click();
          await el.addValue(v);
          if (await b.execute(s => document.querySelector(s)?.value, sel) === v) return;
        } catch (e) { if (i >= 3 || !/stale|no longer attached/i.test(e.message)) throw e; }
        if (i >= 3) throw new Error(`${name}: couldn't type "${v}" into ${sel}`);
        await b.pause(500);
      }
    },
    // Leave a box so it saves (fires the change a real keyboard edit would, then blurs).
    leaveBox: async sel => { await b.execute(s => { const el = document.querySelector(s); if (!el) return; el.dispatchEvent(new Event('change', {bubbles: true})); el.blur(); }, sel); await b.pause(300); },
    enter: async (sel, v) => { await p.type(sel, v); await p.leaveBox(sel); },
    setDate: (sel, v) => b.execute((s, d) => { const i = document.querySelector(s); i.value = d; i.dispatchEvent(new Event('change', {bubbles: true})); }, sel, v), // the iOS date wheel can't be typed into
    // The keyboard's Return key, sent once (the box may redraw as it saves).
    pressReturn: async sel => { await b.elementSendKeys((await css(sel)).elementId, '').catch(e => { if (!/no longer attached|stale/i.test(e.message)) throw e; }); },

    async goTab(t) {
      const season = ['season', 'awards', 'squad'].includes(t);
      await b.waitUntil(async () => { // the section tap can land before the page is ready: tap again until its tabs show
        if (await b.execute(x => !!document.querySelector(`#subtabs [data-t=${x}]`), t)) return true;
        await p.tap(`#sections [data-s=${season ? 'season' : 'tournament'}]`); await b.pause(500);
        return b.execute(x => !!document.querySelector(`#subtabs [data-t=${x}]`), t);
      }, {timeout: 20000, interval: 500, timeoutMsg: `${name}: the ${t} tab`});
      await p.tap(`#subtabs [data-t=${t}]`);
      if (t === 'games' && await p.has('.gstrip')) await p.tap('#subtabs [data-t=games]'); // from inside a game: back to the list
    },
    squadNames: () => b.execute(() => [...document.querySelectorAll('#view .rows .row .who')].map(x => x.textContent)),
    async openGame(n) {
      await p.goTab('games');
      await p.tap(`[data-act=open][data-g=g${n}]`);
      await p.until(n => document.querySelector('#view .ghead h2')?.textContent === `Game ${n}`, `game ${n}`, 20000, n);
    },
    async role(who, r) {
      const find = (n, r) => [...document.querySelectorAll('#view .row')].find(x => x.querySelector('.who')?.textContent === n)?.querySelector(`[data-r=${r}]`);
      await p.tapFound(find, `${who}: ${r}`, who, r);
      await p.until((n, r) => [...document.querySelectorAll('#view .row')].find(x => x.querySelector('.who')?.textContent === n)?.querySelector(`[data-r=${r}]`)?.classList.contains('on'), `${who} as ${r}`, 20000, who, r);
      await p.saved();
    },
    async pickTeam(gk, starters, bench = []) { if (gk) await p.role(gk, 'gk'); for (const n of starters) await p.role(n, 'start'); for (const n of bench) await p.role(n, 'bench'); },
    // A player's label on the pitch (or bench): its text, or '' if it isn't there.
    chip: (who, where = '.pitch') => b.execute((n, w) => [...document.querySelectorAll(`#view ${w} .chip`)].find(x => x.querySelector('.n')?.textContent === n)?.innerText ?? '', who, where),
    chipPart: (who, part, where = '.pitch') => b.execute((n, w, s) => [...document.querySelectorAll(`#view ${w} .chip`)].find(x => x.querySelector('.n')?.textContent === n)?.querySelector(s)?.textContent ?? null, who, where, part),
    waitChip: (who, where = '.pitch') => p.until((n, w) => [...document.querySelectorAll(`#view ${w} .chip`)].some(x => x.querySelector('.n')?.textContent === n), `${who} in ${where}`, 20000, who, where),
    tapChip: (who, where = '.pitch') => p.tapFound((n, w) => [...document.querySelectorAll(`#view ${w} .chip`)].find(x => x.querySelector('.n')?.textContent === n), `${who} in ${where}`, who, where),
    tapQp: who => p.tapFound(n => [...document.querySelectorAll('.modal .qp')].find(x => x.querySelector('b')?.textContent === n), `${who} in the pop-up`, who),
    plus: k => p.tap(`.board [data-act=score][data-k=${k}][data-d="1"]`),
    score: (k, away = false) => b.execute(i => document.querySelectorAll('#view .board .side')[i]?.querySelector('b')?.textContent, (k === 'us') !== away ? 0 : 1),
    waitScore: (k, v, away = false) => p.until((i, v) => document.querySelectorAll('#view .board .side')[i]?.querySelector('b')?.textContent === v, `${k} score ${v}`, 20000, (k === 'us') !== away ? 0 : 1, v),
    pill: () => p.text('#view .ghead .pill'),
    waitPill: v => p.until(v => document.querySelector('#view .ghead .pill')?.textContent === v, `the game to say ${v}`, 20000, v),

    async createTeam(team, names, coach = 'Claude (test coach)') {
      await p.goto('/');
      await p.until(() => !!document.querySelector('[data-act=mkteam]'), 'the start screen', 30000);
      if (await p.has('#mkname')) await p.enter('#mkname', coach); // a name is needed to create a team
      await p.tapText('Create a team');
      // The set-up wizard: Full set-up, team, players, then "Do this later" for the games
      await p.until(() => !!document.querySelector('[data-act=wizroute][data-v=full]'), 'the set-up wizard', 30000);
      await p.tap('[data-act=wizroute][data-v=full]');
      await p.until(() => !!document.getElementById('cfg-team'), 'the team step', 20000);
      await p.type('#cfg-team', team);
      await p.tap('[data-act=wizsize][data-v="5"]');
      await p.tap('[data-act=wiznext]'); // tapped with the keyboard up
      await p.until(() => document.querySelector('#view h2')?.textContent === 'Your players', 'the players step', 20000);
      await p.type('#bulknames', names.join('\n'));
      await p.tap('[data-act=wiznext]');
      await p.until(() => document.querySelector('#view h2')?.textContent === 'Your match day', 'the match day step', 20000);
      await p.tap('[data-act=wizlater]');
      await p.until(t => document.getElementById('hteam')?.textContent === t, 'the team name in the header', 20000, team);
    },
    async inviteCode() {
      await p.tap('#menubtn');
      await p.until(() => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test([...document.querySelectorAll('#view p')].find(x => x.textContent.startsWith('Invite code:'))?.querySelector('b')?.textContent || ''), 'the invite code');
      const code = await b.execute(() => [...document.querySelectorAll('#view p')].find(x => x.textContent.startsWith('Invite code:')).querySelector('b').textContent.trim());
      assert.ok(!PROTECTED_CODES.includes(code), 'never one of the user\'s own teams');
      await p.tap('[data-act=menuclose]');
      return code;
    },
    async setUpGames({name = 'Autumn Cup', len = '20', count = '1', periods = '2'} = {}) {
      await p.goTab('games');
      for (const [sel, v] of [['#tname', name], ['#len', len], ['#cnt', count], ['#tsize', '5']]) await p.enter(sel, v);
      await p.setDate('#tdate', DAY);
      await p.tap(`[data-act=periods][data-v="${periods}"]`);
      await p.tapText('Set up games');
      await p.toast(`${count} game${count === '1' ? '' : 's'} ready.`);
    },
    async fixtures(list) { // [[time, opponent, pitch, away?], ...]
      await p.tapText('Enter opponents and kick-off times');
      for (const [i, [t, o, pitch, away]] of list.entries()) {
        await p.enter(`#fx-t-g${i + 1}`, t); await p.enter(`#fx-o-g${i + 1}`, o); await p.enter(`#fx-p-g${i + 1}`, pitch);
        if (away) { await p.tap(`[data-act=fxside][data-g=g${i + 1}][data-v=away]`); await p.until(g => document.querySelector(`[data-act=fxside][data-g=${g}][data-v=away]`)?.classList.contains('on'), 'away', 20000, `g${i + 1}`); }
      }
      await p.saved();
      await p.tapText('← All games');
    },
    async goal(scorer, n = 1) {
      await p.plus('us');
      await p.until(() => !!document.querySelector('.hint.scorer [data-act=scorer]'), 'the scorer picker');
      await p.tapFound(s => [...document.querySelectorAll('.hint.scorer [data-act=scorer]')].find(x => x.textContent === s), `${scorer} as scorer`, scorer);
      await p.until((s, n) => [...document.querySelectorAll('#view .pitch .chip')].find(x => x.querySelector('.n')?.textContent === s)?.querySelector('.gl')?.textContent === `⚽ ${n}`, `${scorer} ⚽ ${n}`, 20000, scorer, n);
    },
    async card(who, colour) { // 'y' or 'r'
      await p.tapChip(who);
      await p.tapText(colour === 'r' ? '🟥 Red card' : '🟨 Yellow card', '.modal');
    },
    async fullTime(n) {
      await p.tapText('Full time');
      await p.until(n => document.querySelector('.modal h3')?.textContent === `End game ${n}?`, `"End game ${n}?"`, 20000, n);
      await p.tapText('End game', '.modal');
      await p.waitPill('Full time');
    },
    menu: () => p.tap('#menubtn'),
    closeMenu: () => p.tap('[data-act=menuclose]'),
    // ☰ → Leave this team on this phone, tapped twice. Safe to call after a failure.
    async leave(team) {
      await p.saved().catch(() => {}); // the app won't leave with changes still uploading
      if (!(await p.has('[data-act=menuclose]'))) await p.menu();
      await p.tap('[data-act=leave]');
      await p.until(() => /Tap again to leave|Who takes over/.test(document.getElementById('view')?.innerText || ''), 'the leave confirm');
      if (await b.execute(() => (document.getElementById('view')?.innerText || '').includes('Tap again to leave')))
        await p.tapFound(() => [...document.querySelectorAll('[data-act=leave]')].find(x => x.textContent.startsWith('Tap again')), 'leave, again');
      await p.until(t => (document.getElementById('view')?.innerText || '').includes('You left ' + t), 'leaving the team', 30000, team);
    },
    async screenshot(file) { mkdirSync('test-results', {recursive: true}); await b.saveScreenshot(`test-results/${file}`).catch(() => {}); },
    close: () => b.deleteSession().catch(() => {}),
  };
  return p;
}

// Runs the clean-up steps even when the test failed, without hiding the test's own failure.
export async function cleanUp(finished, steps) {
  for (const step of steps) {
    try { await step(); } catch (e) { if (finished) throw e; console.warn('Clean-up after a failure did not finish:', e.message.split('\n')[0]); }
  }
}

// A test body: screenshots of every phone if it fails.
export async function run(phones, body) {
  try { await body(); }
  catch (e) { for (const [i, ph] of phones().entries()) if (ph) await ph.screenshot(`failed-phone${i + 1}.png`); throw e; }
}
