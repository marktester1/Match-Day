// After a release: open LIVE in real iPhone Safari and check it's the new version and starts properly.
// Read-only: no team is created and nothing is written to live's database. Opening the app signs
// the phone in anonymously (as for every visitor); this test deletes that sign-in again at the end.
// Run: npm run smoke:live -- or: EXPECT_VERSION=0.27.1 npm run smoke:live
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {phone, LIVE, run} from './lib.mjs';

const WANT = process.env.EXPECT_VERSION; // optional: the version that should be live
let p;
after(async () => {
  if (p) { // delete this phone's anonymous sign-in on live, so the check leaves nothing behind
    const res = await p.b.execute(async () => {
      const db = await new Promise((ok, no) => { const r = indexedDB.open('firebaseLocalStorageDb'); r.onsuccess = () => ok(r.result); r.onerror = no; });
      const rows = await new Promise((ok, no) => { const r = db.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll(); r.onsuccess = () => ok(r.result); r.onerror = no; });
      const u = rows.map(x => x.value).find(v => v && v.uid && v.stsTokenManager);
      if (!u || u.email || (u.providerData || []).length) return 'no anonymous sign-in to delete';
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${u.apiKey}`, {method: 'POST',
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({idToken: u.stsTokenManager.accessToken})});
      return r.ok ? 'deleted' : 'delete failed ' + r.status;
    }).catch(e => 'delete failed: ' + e.message);
    console.log('live sign-in:', res);
    await p.b.execute(() => { localStorage.clear(); indexedDB.databases?.().then(l => l.forEach(d => indexedDB.deleteDatabase(d.name))); }).catch(() => {});
    await p.close();
  }
});

test('live opens in iPhone Safari on the released version', {timeout: 10 * 60000}, () => run(() => [p], async () => {
  p = await phone(0);
  await p.goto(LIVE + '/');
  await p.until(() => !!document.querySelector('[data-act=mkteam]'), 'the start screen on live', 30000);
  const t = await p.text('#view');
  assert.match(t, /Start a new team/);
  assert.match(t, /Join a team/);
  const v = (t.match(/Match Day v(\d+\.\d+\.\d+)/) || [])[1];
  assert.ok(v, 'the version is shown');
  if (WANT) assert.equal(v, WANT, 'live runs the released version');
  console.log('live version:', v);
  assert.equal(await p.b.execute(() => document.body.classList.contains('beta')), false, 'no BETA label on live');
  assert.equal(await p.b.execute(() => getComputedStyle(document.getElementById('menubtn')).display), 'none');
  await p.until(() => document.getElementById('sync')?.textContent === 'No team yet', 'connected to live', 30000);
  // the privacy and terms pages open
  await p.goto(LIVE + '/privacy.html');
  assert.match(await p.bodyText(), /Privacy/);
  await p.goto(LIVE + '/terms.html');
  assert.match(await p.bodyText(), /Terms/);
  await p.goto(LIVE + '/'); // back to the app's origin page for the clean-up
}));
