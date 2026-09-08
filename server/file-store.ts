import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Store, RecordKind, StoredRecord } from '../supabase/functions/_shared/types.ts';
const fileLocks=new Map<string,Promise<unknown>>();
export function createFileStore(root: string): Store {
  const path = (kind: string, owner: string, id: string) => join(root,kind,owner,`${id}.json`);
  async function read(file: string) { try { return JSON.parse(await readFile(file,'utf8')); } catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error; } }
  async function write(file: string, value: unknown) { await mkdir(join(file,'..'),{recursive:true,mode:0o700});const temp=`${file}.${crypto.randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(value),{mode:0o600});await rename(temp,file); }
  return {
    kind:'local-file',
    async consumeBudget(bucket,amount,limit){const file=join(root,'budgets.json');const previous=fileLocks.get(file)||Promise.resolve();const work=previous.catch(()=>{}).then(async()=>{const current=await read(file)||{};const next=Number(current[bucket]||0)+amount;if(next>limit)return false;const today=bucket.split(':').at(-1);for(const key of Object.keys(current))if(key.split(':').at(-1)!==today)delete current[key];current[bucket]=next;await write(file,current);return true;});fileLocks.set(file,work);try{return await work;}finally{if(fileLocks.get(file)===work)fileLocks.delete(file);}},
    async list(kind,owner) { let names:string[];try{names=await readdir(join(root,kind,owner));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}const rows:StoredRecord[]=[];for(const name of names.filter(n=>n.endsWith('.json'))) {const row=await read(join(root,kind,owner,name));if(row)rows.push(row);}return rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100); },
    async get(kind:RecordKind,owner:string,id:string){return read(path(kind,owner,id));},
    async put(kind,row){await write(path(kind,row.owner,row.id),row);},
    async replaceStatus(kind,row,expectedStatus){const file=path(kind,row.owner,row.id);const previous=fileLocks.get(file)||Promise.resolve();const work=previous.catch(()=>{}).then(async()=>{const current=await read(file);if(current?.payload.status!==expectedStatus)return false;await write(file,row);return true;});fileLocks.set(file,work);try{return await work;}finally{if(fileLocks.get(file)===work)fileLocks.delete(file);}},
    async assetPut(owner,id,bytes,mimeType){await write(path('assets',owner,id),{base64:Buffer.from(bytes).toString('base64'),mimeType});},
    async assetDelete(owner,id){await rm(path('assets',owner,id),{force:true});},
    async assetGet(owner,id){const value=await read(path('assets',owner,id));return value?{bytes:new Uint8Array(Buffer.from(value.base64,'base64')),mimeType:value.mimeType}:null;},
  };
}
