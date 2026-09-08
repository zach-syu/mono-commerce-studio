import { ApiError, MAX_IMAGE_BYTES, MAX_REQUEST_BYTES } from './types.ts';
import type { Payload } from './types.ts';

export const ASPECT_RATIOS = ['1:1','3:2','2:3','3:4','1:4','4:1','4:3','4:5','5:4','1:8','8:1','9:16','16:9','21:9','9:21'];
export const LANGUAGES = ['zh-TW', 'en', 'ja', 'ko'];
export function object(value: unknown, name = 'request'): Payload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'INVALID_INPUT', `${name} 必須是物件。`);
  return value as Payload;
}
export function exactKeys(value: Payload, keys: string[]) {
  const unknown = Object.keys(value).filter(k => !keys.includes(k));
  if (unknown.length) throw new ApiError(400, 'INVALID_INPUT', `不支援的欄位：${unknown.slice(0, 5).join(', ')}`);
}
export function str(value: unknown, name: string, max = 4000, fallback?: string): string {
  if ((value === undefined || value === '') && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError(400, 'INVALID_INPUT', `${name} 必須是 1–${max} 字元的文字。`);
  return value.trim();
}
export function choice(value: unknown, options: readonly string[], name: string, fallback?: string) {
  const text = str(value, name, 100, fallback);
  if (!options.includes(text)) throw new ApiError(400, 'INVALID_INPUT', `${name} 不支援此選項。`);
  return text;
}
export function uuid(value: unknown, name = 'id') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, 'INVALID_INPUT', `${name} 格式不正確。`);
  return value;
}
export async function readJson(request: Request): Promise<Payload> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'CONTENT_TYPE', '請使用 application/json。');
  if (Number(request.headers.get('content-length') || 0) > MAX_REQUEST_BYTES) throw new ApiError(413, 'REQUEST_TOO_LARGE', '請求超過 10 MB。');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'INVALID_JSON', '缺少請求內容。');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new ApiError(413, 'REQUEST_TOO_LARGE', '請求超過 10 MB。'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return object(JSON.parse(new TextDecoder().decode(bytes))); }
  catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'INVALID_JSON', 'JSON 格式不正確。'); }
}
export function parseImage(value: unknown, video = false) {
  if (typeof value !== 'string') throw new ApiError(400, 'INVALID_IMAGE', '請提供圖片。');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0 || (video && !['image/png','image/jpeg'].includes(match[1]))) throw new ApiError(415, 'INVALID_IMAGE', video ? '影片來源限 PNG、JPEG。' : '圖片限 PNG、JPEG、WebP 的 base64 data URL。');
  if (Math.floor(match[2].length * 3 / 4) - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0) > MAX_IMAGE_BYTES) throw new ApiError(413, 'IMAGE_TOO_LARGE', '單張圖片上限為 7 MB。');
  let binary: string;
  try { binary = atob(match[2]); } catch { throw new ApiError(400, 'INVALID_IMAGE', '圖片 base64 無法解碼。'); }
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const png = bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if (!(match[1] === 'image/png' && png || match[1] === 'image/jpeg' && jpeg || match[1] === 'image/webp' && webp)) throw new ApiError(415, 'IMAGE_SIGNATURE', '檔案內容與圖片格式不符。');
  return { mimeType: match[1], base64: match[2], bytes };
}
export function safeJson(value: unknown, max = 128_000): Payload {
  const result = object(value);
  if (JSON.stringify(result).length > max) throw new ApiError(413, 'METADATA_TOO_LARGE', '紀錄內容過大；圖片請先存入素材端點。');
  return result;
}
