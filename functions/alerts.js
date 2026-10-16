// What to tell people, worked out from what changed. No players' names ever go into a follower alert.
const side = (f, s) => (f.us === s ? f.score.us : f.score.them);
const scoreLine = f => `${f.home} ${side(f, 'home')}–${side(f, 'away')} ${f.away}`;
const ourName = f => (f.us === 'home' ? f.home : f.away);
const theirName = f => (f.us === 'home' ? f.away : f.home);
const minute = at => Math.floor((at || 0) / 60000) + 1 + "'";

// Follower alerts from a change to feeds/{id}: [{kind, title, body}]
function feedAlerts(before, after) {
  if (!after || !after.score) return [];
  const out = [], same = before && before.gameN === after.gameN && before.score;
  if (after.status === 'live' && (!same || ['pre', 'none'].includes(before.status)))
    out.push({kind: 'kick', title: 'Kick-off', body: `Game ${after.gameN}: ${after.home} v ${after.away}`});
  if (!same) return out;
  const word = after.sport === 'rugby' ? 'Score!' : 'Goal!';
  if (after.score.us > before.score.us) out.push({kind: 'goal', title: `${word} ${ourName(after)}`, body: scoreLine(after)});
  if (after.score.them > before.score.them) out.push({kind: 'goal', title: `${word} ${theirName(after)}`, body: scoreLine(after)});
  if ((after.cards || 0) > (before.cards || 0)) {
    const c = after.lastCard || {};
    out.push({kind: 'card', title: `${c.c === 'r' ? 'Red' : 'Yellow'} card for ${ourName(after)}`, body: `${c.at != null ? minute(c.at) + ' · ' : ''}${scoreLine(after)}`});
  }
  if (after.status === 'break' && before.status !== 'break')
    out.push({kind: 'ht', title: after.periods === 2 ? 'Half time' : 'End of the quarter', body: scoreLine(after)});
  if (after.status === 'ft' && before.status !== 'ft') out.push({kind: 'ft', title: 'Full time', body: scoreLine(after)});
  return out;
}

const joinAlert = (who, team) => ({title: 'Request to join', body: `${who || 'Someone'} wants to join ${team || 'your team'}. Tap to accept or decline.`});
const joinedAlert = (who, team) => ({title: 'New coach', body: `${who || 'A new coach'} joined ${team || 'the team'}.`});
const acceptedAlert = team => ({title: "You're in", body: `You've been accepted into ${team || 'the team'}. Tap to open it.`});

module.exports = {feedAlerts, joinAlert, joinedAlert, acceptedAlert};
