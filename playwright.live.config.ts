import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir: './tests', testMatch: 'live.e2e.spec.ts',
  timeout: 300_000, expect: { timeout: 15_000 }, workers: 1, fullyParallel: false, retries: 0,
  outputDir: 'artifacts/playwright-live',
  reporter: [['list'], ['json', { outputFile: 'artifacts/playwright-live-results.json' }]],
  use: {
    ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5176',
    viewport: { width: 1440, height: 1000 }, locale: 'zh-TW', acceptDownloads: true,
    actionTimeout: 15_000, navigationTimeout: 30_000,
    // Live credentials must never be captured in tracing or test-runner video.
    trace: 'off', video: 'off', screenshot: 'off',
    launchOptions: { executablePath: process.env.E2E_CHROME_PATH || (existsSync(chrome) ? chrome : undefined) },
  },
  webServer: process.env.E2E_EXTERNAL_LIVE_SERVER === '1' ? undefined : {
    command: 'npm run dev -- --port 5176', url: 'http://127.0.0.1:5176', reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: 'http://127.0.0.1:8788/api', VITE_ANALYTICS_DISABLED: '1' }, timeout: 30_000,
  },
});
