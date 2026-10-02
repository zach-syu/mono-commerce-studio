import {defineConfig,devices} from '@playwright/test';
import {existsSync} from 'node:fs';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({testDir:'tests',testMatch:'benchmark.e2e.spec.ts',workers:1,retries:0,timeout:120000,reporter:[['list'],['json',{outputFile:'artifacts/benchmark-v3/test-results.json'}]],outputDir:'artifacts/benchmark-v3/runner',use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5181',viewport:{width:1440,height:1100},acceptDownloads:true,trace:'retain-on-failure',launchOptions:{executablePath:existsSync(chrome)?chrome:undefined}},webServer:[
 {command:'npm run dev:api',url:'http://127.0.0.1:8796/api/health',reuseExistingServer:false,env:{MONO_DISABLE_LIVE:'1',MONO_API_PORT:'8796',MONO_DATA_DIR:'.local-data/benchmark-v3',MONO_ALLOWED_ORIGINS:'http://127.0.0.1:5181'}},
 {command:'npm run dev -- --port 5181',url:'http://127.0.0.1:5181',reuseExistingServer:false,env:{VITE_API_URL:'http://127.0.0.1:8796/api',VITE_ANALYTICS_DISABLED:'1'}}
]});
