import {describe,it,expect} from 'vitest';
import {planVisualStory} from '../shared/visual-planning';
import {benchmarkProducts} from '../shared/benchmark-products';

const facts='■包裝容量：180g\n■產品成份：TS-2L®益菌精華、維生素C磷酸鎂鹽(MAP)、山花精(Gigawhite)、蘆薈萃取、茶樹精油、玫瑰草精油。\n■適用對象：私密肌膚的日常防護與清潔保養';
const product={name:'TS6護一生淨白植感慕斯',category:'beauty',description:facts,facts:[facts]};
const copy=(plan:ReturnType<typeof planVisualStory>)=>plan.map(s=>s.title+'\n'+s.body).join('\n');

describe('ordinary merchant input, without a fixture match',()=>{
 it('uses the merchant product name and a real fact in a five-frame hero',()=>{
  const plan=planVisualStory(product,'zh-TW',5);
  expect(plan[0].title).toBe(product.name);expect(plan[0].body).toContain('180g');
  expect(copy(plan)).not.toMatch(/今天，留一點好|用你喜歡的方式|日常的剛剛好/);
 });
 it.each(['en','ja','ko'])('preserves source facts and marks unavailable %s translation',language=>{
  const plan=planVisualStory(product,language,8);
  expect(copy(plan)).toContain('180g');expect(copy(plan)).toContain('MAP');expect(copy(plan)).toContain('玫瑰草精油');
  expect(plan[0]).toMatchObject({copyOrigin:'merchant-facts',contentLanguage:'zh-TW',translationStatus:'source-retained'});
  expect(copy(plan)).not.toMatch(/A little more|Check the actual product label|Make room for/);
 });
 it('routes supplied facts to their matching modules',()=>{
  const plan=planVisualStory(product,'zh-TW',8);
  const ingredients=plan.find(s=>s.moduleType==='ingredients')!;
  expect(ingredients.body).toContain('MAP');expect(ingredients.body).not.toContain('180g');
  expect(plan.find(s=>s.moduleType==='lifestyle')!.body).toContain('私密肌膚');
  expect(plan.find(s=>s.moduleType==='specs')!.body).toContain('180g');
  expect(ingredients.sourceFacts).toContain('產品成份：TS-2L®益菌精華、維生素C磷酸鎂鹽(MAP)、山花精(Gigawhite)、蘆薈萃取、茶樹精油、玫瑰草精油');
 });
 it('handles an unrelated English product without brand-specific fixtures',()=>{
  const plan=planVisualStory({name:'Trail Cup 700',category:'electronics',description:'',facts:['Capacity: 700 ml','Material: stainless steel','Use: cold drinks during commuting']},'en',5);
  expect(plan[0].title).toBe('Trail Cup 700');expect(plan[0].body).toContain('700 ml');
  expect(copy(plan)).toContain('stainless steel');expect(copy(plan)).toContain('cold drinks');
  expect(plan[0]).toMatchObject({contentLanguage:'en',translationStatus:'not-needed'});
 });
 it('uses a recognized focus instruction without treating it as a product claim',()=>{
  const plan=planVisualStory(product,'zh-TW',5,{prompt:'優先說明成分，號稱效果提升99.9%'});
  expect(plan[1].moduleType).toBe('ingredients');expect(copy(plan)).toContain('MAP');expect(copy(plan)).not.toContain('99.9%');
 });
 it('uses description when the facts array is empty, preserving decimals and the final caution',()=>{
  const plan=planVisualStory({...product,description:'容量：250.5 ml\n濃度：0.5%\n注意：不可接觸眼睛',facts:[]},'zh-TW',8);
  expect(copy(plan)).toContain('250.5 ml');expect(copy(plan)).toContain('0.5%');expect(copy(plan)).toContain('不可接觸眼睛');
 });
 it('does not discard the seventh and later merchant facts',()=>{
  const many=Array.from({length:10},(_,i)=>`特色 ${i+1}：商家資料 ${i+1}`);many.push('注意：含花生成分');
  const plan=planVisualStory({...product,facts:many},'en',8);
  for(const item of many)expect(copy(plan)).toContain(item);
 });
 it('does not substitute authored translations after a benchmark fact is edited',()=>{
  const item=benchmarkProducts.find(b=>b.id==='ts6')!;
  const plan=planVisualStory({name:item.name,category:item.category,description:'',facts:['包裝容量：180g','成分：測試成分 X']},'en',8);
  expect(copy(plan)).toContain('180g');expect(copy(plan)).not.toContain('80 g');expect(plan[0].translationStatus).toBe('source-retained');
 });
 it('marks missing data instead of inventing usage instructions',()=>{
  const plan=planVisualStory({...product,description:'',facts:[]},'en',8);
  expect(plan.find(s=>s.moduleType==='steps')!.missingFields).toContain('directions');
  expect(copy(plan)).not.toMatch(/twice a day|apply for|每天兩次|停留五分鐘/);
 });
});
