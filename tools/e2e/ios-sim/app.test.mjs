// The Match Day iPhone app (ios-app/): the native shell around the web app, on a simulator. Checks what only
// the app does: it opens beta full screen and says it's the app (no Google sign-in or web notifications,
// which can't work inside an app; email sign-in instead), a whole match works inside it, it keeps working
// with no signal once loaded, and links to other sites leave the app. Needs a Debug build:
//   xcodebuild -project ios-app/ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug \
//     -derivedDataPath /tmp/mdapp CODE_SIGNING_ALLOWED=NO build
//   APP=/tmp/mdapp/Build/Products/Debug-iphonesimulator/App.app node --test app.test.mjs
// Beta only.
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {appPhone, cleanUp, guardBeta, nameRe} from './lib.mjs';

guardBeta();
const APP = process.env.APP;
const TEAM = 'Claude E2E Sim App U10s', SQUAD = ['Ava', 'Ben', 'Cal', 'Dev', 'Eli', 'Fay'];
let c;
after(async () => { await c?.close(); });

test('the iPhone app: opens beta, says it is the app, a whole match inside it, offline, links leave it', {timeout: 20 * 60000, skip: !APP && 'set APP to a Debug build of the app'}, async () => {
  let joined = false, finished = false;
  try {
    c = await appPhone(APP);
    await c.until(() => !!document.querySelector('[data-act=mkteam]'), 'the start screen in the app', 60000);
    const page = await c.b.execute(() => ({ua: navigator.userAgent, host: location.host, google: !!document.querySelector('[data-act=google]'), note: document.body.innerText.includes("Google sign-in isn't in the iPhone app yet"),
      email: [...document.querySelectorAll('button')].some(x => /Sign in with email/.test(x.textContent))}));
    assert.match(page.ua, /MatchDayApp\//, 'the page knows it is inside the app');
    assert.equal(page.host, 'match-day-beta-17b23.web.app', 'a Debug build opens beta');
    assert.equal(page.google, false, 'no Google sign-in inside the app (Google blocks it in apps)');
    assert.equal(page.email, true, 'email sign-in instead');
    assert.equal(page.note, true, 'and it says why');

    // A whole match inside the app
    await c.createTeam(TEAM, SQUAD);
    joined = true;
    await c.setUpGames({name: 'App Cup', len: '20', count: '1', periods: '2'});
    await c.fixtures([['9:30', 'Riverside', '2']]);
    await c.openGame(1);
    await c.pickTeam('Ava', ['Ben', 'Cal', 'Dev', 'Eli'], ['Fay']);
    await c.tapText('Kick off');
    await c.toast('Kicked off.');
    await c.goal('Ben');
    await c.fullTime(1);
    assert.equal(await c.text('.ghead .pill'), 'Full time');

    // No web notifications inside the app (iOS doesn't allow web push in apps), and the Google note
    await c.tap('#menubtn');
    assert.equal(await c.count('[data-act=dpushon]'), 0, 'no web notifications in the app');
    await c.closeMenu();

    // Offline: the helper that keeps the app working with no signal (the service worker) runs inside the app
    // (only "app-bound" Match Day addresses get one, so this also checks that list in Info.plist)
    const offline = await c.b.execute(async () => { const r = await navigator.serviceWorker?.getRegistration(); return !!(r && r.active); });
    assert.ok(offline, 'the offline helper (service worker) runs inside the app');

    // Links to other sites (the website's guides) leave the app: the page stays on Match Day
    await c.tap('#menubtn');
    const before = await c.b.execute(() => location.href);
    await c.b.execute(() => document.querySelector('a[href*="matchday-app.uk/guide"]')?.click());
    await c.b.pause(2000);
    assert.equal(await c.b.execute(() => location.href), before, 'the guide opened outside the app, not inside it');
    await c.closeMenu();

    const text = await c.bodyText();
    assert.ok(nameRe('Ben').test(text), 'sanity: the coach sees the squad');
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(TEAM); }]);
  }
});
