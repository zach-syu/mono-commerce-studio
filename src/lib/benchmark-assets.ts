import {benchmarkProducts} from '../../shared/benchmark-products';
import {benchmarkSourceHashes} from './benchmark-source-hashes';
import type {Product} from './types';
import type {ShotPlan} from './storyboard';
export async function identifyBenchmark(file:File){const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');return benchmarkProducts.find(item=>item.id===benchmarkSourceHashes[hash]);}
export function preparedBenchmarkScene(product:Product,shot:ShotPlan){
 if(product.sourceOrigin!=='benchmark'||!product.benchmarkId||shot.role!=='lifestyle')return undefined;
 const benchmark=benchmarkProducts.find(item=>item.id===product.benchmarkId);const index=shot.sceneVariant||0;const source=benchmark?.scenes[index];
 if(!source)return undefined;
 const focal=product.benchmarkId==='philips'?[.67,.30]:product.benchmarkId==='magforce'?[.43,.5]:[.5,.5];
 return {source,focalX:focal[index]??.5,provider:'conversation-imagegen',note:'使用本輪對話生圖的已保存樣張；這次 App 組版沒有呼叫 Google。'};
}
