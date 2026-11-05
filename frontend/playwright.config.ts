import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 45000,
  expect: { timeout: 10000 }, reporter: 'list',
  outputDir: join(tmpdir(), 'small-web-browser-playwright'),
  use: {
    baseURL: process.env.BROWSER_TEST_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
