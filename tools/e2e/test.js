// The tests' `test` and `expect`. Normally Playwright's own. With ANDROID=1 the coach's phone (`page`)
// is real Chrome on a running Android emulator (or a phone plugged in with USB debugging), driven
// through adb; any other phones in a test (followers, new coaches) stay in Playwright's Chromium at a
// Pixel's size. Needs, on the device, Chrome's "Enable command line on non-rooted devices" flag
// (chrome://flags). Experimental in Playwright.
const base = require('@playwright/test');

let test = base.test;
if (process.env.ANDROID) {
  const {_android} = require('playwright');
  test = base.test.extend({
    android: [async ({}, use) => {
      let [device] = await _android.devices();
      // On GitHub the emulator sometimes vanishes mid-run (android.yml): start it again, once per worker
      if (!device && process.env.ANDROID_RESTART) {
        require('node:child_process').execSync(process.env.ANDROID_RESTART, {stdio: 'inherit', timeout: 10 * 60 * 1000});
        [device] = await _android.devices();
      }
      if (!device) throw new Error('No Android device: start the emulator (or plug in a phone) and check `adb devices`.');
      await use(device);
      await device.close();
    }, {scope: 'worker'}],
    context: async ({android, baseURL}, use) => {
      // a phone: taps, not clicks. Chrome on the emulator sometimes hangs after a long test, and then
      // every later test failed at once: stop Chrome and try again before giving up.
      let ctx;
      for (let i = 1; ; i++) {
        try { ctx = await android.launchBrowser({baseURL, hasTouch: true, locale: 'en-GB', timezoneId: 'Europe/London'}); break; }
        catch (e) {
          if (i >= 3 || /Device is closed/.test(e.message)) throw e; // the device has gone: a new worker finds it again
          await android.shell('am force-stop com.android.chrome').catch(() => {});
          await new Promise(r => setTimeout(r, 5000));
        }
      }
      // Chrome on the device keeps its data between tests: start each one as a fresh coach
      const p = ctx.pages()[0] || await ctx.newPage();
      await p.goto('/privacy.html');
      await p.evaluate(async () => { localStorage.clear(); sessionStorage.clear(); for (const d of (await indexedDB.databases?.()) || []) indexedDB.deleteDatabase(d.name); });
      await use(ctx);
      await ctx.close();
    },
    page: async ({context}, use) => { await use(context.pages()[0] || await context.newPage()); },
  });
}

module.exports = {test, expect: base.expect};
