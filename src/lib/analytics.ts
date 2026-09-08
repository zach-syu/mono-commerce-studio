// Explicit, allowlisted workflow events. Product photos, names, copy and credentials are never properties.
const allowed=new Set(['category','language','platform','mode','outputCount','outputKinds','durationMs','sourceOrigin','resolution','step','provider','model','testRun']);
const key=import.meta.env.VITE_POSTHOG_KEY as string|undefined;
const host=(import.meta.env.VITE_POSTHOG_HOST||'https://us.i.posthog.com').replace(/\/$/,'');
const sessionId=crypto.randomUUID();
export type WorkflowEvent='mono_studio_opened'|'mono_source_loaded'|'mono_copy_completed'|'mono_generation_started'|'mono_generation_completed'|'mono_generation_failed'|'mono_bundle_downloaded'|'mono_product_saved';
export async function track(event:WorkflowEvent,properties:Record<string,unknown>={}){
 if(!key||import.meta.env.VITE_ANALYTICS_DISABLED==='1')return;
 const safe:Record<string,unknown>={app:'mono-commerce-studio',environment:import.meta.env.PROD?'production':'development',$process_person_profile:false,$geoip_disable:true,$ip:'0.0.0.0'};
 for(const [name,value]of Object.entries(properties))if(allowed.has(name)&&(typeof value==='string'||typeof value==='number'||typeof value==='boolean'))safe[name]=typeof value==='string'?value.slice(0,150):value;
 try{await fetch(host+'/i/v0/e/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key,event,distinct_id:sessionId,properties:safe,timestamp:new Date().toISOString()}),keepalive:true,credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(5000)});}catch{/* Analytics failures never interrupt creating or downloading assets. */}
}
