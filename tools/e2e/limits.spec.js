// Every text box has a length limit that matches the database rules (checked for all of them in
// tests.yml); typing past it stops at the limit and says so once, in plain words.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app, cleanUp} = require('./helpers');

test('a box at its length limit stops there and says so once', async ({page}, info) => {
  const c = app(page, info);
  await page.goto('/');
  const box = page.locator('#mkname');
  await expect(box).toBeVisible({timeout: 30000});
  await expect(box).toHaveAttribute('maxlength', '40');
  await box.click();
  await box.pressSequentially('Sam the very long-named assistant coach of the U10s');
  await expect(box).toHaveValue('Sam the very long-named assistant coach ');
  await c.toast("That's the most this box takes (40 characters).");
});

test('failure messages are in plain words, never a raw error code', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#mkname')).toBeVisible({timeout: 30000});
  const said = await page.evaluate(() => ['unavailable', 'too-many-requests', 'permission-denied', 'unauthenticated', 'not-found', 'aborted', 'auth/too-many-requests', 'firestore/unavailable']
    .map(code => whyPlain({code})));
  for (const s of said) expect(s).not.toMatch(/\(|[a-z]+-[a-z]+/); // no "(code)" and no code-like words
  expect(said[1]).toBe('Too many tries from this phone just now. Wait a few minutes and try again.');
  expect(said[2]).toContain('may have been removed from the team');
  expect(await page.evaluate(() => whyPlain({code: 'weird-new-thing'}))).toContain('mention "weird-new-thing"'); // unknown ones can still be reported
});

test('a problem on a coach\'s phone goes to the issues log (which the phone can\'t read back)', async ({page}, info) => {
  const c = app(page, info), T = 'Claude E2E Issues U10s';
  let joined = false, finished = false;
  try {
    await c.createTeam(T, ['Ava', 'Ben', 'Cal', 'Dev', 'Eli']);
    joined = true;
    await page.evaluate(() => logIssue('test', {code: 'e2e-check', message: 'A test report from the browser tests'}, 'limits.spec'));
    await expect.poll(() => page.evaluate(() => window.lastIssue), {timeout: 20000}).toBe('saved');
    // only the owner reads them: this phone can't
    const read = await page.evaluate(() => FB.F.getDocs(FB.F.collection(FB.fs, 'issues')).then(() => 'read', e => e.code));
    expect(read).toBe('permission-denied');
    finished = true;
  } finally {
    await cleanUp(finished, [async () => { if (joined) await c.leave(T); }]);
  }
});
