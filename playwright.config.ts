// Browser tests (Playwright Test, TypeScript): `npm run test:e2e`. They drive the real page in Chromium against
// the real Python server running on offline SEC fixtures (tests/e2e_server.py), so they're fast and repeatable.
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, PORT } from './e2e/env';

// CI installs the Python dependencies globally; locally prefer the project's virtualenv.
const python = process.env.PYTHON ?? (existsSync('.venv/bin/python') ? '.venv/bin/python' : 'python3');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['allure-playwright', { resultsDir: 'allure-results', suiteTitle: true }],
  ],
  use: {
    baseURL: BASE_URL,
    locale: 'en-US',
    viewport: { width: 1280, height: 720 },
    screenshot: 'off', // e2e/fixtures.ts attaches named step screenshots and a final (or failure) screen instead
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }],
  webServer: {
    command: `${python} tests/e2e_server.py`,
    url: `${BASE_URL}/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
