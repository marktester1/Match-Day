const {test} = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const {handle} = require('./webhook');

const SECRET = 'test-signing-secret', TEAM = 'AbCdEfGhIjKlMnOpQrSt', cfg = {variantId: '555', testMode: true};
function fakeDb(docs = {[`teams/${TEAM}`]: {code: 'ABC234'}}) {
  return {docs, doc: p => ({get: async () => ({exists: p in docs, data: () => docs[p]}), set: async v => { docs[p] = v; }})};
}
const order = (o = {}) => ({meta: {event_name: 'order_created', test_mode: true, custom_data: {team: TEAM}, ...o.meta},
  data: {type: 'orders', id: '9001', attributes: {status: 'paid', first_order_item: {variant_id: 555}, user_email: 'parent@example.com', ...o.attrs}}});
const send = (body, db, sig) => { const raw = Buffer.from(JSON.stringify(body));
  return handle({raw, sig: sig ?? crypto.createHmac('sha256', SECRET).update(raw).digest('hex'), secret: SECRET, cfg, db, now: 1}); };
const billing = db => db.docs[`teams/${TEAM}/billing/state`];

test('a paid order unlocks the team and stores only the order number', async () => {
  const db = fakeDb();
  assert.equal((await send(order(), db)).status, 200);
  assert.deepEqual(billing(db), {unlocked: true, source: 'purchase', at: 1, order: '9001'});
});
test('a refund re-locks the team', async () => {
  const db = fakeDb();
  await send(order(), db);
  await send(order({meta: {event_name: 'order_refunded'}}), db);
  assert.equal(billing(db).unlocked, false);
  assert.equal(billing(db).refunded, true);
});
test('a refund for a different order changes nothing', async () => {
  const db = fakeDb();
  await send(order(), db);
  const r = order({meta: {event_name: 'order_refunded'}}); r.data.id = '1234';
  await send(r, db);
  assert.equal(billing(db).unlocked, true);
});
test('forged or tampered messages are refused', async () => {
  const db = fakeDb();
  assert.equal((await send(order(), db, 'f'.repeat(64))).status, 401);
  assert.equal((await send(order(), db, 'not-hex')).status, 401);
  assert.equal((await send(order(), db, '')).status, 401);
  assert.equal(billing(db), undefined);
});
test('orders that are not ours, not paid, or in the wrong mode are ignored', async () => {
  const db = fakeDb();
  await send(order({attrs: {first_order_item: {variant_id: 777}}}), db);   // another product
  await send(order({attrs: {status: 'pending'}}), db);                      // not paid
  await send(order({meta: {test_mode: false}}), db);                        // real money sent to beta
  await send(order({meta: {custom_data: {team: '../../users/x'}}}), db);   // nonsense team id
  await send(order({meta: {custom_data: {team: 'ZZZZZZZZZZZZZZZZZZZZ'}}}), db); // team that doesn't exist
  await send(order({meta: {custom_data: {}}}), db);                         // no team at all
  assert.equal(billing(db), undefined);
  assert.equal(Object.keys(db.docs).length, 1);
});
test('nothing is unlocked until the variant is configured', async () => {
  const db = fakeDb(), raw = Buffer.from(JSON.stringify(order()));
  await handle({raw, sig: crypto.createHmac('sha256', SECRET).update(raw).digest('hex'), secret: SECRET, cfg: {variantId: '', testMode: true}, db});
  assert.equal(billing(db), undefined);
});
