import { openDB } from 'idb';
import type { Draft, SavedProject } from './types';
const database=openDB('mono-studio',1,{upgrade(db){db.createObjectStore('drafts');db.createObjectStore('projects',{keyPath:'id'});}});
export async function saveDraft(draft:Draft){return (await database).put('drafts',structuredClone(draft),'current');}
export async function readDraft():Promise<Draft|undefined>{return (await database).get('drafts','current');}
export async function saveProject(project:SavedProject){return (await database).put('projects',structuredClone({...project,artifacts:project.artifacts.map(a=>({...a,previewUrl:undefined}))}));}
export async function readProjects():Promise<SavedProject[]>{const values=await (await database).getAll('projects');return values.sort((a,b)=>b.savedAt.localeCompare(a.savedAt));}
