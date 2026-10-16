// The app's Content Security Policy (enforced, in firebase.json). index.html has one inline
// <script>; instead of allowing any inline script ('unsafe-inline'), the policy allows only that
// script, by its SHA-256 hash. The hash changes whenever index.html's script changes, so:
//   node tools/csp.cjs           updates firebase.json for the current index.html (run after editing)
//   node tools/csp.cjs --check   fails if firebase.json is out of date (runs before every publish)
// Styles keep 'unsafe-inline': the app builds its screens with style="" attributes, and styles
// can't run code.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1 || /<script\b(?![^>]*\bsrc=)[^>]*\S[^>]*>/.test(html.replace(/<script>/g, ''))) {
  console.error('csp: expected exactly one inline <script> in index.html'); process.exit(1);
}
const hash = "'sha256-" + crypto.createHash('sha256').update(scripts[0], 'utf8').digest('base64') + "'";
const policy = [
  "default-src 'self'",
  `script-src 'self' ${hash} https://www.gstatic.com https://apis.google.com`, // Firebase library; Google sign-in helper
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https://*.googleusercontent.com",
  // Firestore and sign-in; the service worker caches the fonts and the Firebase library
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://www.gstatic.com https://apis.google.com https://fonts.googleapis.com https://fonts.gstatic.com",
  "frame-src 'self' https://*.firebaseapp.com https://*.web.app https://accounts.google.com https://apis.google.com", // sign-in hand-off
  "worker-src 'self'", "manifest-src 'self'", "base-uri 'self'", "form-action 'self'", "object-src 'none'", "frame-ancestors 'self'",
].join('; ');
const file = path.join(ROOT, 'firebase.json'), cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
const all = cfg.hosting.headers.find(h => h.source === '**').headers;
const cur = all.find(h => /^Content-Security-Policy/.test(h.key));
if (process.argv.includes('--check')) {
  if (!cur || cur.key !== 'Content-Security-Policy' || cur.value !== policy) {
    console.error('csp: firebase.json does not match index.html. Run: node tools/csp.cjs'); process.exit(1);
  }
  console.log('csp: ok (' + hash + ')');
} else {
  const i = all.indexOf(cur), entry = {key: 'Content-Security-Policy', value: policy};
  if (i >= 0) all[i] = entry; else all.push(entry);
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  console.log('csp: firebase.json updated (' + hash + ')');
}
