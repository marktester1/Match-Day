// Release checks for Match Day. Run before and after promoting beta to live:
//   node tools/release-check.cjs pre    (before: beta is ready, live is safe to update)
//   node tools/release-check.cjs post   (after: live runs the reviewed rules and the new version)
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
  out('INFO', 'usage limits', 'both projects are on the free Spark plan: Firebase stops at the free quota rather than charging. Check usage in the console before wider release.');
}

main().catch(e => out('FAIL', 'release check crashed', e.message)).finally(() => {
  const n = s => results.filter(r => r.status === s).length;
  console.log(`\n${n('PASS')} passed, ${n('FAIL')} failed, ${n('WARN')} warnings`);
  process.exitCode = n('FAIL') ? 1 : 0;
});
