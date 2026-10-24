import { defineConfig, devices } from '@playwright/test';

/**
 * Cross-browser and cross-device checks of the real game (npm run test:browsers). By default they
 * run against the live site; E2E_URL points them somewhere else (a local production build, say).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 1,
  workers: 4,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_URL || 'https://ascend.drewclark.io' },
  projects: [
    { name: 'Chrome (desktop)', use: { ...devices['Desktop Chrome'] } },
    { name: 'Safari (desktop)', use: { ...devices['Desktop Safari'] } },
    { name: 'Firefox (desktop)', use: { ...devices['Desktop Firefox'] } },
    { name: 'iPhone (Safari)', use: { ...devices['iPhone 14'] } },
    { name: 'iPhone landscape (Safari)', use: { ...devices['iPhone 14 landscape'] } },
    { name: 'Android phone (Chrome)', use: { ...devices['Pixel 7'] } },
    { name: 'iPad (Safari)', use: { ...devices['iPad (gen 7)'] } },
    { name: 'Android tablet (Chrome)', use: { ...devices['Galaxy Tab S4'] } },
  ],
});
