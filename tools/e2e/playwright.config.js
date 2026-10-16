// Playwright set-up for Match Day's end-to-end journey. It runs against the beta site only.
// Run: cd tools/e2e && npx playwright test        (both browsers)
//      MATCHDAY_URL=http://127.0.0.1:8000 npx playwright test   (a local copy; localhost uses beta data)
const {defineConfig, devices} = require('@playwright/test');

const BASE = (process.env.MATCHDAY_URL || 'https://match-day-beta-17b23.web.app').replace(/\/$/, '');
if (/match-day-17b23\.web\.app|match-day-17b23\.firebaseapp\.com/.test(BASE))
  throw new Error('The end-to-end test must never run against live. Use beta or localhost.');

// npm run test:phones: the last three iPhones (WebKit) and four popular Android phones (Chromium),
// each with its own screen size, user agent and touch. Playwright's engines, not the phones themselves.
const PHONES = ['iPhone 17', 'iPhone 16', 'iPhone 15', 'Galaxy S24', 'Galaxy A55', 'Pixel 9', 'Galaxy Z Flip 7']
  .map(d => ({name: d.toLowerCase().replace(/\s+/g, '-'), use: {...devices[d]}}));

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js$/,
  timeout: 6 * 60 * 1000,          // the whole journey, one test per browser
  expect: {timeout: 15 * 1000},    // Firestore round trips on beta
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  },
  projects: process.env.PHONES ? PHONES : [
    {name: 'iphone-webkit', use: {...devices['iPhone 15']}},        // Safari's engine, iPhone screen, touch
    {name: 'desktop-chromium', use: {...devices['Desktop Chrome']}},
  ],
});
