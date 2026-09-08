import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createHandler } from '../supabase/functions/_shared/handler.ts';
import { createFileStore } from './file-store.ts';

// Node 22+ supports loading dotenv files without adding a second runtime dependency.
for (const file of ['.env','.env.local','.env.mono.local']) if(existsSync(file))process.loadEnvFile(file);
const port=Number(process.env.MONO_API_PORT || 8787);
const handler=createHandler({env:process.env,store:createFileStore(resolve(process.env.MONO_DATA_DIR || '.local-data'))});
createServer(async(req,res)=>{
  try {
    const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
    const method=req.method || 'GET';
    const stream = ['GET','HEAD'].includes(method) ? undefined : new ReadableStream<Uint8Array>({
      start(controller){req.on('data',chunk=>controller.enqueue(new Uint8Array(chunk)));req.on('end',()=>controller.close());req.on('error',error=>controller.error(error));},
      cancel(){req.destroy();}
    });
    const request=new Request(`http://127.0.0.1:${port}${req.url || '/'}`,{method,headers,...(stream?{body:stream,duplex:'half'}:{})} as RequestInit);
    const response=await handler(request);res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(Buffer.from(await response.arrayBuffer()));
  } catch {if(!res.headersSent){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'SERVER_ERROR',message:'服務暫時無法完成操作。',retryable:true}}));}else res.end();}
}).listen(port,'127.0.0.1',()=>console.log(`MONO API: http://127.0.0.1:${port} (same handler as Supabase)`));
