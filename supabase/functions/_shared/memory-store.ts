import type { Store, RecordKind, StoredRecord } from './types.ts';
export class MemoryStore implements Store {
  kind = 'memory';
  records = new Map<string, StoredRecord>();
  assets = new Map<string, {bytes: Uint8Array; mimeType: string}>();
  budgets = new Map<string,number>();
  async consumeBudget(bucket:string,amount:number,limit:number){const next=(this.budgets.get(bucket)||0)+amount;if(next>limit)return false;this.budgets.set(bucket,next);return true;}
  async list(kind: RecordKind, owner: string) { return [...this.records.entries()].filter(([k]) => k.startsWith(`${kind}/${owner}/`)).map(([,v]) => structuredClone(v)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0,100); }
  async get(kind: RecordKind, owner: string, id: string) { return structuredClone(this.records.get(`${kind}/${owner}/${id}`) || null); }
  async put(kind: RecordKind, row: StoredRecord) { this.records.set(`${kind}/${row.owner}/${row.id}`, structuredClone(row)); }
  async replaceStatus(kind: RecordKind,row: StoredRecord,expectedStatus:string){const key=`${kind}/${row.owner}/${row.id}`;if(this.records.get(key)?.payload.status!==expectedStatus)return false;this.records.set(key,structuredClone(row));return true;}
  async assetPut(owner: string, id: string, bytes: Uint8Array, mimeType: string) { this.assets.set(`${owner}/${id}`, { bytes, mimeType }); }
  async assetDelete(owner:string,id:string){this.assets.delete(`${owner}/${id}`);}
  async assetGet(owner: string, id: string) { return this.assets.get(`${owner}/${id}`) || null; }
}
