import { ApiError } from './types.ts';
import type { Store, RecordKind, StoredRecord } from './types.ts';

// The caller supplies the pinned supabase-js client; shared business logic remains runtime independent.
export function createSupabaseStore(client: any): Store {
  const table = (kind: RecordKind) => kind === 'products' ? 'mono_products' : 'mono_jobs';
  const unpack = (row: any): StoredRecord => ({ id: row.id, owner: row.owner_hash, payload: row.payload, createdAt: row.created_at, updatedAt: row.updated_at });
  function check(error: unknown) { if (error) throw new ApiError(503, 'STORAGE_UNAVAILABLE', '作品儲存服務暫時無法使用。', true); }
  return {
    kind: 'supabase',
    async consumeBudget(bucket,amount,limit){const {data,error}=await client.rpc('mono_consume_budget',{p_bucket:bucket,p_amount:amount,p_limit:limit});check(error);return data===true;},
    async list(kind, owner) { const { data, error } = await client.from(table(kind)).select('*').eq('owner_hash', owner).order('updated_at', { ascending: false }).limit(100); check(error); return (data || []).map(unpack); },
    async get(kind, owner, id) { const { data, error } = await client.from(table(kind)).select('*').eq('owner_hash', owner).eq('id', id).maybeSingle(); check(error); return data ? unpack(data) : null; },
    async put(kind, row) { const { error } = await client.from(table(kind)).upsert({ id: row.id, owner_hash: row.owner, payload: row.payload, created_at: row.createdAt, updated_at: row.updatedAt }, { onConflict: 'owner_hash,id' }); check(error); },
    async replaceStatus(kind,row,expectedStatus){const {data,error}=await client.from(table(kind)).update({payload:row.payload,updated_at:row.updatedAt}).eq('owner_hash',row.owner).eq('id',row.id).eq('payload->>status',expectedStatus).select('id');check(error);return Boolean(data?.length);},
    async assetPut(owner, id, bytes, mimeType) { const { error } = await client.storage.from('mono-assets').upload(`${owner}/${id}`, bytes, { contentType: mimeType, upsert: false }); check(error); },
    async assetDelete(owner,id){const {error}=await client.storage.from('mono-assets').remove([`${owner}/${id}`]);check(error);},
    async assetGet(owner, id) { const { data, error } = await client.storage.from('mono-assets').download(`${owner}/${id}`); if (error) { if (String(error.statusCode) === '404' || String(error.statusCode) === '400') return null; check(error); } return data ? { bytes: new Uint8Array(await data.arrayBuffer()), mimeType: data.type } : null; },
  };
}
