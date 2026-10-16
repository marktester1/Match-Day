// Security rules tests for Match Day. Run with: cd tests && npm test
// (starts the Firestore emulator, runs these, stops it). Nothing touches the real databases.
import {readFileSync} from 'node:fs';
import {test, before, after, beforeEach} from 'node:test';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, getDoc, getDocs, setDoc, deleteDoc, collection, writeBatch, serverTimestamp} from 'firebase/firestore';

const OWNER = 'markdavidmiles@gmail.com';
let env;
const T = 'team1', CODE = 'ABCDEF';

// What the app writes today, so the rules are tested against real shapes.
const settings = {team: 'Example Team U10s', short: 'Example Team', size: 5, sport: 'football', rscore: 'points'};
const tournament = {name: 'County Cup', date: '2026-10-16', len: 10, count: 6, periods: 2, size: 5, ready: true};
const blankGame = n => ({n, opponent: 'Riverside', team: '', time: '9:30', pitch: '2', gk: null, starters: [], bench: [],
  subs: [], gkChanges: [], goals: [], clock: {running: false, startedAt: 0, acc: 0}, score: {us: 0, them: 0}, done: false});
const award = {date: '2026-10-16', type: 'Training', label: 'Wednesday', winners: [{p: 'p1', reason: 'Effort'}], createdAt: 1792000000000};
const archive = {name: 'County Cup', date: '2026-10-16', savedAt: 1792000000000, games: [{n: 1, score: {us: 1, them: 0}}], players: [{id: 'p1', name: 'Sam'}]};

const db = (uid, extra) => (uid ? env.authenticatedContext(uid, extra) : env.unauthenticatedContext()).firestore();
const alice = () => db('alice');           // a coach in team1
const mallory = () => db('mallory');       // signed in, but not in team1
const owner = (verified = true) => db('owner', {email: OWNER, email_verified: verified});
const d = (f, ...p) => doc(f, 'teams', T, ...p);

before(async () => {
  env = await initializeTestEnvironment({projectId: 'demo-match-day', firestore: {rules: readFileSync('../firestore.rules', 'utf8')}});
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'teams', T), {code: CODE, createdBy: 'alice', created: new Date()});
    await setDoc(doc(f, 'teams', T, 'members', 'alice'), {code: CODE, joined: new Date()});
    await setDoc(doc(f, 'codes', CODE), {team: T});
    await setDoc(d(f, 'club', 'settings'), settings);
    await setDoc(d(f, 'club', 'squad'), {players: [{id: 'p1', name: 'Sam'}]});
    await setDoc(d(f, 'games', 'g1'), blankGame(1));
  });
});

// ---- a coach in the team: everything the app normally writes is allowed ----
test('coach can save settings, squad, tournament, notes', async () => {
  const f = alice();
  await assertSucceeds(setDoc(d(f, 'club', 'settings'), settings));
  await assertSucceeds(setDoc(d(f, 'club', 'settings'), {team: 'Old team', short: 'Old', size: 5})); // older settings
  await assertSucceeds(setDoc(d(f, 'club', 'squad'), {players: [{id: 'p1', name: 'Sam'}, {id: 'p2', name: 'Alex'}]}));
  await assertSucceeds(setDoc(d(f, 'club', 'tournament'), tournament));
  await assertSucceeds(setDoc(d(f, 'club', 'tournament'), {name: '', date: '', len: 10, count: 6})); // older tournament
  await assertSucceeds(setDoc(d(f, 'club', 'notes'), {items: [{id: 'n1', p: 'p1', text: 'Stay wide', at: 1, done: false, by: 'Sam'}]}));
});
test('coach can save a live game, a finished rugby game, awards and the season record', async () => {
  const f = alice();
  await assertSucceeds(setDoc(d(f, 'games', 'g1'), {...blankGame(1), gk: 'p1', starters: ['p1'], clock: {running: true, startedAt: Date.now(), acc: 120000},
    score: {us: 2, them: 1}, goals: [{at: 1000, p: 'p1'}], side: 'away', size: 6}));
  await assertSucceeds(setDoc(d(f, 'games', 'g10'), {...blankGame(10), goals: [{at: 1, p: 'p1', type: 'try'}], opp: [{at: 2, type: 'pen'}], score: {us: 5, them: 3}, done: true}));
  await assertSucceeds(setDoc(d(f, 'awards', 'a1792000000000'), award));
  await assertSucceeds(setDoc(d(f, 'archive', 't1792000000000'), archive));
  await assertSucceeds(deleteDoc(d(f, 'archive', 't1792000000000')));
});

// ---- the same coach sending malformed data is refused ----
test('settings: unknown fields, long names, bad values are refused', async () => {
  const f = alice();
  await assertFails(setDoc(d(f, 'club', 'settings'), {...settings, admin: true}));
  await assertFails(setDoc(d(f, 'club', 'settings'), {...settings, team: 'x'.repeat(41)}));
  await assertFails(setDoc(d(f, 'club', 'settings'), {...settings, size: 12}));
  await assertFails(setDoc(d(f, 'club', 'settings'), {...settings, size: '5'}));
  await assertFails(setDoc(d(f, 'club', 'settings'), {...settings, sport: 'cricket'}));
});
test('squad, notes and tournament: oversized or wrong shapes are refused', async () => {
  const f = alice();
  await assertFails(setDoc(d(f, 'club', 'squad'), {players: Array.from({length: 81}, (_, i) => ({id: 'p' + i, name: 'X'}))}));
  await assertFails(setDoc(d(f, 'club', 'squad'), {players: 'everyone'}));
  await assertFails(setDoc(d(f, 'club', 'squad'), {players: [], extra: 1}));
  await assertFails(setDoc(d(f, 'club', 'notes'), {items: Array.from({length: 301}, () => ({}))}));
  await assertFails(setDoc(d(f, 'club', 'tournament'), {...tournament, len: 0}));
  await assertFails(setDoc(d(f, 'club', 'tournament'), {...tournament, periods: 3}));
  await assertFails(setDoc(d(f, 'club', 'tournament'), {...tournament, count: 11}));
  await assertFails(setDoc(d(f, 'club', 'secrets'), {anything: 1})); // unknown club document
});
test('games: bad IDs, scores, clocks, sizes and extra fields are refused', async () => {
  const f = alice();
  await assertFails(setDoc(d(f, 'games', 'g11'), blankGame(1)));
  await assertFails(setDoc(d(f, 'games', 'game1'), blankGame(1)));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...blankGame(1), score: {us: -1, them: 0}}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...blankGame(1), score: {us: '3', them: 0}}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...blankGame(1), score: {us: 1, them: 0, bonus: 9}}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...blankGame(1), clock: {running: true, startedAt: 0, acc: -5}}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...blankGame(1), starters: Array.from({length: 16}, (_, i) => 'p' + i)}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...blankGame(1), opponent: 'x'.repeat(41)}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...blankGame(1), side: 'neutral'}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...blankGame(1), hacked: true}));
});
test('awards and season record: bad IDs and shapes are refused', async () => {
  const f = alice();
  await assertFails(setDoc(d(f, 'awards', 'bad id!'), award));
  await assertFails(setDoc(d(f, 'awards', 'a1'), {...award, label: 'x'.repeat(61)}));
  await assertFails(setDoc(d(f, 'awards', 'a1'), {...award, winners: Array.from({length: 31}, () => ({}))}));
  await assertFails(setDoc(d(f, 'archive', 't1'), {...archive, games: Array.from({length: 11}, () => ({}))}));
  await assertFails(setDoc(d(f, 'archive', 't1'), {...archive, extra: 1}));
});

// ---- people outside the team ----
test('someone not in the team can read and write nothing', async () => {
  const f = mallory();
  await assertFails(getDoc(d(f, 'club', 'squad')));
  await assertFails(getDoc(d(f, 'games', 'g1')));
  await assertFails(setDoc(d(f, 'club', 'settings'), settings));
  await assertFails(deleteDoc(d(f, 'games', 'g1')));
  await assertFails(getDocs(collection(f, 'teams')));
  await assertFails(getDoc(d(db(null), 'club', 'squad'))); // not signed in at all
});
test('joining: the code only lets you ask; a coach must accept', async () => {
  const f = mallory();
  await assertFails(getDocs(collection(f, 'codes')));
  await assertSucceeds(getDoc(doc(f, 'codes', CODE)));
  // can't add yourself, even with the right code
  await assertFails(setDoc(doc(f, 'teams', T, 'members', 'mallory'), {code: CODE, joined: serverTimestamp(), name: 'Mal', via: 'phone'}));
  // can ask with the right code, not a wrong one, and only for yourself
  await assertFails(setDoc(doc(f, 'teams', T, 'requests', 'mallory'), {code: 'WRONG1', name: 'Mal', via: 'phone', at: 1}));
  await assertFails(setDoc(doc(f, 'teams', T, 'requests', 'someoneelse'), {code: CODE, name: 'Mal', via: 'phone', at: 1}));
  await assertSucceeds(setDoc(doc(f, 'teams', T, 'requests', 'mallory'), {code: CODE, name: 'Mal', via: 'phone', at: 1}));
  await assertFails(getDoc(d(f, 'club', 'squad')));            // still can't see the team
  await assertFails(getDocs(collection(f, 'teams', T, 'requests'))); // or other requests
  // a coach sees the request and accepts it
  const a = alice();
  await assertSucceeds(getDocs(collection(a, 'teams', T, 'requests')));
  await assertSucceeds(setDoc(doc(a, 'teams', T, 'members', 'mallory'), {code: CODE, joined: serverTimestamp(), name: 'Mal', via: 'phone', by: 'Alice'}));
  await assertSucceeds(deleteDoc(doc(a, 'teams', T, 'requests', 'mallory')));
  await assertSucceeds(getDoc(d(f, 'club', 'squad')));          // now in
});
test("a coach can't add someone who hasn't asked, and nobody can give themselves odd fields", async () => {
  const f = alice();
  await assertFails(setDoc(doc(f, 'teams', T, 'members', 'mallory'), {code: CODE, joined: serverTimestamp()}));
  await assertFails(setDoc(doc(f, 'teams', T, 'members', 'alice'), {code: CODE, joined: serverTimestamp(), role: 'admin'}));
  await assertFails(setDoc(doc(f, 'teams', T, 'members', 'alice'), {code: CODE, name: 'x'.repeat(41)}));
  await assertSucceeds(setDoc(doc(f, 'teams', T, 'members', 'alice'), {code: CODE, name: 'Alice', via: 'phone', seen: serverTimestamp()}, {merge: true}));
});
test('declining and removing: coaches decline requests; only the manager removes a coach', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'teams', T, 'members', 'carol'), {code: CODE, joined: new Date()});
    await setDoc(doc(f, 'teams', T, 'requests', 'mallory'), {code: CODE, name: 'Mal', via: 'phone', at: 1});
  });
  await assertSucceeds(deleteDoc(doc(db('carol'), 'teams', T, 'requests', 'mallory'))); // any coach can decline
  await assertFails(deleteDoc(doc(db('carol'), 'teams', T, 'members', 'alice')));       // carol isn't the manager
  await assertSucceeds(deleteDoc(doc(alice(), 'teams', T, 'members', 'carol')));        // alice created the team
  await assertFails(getDoc(d(db('carol'), 'club', 'squad')));                            // carol is out
});
test('creating a team the way the app does is allowed', async () => {
  const f = db('bob'), b = writeBatch(f);
  b.set(doc(f, 'teams', 'team2'), {code: 'XYZ234', createdBy: 'bob', created: serverTimestamp()});
  b.set(doc(f, 'teams', 'team2', 'members', 'bob'), {code: 'XYZ234', joined: serverTimestamp(), name: '', via: 'phone', seen: serverTimestamp()});
  b.set(doc(f, 'codes', 'XYZ234'), {team: 'team2'});
  b.set(doc(f, 'teams', 'team2', 'club', 'settings'), {team: '', short: '', size: 5});
  await assertSucceeds(b.commit());
});

// ---- the owner's Admin page ----
test('owner sees team names and coach lists, never squads or games', async () => {
  const f = owner();
  await assertSucceeds(getDocs(collection(f, 'teams')));
  await assertSucceeds(getDoc(d(f, 'club', 'settings')));
  await assertSucceeds(getDocs(collection(f, 'teams', T, 'members')));
  await assertFails(getDoc(d(f, 'club', 'squad')));
  await assertFails(getDoc(d(f, 'club', 'notes')));
  await assertFails(getDoc(d(f, 'games', 'g1')));
  await assertFails(setDoc(d(f, 'club', 'settings'), settings));
});
test('owner access needs a verified email', async () => {
  await assertFails(getDocs(collection(owner(false), 'teams')));
});

// ---- paying for a team ----
test('coaches can see whether their team has paid but never mark it paid', async () => {
  const f = alice();
  await assertFails(setDoc(d(f, 'billing', 'state'), {unlocked: true, source: 'purchase', at: 1}));
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'teams', T, 'billing', 'state'), {unlocked: true, source: 'founding', at: 1}); });
  await assertSucceeds(getDoc(d(f, 'billing', 'state')));
  await assertFails(setDoc(d(f, 'billing', 'state'), {unlocked: false}));
  await assertFails(deleteDoc(d(f, 'billing', 'state')));
  await assertFails(getDoc(d(mallory(), 'billing', 'state')));
});
test('the owner can unlock a team or end its trial from the Admin page', async () => {
  const o = env.authenticatedContext('owner', {email: 'markdavidmiles@gmail.com', email_verified: true}).firestore();
  await assertSucceeds(setDoc(d(o, 'billing', 'state'), {unlocked: true, source: 'test', at: 1}));
  await assertSucceeds(setDoc(d(o, 'billing', 'state'), {unlocked: false, trialEnds: 1792000000000}));
  await assertFails(setDoc(d(o, 'billing', 'state'), {unlocked: true, source: 'free'}));
  await assertFails(setDoc(d(o, 'billing', 'other'), {unlocked: true}));
  await assertSucceeds(deleteDoc(d(o, 'billing', 'state')));
});

// ---- the parents' live score ----
const FEED = 'Abcdefghijklmnopqrstuvwx';
const feed = {team: T, home: 'Example Team', away: 'Riverside', us: 'home', score: {us: 2, them: 1}, status: 'live',
  clock: {running: true, startedAt: 1792000000000, acc: 0}, periods: 2, len: 20, gameN: 3, sport: 'football', updatedAt: 1792000000000};
test('a coach can publish the parent feed; it holds no player data', async () => {
  const f = alice();
  await assertSucceeds(setDoc(d(f, 'club', 'feed'), {id: FEED, season: '2026'}));
  await assertSucceeds(setDoc(doc(f, 'feeds', FEED), feed));
  await assertFails(setDoc(doc(f, 'feeds', FEED), {...feed, scorers: ['Sam']}));          // no names
  const fx = {n: 1, home: 'Example Team', away: 'Riverside', us: 'home', time: '9:30', pitch: '2', score: {us: 1, them: 0}, status: 'ft'};
  await assertSucceeds(setDoc(doc(f, 'feeds', FEED), {...feed, tname: 'Spring Cup', tdate: '2026-10-17'}));
  await assertSucceeds(setDoc(doc(f, 'feeds', FEED, 'games', 'g1'), fx));
  await assertSucceeds(setDoc(doc(f, 'feeds', FEED, 'games', 'g10'), {...fx, n: 10, status: 'pre'}));
  await assertFails(setDoc(doc(f, 'feeds', FEED, 'games', 'g1'), {...fx, scorers: ['Sam']}));  // no names in fixtures either
  await assertFails(setDoc(doc(f, 'feeds', FEED, 'games', 'g11'), fx));
  await assertFails(setDoc(doc(mallory(), 'feeds', FEED, 'games', 'g2'), fx));             // not a coach in that team
  const parent = db('parent2');
  await assertSucceeds(getDocs(collection(parent, 'feeds', FEED, 'games')));
  await assertFails(setDoc(doc(parent, 'feeds', FEED, 'games', 'g1'), {...fx, score: {us: 9, them: 0}}));
  await assertSucceeds(deleteDoc(doc(f, 'feeds', FEED, 'games', 'g10')));
  await assertFails(setDoc(doc(f, 'feeds', FEED), {...feed, status: 'whatever'}));
  await assertFails(setDoc(doc(f, 'feeds', 'short'), feed));                               // IDs must be long and random
  await assertFails(setDoc(doc(mallory(), 'feeds', 'Zbcdefghijklmnopqrstuvwx'), feed));   // not a coach in that team
});
test('a parent can read a feed by its link, but not list feeds or see the team', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'feeds', FEED), feed); });
  const parent = db('parent1');
  await assertSucceeds(getDoc(doc(parent, 'feeds', FEED)));
  await assertFails(getDocs(collection(parent, 'feeds')));
  await assertFails(setDoc(doc(parent, 'feeds', FEED), {...feed, score: {us: 9, them: 0}}));
  await assertFails(getDoc(d(parent, 'club', 'squad')));
  await assertFails(getDoc(doc(db(null), 'feeds', FEED)));                                 // must be signed in (the app does this)
});

// ---- each sign-in's own team list ----
test('a team list is private to its sign-in', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'users', 'alice'), {teams: {[T]: true}}));
  await assertFails(getDoc(doc(mallory(), 'users', 'alice')));
  await assertFails(setDoc(doc(alice(), 'users', 'alice'), {teams: {}, admin: true}));
});
