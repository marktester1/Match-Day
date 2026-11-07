// Notifications on Android: a link opened inside WhatsApp (or Facebook, Instagram) shows in that app's own
// browser, which can't get notifications. The supporters' card says to open it in Chrome before anyone taps,
// and tapping says the same; in Chrome itself there's no such warning. Checked on the card's own code.
const {test, expect} = require('./test');

const WHATSAPP = 'Mozilla/5.0 (Linux; Android 14; SM-S921B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 WhatsApp/2.24';
const CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

for (const [where, ua, warned] of [['inside WhatsApp', WHATSAPP, true], ['in Chrome', CHROME, false]]) {
  test(`Android supporters' notifications ${where}`, async ({browser}, info) => {
    test.skip(!!process.env.ANDROID, 'pretends to be an Android browser; on a real Android phone it already is one');
    test.skip(info.project.name !== 'desktop-chromium', "Android browsers are Chrome's engine, not Safari's");
    const ctx = await browser.newContext({userAgent: ua});
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('#mkname')).toBeVisible({timeout: 30000});
    const card = await page.evaluate(() => { S.fpush = null; return followPushCard({sport: 'football'}); });
    if (warned) expect(card).toContain('Tap ⋮ and choose Open in Chrome');
    else expect(card).not.toContain('Open in Chrome');
    expect(card).not.toContain('Home Screen'); // that's the iPhone advice
    if (warned) expect(await page.evaluate(() => pushToken().then(() => 'ok', e => pushWhy(e)))).toContain('Open in Chrome');
    await ctx.close();
  });
}
