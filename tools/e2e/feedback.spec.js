// The feedback button: bottom right on every screen, an email to us with the app version and phone
// filled in (nothing about the team), out of the way while typing. Beta only; makes no team.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1

test('the feedback button opens an email with the version and phone, and hides while typing', async ({page}) => {
  await page.goto('/');
  const fb = page.locator('#feedback');
  await expect(fb).toBeVisible({timeout: 30000});
  await expect(fb).toHaveText('💬 Feedback');

  // bottom right, inside the screen
  const box = await fb.boundingBox(), vp = await page.evaluate(() => ({width: innerWidth, height: innerHeight})); // (real Chrome on Android has no set viewport)
  expect(box.x + box.width).toBeGreaterThan(vp.width - 40);
  expect(box.y + box.height).toBeGreaterThan(vp.height - 40);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);

  // an email to us, with the version and a screenshot hint
  const href = decodeURIComponent(await fb.getAttribute('href'));
  const version = await page.evaluate(() => APP_VERSION);
  expect(href).toMatch(/^mailto:hello@matchday-app\.uk\?subject=Match Day feedback&body=/);
  expect(href).toContain(`Match Day ${version} (beta)`);
  expect(href).toContain('attach one to this email');

  // gone while a box has the keyboard, back afterwards
  await page.locator('#mkname').focus();
  await expect(fb).toBeHidden();
  await page.locator('#mkname').blur();
  await expect(fb).toBeVisible();
});
