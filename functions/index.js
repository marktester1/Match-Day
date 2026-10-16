// Deployed to the beta project first (Lemon Squeezy test mode). Settings per project:
//   .env.<projectId>  LS_VARIANT_ID (the £3.99 team unlock's variant) and LS_TEST_MODE (true on beta)
//   secret            LEMONSQUEEZY_SIGNING_SECRET (firebase functions:secrets:set ... --project beta)
const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret, defineString} = require('firebase-functions/params');
const admin = require('firebase-admin');
const {handle} = require('./webhook');

admin.initializeApp();
const SECRET = defineSecret('LEMONSQUEEZY_SIGNING_SECRET');
const VARIANT = defineString('LS_VARIANT_ID', {default: ''});
const TEST_MODE = defineString('LS_TEST_MODE', {default: 'true'});

exports.lemonSqueezy = onRequest({region: 'europe-west2', secrets: [SECRET], maxInstances: 2, memory: '256MiB'}, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('POST only'); return; }
  try {
    const r = await handle({raw: req.rawBody, sig: req.get('X-Signature'), secret: SECRET.value(),
      cfg: {variantId: VARIANT.value(), testMode: TEST_MODE.value() === 'true'}, db: admin.firestore()});
    console.log(r.msg);
    res.status(r.status).send(r.msg);
  } catch (e) {
    console.error('webhook failed', e);
    res.status(500).send('error'); // Lemon Squeezy retries
  }
});
