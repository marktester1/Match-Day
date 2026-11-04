// Signing in. Beta only.
// Google: "Continue with Google" sends the coach to Google with the hand-off page on the same address
// the app is on (iPhones lose the result if it's on another site), and Google is asked to send them
// back there. The test stops at Google's door: it never signs in to a Google account. Whether Google
// accepts each real address is checked by tools/release-check.cjs ("Google sign-in on …").
// Email: a new account is made, keeps its team through signing out and back in, a wrong password is
// refused in plain words, and the account and team are removed at the end.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app, cleanUp} = require('./helpers');

test('Continue with Google hands off on this same address and asks Google to come back to it', async ({page}, info) => {
  const c = app(page, info);
  await page.goto('/');
  const here = new URL(page.url()).host;
  // On the app's own addresses the hand-off stays put; on a local copy it uses beta's Firebase address.
  const expected = /\.web\.app$|\.firebaseapp\.com$|(^|\.)matchday-app\.uk$/.test(here) ? here : 'match-day-beta-17b23.firebaseapp.com';

  const handoffs = [];
  page.on('request', r => { if (r.isNavigationRequest() && r.url().includes('/__/auth/handler')) handoffs.push(new URL(r.url())); });
  let google = null;
  await page.route(/^https:\/\/accounts\.google\.com\//, route => { // Google's door: note where it was asked to return, go no further
    google ??= new URL(route.request().url());
    route.fulfill({contentType: 'text/html', body: '<p id="stopped">Stopped at Google by the test</p>'});
  });

  const gbtn = page.locator('[data-act=google]');
  await expect(gbtn).toBeVisible({timeout: 30000});
  await expect(gbtn).toHaveText('Continue with Google');
  await c.press(gbtn);
  await expect(page.locator('#stopped')).toBeVisible({timeout: 30000});

  expect(handoffs.length, 'the app went to the sign-in hand-off page').toBeGreaterThan(0);
  expect(handoffs[0].host, "the hand-off page is on the app's own address").toBe(expected);
  expect(handoffs[0].searchParams.get('providerId')).toBe('google.com');
  expect(google.searchParams.get('client_id')).toBeTruthy();
  expect(google.searchParams.get('redirect_uri'), 'Google is asked to come back to the same address').toBe(`https://${expected}/__/auth/handler`);
});

test('an email account keeps its team through signing out and back in', async ({page}, info) => {
  const c = app(page, info), {press, btn, view, toast} = c;
  const TEAM = 'Claude E2E Sign-in U9s';
  const email = `claude-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`; // a throwaway beta account
  const pw = 'e2e-' + Math.random().toString(36).slice(2, 12);
  let account = false, joined = false, finished = false;
  const form = async (create, pass) => {
    await page.locator('#acctemail').fill(email);
    await page.locator('#acctpw').fill(pass);
    await press(btn(create ? 'Create account' : 'Sign in', page.locator('#acctf')));
  };
  try {
    // Make the account on the start screen
    await page.goto('/');
    await press(page.locator('[data-act=acctcreate]').first());
    await form(true, pw);
    await toast('Account created.');
    account = true;
    expect(await page.evaluate(() => FB.auth.currentUser.email)).toBe(email);

    // A team, saved to the account
    await c.createTeam(TEAM, ['Ava', 'Ben', 'Cal', 'Dev', 'Eli']);
    joined = true;
    await press(page.locator('#menubtn'));
    await expect(view).toContainText(`Signed in with email as ${email}`);

    // Sign out: the phone forgets the team
    await c.saved();
    await press(page.locator('[data-act=signout]'));
    await expect(page.locator('[data-act=signout]')).toHaveText('Tap again to sign out on this phone');
    await press(page.locator('[data-act=signout]'));
    await expect(page.locator('#mkname')).toBeVisible({timeout: 30000});
    await expect(page.locator('#hteam')).not.toHaveText(TEAM);

    // A wrong password is refused, in plain words
    await press(page.locator('[data-act=acctsignin]').first());
    await form(false, pw + 'x');
    await toast("That email and password don't match.");

    // The right one brings the team back
    await page.locator('#acctpw').fill(pw);
    await press(btn('Sign in', page.locator('#acctf')));
    await expect(page.locator('#hteam')).toHaveText(TEAM, {timeout: 45000});
    expect(await page.evaluate(() => FB.auth.currentUser.email)).toBe(email);
    finished = true;
  } finally {
    await cleanUp(finished, [
      async () => { if (joined) await c.leave(TEAM); },
      async () => { // remove the throwaway account (signed in here, or sign in again to remove it)
        if (!account) return;
        const r = await page.evaluate(async ([email, pw]) => {
          let u = FB.auth.currentUser;
          if (u?.email !== email) u = (await FB.A.signInWithEmailAndPassword(FB.auth, email, pw)).user;
          await FB.A.deleteUser(u);
          return 'deleted';
        }, [email, pw]);
        expect(r).toBe('deleted');
      },
    ]);
  }
});
