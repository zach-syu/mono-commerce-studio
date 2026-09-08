import {resolveMerchantFacts,copyFromMerchantFacts} from './merchant-facts.ts';
export type ProductBrief = { name: string; category: string; description: string; facts: string[] };
export function demoCopy(product:ProductBrief,language:string){
 const context=resolveMerchantFacts(product,language);
 return (['hero','benefits','detail','lifestyle','specs'] as const).map(role=>({id:role,role,...copyFromMerchantFacts(context,role),visualGoal:'Use the merchant-supplied facts for this '+role+' frame; preserve the source product and mark unknowns.',selected:true}));
}
