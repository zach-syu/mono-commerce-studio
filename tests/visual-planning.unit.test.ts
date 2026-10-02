import {describe,it,expect} from 'vitest';
import {planVisualStory,resizeVisualPlan,reviewVisualPlan,plannerSystemPrompt,planSchema} from '../shared/visual-planning';

const product={name:'AC4221 空氣清淨機',category:'electronics',description:'',facts:['CADR 600 m³/h；睡眠模式 15 dB；Air+ App。']};
describe('category visual planning',()=>{
 it.each([1,3,5,8,12,16])('returns exactly %i editable image plans',count=>{
  const sections=planVisualStory(product,'zh-TW',count);
  expect(sections).toHaveLength(count);expect(new Set(sections.map(s=>s.id)).size).toBe(count);
 });
 it.each([0,17,2.5,NaN])('rejects invalid counts before generation: %s',count=>expect(()=>planVisualStory(product,'zh-TW',count)).toThrow());
 it.each(['food','beauty','fashion','bag','electronics','supplement'])('covers scenes, macro details and diagrams for %s',category=>{
  const sections=planVisualStory({...product,category},'zh-TW',8);
  expect(reviewVisualPlan(sections).issues).toEqual([]);
  expect(sections.filter(s=>s.moduleType==='lifestyle').length).toBeGreaterThanOrEqual(2);
  expect(new Set(sections.filter(s=>s.moduleType==='lifestyle').map(s=>s.visualGoal)).size).toBeGreaterThanOrEqual(2);
 });
 it('uses appliance-specific plans instead of shoe or beauty prompts',()=>{
  const plan=planVisualStory(product,'zh-TW',8);
  expect(plan.map(s=>s.visualGoal).join(' ')).toMatch(/bedroom|living room/i);
  expect(plan.map(s=>s.visualGoal).join(' ')).not.toMatch(/cotton shirt|cream tube/i);
  expect(plan.some(s=>s.moduleType==='mechanism')).toBe(true);
 });
 it('does not invent numerical product specifications',()=>{
  const plan=planVisualStory({...product,facts:[]},'en',8);
  expect(plan.map(s=>s.body).join(' ')).not.toMatch(/99\.9|600|15\s?dB|28\s?(坪|ping)/);
  expect(plan.every(s=>s.title.trim()&&s.body.trim())).toBe(true);
  expect(plan.find(s=>s.moduleType==='specs')?.body).toContain('not been provided');
 });
 it('adapts examples to tea and phones instead of prescribing dumplings or air filtration',()=>{
  const tea=planVisualStory({...product,name:'MORI 焙茶',category:'food'},'zh-TW',8);
  const phone=planVisualStory({...product,name:'智慧型手機',category:'electronics'},'zh-TW',8);
  expect(tea.map(s=>s.visualGoal).join(' ')).not.toMatch(/dumpling/i);
  expect(phone.map(s=>s.visualGoal).join(' ')).not.toMatch(/purifier|filtration|unobstructed intake/i);
 });
 it('preserves edits and deselects extra plans when count shrinks',()=>{
  const all=planVisualStory(product,'zh-TW',8);all[0].title='使用者自己寫的標題';
  const small=resizeVisualPlan(all,planVisualStory(product,'zh-TW',3),3);
  expect(small.filter(s=>s.selected)).toHaveLength(3);expect(small[0].title).toBe('使用者自己寫的標題');expect(small).toHaveLength(8);
 });
 it('expands without duplicating identifiers',()=>{
  const result=resizeVisualPlan(planVisualStory(product,'zh-TW',5),planVisualStory(product,'zh-TW',12),12);
  expect(result.filter(s=>s.selected)).toHaveLength(12);expect(new Set(result.map(s=>s.id)).size).toBe(result.length);
 });
 it('adds the second scene when expanding an old five-frame plan',()=>{
  const result=resizeVisualPlan(planVisualStory(product,'zh-TW',5),planVisualStory(product,'zh-TW',8),8);
  expect(reviewVisualPlan(result).issues).toEqual([]);
 });
 it('uses the requested count consistently in instruction and schema',()=>{
  expect(plannerSystemPrompt(12,'electronics')).toContain('exactly 12');
  const schema=planSchema(12);expect(schema.properties.sections.minItems).toBe(12);expect(schema.properties.sections.maxItems).toBe(12);
  expect(plannerSystemPrompt(12,'electronics')).not.toContain('Return five');
 });
 it('flags repeated packshot plans instead of awarding a quality pass',()=>{
  const plan=planVisualStory(product,'zh-TW',8).map(s=>({...s,moduleType:'hero' as const,visualGoal:'same packshot'}));
  expect(reviewVisualPlan(plan).issues.length).toBeGreaterThan(0);
 });
});
