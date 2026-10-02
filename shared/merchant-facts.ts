import type {ProductBrief} from './free-copy.ts';
import {benchmarkProducts,translatedBenchmarkFacts} from './benchmark-products.ts';

export type FactKind='capacity'|'ingredients'|'audience'|'directions'|'care'|'dimensions'|'material'|'contents'|'model'|'features';
export interface MerchantEvidence {copyOrigin:'merchant-facts';contentLanguage:string;requestedLanguage:string;translationStatus:'not-needed'|'source-retained'|'reviewed-fixture';sourceFacts:string[];missingFields:string[];}
type Fact={raw:string;value:string;kind:FactKind};
const labels:Record<string,Record<string,string>>={
 'zh-TW':{hero:'商品介紹',benefits:'商品重點',detail:'包裝與外觀細節',lifestyle:'使用情境',specs:'商品資訊',ingredients:'配方成分',material:'材質與結構',mechanism:'已提供的功能',steps:'使用方式',size:'尺寸與容量',contents:'商品內容',comparison:'選購資訊',care:'保存與注意事項'},
 en:{hero:'Product overview',benefits:'Product highlights',detail:'Packaging details',lifestyle:'Use context',specs:'Product information',ingredients:'Ingredients',material:'Material and construction',mechanism:'Supplied features',steps:'Directions',size:'Dimensions and capacity',contents:'Included items',comparison:'Product options',care:'Care and precautions'},
 ja:{hero:'商品紹介',benefits:'商品のポイント',detail:'パッケージの詳細',lifestyle:'使用シーン',specs:'商品情報',ingredients:'配合成分',material:'素材と構造',mechanism:'確認できる機能',steps:'使用方法',size:'サイズと容量',contents:'商品内容',comparison:'選択のための情報',care:'保管と注意事項'},
 ko:{hero:'제품 소개',benefits:'제품 주요 정보',detail:'포장과 외관',lifestyle:'사용 상황',specs:'제품 정보',ingredients:'성분',material:'소재와 구조',mechanism:'제공된 기능',steps:'사용 방법',size:'크기와 용량',contents:'구성품',comparison:'선택 정보',care:'보관과 주의 사항'}
};
export function detectContentLanguage(text:string,fallback='zh-TW'){
 if(/[\u3040-\u30ff]/u.test(text))return 'ja';
 if(/[\uac00-\ud7af]/u.test(text))return 'ko';
 if(/[\u3400-\u9fff]/u.test(text))return 'zh-TW';
 return /[a-z]{3}/i.test(text)?'en':fallback;
}
function classify(raw:string):FactKind{
 const field=raw.match(/^([^：:]{1,24})[：:]/u)?.[1];
 if(field){const kind=classify(field);if(kind!=='features')return kind;}
 if(/注意|警告|保存|保養|保管|お手入れ|洗標|precaution|warning|caution|storage|keep frozen|care:|주의|보관/i.test(raw))return 'care';
 if(/成[分份]|原料|配方|配合|ingredient|formula|contains|성분|益生菌|益生質|後生元|probiotic|prebiotic|postbiotic/i.test(raw))return 'ingredients';
 if(/適用對象|適合對象|用途|情境|対象|使用シーン|audience|suitable for|use:|使用目的|사용 대상|사용 상황/i.test(raw))return 'audience';
 if(/使用方式|用法|使用方法|食用方式|調理方法|directions|how to use|preparation|instruction|사용 방법/i.test(raw))return 'directions';
 if(/尺寸|長度|寬度|高度|尺碼|サイズ|寸法|dimension|size|measurement|크기|치수/i.test(raw))return 'dimensions';
 if(/材質|面料|素材|material|fabric|cotton|nylon|소재/i.test(raw))return 'material';
 if(/容量|重量|淨重|内容量|capacity|weight|volume|용량|중량|\d(?:[\d. ]*)\s?(?:g|kg|ml|mL)\b/i.test(raw))return 'capacity';
 if(/套組|內容物|組合|任選|包裝包含|included|contents|set of|choose .*packs|セット|구성/i.test(raw))return 'contents';
 if(/型號|型番|品番|model|모델/i.test(raw))return 'model';
 return 'features';
}
function parseFacts(text:string):Fact[]{
 const rows=text.split(/[\r\n。；;]+|(?=[■●•])/u).map(s=>s.replace(/^(?:[■●•◆◇□▪*\-]+\s*|\d+[.)、]\s+)/u,'').trim()).filter(Boolean);
 return [...new Set(rows)].map(raw=>({raw,value:raw.replace(/^[^：:]{1,24}[：:]\s*/u,''),kind:classify(raw)}));
}
export function resolveMerchantFacts(brief:ProductBrief,requestedLanguage:string){
 const raw=brief.facts.filter(s=>s.trim()).join('\n').trim()||brief.description.trim();
 const sourceLanguage=detectContentLanguage(raw,requestedLanguage);
 const reviewed=translatedBenchmarkFacts(brief.name,raw,requestedLanguage)||sampleTranslation(raw,requestedLanguage);
 const translated=Boolean(reviewed&&requestedLanguage!==sourceLanguage);
 const contentLanguage=translated?requestedLanguage:sourceLanguage;
 const translationStatus:MerchantEvidence['translationStatus']=translated?'reviewed-fixture':contentLanguage===requestedLanguage?'not-needed':'source-retained';
 const benchmark=translated?benchmarkProducts.find(b=>b.name===brief.name):undefined;
 return {raw,sourceLanguage,contentLanguage,requestedLanguage,translationStatus,name:benchmark?.displayNames[requestedLanguage]||brief.name,facts:parseFacts(reviewed||raw),sourceFacts:parseFacts(raw),labels:labels[contentLanguage]||labels['zh-TW']};
}
export function recognisedFocus(prompt=''){
 const rules:[string,RegExp][]=[['ingredients',/成[分份]|配方|ingredient|formulation|配合|성분/i],['material',/材質|面料|素材|material|fabric|소재/i],['steps',/使用方式|使用步驟|用法|directions|how to use|使用方法/i],['lifestyle',/用途|情境|lifestyle|use context|使用シーン/i],['contents',/內容物|套組|收納|included|contents/i],['mechanism',/功能|運作|mechanism|feature/i]];
 return rules.find(([,pattern])=>pattern.test(prompt))?.[0];
}
export function freePlanningExplanation(brief:ProductBrief,language:string,count:number,prompt=''){
 const context=resolveMerchantFacts(brief,language);
 return `執行方式：依商品資料整理，沒有呼叫 AI，也没有傳送模型 Prompt。\n詳情圖張數：${count}\n輸入資料：${context.sourceFacts.length} 項\n目標語言：${language}\n實際文案語言：${context.contentLanguage}\n翻譯狀態：${context.translationStatus==='source-retained'?'未翻譯，保留原文':context.translationStatus==='reviewed-fixture'?'使用範例的預寫翻譯':'沿用輸入語言'}\n製作方向：${prompt||'未填寫'}\n重點關鍵字：${recognisedFocus(prompt)||'未指定可識別重點'}\n\n整理規則：商品名稱作為主標題；容量與用途進入主視覺；成分、材質、使用方式與規格依欄位分類。未提供的資料保留空缺，不推測功效。照片僅保留為商品原圖，免費整理沒有辨識照片。\n\n原始資料：\n${context.raw||'未提供'}`.replace('没有','沒有');
}
export function copyFromMerchantFacts(context:ReturnType<typeof resolveMerchantFacts>,moduleType:string,sceneVariant=0){
 const {facts,contentLanguage,translationStatus,requestedLanguage}=context;
 const matching=(...kinds:FactKind[])=>facts.filter(f=>kinds.includes(f.kind));
 const groups:Record<string,FactKind[]>={hero:['capacity','audience','features'],benefits:['features','audience','material','capacity'],detail:['model','capacity','material'],lifestyle:['audience','directions'],ingredients:['ingredients'],material:['material'],mechanism:['features'],steps:['directions'],size:['dimensions','capacity'],contents:['contents'],comparison:['features'],care:['care']};
 let selected=moduleType==='specs'?facts:matching(...(groups[moduleType]||['features']));
 if(moduleType==='hero')selected=[...matching('capacity'),...matching('audience'),...matching('features')].slice(0,2);
 if(['hero','benefits','detail','lifestyle'].includes(moduleType)&&!selected.length)selected=facts.slice(0,moduleType==='hero'?2:1);
 if(moduleType==='benefits')selected=selected.slice(0,3);
 const missingFields=selected.length?[]:[moduleType==='steps'?'directions':moduleType];
 const missing:Record<string,string>={
  'zh-TW':`${context.labels[moduleType]||'商品資料'}尚未提供，請補充已確認的資訊。`,
  en:`${context.labels[moduleType]||'Product details'} have not been provided. Add verified product information.`,
  ja:`${context.labels[moduleType]||'商品情報'}は未提供です。確認できる情報を追加してください。`,
  ko:`${context.labels[moduleType]||'제품 정보'}가 제공되지 않았습니다. 확인된 정보를 추가하세요.`
 };
 const title=moduleType==='hero'?context.name:moduleType==='lifestyle'?`${context.labels.lifestyle} ${sceneVariant+1}`:context.labels[moduleType]||context.labels.benefits;
 const body=selected.length?selected.map(f=>f.raw).join('\n'):missing[contentLanguage]||missing['zh-TW'];
 const sourceFacts=translationStatus==='reviewed-fixture'?context.sourceFacts.map(f=>f.raw):selected.map(f=>f.raw);
 const evidencePoints=moduleType==='ingredients'?selected.flatMap(f=>f.value.split(/[、，,]/u).map(x=>x.trim()).filter(Boolean)):selected.map(f=>f.raw);
 return {title,body,evidencePoints,sourceFacts,missingFields,copyOrigin:'merchant-facts' as const,contentLanguage,requestedLanguage,translationStatus,customDiagramText:true};
}

// These are authored translations of the three visible sample records, not a general translator.
function sampleTranslation(raw:string,language:string):string|undefined{
 const samples:Record<string,Record<string,string>>={
  '示範包裝。茶葉商品。實際成分、重量與產地待商家補充。':{en:'Sample tea packaging. Ingredients, net weight, and origin must be supplied by the merchant.',ja:'お茶のサンプルパッケージです。原材料、内容量、原産地は販売者による確認が必要です。',ko:'차 제품의 예시 포장입니다. 원재료, 중량, 원산지는 판매자의 확인이 필요합니다.'},
  '示範精華液包裝。實際成分、容量與使用方式待商家補充。':{en:'Sample serum packaging. Ingredients, volume, and directions must be supplied by the merchant.',ja:'美容液のサンプルパッケージです。成分、容量、使用方法は販売者による確認が必要です。',ko:'세럼의 예시 포장입니다. 성분, 용량, 사용 방법은 판매자의 확인이 필요합니다.'},
  '示範休閒鞋。米白與鼠尾草綠配色。材質、尺寸與產地待商家補充。':{en:'Sample casual sneakers in off-white and sage green. Materials, sizes, and origin must be supplied by the merchant.',ja:'オフホワイトとセージグリーンのカジュアルシューズのサンプルです。素材、サイズ、原産地は販売者による確認が必要です。',ko:'오프화이트와 세이지 그린 색상의 캐주얼 운동화 예시입니다. 소재, 사이즈, 원산지는 판매자의 확인이 필요합니다.'}
 };
 return samples[raw]?.[language];
}
