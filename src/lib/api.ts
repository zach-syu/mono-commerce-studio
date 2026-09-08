import type { CopySection, Product, Settings } from './types';
import {demoCopy} from '../../shared/free-copy';
export const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/,'');
let accessCode = '';
export function setAccessCode(value:string){ accessCode=value; }
export function getWorkspaceToken(){
  const key='mono-workspace-token'; let token=localStorage.getItem(key);
  if(!token || !/^[a-f0-9]{64}$/.test(token)) { token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join(''); localStorage.setItem(key,token); }
  return token;
}
export async function request<T>(path:string, body?:unknown, signal?:AbortSignal):Promise<T>{
 const response=await fetch(apiBase+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','x-workspace-token':getWorkspaceToken(),...(accessCode?{'x-mono-access-code':accessCode}:{}),...(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?{apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:signal??AbortSignal.timeout(150000)});
 const data=await response.json().catch(()=>({error:{message:'伺服器回應格式不正確。請稍後重試。'}}));
 if(!response.ok) throw new Error(data.error?.message || `連線失敗（${response.status}）。請重試。`);
 return data as T;
}
export async function planCopy(product:Product,settings:Settings,signal?:AbortSignal,allowPaid=false){
 if(settings.mode==='demo'){const start=performance.now();return {sections:demoCopy({name:product.name,category:product.category,description:product.facts,facts:product.facts.trim()?[product.facts]:[]},settings.language),provider:'demo',model:'local-storyboard-v2',durationMs:Math.round(performance.now()-start)};}
 if(!allowPaid)throw new Error('請先確認本次付費文案規劃，或使用免費規劃。');
 return request<{sections:CopySection[];provider:string;model:string;durationMs:number}>('/copy',{product:{name:product.name,category:product.category,description:product.facts,facts:product.facts.trim()?[product.facts]:[]},language:settings.language,platform:settings.platform,prompt:settings.prompt,mode:settings.mode,allowPaid:true,...(settings.mode==='live'?{sourceDataUrl:product.sourceDataUrl}:{})},signal);
}
export async function health(){return request<{mode?:string;providers?:Record<string,unknown>;models?:Record<string,string>;storage?:string;[key:string]:unknown}>('/health');}
