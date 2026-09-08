import {describe,it,expect,vi,afterEach} from 'vitest';
import {buildStoryboard,buildPhotoPrompt,plannedPhotoCalls,sceneAssetFor,completeSections} from '../src/lib/storyboard';
import {initialSettings} from '../src/lib/types';
import type {Product,CopySection} from '../src/lib/types';
import {generateArtifacts} from '../src/lib/render';
import {planCopy} from '../src/lib/api';

const product:Product={id:'p1',name:'SORA 日常精華',category:'beauty',facts:'容量：30 mL\n成分：未提供',sourceDataUrl:'data:image/png;base64,test',sourceName:'custom.png',sourceWidth:1000,sourceHeight:1000,sourceOrigin:'uploaded'};
const sections:CopySection[]=['hero','benefits','detail','lifestyle','specs'].map((role,index)=>({id:String(index),title:'Edited '+role,body:'KEEP MY EDITED COPY '+role,selected:true,role:role as CopySection['role']}));
afterEach(()=>vi.unstubAllGlobals());
describe('purpose-driven storyboards',()=>{
 it('never replaces an uploaded product with a scene from another sample',()=>{expect(sceneAssetFor({...product,sourceName:'beauty.png',sourceOrigin:'uploaded'})).toBeUndefined();});
 it('adds missing roles without replacing existing copy or reusing ids',()=>{const original=[{...sections[0],id:'added-detail',title:'MY TITLE'},{...sections[4]}];const result=completeSections(original,sections);expect(result.find(s=>s.id==='added-detail')!.title).toBe('MY TITLE');expect(new Set(result.map(s=>s.id)).size).toBe(result.length);expect(result).toHaveLength(5);});
 it('plans five visibly different modules and preserves every selected copy edit',()=>{
  const plans=buildStoryboard(product,{...initialSettings,outputs:['detail']},sections);
  expect(new Set(plans.map(p=>p.template)).size).toBe(5);
  expect(plans.map(p=>p.section.body)).toEqual(sections.map(s=>s.body));
  expect(plans.map(p=>p.role)).toEqual(['hero','benefits','detail','lifestyle','specs']);
 });
 it('never pays to remake the source packshot, crop details or specification table',()=>{
  const settings={...initialSettings,mode:'live' as const,outputs:['main','banner','detail'] as const};
  const plans=buildStoryboard(product,{...settings,outputs:[...settings.outputs]},sections);
  expect(plans.filter(p=>p.needsNewPhoto).map(p=>p.role)).toEqual(['hero','hero','lifestyle']);
  expect(plannedPhotoCalls(plans,{...settings,outputs:[...settings.outputs]})).toBe(2);
  expect(plannedPhotoCalls(plans,initialSettings)).toBe(0);
 });
 it('gives hero and lifestyle genuinely different photographic directions without baking copy into photos',()=>{
  const plans=buildStoryboard(product,{...initialSettings,outputs:['detail']},sections);
  const hero=buildPhotoPrompt(product,initialSettings,plans[0]);const scene=buildPhotoPrompt(product,initialSettings,plans[3]);
  expect(hero).not.toBe(scene);expect(hero).toContain('hero');expect(scene).toContain('bathroom');
  expect(hero).not.toContain('KEEP MY EDITED COPY');expect(scene).not.toContain('KEEP MY EDITED COPY');
  expect(hero).not.toContain('Keep the SAME camera angle');
 });
 it('requires explicit paid confirmation before any image request or canvas work',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  await expect(generateArtifacts(product,{...initialSettings,mode:'live',outputs:['detail']},sections,()=>{},new AbortController().signal)).rejects.toThrow('付費');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('creates a complete editable free plan without an HTTP call',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  const result=await planCopy(product,initialSettings);
  expect(result.provider).toBe('demo');expect(result.sections).toHaveLength(8);
  expect(new Set(result.sections.map(s=>s.role)).size).toBe(5);expect(fetcher).not.toHaveBeenCalled();
 });
});
