const {test} = require('node:test');
const assert = require('node:assert');
const {feedAlerts, joinAlert} = require('./alerts');

const f = (o = {}) => ({team: 'T', home: 'Example Team', away: 'Riverside', us: 'home', score: {us: 0, them: 0}, status: 'pre', periods: 2, gameN: 1, sport: 'football', ...o});
const kinds = a => a.map(x => x.kind);

test('kick-off when a game starts, not when it resumes', () => {
  assert.deepEqual(feedAlerts(f(), f({status: 'live'})), [{kind: 'kick', title: 'Kick-off', body: 'Game 1: Example Team v Riverside'}]);
  assert.deepEqual(kinds(feedAlerts(f({status: 'paused'}), f({status: 'live'}))), []);
  assert.deepEqual(kinds(feedAlerts(f({status: 'ft'}), f({status: 'live', gameN: 2}))), ['kick']);   // next game kicks off
});
test('goals for either side, with the score and no names', () => {
  const a = feedAlerts(f({status: 'live'}), f({status: 'live', score: {us: 1, them: 0}}));
  assert.deepEqual(a, [{kind: 'goal', title: 'Goal! Example Team', body: 'Example Team 1–0 Riverside'}]);
  const b = feedAlerts(f({status: 'live', us: 'away', home: 'Riverside', away: 'Example Team'}), f({status: 'live', us: 'away', home: 'Riverside', away: 'Example Team', score: {us: 0, them: 1}}));
  assert.deepEqual(b, [{kind: 'goal', title: 'Goal! Riverside', body: 'Riverside 1–0 Example Team'}]);
  assert.equal(feedAlerts(f({status: 'live', sport: 'rugby'}), f({status: 'live', sport: 'rugby', score: {us: 5, them: 0}}))[0].title, 'Score! Example Team');
});
test('cards, half time and full time', () => {
  assert.deepEqual(feedAlerts(f({status: 'live'}), f({status: 'live', cards: 1, lastCard: {c: 'y', at: 660000}})),
    [{kind: 'card', title: 'Yellow card for Example Team', body: "12' · Example Team 0–0 Riverside"}]);
  assert.equal(feedAlerts(f({status: 'live', cards: 1}), f({status: 'live', cards: 2, lastCard: {c: 'r', at: 0}}))[0].title, 'Red card for Example Team');
  assert.deepEqual(kinds(feedAlerts(f({status: 'live'}), f({status: 'break'}))), ['ht']);
  assert.equal(feedAlerts(f({status: 'live', periods: 4}), f({status: 'break', periods: 4}))[0].title, 'End of the quarter');
  assert.deepEqual(kinds(feedAlerts(f({status: 'live', score: {us: 2, them: 1}}), f({status: 'ft', score: {us: 2, them: 1}}))), ['ft']);
});
test('nothing for repeat saves or a brand-new link', () => {
  assert.deepEqual(feedAlerts(f({status: 'live', score: {us: 1, them: 0}}), f({status: 'live', score: {us: 1, them: 0}})), []);
  assert.deepEqual(feedAlerts(null, f({status: 'none'})), []);
  assert.deepEqual(feedAlerts(f(), null), []);
});
test('join request wording', () => {
  assert.equal(joinAlert('Sam (coach)', 'Example Team U10s').body, 'Sam (coach) wants to join Example Team U10s. Tap to accept or decline.');
});
