import { defineConfig, devices } from '@playwright/test';

/**
 * Cross-browser and cross-device checks of the real game (npm run test:browsers). By default they
 * run against the live site; E2E_URL points them somewhere else (a local production build, say).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 1,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_URL || 'https://ascend.drewclark.io',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_START_SERVER === '1' ? {
    command: 'node server/dist/index.js',
    url: 'http://127.0.0.1:3002/health',
    env: { NODE_ENV: 'test', PORT: '3002' },
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  } : undefined,
  projects: [
    { name: 'Chrome (desktop)', use: { ...devices['Desktop Chrome'] } },
    { name: 'Safari (desktop)', use: { ...devices['Desktop Safari'] } },
    { name: 'Firefox (desktop)', use: { ...devices['Desktop Firefox'] } },
    // Firefox does not support Playwright's isMobile emulation. Exercise Gecko with
    // real touch events and phone-shaped viewports; these are not Android device runs.
    { name: 'Firefox phone viewport', use: { browserName: 'firefox', viewport: { width: 412, height: 915 }, hasTouch: true, deviceScaleFactor: 2.625 } },
    { name: 'Firefox landscape viewport', use: { browserName: 'firefox', viewport: { width: 915, height: 412 }, hasTouch: true, deviceScaleFactor: 2.625 } },
    { name: 'iPhone (Safari)', use: { ...devices['iPhone 14'] } },
    { name: 'iPhone landscape (Safari)', use: { ...devices['iPhone 14 landscape'] } },
    { name: 'Android phone (Chrome)', use: { ...devices['Pixel 7'] } },
    { name: 'iPad (Safari)', use: { ...devices['iPad (gen 7)'] } },
    { name: 'Android tablet (Chrome)', use: { ...devices['Galaxy Tab S4'] } },
  ],
});
