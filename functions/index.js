// Push notifications for Match Day. Settings per project (.env.<projectId>):
//   FN_REGION  where the functions run: must match the Firestore database's location
//   SITE       the app's address, for the link a notification opens
const {onDocumentWritten, onDocumentCreated} = require('firebase-functions/v2/firestore');
const {setGlobalOptions} = require('firebase-functions/v2');
const {defineString} = require('firebase-functions/params');
const admin = require('firebase-admin');
const {feedAlerts, joinAlert, joinedAlert, acceptedAlert} = require('./alerts');

admin.initializeApp();
const REGION = defineString('FN_REGION'), SITE = defineString('SITE');
setGlobalOptions({region: REGION, maxInstances: 5, memory: '256MiB'});
const db = () => admin.firestore();
const DEAD = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

// Sends one alert to many phones; forgets phones that no longer accept notifications.
async function send(targets, alert, url, tag) {
  if (!targets.length) return;
  const res = await admin.messaging().sendEachForMulticast({
    tokens: targets.map(t => t.token),
    data: {title: alert.title, body: alert.body, url, tag},
    webpush: {headers: {Urgency: 'high', TTL: '900'}},
  });
  await Promise.all(res.responses.map((r, i) => (!r.success && DEAD.includes(r.error?.code) ? targets[i].ref.delete().catch(() => {}) : null)));
}

// Followers: kick-off, goals, cards, half time and full time, as each follower chose.
exports.followerAlerts = onDocumentWritten('feeds/{f}', async e => {
  const before = e.data.before.exists ? e.data.before.data() : null, after = e.data.after.exists ? e.data.after.data() : null;
  const alerts = feedAlerts(before, after);
  if (!alerts.length) return;
  const subs = (await db().collection(`feeds/${e.params.f}/push`).get()).docs.map(d => ({ref: d.ref, ...d.data()}));
  for (const a of alerts)
    await send(subs.filter(s => (s.kinds || []).includes(a.kind)), a, `${SITE.value()}/?follow=${e.params.f}`, `md-${e.params.f}-${a.kind}`);
});

async function teamName(t) { const s = await db().doc(`teams/${t}/club/settings`).get(); return s.data()?.team || ''; }
async function coachPhones(t, except) {
  const ms = await db().collection(`teams/${t}/members`).get();
  const ids = ms.docs.map(d => d.id).filter(id => id !== except);
  const ds = await Promise.all(ids.map(id => db().doc(`devices/${id}`).get()));
  return ds.filter(d => d.exists && d.data().token).map(d => ({ref: d.ref, token: d.data().token}));
}
async function phoneOf(uid) { const d = await db().doc(`devices/${uid}`).get(); return d.exists && d.data().token ? [{ref: d.ref, token: d.data().token}] : []; }

// Coaches: someone asks to join.
exports.joinRequestAlert = onDocumentCreated('teams/{t}/requests/{uid}', async e => {
  const r = e.data.data(), team = await teamName(e.params.t);
  await send(await coachPhones(e.params.t, e.params.uid), joinAlert(r.name, team), `${SITE.value()}/`, `md-join-${e.params.t}`);
});

// A coach is accepted: tell them, and tell the other coaches. (Not when the team is first created.)
exports.memberAddedAlert = onDocumentCreated('teams/{t}/members/{uid}', async e => {
  const t = (await db().doc(`teams/${e.params.t}`).get()).data() || {};
  if (t.createdBy === e.params.uid) return;
  const m = e.data.data() || {}, team = await teamName(e.params.t);
  await send(await phoneOf(e.params.uid), acceptedAlert(team), `${SITE.value()}/`, `md-in-${e.params.t}`);
  await send(await coachPhones(e.params.t, e.params.uid), joinedAlert(m.name, team), `${SITE.value()}/`, `md-joined-${e.params.t}`);
});
