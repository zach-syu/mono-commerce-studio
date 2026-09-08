export type Category = 'food' | 'beauty' | 'fashion';
export type Language = 'zh-TW' | 'en' | 'ja' | 'ko';
export type Mode = 'demo' | 'live';
export type OutputKind = 'main' | 'detail' | 'banner' | 'video';
export type Tone = 'natural' | 'studio' | 'bold';
export type Layout = 'smart' | 'center' | 'split' | 'editorial';
export type Resolution = '1K' | '2K' | '4K';
export type VisualRole = 'hero' | 'benefits' | 'detail' | 'lifestyle' | 'specs';
export type DetailFocus = 'upper' | 'center' | 'lower';
export interface CopySection { id: string; title: string; body: string; selected: boolean; role?:VisualRole; visualGoal?:string; detailFocus?:DetailFocus; }
export interface Product { id: string; name: string; category: Category; facts: string; sourceDataUrl: string; sourceName: string; sourceWidth: number; sourceHeight: number; sourceOrigin: 'uploaded' | 'ai-sample'; }
export interface Settings { platform: string; language: Language; prompt: string; tone: Tone; layout: Layout; resolution: Resolution; outputs: OutputKind[]; bannerRatio: '16:9' | '21:9'; mode: Mode; }
export interface Artifact { id: string; kind: OutputKind; title: string; blob: Blob; previewUrl?: string; width: number; height: number; mimeType: string; prompt: string; provider: string; model: string; durationMs: number; sourceId: string; copy: CopySection | null; warning?: string; rawGenerated?: Blob; nativeWidth?:number; nativeHeight?:number; endpoint?:string; visualRole?:VisualRole|'packshot'|'banner'|'video'; template?:string; photoOrigin?:'original'|'original-crop'|'prepared-scene'|'context-preview'|'generated'; sourceNote?:string; reusedPhoto?:boolean; compositionVersion?:string; }
export interface SavedProject { id: string; product: Product; settings: Settings; sections: CopySection[]; artifacts: Artifact[]; savedAt: string; }
export interface Draft { product: Product | null; settings: Settings; sections: CopySection[]; step: number; }
export const initialSettings: Settings = { platform:'Shopee',language:'zh-TW',prompt:'',tone:'natural',layout:'smart',resolution:'1K',outputs:['main','detail'],bannerRatio:'16:9',mode:'demo' };
export const categoryLabels: Record<Category,string> = {food:'食品',beauty:'美妝保健',fashion:'服裝配件'};
export const languageLabels: Record<Language,string> = {'zh-TW':'繁體中文',en:'English',ja:'日本語',ko:'한국어'};
export const outputLabels: Record<OutputKind,string> = {main:'商品主圖',detail:'商品詳情圖',banner:'Banner',video:'帶貨短片'};
export const sampleProducts: {id:Category;name:string;facts:string;file:string;caption:string}[] = [
 {id:'food',name:'MORI 焙茶',facts:'示範包裝。茶葉商品。實際成分、重量與產地待商家補充。',file:'/samples/food.png',caption:'食品 · 茶葉'},
 {id:'beauty',name:'SORA 日常精華',facts:'示範精華液包裝。實際成分、容量與使用方式待商家補充。',file:'/samples/beauty.png',caption:'美妝 · 精華液'},
 {id:'fashion',name:'PLAIN 日常休閒鞋',facts:'示範休閒鞋。米白與鼠尾草綠配色。材質、尺寸與產地待商家補充。',file:'/samples/fashion.png',caption:'服裝配件 · 休閒鞋'},
];
