// Season minutes are a fair share: each player's minutes as a % of the playing time on the match days they
// came to, so a day they missed doesn't count against them. Checked on the Season screen's own code with two
// made-up saved tournaments (nothing is saved anywhere).
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1

test('season minutes are a % of the match days each player came to', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#mkname')).toBeVisible({timeout: 30000});
  const rows = await page.evaluate(() => {
    const m = n => n * 60000;
    S.squad = [{id: 'pa', name: 'Ava'}, {id: 'pb', name: 'Ben'}, {id: 'pc', name: 'Cal'}, {id: 'pd', name: 'Dot'}];
    S.awards = [];
    S.archive = [
      // Day 1: 2-a-side, 10 minutes. Ava and Ben play it all, Cal on the bench. Dot not there.
      {id: 't1', name: 'Day 1', date: '2026-10-03', savedAt: 1, games: [{n: 1, size: 2, played: true, done: true, score: {us: 0, them: 0}, mins: {pa: m(10), pb: m(10), pc: 0}}]},
      // Day 2: Ben not there. Ava and Cal play it all.
      {id: 't2', name: 'Day 2', date: '2026-10-10', savedAt: 2, games: [{n: 1, size: 2, played: true, done: true, score: {us: 0, them: 0}, mins: {pa: m(10), pc: m(10)}}]},
    ];
    const d = document.createElement('div');
    d.innerHTML = seasonView();
    return [...d.querySelectorAll('.mrow')].map(r => ({
      who: r.querySelector('.who').firstChild.textContent, pc: r.querySelector('.tot').textContent,
      flag: r.querySelector('.flag')?.textContent || '', brk: r.querySelector('.brk').textContent}));
  });
  expect(rows.map(r => [r.who, r.pc, r.flag])).toEqual([
    ['Cal', '50%', 'Needs time'], // 10 of the 20 minutes on the two days he came
    ['Ben', '100%', ''],           // missed day 2, so only day 1 counts: not flagged for fewer minutes (ties: fewer minutes first)
    ['Ava', '100%', ''],
    ['Dot', '–', ''],              // never came: no %
  ]);
  expect(rows[1].brk).toContain('10m · 1 of 2 match days · 1 game');
});
