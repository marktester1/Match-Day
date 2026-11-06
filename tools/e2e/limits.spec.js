// Every text box has a length limit that matches the database rules (checked for all of them in
// tests.yml); typing past it stops at the limit and says so once, in plain words.
const {test, expect} = require('./test'); // Playwright's, or real Android Chrome with ANDROID=1
const {app} = require('./helpers');

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
