// Shared steps for the coach-joins and follower tests (the journey test keeps its own copy).
// Everything runs on beta with fresh anonymous sign-ins; each test leaves the teams it makes.
const {expect} = require('@playwright/test');

const BASE = (process.env.MATCHDAY_URL || 'https://match-day-beta-17b23.web.app').replace(/\/$/, ''); // as in playwright.config.js
const PROTECTED_CODES = ['L9J-Q7H', '4VT-AWE', 'L83-LTJ']; // the user's teams and Claude's shared one
// Two days ahead, so the app doesn't jump straight into a game "about to kick off" on reload.
const DAY = new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-CA');
const nameRe = n => new RegExp(`(^|[^A-Za-z])${n.replace(' ', '\\s')}([^A-Za-z]|$)`);

// A second person on their own phone: same kind of device as the test's project, separate sign-in.
async function newPhone(browser, info) {
  const u = info.project.use;
  const ctx = await browser.newContext({viewport: u.viewport, userAgent: u.userAgent, deviceScaleFactor: u.deviceScaleFactor,
    isMobile: u.isMobile, hasTouch: u.hasTouch, locale: 'en-GB', timezoneId: 'Europe/London', baseURL: BASE});
  return {ctx, page: await ctx.newPage()};
}

// The coach's screens, for one page.
function app(page, info) {
  const touch = !!info.project.use.hasTouch;
  const press = async loc => { touch ? await loc.tap() : await loc.click(); }; // taps on a phone, clicks on a computer
  const btn = (name, root = page) => root.getByRole('button', {name, exact: true});
  const view = page.locator('#view');
  const modal = page.locator('.modal .box');
  const toast = text => expect(page.locator('#toast:not([hidden])')).toContainText(text); // on screen now, not an old one
  // The header says "Shared · live" once every change has reached the server.
  const saved = () => expect(page.locator('#sync')).toHaveText('Shared · live', {timeout: 30000});
  const SEASON_TABS = ['season', 'awards', 'squad'];
  const goTab = async t => {
    const tab = page.locator(`#subtabs [data-act=tab][data-t=${t}]`);
    if (!(await tab.count())) await press(page.locator(`#sections [data-s=${SEASON_TABS.includes(t) ? 'season' : 'tournament'}]`));
    await press(tab);
    if (t === 'games' && await page.locator('.gstrip').count()) await press(tab); // from inside a game: back to the list
  };
  const a = {
    page, press, btn, view, modal, toast, saved, goTab,
    reload: async team => { await saved(); await page.reload(); await expect(page.locator('#hteam')).toHaveText(team, {timeout: 30000}); },
    enter: async (sel, v) => { const b = page.locator(sel); await b.fill(v); await b.blur(); await expect(page.locator(sel)).toHaveValue(v); },
    squadNames: () => view.locator('.rows .row .who').allTextContents(),
    openGame: async n => { await goTab('games'); await press(page.locator(`[data-act=open][data-g=g${n}]`).first()); await expect(view.locator('.ghead h2')).toHaveText(`Game ${n}`); },
    role: async (name, r) => {
      const row = view.locator('.row').filter({has: page.locator('.who').getByText(name, {exact: true})});
      await press(row.locator(`[data-act=role][data-r=${r}]`));
      await expect(row.locator(`[data-r=${r}]`)).toHaveClass(/\bon\b/);
    },
    chip: (name, where = '.pitch') => view.locator(`${where} .chip`).filter({has: page.locator('.n').getByText(name, {exact: true})}),
    plus: k => view.locator(`.board [data-act=score][data-k=${k}][data-d="1"]`),
    // The scoreboard puts the home side on the left.
    score: (k, away = false) => view.locator('.board .side').nth((k === 'us') !== away ? 0 : 1).locator('b'),
    pill: () => view.locator('.ghead .pill'),

    async createTeam(team, names) {
      await page.goto('/');
      await press(btn('Create a team'));
      await expect(page.locator('#cfg-team')).toBeVisible({timeout: 30000});
      await page.locator('#cfg-team').fill(team);
      await page.locator('#cfg-size').fill('5');
      await page.locator('#bulknames').fill(names.join('\n'));
      await press(btn('Start using the app'));
      await toast('All set.');
      await expect(page.locator('#hteam')).toHaveText(team);
    },
    async inviteCode() {
      await press(page.locator('#menubtn'));
      const b = view.locator('p', {hasText: 'Invite code:'}).locator('b');
      await expect(b).toHaveText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      const code = (await b.textContent()).trim();
      expect(PROTECTED_CODES).not.toContain(code);
      await press(page.locator('[data-act=menuclose]'));
      return code;
    },
    async setUpGames({name = 'Autumn Cup', len = '20', count = '1', periods = '2'} = {}) {
      await goTab('games');
      for (const [sel, v] of [['#tname', name], ['#tdate', DAY], ['#len', len], ['#cnt', count], ['#tsize', '5']]) await a.enter(sel, v);
      await press(page.locator(`[data-act=periods][data-v="${periods}"]`));
      await press(btn('Set up games'));
      await toast(`${count} game${count === '1' ? '' : 's'} ready.`);
    },
    async fixtures(list) { // [[time, opponent, pitch, away?], ...]
      await press(btn('Enter opponents and kick-off times'));
      for (const [i, [t, o, p, away]] of list.entries()) {
        await a.enter(`#fx-t-g${i + 1}`, t);
        await a.enter(`#fx-o-g${i + 1}`, o);
        await a.enter(`#fx-p-g${i + 1}`, p);
        if (away) { await press(page.locator(`[data-act=fxside][data-g=g${i + 1}]`)); await expect(page.locator(`[data-act=fxside][data-g=g${i + 1}]`)).toHaveText('Away'); }
      }
      await press(btn('← All games'));
    },
    async pickTeam(gk, starters, bench = []) {
      if (gk) await a.role(gk, 'gk');
      for (const n of starters) await a.role(n, 'start');
      for (const n of bench) await a.role(n, 'bench');
    },
    async goal(scorer) {
      await press(a.plus('us'));
      await press(view.locator('.hint.scorer [data-act=scorer]').filter({hasText: new RegExp(`^${scorer}$`)}));
      await expect(a.chip(scorer).locator('.gl')).toHaveText('⚽ 1');
    },
    async fullTime(n) {
      await press(btn('Full time'));
      await expect(modal.locator('h3')).toHaveText(`End game ${n}?`);
      await press(btn('End game', modal));
      await expect(a.pill()).toHaveText('Full time');
    },
    // ☰ → Leave this team on this phone, tapped twice. Safe to call after a failure.
    async leave(team) {
      await saved().catch(() => {}); // the app won't leave with changes still uploading
      if (await page.locator('[data-act=menuclose]').count() === 0) await press(page.locator('#menubtn'));
      await press(page.locator('[data-act=leave]'));
      await expect(page.locator('[data-act=leave]')).toHaveText('Tap again to leave this team on this phone');
      await press(page.locator('[data-act=leave]'));
      await expect(view).toContainText(`You left ${team}`, {timeout: 30000});
      await expect(view.locator('.report')).toContainText("Removed from the team's coach list.");
    },
  };
  return a;
}

// Runs the clean-up steps even when the test failed, without hiding the test's own failure.
async function cleanUp(finished, steps) {
  for (const step of steps) {
    try { await step(); } catch (e) { if (finished) throw e; console.warn('Clean-up after a failure did not finish:', e.message.split('\n')[0]); }
  }
}

module.exports = {app, newPhone, cleanUp, nameRe, DAY, PROTECTED_CODES};
