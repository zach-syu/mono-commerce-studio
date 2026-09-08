import {Button} from './ui';
import {languageLabels} from '../lib/types';
import type {CopySection,Language,Product} from '../lib/types';
import {resolveMerchantFacts,recognisedFocus} from '../../shared/merchant-facts';

export function untranslatedLanguage(sections:CopySection[],language:Language){
 return sections.find(s=>s.selected&&s.translationStatus==='source-retained'&&s.contentLanguage!==language)?.contentLanguage as Language|undefined;
}
export default function CopySourceNotice({product,sections,language,prompt,onUseLanguage}:{product:Product;sections:CopySection[];language:Language;prompt:string;onUseLanguage:(language:Language)=>void}){
 const context=resolveMerchantFacts({name:product.name,category:product.category,description:product.facts,facts:[product.facts]},language);
 const untranslated=untranslatedLanguage(sections,language);
 const legacy=sections.length>0&&sections.some(s=>!s.copyOrigin);
 return <div className="copy-source-notice" role="status" data-testid="copy-source-notice">
  <strong>依商品資料整理 · 免費 · 未呼叫 AI</strong>
  <p>使用你填寫的 {context.sourceFacts.length} 項資料安排文案。不會辨識照片內容，也不會自動補寫未提供的功效。</p>
  {prompt.trim()&&<p>{recognisedFocus(prompt)?'已依製作方向調整相關圖種的順序。':'這段製作方向沒有可套用的重點關鍵字，請直接編輯各張內容。'} 免費版支援成分、材質、用途、步驟等重點，不會理解所有長指令。</p>}
  {legacy&&<p className="copy-source-warning">這份草稿來自舊版整理。請重新按「依商品資料整理」，讓原始資料進入文案。</p>}
  {untranslated&&<div className="copy-source-warning"><p>你選擇 {languageLabels[language]}，但商品資料是{languageLabels[untranslated]}。免費功能沒有完成翻譯，以下保留原文。請改用原文，或回商品設定貼上目標語言資料，再製作素材。</p><Button variant="secondary" onClick={()=>onUseLanguage(untranslated)}>改用原文：{languageLabels[untranslated]}</Button></div>}
  {context.translationStatus==='reviewed-fixture'&&<p>這份資料符合內建範例，使用預先撰寫的翻譯。自行修改資料後，不會套用舊翻譯。</p>}
 </div>;
}
