export type Env = Record<string, string | undefined>;
export type Payload = Record<string, unknown>;
export type RecordKind = 'products' | 'jobs';
export interface StoredRecord { id: string; owner: string; payload: Payload; createdAt: string; updatedAt: string }
export interface Store {
  kind: string;
  list(kind: RecordKind, owner: string): Promise<StoredRecord[]>;
  get(kind: RecordKind, owner: string, id: string): Promise<StoredRecord | null>;
  put(kind: RecordKind, row: StoredRecord): Promise<void>;
  replaceStatus(kind: RecordKind, row: StoredRecord, expectedStatus: string): Promise<boolean>;
  consumeBudget(bucket: string, amount: number, limit: number): Promise<boolean>;
  assetPut(owner: string, id: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  assetDelete(owner: string, id: string): Promise<void>;
  assetGet(owner: string, id: string): Promise<{ bytes: Uint8Array; mimeType: string } | null>;
}
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) { super(message); }
}
export const MODELS = { copy: 'gemini-3.7-flash', image: 'gemini-3.1-flash-image', video: 'veo-3.1-generate-001' } as const;
export const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 10 * 1024 * 1024;
export function bytesToBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
}
export function dataUrl(bytes: Uint8Array, mimeType: string) { return `data:${mimeType};base64,${bytesToBase64(bytes)}`; }
export async function ownerFromToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('');
}
