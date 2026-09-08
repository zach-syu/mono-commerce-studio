import {defineConfig,devices} from '@playwright/test';
import {existsSync} from 'node:fs';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({testDir:'tests',testMatch:'merchant-copy.e2e.spec.ts',workers:1,retries:0,timeout:90000,reporter:[['list'],['json',{outputFile:'artifacts/merchant-copy/e2e-results.json'}]],outputDir:'artifacts/merchant-copy/runner',use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5182',viewport:{width:1440,height:1100},acceptDownloads:true,trace:'retain-on-failure',launchOptions:{executablePath:existsSync(chrome)?chrome:undefined}},webServer:[
 {command:'npm run dev:api',url:'http://127.0.0.1:8797/api/health',reuseExistingServer:false,env:{MONO_DISABLE_LIVE:'1',MONO_API_PORT:'8797',MONO_DATA_DIR:'.local-data/merchant-copy',MONO_ALLOWED_ORIGINS:'http://127.0.0.1:5182'}},
 {command:'npm run dev -- --port 5182',url:'http://127.0.0.1:5182',reuseExistingServer:false,env:{VITE_API_URL:'http://127.0.0.1:8797/api',VITE_ANALYTICS_DISABLED:'1'}}
]});
