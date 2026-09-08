import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export default defineConfig({
  testDir: './tests',
  testMatch: 'e2e.spec.ts',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'artifacts/playwright',
  reporter: [['list'], ['json', { outputFile: 'artifacts/playwright-results.json' }], ['html', { outputFolder: 'artifacts/playwright-html', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-TW',
    acceptDownloads: true,
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.E2E_CHROME_PATH || (existsSync(systemChrome) ? systemChrome : undefined) },
  },
  webServer: process.env.E2E_EXTERNAL_SERVER === '1' ? undefined : [
    { command: 'npm run dev:api', env: { MONO_DISABLE_LIVE: '1' }, url: 'http://127.0.0.1:8787/api/health', reuseExistingServer: !process.env.CI, timeout: 30_000 },
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30_000, env: { VITE_API_URL: '/api', VITE_ANALYTICS_DISABLED: '1' } },
  ],
});
