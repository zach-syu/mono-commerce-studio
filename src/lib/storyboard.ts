import type {CopySection,Product,Settings,VisualRole,OutputKind} from './types';
import {moduleNames,moduleRoles,visualProfile} from '../../shared/visual-planning';
import type {ModuleType} from '../../shared/visual-planning';

export const visualRoles:VisualRole[]=['hero','benefits','detail','lifestyle','specs'];
export const roleNames:Record<VisualRole,string>={hero:'主視覺',benefits:'賣點圖',detail:'原圖細節',lifestyle:'使用情境',specs:'規格資訊'};
export const roleDescriptions:Record<VisualRole,string>={hero:'大幅商品與品牌印象，先讓人想看下去。',benefits:'把已確認的重點整理成清楚的圖文模組。',detail:'放大原圖的局部，保留商品真實細節。',lifestyle:'用適合商品的場景，說明它出現在哪裡。',specs:'把已提供的規格整理成容易比較的資訊。'};
export interface ShotPlan { id:string;kind:OutputKind;role:VisualRole|'packshot'|'video';template:string;section:CopySection;purpose:string;visualGoal:string;needsNewPhoto:boolean;photoKey:string|null;photoAspectRatio:'1:1'|'4:3'|'3:4';moduleType?:ModuleType;sceneVariant?:number;focalX?:number; }

export function sectionRole(section:CopySection,index:number,total:number):VisualRole{
 if(section.moduleType&&moduleRoles[section.moduleType])return moduleRoles[section.moduleType];
 if(section.role&&visualRoles.includes(section.role))return section.role;
 const ids:Record<string,VisualRole>={hero:'hero',benefits:'benefits',details:'detail',detail:'detail',lifestyle:'lifestyle',specs:'specs'};
 if(ids[section.id])return ids[section.id];
 if(index===total-1&&total>2)return 'specs';
 return visualRoles[index%visualRoles.length];
}
export function normaliseSections(sections:CopySection[]):CopySection[]{return sections.map((s,i)=>({...s,role:sectionRole(s,i,sections.length)}));}
export function completeSections(current:CopySection[],suggested:CopySection[]):CopySection[]{
 const existing=normaliseSections(current);const roles=new Set(existing.map(s=>s.role));
 const added=suggested.filter(s=>!roles.has(s.role)).map(s=>({...s,id:'added-'+s.role+'-'+crypto.randomUUID()}));
 return [...existing,...added].sort((a,b)=>visualRoles.indexOf(a.role!)-visualRoles.indexOf(b.role!));
}
export function buildStoryboard(product:Product,s:Settings,sections:CopySection[]):ShotPlan[]{
 const chosen=normaliseSections(sections).filter(x=>x.selected);if(!chosen.length)return [];
 const hero=chosen.find(x=>x.role==='hero')||{...chosen[0],role:'hero' as const,moduleType:chosen[0].moduleType?'hero' as const:undefined,visualGoal:undefined};
 const template:Record<VisualRole,string>={hero:'hero-stage',benefits:'benefit-grid',detail:'detail-collage',lifestyle:'context-scene',specs:'spec-table'};
 const plan=(kind:OutputKind,section:CopySection,role:ShotPlan['role']):ShotPlan=>{
  const visualGoal=section.visualGoal?.trim()||((role==='packshot'||role==='video')?'':roleDescriptions[role]);
  const needsNewPhoto=role==='hero'||role==='lifestyle';
  const moduleType=section.moduleType||(role==='packshot'||role==='video'?undefined:role);
  return {id:`${kind}-${section.id}`,kind,role,section,moduleType,sceneVariant:section.sceneVariant||0,purpose:role==='packshot'?'保留商品原圖':role==='video'?'短片':moduleType?moduleNames[moduleType]+(moduleType==='lifestyle'?` ${1+(section.sceneVariant||0)}`:''):roleNames[role],template:kind==='banner'?'campaign-banner':role==='packshot'?'source-packshot':role==='video'?'video':section.moduleType?`v3-${moduleType}`:template[role],visualGoal,needsNewPhoto,photoKey:needsNewPhoto?`${role}|${section.sceneVariant||0}|${section.visualGoal?.trim()||'default'}|${s.tone}`:null,photoAspectRatio:role==='lifestyle'?'3:4':role==='hero'?'4:3':'1:1'};
 };
 return s.outputs.flatMap(kind=>kind==='detail'?chosen.map(section=>plan(kind,section,section.role!)):[plan(kind,kind==='banner'?hero:chosen[0],kind==='main'?'packshot':kind==='banner'?'hero':'video')]);
}
export function plannedPhotoCalls(plans:ShotPlan[],s:Settings){return s.mode==='demo'?0:new Set(plans.filter(p=>p.needsNewPhoto).map(p=>p.photoKey)).size;}
export function buildPhotoPrompt(product:Product,s:Settings,shot:ShotPlan){
 const profile=visualProfile(product.category,product.name);const scenes=profile.scenes;const goal=shot.visualGoal.trim();const scene=goal&&goal!==roleDescriptions.lifestyle?goal:scenes[(shot.sceneVariant||0)%scenes.length];
 const color={natural:'soft natural neutrals with restrained sage accents',studio:'cool clean whites, pale blue-grey and precise studio light',bold:'warm apricot, deep warm shadows and confident color blocking'};
 const direction=shot.role==='lifestyle'?`Lifestyle scene ${1+(shot.sceneVariant||0)}: ${scene}. Show a concrete activity and environment appropriate to the exact product. Preserve the product fully in the central 55% of the frame, leaving room for portrait crops. The scene must visibly differ from a plain packshot and other situations in the set.`:`Campaign hero photograph: ${profile.hero} Create a refined editorial set with directional light, dimensional shadows and breathing room. The product is the focal point. Center its important details so the same photograph can be used for a Banner.`;
 return ['Create one photograph for a planned ecommerce image set.',direction,`Shared art direction: ${color[s.tone]}.`,
 `Preserve the exact source product shape, color, logo, packaging, number of pieces, and label text. Product identity stays consistent; the framing, scale, lighting and surrounding environment should serve this shot's purpose. Do not invent a back view or details that the reference does not establish.`,
 `Product identity: ${product.name}. Merchant-supplied facts: ${product.facts}. Do not turn those facts into visible text.`,
 shot.visualGoal?`Visual goal (scene and framing only): ${shot.visualGoal}.`:'',
 'This request is a photograph layer; diagrams, captions and copy will be composed separately. Suitable adult people, hands, clothing, known food ingredients and serving props are allowed when the planned scene calls for them. Do not present props as included accessories. Never invent medical results, unseen product interiors, certificates, unsupported statistics or health transformations. No additional typography or watermarks; preserve existing product marks.'
 ].filter(Boolean).join('\n');
}
export function sceneAssetFor(product:Product){
 if(product.sourceOrigin!=='ai-sample')return undefined;
 const assets:Record<string,string>={'food.png':'/samples/food-scene.png','beauty.png':'/samples/beauty-scene.png','fashion.png':'/samples/fashion-scene.png'};
 return assets[product.sourceName];
}
