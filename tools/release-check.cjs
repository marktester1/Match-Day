// Release checks for Match Day. Run before and after promoting beta to live:
//   node tools/release-check.cjs pre    (before: beta is ready, live is safe to update)
//   node tools/release-check.cjs post   (after: live runs the reviewed rules and the new version)
//   "pre" also needs every GitHub test run (Tests, Android, iPhone Simulator) passed on this commit
//   add --e2e to "pre" to also play a coach's whole match day on beta (tools/e2e, a few minutes)
//   add --ios-sim to either: "pre" plays every journey in real iPhone Safari on beta (iOS Simulator,
//   slow); "post" opens live in iPhone Safari and checks the version, without creating anything
// Uses the Firebase CLI's own sign-in (firebase login) to read project settings; reads nothing
// from any team. Exit code 1 if any check fails.
const fs = require('node:fs'), path = require('node:path'), {execSync} = require('node:child_process');
const FT = path.join(execSync('npm root -g').toString().trim(), 'firebase-tools', 'lib') + '/';
const {requireAuth} = require(FT + 'requireAuth'), auth = require(FT + 'auth'), rules = require(FT + 'gcp/rules'), {Client} = require(FT + 'apiv2');

const ROOT = path.join(__dirname, '..');
const STAGE = process.argv[2] === 'post' ? 'post' : 'pre';
const P = {live: 'match-day-17b23', beta: 'match-day-beta-17b23'};
const URL = {live: 'https://match-day-17b23.web.app', beta: 'https://match-day-beta-17b23.web.app'};
const KEY = {}; // web API keys, read from firebase-config.js (public values)
const results = [];
const out = (status, name, detail = '') => { results.push({status, name}); console.log(`${status.padEnd(4)} ${name}${detail ? ' — ' + detail : ''}`); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fetchText = async (u, opt) => { const r = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), opt); return {status: r.status, headers: r.headers, text: await r.text()}; };
const appVersion = t => (t.match(/APP_VERSION='([^']+)'/) || [])[1];
const cacheName = t => (t.match(/CACHE='([^']+)'/) || [])[1];
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

async function main() {
  console.log(`Match Day release checks (${STAGE}-release)\n`);
  const a = auth.getGlobalDefaultAccount();
  if (!a) { out('FAIL', 'Firebase CLI sign-in', 'run: firebase login'); return; }
  await requireAuth({user: a.user, tokens: a.tokens});
  const cfgSrc = read('firebase-config.js');
  KEY.live = (cfgSrc.match(/const LIVE = \{[^}]*apiKey: "([^"]+)"/) || [])[1];
  KEY.beta = (cfgSrc.match(/const BETA = \{[^}]*apiKey: "([^"]+)"/) || [])[1];

  // 1. Rules: what's deployed matches the reviewed source
  const local = read('firestore.rules');
  for (const env of ['beta', 'live']) {
    const rel = await rules.listAllReleases(P[env]);
    const files = await rules.getRulesetContent(await rules.getLatestRulesetName(P[env], 'cloud.firestore', rel));
    const same = files.length === 1 && files[0].content === local;
    if (same) out('PASS', `${env} rules match firestore.rules`);
    else if (env === 'live' && STAGE === 'pre') out('INFO', 'live rules differ from firestore.rules', 'publish them to live first (firebase deploy --only firestore:rules --project live)');
    else out('FAIL', `${env} rules differ from firestore.rules`);
  }

  // 2. Sign-in methods on in both projects
  const idt = new Client({urlPrefix: 'https://identitytoolkit.googleapis.com', auth: true});
  for (const env of ['beta', 'live']) {
    const c = (await idt.get(`/admin/v2/projects/${P[env]}/config`)).body;
    const g = (await idt.get(`/admin/v2/projects/${P[env]}/defaultSupportedIdpConfigs/google.com`).catch(() => ({body: {}}))).body;
    const on = {anonymous: !!c.signIn?.anonymous?.enabled, email: !!c.signIn?.email?.enabled, google: !!g.enabled};
    const off = Object.keys(on).filter(k => !on[k]);
    out(off.length ? 'FAIL' : 'PASS', `${env} sign-in methods`, off.length ? 'switched off: ' + off.join(', ') : 'anonymous, email, Google');
  }

  // 2b. Google sign-in works on every address coaches use. For each one: the app keeps Google's
  // hand-off on that same address (iPhones lose it otherwise), the hand-off page is served there,
  // Firebase lists it as an authorised domain, and Google accepts it as a return address (asked
  // without signing in: an accepted address goes to Google's sign-in page, any other to its error page).
  const liveHosts = JSON.parse((cfgSrc.match(/const LIVE_HOSTS = (\[[^\]]*\])/) || [, '[]'])[1]);
  const authRule = new RegExp((read('index.html').match(/if\(\/(.+?)\/\.test\(location\.hostname\)\)cfg=\{\.\.\.cfg,authDomain:location\.hostname\}/) || [, '$^'])[1]);
  const authorised = {};
  for (const env of ['beta', 'live']) authorised[env] = (await idt.get(`/admin/v2/projects/${P[env]}/config`)).body.authorizedDomains || [];
  for (const [env, host] of [...liveHosts.map(h => ['live', h]), ['beta', new globalThis.URL(URL.beta).host]]) {
    const bad = [];
    if (!authRule.test(host)) bad.push("the app sends Google's hand-off to another address (authDomain rule in index.html)");
    const h = await fetch(`https://${host}/__/auth/handler`).then(r => r.status).catch(() => 0);
    if (h !== 200) bad.push(`hand-off page not served (${h})`);
    if (!authorised[env].includes(host)) bad.push('not in Firebase → Authentication → Authorised domains');
    const au = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${KEY[env]}`, {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({providerId: 'google.com', continueUri: `https://${host}/__/auth/handler`})}).then(r => r.json()).catch(() => ({}));
    const g = au.authUri ? (await fetch(au.authUri, {redirect: 'manual'}).catch(() => null))?.headers.get('location') || '' : '';
    if (!/^https:\/\/accounts\.google\.com\/(v3\/)?signin\/identifier/.test(g)) bad.push(`Google refuses https://${host}/__/auth/handler (add it to the Web OAuth client's redirect URIs in Google Cloud)`);
    out(bad.length ? 'FAIL' : 'PASS', `Google sign-in on ${host}`, bad.join('; ') || 'hand-off stays on this address, Google accepts it');
  }

  // 3. Beta can't reach live data: a beta sign-in and no sign-in are both refused by live
  const su = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY.beta}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{"returnSecureToken":true}'})).json();
  const liveDoc = `https://firestore.googleapis.com/v1/projects/${P.live}/databases/(default)/documents/teams?pageSize=1`;
  const withBeta = await fetch(liveDoc, {headers: {Authorization: 'Bearer ' + su.idToken}});
  const noAuth = await fetch(liveDoc);
  const writeBeta = await fetch(`https://firestore.googleapis.com/v1/projects/${P.live}/databases/(default)/documents/codes?documentId=RELCHK`, {method: 'POST', headers: {Authorization: 'Bearer ' + su.idToken, 'Content-Type': 'application/json'}, body: '{"fields":{"team":{"stringValue":"x"}}}'});
  if (su.idToken) await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY.beta}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({idToken: su.idToken})}); // tidy the test sign-in
  const refused = s => s === 401 || s === 403;
  out(refused(withBeta.status) && refused(noAuth.status) && refused(writeBeta.status) ? 'PASS' : 'FAIL', 'beta sign-ins and strangers are refused by live',
    `read with beta sign-in ${withBeta.status}, read signed out ${noAuth.status}, write with beta sign-in ${writeBeta.status}`);

  // 4. Backups hold first names only
  const html = read('index.html');
  const bd = (html.match(/function backupData\(\)\{[\s\S]*?\}\}/) || [''])[0];
  const leaks = ['members', 'email', 'users', 'uid', 'surname', 'birth', 'phone'].filter(w => new RegExp('\\b' + w + '\\b', 'i').test(bd));
  const squadShape = /squad=arr\([^;]*\.map\(\(p,i\)=>\{[\s\S]*?return\{id,name\}\}\)/.test(html);
  out(!leaks.length && squadShape ? 'PASS' : 'FAIL', 'backups hold only first names', leaks.length ? 'found: ' + leaks.join(', ') : 'squad entries are {id, name}; no coach or account data');

  // 5. Updates reach every phone: version and cache name move on; app files are never cached stale
  const localV = appVersion(html), localCache = cacheName(read('sw.js'));
  const [betaIdx, liveIdx, liveSw] = await Promise.all([fetchText(URL.beta + '/index.html'), fetchText(URL.live + '/index.html'), fetchText(URL.live + '/sw.js')]);
  const liveV = appVersion(liveIdx.text), liveCache = cacheName(liveSw.text), betaV = appVersion(betaIdx.text);
  out(betaV === localV ? 'PASS' : 'FAIL', 'beta runs the version being released', `beta ${betaV}, this copy ${localV}`);
  if (STAGE === 'pre') {
    out(newer(localV, liveV) ? 'PASS' : 'FAIL', 'version is newer than live', `${liveV} → ${localV}`);
    out(localCache !== liveCache ? 'PASS' : 'FAIL', 'offline cache name changes', `${liveCache} → ${localCache}`);
  } else {
    out(liveV === localV ? 'PASS' : 'FAIL', 'live runs the released version', `live ${liveV}`);
    out(liveCache === localCache ? 'PASS' : 'FAIL', 'live serves the new offline cache name', liveCache);
  }
  for (const f of ['index.html', 'sw.js', 'firebase-config.js']) {
    const h = (await fetchText(URL.live + '/' + f)).headers.get('cache-control') || '';
    out(/no-cache/.test(h) ? 'PASS' : 'FAIL', `live ${f} is never served stale`, h);
  }
  const betaBuilt = fs.existsSync(path.join(ROOT, 'public/index.html')) && fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8') === betaIdx.text;
  out(betaBuilt ? 'PASS' : 'FAIL', 'beta serves exactly this build', betaBuilt ? '' : 'run: sh tools/build_public.sh, then deploy to beta');

  // 6. One team can't read another's data (and the rest of the rules tests)
  try {
    execSync('npm test', {cwd: path.join(ROOT, 'tests'), stdio: 'pipe', env: {...process.env, PATH: '/opt/homebrew/opt/openjdk/bin:' + process.env.PATH, JAVA_HOME: '/opt/homebrew/opt/openjdk'}});
    out('PASS', 'rules tests in the emulator (incl. team isolation)');
  } catch (e) { out('FAIL', 'rules tests in the emulator', (e.stdout || '').toString().split('\n').filter(l => /✖|not ok/.test(l)).slice(0, 3).join(' | ')); }
  try { fs.unlinkSync(path.join(ROOT, 'tests/firestore-debug.log')); } catch (_) {}

  // 6a. Every test on GitHub passed on this code: the browser tests, rules and checks (Tests), real
  //     Chrome on three Android phones (Android) and real iPhone Safari (iPhone Simulator). Required
  //     for every release. A later commit that only changes notes (*.md) can use its parent's runs.
  if (STAGE === 'pre') {
    const git = c => execSync('git ' + c, {cwd: ROOT, stdio: 'pipe'}).toString().trim();
    const WF = {'Tests': 'tests.yml', 'Android': 'android.yml', 'iPhone Simulator': 'ios-sim.yml'};
    try {
      const head = git('rev-parse HEAD'), branch = git('rev-parse --abbrev-ref HEAD');
      const dirty = git("status --porcelain --untracked-files=no -- . ':!*.md'");
      const pushed = (() => { try { return git(`branch -r --contains ${head}`).length > 0; } catch (_) { return false; } })();
      if (dirty || !pushed) out('FAIL', 'every GitHub test passed on this code', dirty ? 'uncommitted changes: commit and push them, then run the tests' : `not on GitHub yet: git push origin ${branch}`);
      else {
        // the newest commit with the same code as HEAD (notes aside) that has test runs
        const same = git('log --format=%H -30 HEAD').split('\n').filter(s => { try { git(`diff --quiet ${s} HEAD -- . ':!*.md'`); return true; } catch (_) { return false; } });
        const runs = {};
        for (const sha of same) {
          for (const r of JSON.parse(execSync(`gh run list --commit ${sha} --limit 50 --json workflowName,conclusion,status,databaseId`, {cwd: ROOT, stdio: 'pipe'}).toString()))
            if (WF[r.workflowName] && !runs[r.workflowName]) runs[r.workflowName] = {...r, sha}; // newest first
        }
        const bad = Object.keys(WF).map(w => {
          const r = runs[w];
          if (!r) return `${w}: not run (gh workflow run ${WF[w]} --ref ${branch})`;
          if (r.status !== 'completed') return `${w}: still running (gh run watch ${r.databaseId})`;
          if (r.conclusion !== 'success') return `${w}: ${r.conclusion} (gh run view ${r.databaseId} --log-failed; rerun: gh workflow run ${WF[w]} --ref ${branch})`;
          return '';
        }).filter(Boolean);
        out(bad.length ? 'FAIL' : 'PASS', 'every GitHub test passed on this code', bad.join('; ') || Object.keys(WF).map(w => `${w} #${runs[w].databaseId}`).join(', '));
      }
    } catch (e) { out('FAIL', 'every GitHub test passed on this code', 'could not read GitHub runs (gh auth status?): ' + e.message.split('\n')[0]); }
  }

  // 6b. Optional: a coach's whole match day on beta, in WebKit (iPhone) and Chromium
  if (STAGE === 'pre') {
    const E2E = path.join(ROOT, 'tools/e2e');
    if (!process.argv.includes('--e2e')) out('INFO', 'end-to-end journey on beta', 'skipped: add --e2e to run it');
    else if (!fs.existsSync(path.join(E2E, 'node_modules/@playwright/test'))) out('FAIL', 'end-to-end journey on beta', 'set up first: cd tools/e2e && npm install && npm run setup');
    else try {
      execSync('npx playwright test', {cwd: E2E, stdio: 'pipe', timeout: 10 * 60 * 1000});
      out('PASS', 'end-to-end journeys on beta', 'coach, joining coach and follower, in WebKit (iPhone) and Chromium');
    } catch (e) { out('FAIL', 'end-to-end journey on beta', (e.stdout || '').toString().split('\n').filter(l => /✘|Error:|^\s+> /.test(l)).slice(0, 4).map(l => l.trim()).join(' | ') + ' (details: cd tools/e2e && npx playwright test)'); }
  }

  // 6c. Optional: real iPhone Safari in the iOS Simulator (Appium). Before: every journey on beta.
  //     After: a read-only check that live opens on the new version (no team created; its sign-in deleted).
  if (process.argv.includes('--ios-sim')) {
    const SIM = path.join(ROOT, 'tools/e2e/ios-sim'), name = STAGE === 'pre' ? 'iPhone Safari journeys on beta' : 'live in iPhone Safari';
    if (!fs.existsSync(path.join(SIM, 'node_modules/webdriverio')) || !fs.existsSync(path.join(SIM, '.appium'))) out('FAIL', name, 'set up first: cd tools/e2e/ios-sim && npm install && npm run setup');
    else {
      const listening = () => { try { execSync('lsof -iTCP:4723 -sTCP:LISTEN', {stdio: 'pipe'}); return true; } catch (_) { return false; } };
      let appium = null;
      if (!listening()) { // start Appium for this check, and stop it afterwards
        appium = require('node:child_process').spawn('npx', ['appium', '--port', '4723', '--log-level', 'warn'], {cwd: SIM, env: {...process.env, APPIUM_HOME: './.appium'}, stdio: 'ignore', detached: true});
        for (let i = 0; i < 60 && !listening(); i++) execSync('sleep 1');
      }
      try {
        execSync(STAGE === 'pre' ? 'npm test' : 'npm run smoke:live', {cwd: SIM, stdio: 'pipe', timeout: 90 * 60 * 1000, env: {...process.env, EXPECT_VERSION: localV}});
        out('PASS', name, STAGE === 'pre' ? 'whole match day, coach joining, follower, managers' : `opens on ${localV}, no BETA label, start screen and legal pages`);
      } catch (e) { out('FAIL', name, (e.stdout || '').toString().split('\n').filter(l => /✖|Error|timed out|Assertion/.test(l)).slice(0, 3).map(l => l.trim()).join(' | ') + ' (details: see tools/e2e/ios-sim)'); }
      finally { if (appium) try { process.kill(-appium.pid); } catch (_) {} }
    }
  } else out('INFO', STAGE === 'pre' ? 'iPhone Safari journeys on beta' : 'live in iPhone Safari', 'skipped: add --ios-sim to run it (iOS Simulator, slow)');

  // 7. Private files never published; security headers; dependencies; usage limits
  for (const f of ['.git/HEAD', 'exports/', 'firestore.rules', 'BACKLOG.md', 'CLAUDE.md', 'tests/rules.test.js']) {
    const s = (await fetch(URL.live + '/' + f)).status;
    out(s === 404 ? 'PASS' : 'FAIL', `live does not serve ${f}`, String(s));
  }
  const h = liveIdx.headers, want = {'strict-transport-security': 'HSTS', 'x-content-type-options': 'nosniff', 'referrer-policy': 'Referrer-Policy', 'x-frame-options': 'X-Frame-Options'};
  const missing = Object.keys(want).filter(k => !h.get(k));
  out(missing.length ? (STAGE === 'pre' ? 'WARN' : 'FAIL') : 'PASS', 'security headers on live', missing.length ? 'missing: ' + missing.map(k => want[k]).join(', ') : 'HSTS, nosniff, Referrer-Policy, X-Frame-Options');
  out(h.get('content-security-policy') ? 'PASS' : 'WARN', 'content security policy', h.get('content-security-policy') ? 'enforced' : h.get('content-security-policy-report-only') ? 'report-only (not enforced yet)' : 'none');
  try { execSync('npm audit --omit=dev --audit-level=high', {cwd: path.join(ROOT, 'tests'), stdio: 'pipe'}); out('PASS', 'dependency audit (test tools)'); }
  catch (e) { out('WARN', 'dependency audit (test tools)', 'high-severity advisories: run npm audit in tests/'); }
  const sdk = (html.match(/firebasejs\/([\d.]+)\//) || [])[1];
  out('INFO', 'app libraries', `Firebase JS SDK ${sdk} from gstatic (pinned version)`);
  const bill = new Client({urlPrefix: 'https://cloudbilling.googleapis.com', auth: true}), plan = {};
  for (const env of ['beta', 'live']) plan[env] = await bill.get(`/v1/projects/${P[env]}/billingInfo`).then(r => r.body.billingEnabled ? 'Blaze (pay-as-you-go)' : 'Spark (free)').catch(() => 'unknown');
  out('INFO', 'usage and billing', `live: ${plan.live}, beta: ${plan.beta}. On Blaze, keep a budget alert set (Google Cloud → Billing → Budgets & alerts).`);
}

main().catch(e => out('FAIL', 'release check crashed', e.message)).finally(() => {
  const n = s => results.filter(r => r.status === s).length;
  console.log(`\n${n('PASS')} passed, ${n('FAIL')} failed, ${n('WARN')} warnings`);
  process.exitCode = n('FAIL') ? 1 : 0;
});
