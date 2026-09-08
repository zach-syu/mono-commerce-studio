import {defineConfig,devices} from '@playwright/test';
import {existsSync} from 'node:fs';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
 testDir:'tests',testMatch:'preview.e2e.spec.ts',workers:1,retries:0,timeout:60000,
 reporter:[['list'],['json',{outputFile:'artifacts/layout-v2/test-results.json'}]],outputDir:'artifacts/layout-v2/test-runner',
 use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5180',viewport:{width:1440,height:1100},acceptDownloads:true,trace:'off',launchOptions:{executablePath:existsSync(chrome)?chrome:undefined}},
 webServer:[
  {command:'npm run dev:api',url:'http://127.0.0.1:8799/api/health',reuseExistingServer:false,env:{MONO_DISABLE_LIVE:'1',MONO_API_PORT:'8799',MONO_DATA_DIR:'.local-data/no-cost-v2',MONO_ALLOWED_ORIGINS:'http://127.0.0.1:5180'}},
  {command:'npm run dev -- --port 5180',url:'http://127.0.0.1:5180',reuseExistingServer:false,env:{VITE_API_URL:'http://127.0.0.1:8799/api',VITE_ANALYTICS_DISABLED:'1'}}
 ]
});
