// Bugs found on 7 Nov 2026, each checked directly:
// - dates: "Mon 9 Nov" in every browser (some added a comma: "Mon, 9 Nov");
// - a phone whose watch on the coach list, join requests or team record was refused once (e.g. just after
//   being accepted) stopped updating for good: now it tries again, and the refusal goes to the issues log.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app, cleanUp} = require('./helpers');

test('dates read "Mon 9 Nov" in every browser, never with a comma', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#mkname')).toBeVisible({timeout: 30000});
  expect(await page.evaluate(() => [nice('2026-11-09'), nice('2026-11-07'), nice('2027-01-01'), nice('')]))
    .toEqual(['Mon 9 Nov', 'Sat 7 Nov', 'Fri 1 Jan', '']);
});

test('a refused watch on the coach list, requests or team record tries again', async ({page}, info) => {
  const c = app(page, info), T = 'Claude E2E Watch U10s';
  let joined = false, finished = false;
  try {
    await c.createTeam(T, ['Ava', 'Ben', 'Cal', 'Dev', 'Eli']);
    joined = true;
    await c.saved();
    // Refuse the next watch of each kind once, as the database did on a slow phone, then let them through
    const result = await page.evaluate(async () => {
      const mod = FB.F, real = mod.onSnapshot, refused = new Set();
      const wrapped = (ref, next, err) => {
        const kind = /\/members$/.test(ref.path) ? 'members' : /\/requests$/.test(ref.path) ? 'requests' : /^teams\/[^/]+$/.test(ref.path) ? 'team' : null;
        if (kind && !refused.has(kind)) { refused.add(kind); setTimeout(() => err({code: 'permission-denied', message: 'refused once'}), 50); return () => {}; }
        return real(ref, next, err);
      };
      FB.F = new Proxy(mod, {get: (t, k) => k === 'onSnapshot' ? wrapped : t[k]}); // the library itself can't be changed
      S.members = []; S.invite = ''; S.requests = null;
      watchMembers(S.teamId); watchRequests(S.teamId); watchTeamDoc(S.teamId);
      await new Promise(r => setTimeout(r, 6000)); // retries come after 3 seconds
      FB.F = mod;
      return {refused: [...refused].sort(), members: S.members.length, invite: !!S.invite, requests: Array.isArray(S.requests)};
    });
    expect(result).toEqual({refused: ['members', 'requests', 'team'], members: 1, invite: true, requests: true});
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(T); }]);
  }
});
