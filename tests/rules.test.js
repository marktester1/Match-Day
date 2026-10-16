// Security rules tests for Match Day. Run with: cd tests && npm test
// (starts the Firestore emulator, runs these, stops it). Nothing touches the real databases.
import {readFileSync} from 'node:fs';
import {test, before, after, beforeEach} from 'node:test';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, collection, writeBatch, serverTimestamp} from 'firebase/firestore';

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
// Asking to join, the way the app does it: the team goes on the asker's joins list (at most 3 teams
// waiting at once) in the same write as the request.
const ask = (f, uid, t = T, code = CODE, slots = [t], extra = {}) => {
  const b = writeBatch(f);
  b.set(doc(f, 'joins', uid), {teams: slots});
  b.set(doc(f, 'teams', t, 'requests', uid), {code, name: 'Mal', via: 'phone', at: 1, ...extra});
  return b.commit();
};

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
  await assertFails(ask(f, 'mallory', T, 'WRONG1'));
  await assertFails(ask(f, 'someoneelse'));
  await assertFails(setDoc(doc(f, 'teams', T, 'requests', 'mallory'), {code: CODE, name: 'Mal', via: 'phone', at: 1})); // not on the joins list
  await assertSucceeds(ask(f, 'mallory'));
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

// ---- push notifications ----
const TOKEN = 'fcm-token-' + 'x'.repeat(140);
test('followers sign up for alerts on a feed; only they can see or change it', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'feeds', FEED), feed); });
  const fol = db('follower1');
  await assertSucceeds(setDoc(doc(fol, 'feeds', FEED, 'push', 'follower1'), {token: TOKEN, kinds: ['kick', 'goal', 'card', 'ht', 'ft'], at: 1}));
  await assertSucceeds(getDoc(doc(fol, 'feeds', FEED, 'push', 'follower1')));
  await assertFails(setDoc(doc(fol, 'feeds', FEED, 'push', 'someone-else'), {token: TOKEN, kinds: ['goal'], at: 1}));
  await assertFails(getDoc(doc(db('follower2'), 'feeds', FEED, 'push', 'follower1')));
  await assertFails(getDocs(collection(alice(), 'feeds', FEED, 'push')));               // not even the team's coaches
  await assertFails(setDoc(doc(fol, 'feeds', FEED, 'push', 'follower1'), {token: TOKEN, kinds: ['names'], at: 1}));
  await assertFails(setDoc(doc(fol, 'feeds', FEED, 'push', 'follower1'), {token: 'short', kinds: ['goal'], at: 1}));
  await assertFails(setDoc(doc(fol, 'feeds', 'Zzzzzzzzzzzzzzzzzzzzzzzz', 'push', 'follower1'), {token: TOKEN, kinds: ['goal'], at: 1})); // no such feed
  await assertSucceeds(deleteDoc(doc(fol, 'feeds', FEED, 'push', 'follower1')));
});
test('the feed can carry a name-free card count', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'feeds', FEED), {...feed, cards: 2, lastCard: {c: 'y', at: 720000}}));
  await assertFails(setDoc(doc(alice(), 'feeds', FEED), {...feed, cards: 1, lastCard: {c: 'y', at: 1, p: 'Sam'}}));
});
test("a phone's push address for coach alerts is private to its sign-in", async () => {
  await assertSucceeds(setDoc(doc(alice(), 'devices', 'alice'), {token: TOKEN, at: 1}));
  await assertFails(setDoc(doc(alice(), 'devices', 'mallory'), {token: TOKEN, at: 1}));
  await assertFails(getDoc(doc(mallory(), 'devices', 'alice')));
  await assertFails(setDoc(doc(alice(), 'devices', 'alice'), {token: TOKEN, at: 1, team: T}));
});

// ---- each sign-in's own team list ----
test('a team list is private to its sign-in', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'users', 'alice'), {teams: {[T]: true}}));
  await assertFails(getDoc(doc(mallory(), 'users', 'alice')));
  await assertFails(setDoc(doc(alice(), 'users', 'alice'), {teams: {}, admin: true}));
});

// ---- inside lists: records and player IDs are checked, old shapes still save ----
const sub = (at, off, on, gk) => ({at, off, on, ...(gk ? {gk: true} : {})});
test('games: realistic long games save, including every shape older versions wrote', async () => {
  const f = alice();
  const subs = Array.from({length: 300}, (_, i) => sub(i * 1000, 'p' + (i % 7), 'p' + ((i + 1) % 7), i % 50 === 0));
  const goals = Array.from({length: 200}, (_, i) => ({at: i * 100, p: i % 3 ? 'p1' : i % 2 ? 'og' : null}));
  await assertSucceeds(setDoc(d(f, 'games', 'g2'), {...blankGame(2), gk: 'p1', starters: ['p1', 'p2', 'p3', 'p4', 'p5'], bench: ['p6', 'p7'],
    subs, goals, gkChanges: [{at: 5000, p: 'p2'}], score: {us: 200, them: 0}}));
  await assertSucceeds(setDoc(d(f, 'games', 'g3'), {...blankGame(3), subs: [sub(1, 'p1', 'p2')], goals: [{at: 1, p: null, type: 'try'}], opp: [{at: 2, type: 'con'}]}));
  await assertSucceeds(setDoc(d(f, 'games', 'g4'), {...blankGame(4), subs: [{at: 1, off: 'p1', on: null}]})); // injured, nobody on
});
test('games: yellow and red cards save; junk cards are refused', async () => {
  const f = alice(), g = {n: 1, starters: ['p1', 'p2'], subs: [{at: 300000, off: 'p2', on: null}], clock: {running: true, startedAt: 1, acc: 0}};
  await assertSucceeds(setDoc(d(f, 'games', 'g1'), {...g, cards: [{at: 120000, p: 'p1', c: 'y'}, {at: 300000, p: 'p2', c: 'r'}]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, cards: [{at: 1, p: 'p1', c: 'blue'}]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, cards: [{at: 1, p: 'p1', c: 'y', reason: 'x', who: 'y', why: 'z'}]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, cards: [{at: 1, p: 'not a player id!', c: 'y'}]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, cards: 'yellow'}));
});
test('a saved tournament can have a match report, within a sensible length', async () => {
  const f = alice(), t = {name: 'Autumn Cup', date: '2026-10-17', savedAt: 1, games: [], players: []};
  await assertSucceeds(setDoc(d(f, 'archive', 't1792000000001'), {...t, report: 'Great passing in the second game.'}));
  await assertFails(setDoc(d(f, 'archive', 't1792000000001'), {...t, report: 'x'.repeat(3001)}));
  await assertFails(setDoc(d(f, 'archive', 't1792000000001'), {...t, report: 42}));
});
test('games: junk inside lists is refused', async () => {
  const f = alice(), g = blankGame(1);
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, starters: ['p1', 'two words']}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, starters: ['p1', 7.5]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, bench: [{id: 'p1'}]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, starters: ['<img src=x>']}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, gk: 'bad id!'}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, subs: ['p1']}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, subs: [sub(-1, 'p1', 'p2')]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, subs: [sub(1, 42, 'p2')]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, subs: [{...sub(1, 'p1', 'p2'), gk: 'yes'}]}));
  // the newest entry of a long list is checked
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, subs: [...Array.from({length: 20}, (_, i) => sub(i, 'p1', 'p2')), sub(21, 'p1', {x: 1})]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, goals: [{at: 1, p: 'p1', type: 'wonder'}]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, goals: [{at: 1, p: ['p1']}]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, opp: [{at: 1e12, type: 'pen'}]}));
  await assertFails(setDoc(d(f, 'games', 'g1'), {...g, gkChanges: [{at: 1, p: 'p1', a: 1, b: 2, c: 3, d: 4}]}));
});
test('squad, notes, awards and season record: junk inside lists is refused', async () => {
  const f = alice();
  await assertSucceeds(setDoc(d(f, 'club', 'squad'), {players: Array.from({length: 80}, (_, i) => ({id: 'p' + i, name: 'Player ' + i}))}));
  await assertFails(setDoc(d(f, 'club', 'squad'), {players: [{id: 'p1', name: 'Sam'}, {name: 'No ID'}]}));
  await assertFails(setDoc(d(f, 'club', 'squad'), {players: [{id: 'p1', name: 'x'.repeat(41)}]}));
  await assertFails(setDoc(d(f, 'club', 'squad'), {players: ['Sam']}));
  await assertFails(setDoc(d(f, 'club', 'notes'), {items: [{id: 'n1', p: 'p1', text: 'x'.repeat(301), at: 1, done: false}]}));
  await assertFails(setDoc(d(f, 'club', 'notes'), {items: [{id: 'n1', p: 'p1', text: 'ok', at: 1, done: 'no'}]}));
  await assertFails(setDoc(d(f, 'awards', 'a1'), {...award, winners: [{p: 'p1', reason: 'x'.repeat(81)}]}));
  await assertFails(setDoc(d(f, 'awards', 'a1'), {...award, winners: [{p: {}, reason: 'Effort'}]}));
  await assertFails(setDoc(d(f, 'archive', 't1'), {...archive, games: [{n: 1, score: {us: 'lots', them: 0}}]}));
  await assertFails(setDoc(d(f, 'archive', 't1'), {...archive, games: [{n: 1, mins: 'all'}]}));
  await assertFails(setDoc(d(f, 'archive', 't1'), {...archive, players: [{id: 5, name: 'Sam'}]}));
  // what Finish tournament saves today
  await assertSucceeds(setDoc(d(f, 'archive', 't2'), {...archive, games: Array.from({length: 6}, (_, i) => ({n: i + 1, opponent: 'Riverside', team: 'Example Team',
    side: 'home', size: 5, time: '9:30', pitch: '2', score: {us: 1, them: 1}, done: true, played: true, gk: 'p1', mins: {p1: 600000},
    goals: [{at: 1, p: 'p1'}], opp: []}))}));
});

// ---- invite codes: 8 characters, a new code from the manager ----
test('new teams get 8-character codes (6 still allowed for older apps); other lengths refused', async () => {
  const f = db('bob'), mk = (id, code) => setDoc(doc(f, 'teams', id), {code, createdBy: 'bob', created: serverTimestamp()});
  await assertSucceeds(mk('t8', 'ABCD2345'));
  await assertSucceeds(mk('t6', 'ABC234'));
  await assertFails(mk('t7', 'ABC2345'));
});
const newCode = (f, code = 'NEWCODE8', old = CODE) => {
  const b = writeBatch(f);
  b.update(doc(f, 'teams', T), {code});
  b.set(doc(f, 'codes', code), {team: T});
  b.delete(doc(f, 'codes', old));
  return b.commit();
};
test('the manager can make a new invite code; the old one stops working', async () => {
  await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), 'teams', T, 'members', 'carol'), {code: CODE, joined: new Date()}));
  await assertFails(newCode(db('carol')));                       // only the manager
  await assertFails(newCode(mallory()));
  await assertSucceeds(newCode(alice()));
  if ((await getDoc(doc(mallory(), 'codes', CODE))).exists()) throw new Error('old code should be gone');
  await assertFails(ask(mallory(), 'mallory', T, CODE));         // the old code can't be used to ask
  await assertSucceeds(ask(mallory(), 'mallory', T, 'NEWCODE8'));
  // coaches who joined with the old code keep their access and can still update their own entry
  await assertSucceeds(getDoc(d(db('carol'), 'club', 'squad')));
  await assertSucceeds(setDoc(doc(db('carol'), 'teams', T, 'members', 'carol'), {code: CODE, name: 'Carol', via: 'phone', seen: serverTimestamp()}, {merge: true}));
  // and a coach accepts with the new code
  await assertSucceeds(setDoc(doc(db('carol'), 'teams', T, 'members', 'mallory'), {code: 'NEWCODE8', joined: serverTimestamp(), name: 'Mal', via: 'phone', by: 'Carol'}));
});
test('a new code must be 8 characters, registered and replace the old one; nothing else changes', async () => {
  const f = alice();
  await assertFails(newCode(f, 'SHORT1'));
  await assertFails(updateDoc(doc(f, 'teams', T), {code: 'NEWCODE8'}));                 // no code record
  await assertFails((() => { const b = writeBatch(f); b.update(doc(f, 'teams', T), {code: 'NEWCODE8'}); b.set(doc(f, 'codes', 'NEWCODE8'), {team: T}); return b.commit(); })()); // old code left working
  await assertFails(updateDoc(doc(f, 'teams', T), {created: new Date()}));
  await assertFails(setDoc(doc(f, 'codes', 'TAKEOVER'), {team: 'team2'}));             // can't point a code at another team
  await assertFails(deleteDoc(doc(db('carol'), 'codes', CODE)));
});

// ---- the manager role ----
test('the manager can hand over to another coach, not to an outsider; others cannot take it', async () => {
  await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), 'teams', T, 'members', 'carol'), {code: CODE, joined: new Date()}));
  await assertFails(updateDoc(doc(db('carol'), 'teams', T), {createdBy: 'carol'}));
  await assertFails(updateDoc(doc(alice(), 'teams', T), {createdBy: 'mallory'}));
  await assertSucceeds(updateDoc(doc(alice(), 'teams', T), {createdBy: 'carol'}));
  await assertSucceeds(deleteDoc(doc(db('carol'), 'teams', T, 'members', 'alice'))); // the new manager can remove coaches
});

// ---- join requests: limits, duplicates, declines ----
test('one sign-in can have requests waiting in at most 3 teams', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    for (const t of ['tA', 'tB', 'tC', 'tD']) await setDoc(doc(ctx.firestore(), 'teams', t), {code: 'CODE' + t, createdBy: 'x'});
  });
  const f = mallory();
  await assertSucceeds(ask(f, 'mallory', 'tA', 'CODEtA', ['tA']));
  await assertSucceeds(ask(f, 'mallory', 'tB', 'CODEtB', ['tA', 'tB']));
  await assertSucceeds(ask(f, 'mallory', 'tC', 'CODEtC', ['tA', 'tB', 'tC']));
  await assertFails(ask(f, 'mallory', 'tD', 'CODEtD', ['tA', 'tB', 'tC', 'tD']));      // a fourth
  await assertFails(ask(f, 'mallory', 'tD', 'CODEtD', ['tB', 'tC', 'tD']));            // dropping tA while it's still waiting
  await assertSucceeds(deleteDoc(doc(f, 'teams', 'tA', 'requests', 'mallory')));       // cancel (or a coach declines)
  await assertSucceeds(ask(f, 'mallory', 'tD', 'CODEtD', ['tB', 'tC', 'tD']));         // now there's room
  await assertFails(setDoc(doc(f, 'joins', 'mallory'), {teams: ['tB', 'tC', 'tD'], extra: 1}));
  await assertFails(getDoc(doc(alice(), 'joins', 'mallory')));                          // private
});
test('asking twice keeps one request per person; the email shown must be the real sign-in', async () => {
  const f = mallory();
  await assertSucceeds(ask(f, 'mallory'));
  await assertSucceeds(ask(f, 'mallory', T, CODE, [T], {at: 2}));                       // tapping again just updates it
  const reqs = await getDocs(collection(alice(), 'teams', T, 'requests'));
  if (reqs.size !== 1) throw new Error('expected one request, got ' + reqs.size);
  await assertFails(ask(f, 'mallory', T, CODE, [T], {email: 'coach@example.com'}));    // anonymous: no email to show
  const g = db('gina', {email: 'gina@example.com', email_verified: true});
  await assertFails(ask(g, 'gina', T, CODE, [T], {email: 'someone@else.com', via: 'google'}));
  await assertSucceeds(ask(g, 'gina', T, CODE, [T], {email: 'gina@example.com', via: 'google'}));
  await assertFails(ask(f, 'mallory', T, CODE, [T], {at: 'now'}));
});
test('a declined request can be asked again; the asker can see it has gone', async () => {
  const f = mallory();
  await assertSucceeds(ask(f, 'mallory'));
  await assertSucceeds(deleteDoc(doc(alice(), 'teams', T, 'requests', 'mallory')));    // declined
  const r = await getDoc(doc(f, 'teams', T, 'requests', 'mallory'));
  if (r.exists()) throw new Error('request should be gone');
  await assertFails(getDoc(d(f, 'club', 'squad')));
  await assertSucceeds(ask(f, 'mallory'));                                              // can ask again
  await assertFails(deleteDoc(doc(db('stranger'), 'teams', T, 'requests', 'mallory'))); // strangers can't touch it
});

// ---- accounts: moving a phone's teams onto an account, lost phones ----
test('linking: an anonymous coach who adds an account keeps the same sign-in, so nothing changes', async () => {
  const f = db('alice', {email: 'alice@example.com', email_verified: true, firebase: {sign_in_provider: 'google.com'}});
  await assertSucceeds(getDoc(d(f, 'club', 'squad')));
  await assertSucceeds(setDoc(doc(f, 'teams', T, 'members', 'alice'), {code: CODE, name: 'Alice', via: 'google', seen: serverTimestamp()}, {merge: true}));
  await assertSucceeds(setDoc(doc(f, 'users', 'alice'), {teams: {[T]: true}}));
});
test('switching to an existing account: the phone admits the account and hands over the manager role in one step', async () => {
  // alice (anonymous, manager, the only coach) signs into her existing account aliceacct on this phone
  const acct = db('aliceacct', {email: 'alice@example.com', email_verified: true});
  await assertSucceeds(ask(acct, 'aliceacct', T, CODE, [T], {name: 'Alice', via: 'google', email: 'alice@example.com'}));
  const f = alice(), b = writeBatch(f);
  b.set(doc(f, 'teams', T, 'members', 'aliceacct'), {code: CODE, joined: serverTimestamp(), name: 'Alice', via: 'google', by: 'Alice'});
  b.delete(doc(f, 'teams', T, 'requests', 'aliceacct'));
  b.update(doc(f, 'teams', T), {createdBy: 'aliceacct'});
  b.delete(doc(f, 'teams', T, 'members', 'alice'));
  await assertSucceeds(b.commit());
  await assertSucceeds(getDoc(d(acct, 'club', 'squad')));
  await assertFails(getDoc(d(alice(), 'club', 'squad')));                                // the old sign-in is out
  await assertSucceeds(newCode(acct));                                                   // and the account is manager
});
test("switching: the old sign-in can't admit an account that never asked", async () => {
  const f = alice(), b = writeBatch(f);
  b.set(doc(f, 'teams', T, 'members', 'aliceacct'), {code: CODE, joined: serverTimestamp(), name: 'Alice', via: 'google'});
  b.delete(doc(f, 'teams', T, 'members', 'alice'));
  await assertFails(b.commit());
});
test('lost phone: the manager removes it; it can ask again but gets nothing until accepted', async () => {
  await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), 'teams', T, 'members', 'oldphone'), {code: CODE, joined: new Date()}));
  await assertFails(deleteDoc(doc(db('carol'), 'teams', T, 'members', 'oldphone')));    // not in the team
  await assertSucceeds(deleteDoc(doc(alice(), 'teams', T, 'members', 'oldphone')));
  const f = db('oldphone');
  await assertFails(getDoc(d(f, 'club', 'squad')));
  await assertFails(setDoc(d(f, 'club', 'squad'), {players: []}));
  await assertSucceeds(ask(f, 'oldphone'));
  await assertFails(getDoc(d(f, 'games', 'g1')));
});
test('leaving: a coach can remove themselves, and their own team list entry', async () => {
  await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), 'teams', T, 'members', 'carol'), {code: CODE, joined: new Date()}));
  const f = db('carol');
  await assertSucceeds(setDoc(doc(f, 'users', 'carol'), {teams: {[T]: true, other: true}}));
  await assertSucceeds(deleteDoc(doc(f, 'teams', T, 'members', 'carol')));
  await assertSucceeds(updateDoc(doc(f, 'users', 'carol'), {['teams.' + T]: deleteField()}));
  await assertFails(getDoc(d(f, 'club', 'squad')));
});

// ---- the biggest documents the app can make still save (rules have a limit of 1000 steps per write) ----
const fullGame = n => ({...blankGame(n), gk: 'p1', side: 'away', size: 11, done: true,
  starters: Array.from({length: 15}, (_, i) => 'p' + i), bench: Array.from({length: 80}, (_, i) => 'b' + i),
  subs: Array.from({length: 300}, (_, i) => sub(i * 1000, 'p' + (i % 15), 'b' + (i % 80), i % 9 === 0)),
  gkChanges: Array.from({length: 100}, (_, i) => ({at: i, p: 'p' + (i % 15)})),
  goals: Array.from({length: 200}, (_, i) => ({at: i, p: 'p1', type: 'try'})), opp: Array.from({length: 200}, (_, i) => ({at: i, type: 'pen'})),
  clock: {running: true, startedAt: Date.now(), acc: 36000000}, score: {us: 999, them: 999}});
const players80 = Array.from({length: 80}, (_, i) => ({id: 'p' + i, name: 'Player name ' + i}));
const fullArchive = {name: 'x'.repeat(60), date: '2026-10-16', savedAt: 1792000000000, players: players80,
  games: Array.from({length: 10}, (_, i) => {const g = fullGame(i + 1); return {n: i + 1, opponent: 'x'.repeat(40), team: 'y'.repeat(40), side: 'home', size: 11,
    time: '9:30', pitch: '2', score: {us: 99, them: 99}, done: true, played: true, gk: 'p1', mins: Object.fromEntries(players80.map(p => [p.id, 600000])), goals: g.goals, opp: g.opp};})};
test('the biggest documents the app can make still save', async () => {
  const f = alice();
  await assertSucceeds(setDoc(d(f, 'games', 'g10'), fullGame(10)));
  await assertSucceeds(setDoc(d(f, 'club', 'squad'), {players: players80}));
  await assertSucceeds(setDoc(d(f, 'club', 'notes'), {items: Array.from({length: 300}, (_, i) => ({id: 'n' + i, p: 'p1', text: 'x'.repeat(300), at: 1, done: true, by: 'x'.repeat(40)}))}));
  await assertSucceeds(setDoc(d(f, 'awards', 'a1'), {...award, label: 'x'.repeat(60), winners: Array.from({length: 30}, (_, i) => ({p: 'p' + i, reason: 'x'.repeat(80)}))}));
  await assertSucceeds(setDoc(d(f, 'archive', 't1'), fullArchive));
});
test('a full restore saves in one all-or-nothing batch', async () => {
  const f = alice(), b = writeBatch(f);
  b.set(d(f, 'club', 'settings'), settings);
  b.set(d(f, 'club', 'squad'), {players: players80});
  b.set(d(f, 'club', 'tournament'), tournament);
  b.set(d(f, 'club', 'notes'), {items: [{id: 'n1', p: 'p1', text: 'Stay wide', at: 1, done: false, by: 'Sam'}]});
  for (let i = 1; i <= 10; i++) b.set(d(f, 'games', 'g' + i), fullGame(i));
  for (let i = 0; i < 20; i++) b.set(d(f, 'archive', 't' + i), fullArchive);
  for (let i = 0; i < 20; i++) b.set(d(f, 'awards', 'a' + i), award);
  await assertSucceeds(b.commit());
});
