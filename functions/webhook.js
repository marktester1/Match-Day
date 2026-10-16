// Lemon Squeezy → Match Day. Lemon Squeezy calls this after a checkout or refund; we check the
// message really came from them (signature), that it's for our product and the right mode (test
// on beta, real money on live), then unlock or re-lock the team named in the checkout.
// We store the order number only: no names, emails or card details.
const crypto = require('node:crypto');

const TEAM_ID = /^[A-Za-z0-9]{20}$/;

function signatureOk(raw, sig, secret) {
  if (!secret || typeof sig !== 'string' || !/^[0-9a-f]{64}$/i.test(sig)) return false;
  const want = crypto.createHmac('sha256', secret).update(raw).digest();
  return crypto.timingSafeEqual(want, Buffer.from(sig, 'hex'));
}

// Returns {status, msg}. 200 for anything we deliberately ignore, so Lemon Squeezy doesn't keep retrying;
// 401 for a bad signature; 500 (thrown) if the database write fails, so it does retry.
async function handle({raw, sig, secret, cfg, db, now = Date.now()}) {
  if (!signatureOk(raw, sig, secret)) return {status: 401, msg: 'bad signature'};
  let body;
  try { body = JSON.parse(raw.toString('utf8')); } catch (_) { return {status: 400, msg: 'not JSON'}; }
  const meta = body.meta || {}, data = body.data || {}, a = data.attributes || {};
  const ev = meta.event_name;
  if (ev !== 'order_created' && ev !== 'order_refunded') return {status: 200, msg: 'ignored event ' + ev};
  if (!!meta.test_mode !== !!cfg.testMode) return {status: 200, msg: 'ignored: wrong mode for this project'};
  const variant = String(a.first_order_item && a.first_order_item.variant_id || '');
  if (!cfg.variantId || variant !== String(cfg.variantId)) return {status: 200, msg: 'ignored: not the team unlock'};
  const team = meta.custom_data && meta.custom_data.team;
  if (typeof team !== 'string' || !TEAM_ID.test(team)) return {status: 200, msg: 'ignored: no team in checkout'};
  if (!(await db.doc(`teams/${team}`).get()).exists) return {status: 200, msg: 'ignored: no such team'};
  const ref = db.doc(`teams/${team}/billing/state`), order = String(data.id || '');
  if (ev === 'order_created') {
    if (a.status !== 'paid') return {status: 200, msg: 'ignored: not paid (' + a.status + ')'};
    await ref.set({unlocked: true, source: 'purchase', at: now, order});
    return {status: 200, msg: 'unlocked ' + team};
  }
  const cur = (await ref.get()).data() || {};
  if (cur.order !== order) return {status: 200, msg: 'ignored: refund for a different order'};
  await ref.set({unlocked: false, source: 'purchase', at: now, order, refunded: true});
  return {status: 200, msg: 'refunded ' + team};
}

module.exports = {handle, signatureOk};
