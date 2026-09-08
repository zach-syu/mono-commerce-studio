#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

// Run only after the report and all E2E writers have finished. Inputs are snapshotted and rechecked.
const args=process.argv.slice(2);
function argument(name,fallback){const i=args.indexOf(name);return i<0?fallback:args[i+1];}
const root=path.resolve(argument('--root',path.join(path.dirname(fileURLToPath(import.meta.url)),'..')));
const maxMiB=Number(argument('--max-zip-mb','90'));
if(!Number.isFinite(maxMiB)||maxMiB<=0||maxMiB>90)throw new Error('--max-zip-mb must be greater than 0 and at most 90.');
const limit=Math.floor(maxMiB*1024*1024);
const outputRoot=path.join(root,'public/report');
const mediaPattern=/\.(png|jpe?g|webp|gif|avif|webm|mp4|mov)$/i;
const imagePattern=/\.(png|jpe?g|webp|gif|avif)$/i;
const includedFolders=new Set(['outputs','source','raw-ai','model-responses']);
const includedMetadata=new Set(['evidence.json','manifest.json','copy.txt','detail-page.html','copy-model-response.json']);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const relative=file=>path.relative(root,file).split(path.sep).join('/');
const records=[];const excluded=[];const caseSummaries=[];const snapshots=new Map();

function safePath(base,relativePath){
 if(typeof relativePath!=='string'||!relativePath||relativePath.includes('\\')||path.isAbsolute(relativePath)||relativePath.split('/').some(part=>part==='..'||part===''))throw new Error(`Unsafe reference path: ${relativePath}`);
 const resolved=path.resolve(base,relativePath);if(!resolved.startsWith(path.resolve(base)+path.sep))throw new Error(`Reference escapes its directory: ${relativePath}`);return resolved;
}
async function walk(directory){
 const files=[];
 for(const entry of (await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  const file=path.join(directory,entry.name);if(entry.isSymbolicLink())throw new Error(`Symbolic links are not packaged: ${relative(file)}`);
  if(entry.isDirectory())files.push(...await walk(file));else if(entry.isFile())files.push(file);
 }
 return files;
}
async function readStable(file){
 const before=await fs.stat(file);const bytes=await fs.readFile(file);const after=await fs.stat(file);
 if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||bytes.length!==before.size)throw new Error(`Input changed during packaging: ${relative(file)}`);
 snapshots.set(file,{size:before.size,mtimeMs:before.mtimeMs});return bytes;
}
function categoryOf(value){return ['food','beauty','fashion'].includes(value)?value:'common';}
async function include(file,archivePath,context){
 if(records.some(record=>record.path===archivePath))throw new Error(`Duplicate archive path: ${archivePath}`);
 const bytes=await readStable(file);
 if(mediaPattern.test(file)&&!bytes.length)throw new Error(`Empty media file: ${relative(file)}`);
 if(file.endsWith('.png')&&(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))))throw new Error(`Invalid PNG header: ${relative(file)}`);
 records.push({path:archivePath,source:relative(file),bytes:bytes.length,sha256:hash(bytes),...context,_bytes:bytes});
}

const evidenceRoot=path.join(root,'artifacts/e2e');
for(const entry of (await fs.readdir(evidenceRoot,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
 if(!entry.isDirectory())continue;
 const caseRoot=path.join(evidenceRoot,entry.name);const files=await walk(caseRoot);
 if(!files.includes(path.join(caseRoot,'evidence.json')))throw new Error(`Case has no completed evidence.json: ${entry.name}. Wait until tests finish.`);
 const evidence=JSON.parse((await readStable(path.join(caseRoot,'evidence.json'))).toString('utf8'));
 const category=categoryOf(evidence.category??evidence.manifest?.product?.category);
 caseSummaries.push({id:entry.name,category,status:evidence.status??'not-recorded',mode:evidence.mode??'not-recorded',startedAt:evidence.startedAt??null});
 for(const file of files){
  const local=path.relative(caseRoot,file).split(path.sep).join('/');const segments=local.split('/');
  if(file.endsWith('.zip')){excluded.push({path:relative(file),reason:'Nested ZIP duplicates the extracted case contents.'});continue;}
  if(!segments.some(segment=>includedFolders.has(segment))&&!includedMetadata.has(path.basename(file))){excluded.push({path:relative(file),reason:'UI screenshot or other test scaffolding; retained in the HTML report.'});continue;}
  await include(file,`cases/${entry.name}/${local}`,{category,caseId:entry.name,role:segments.includes('outputs')?'output':segments.includes('raw-ai')?'raw-ai':segments.includes('model-responses')?'model-response':segments.includes('source')?'source':'case-metadata',mode:evidence.mode??'not-recorded'});
 }
 // Every file explicitly promised by the current case manifest must exist in the archive.
 for(const output of evidence.outputs??evidence.manifest?.outputs??[]){
  if(!output.file)continue;safePath(caseRoot,output.file);
  if(!records.some(record=>record.path===`cases/${entry.name}/${output.file}`))throw new Error(`Missing declared output: ${entry.name}/${output.file}`);
 }
 if(evidence.source?.file){safePath(caseRoot,evidence.source.file);if(!records.some(record=>record.path===`cases/${entry.name}/${evidence.source.file}`))throw new Error(`Missing original source: ${entry.name}`);}
}

const provenancePath=path.join(root,'docs/sample-provenance.json');
const provenance=JSON.parse((await readStable(provenancePath)).toString('utf8'));
for(const sample of provenance.records??[]){
 const file=safePath(root,sample.path);
 if(!sample.path.startsWith('public/samples/'))throw new Error(`Unexpected sample location: ${sample.path}`);
 await include(file,`samples/${sample.path.slice('public/samples/'.length)}`,{category:categoryOf(sample.category),caseId:null,role:sample.role??'sample',mode:'prepared-with-imagegen',sampleStatus:sample.status??'not-recorded'});
 const added=records.at(-1);if(sample.sha256&&sample.sha256!==added.sha256)throw new Error(`Sample hash no longer matches provenance: ${sample.path}`);
}
await include(provenancePath,'samples/sample-provenance.json',{category:'common',caseId:null,role:'sample-provenance',mode:'prepared-with-imagegen'});
if(!records.length)throw new Error('No output files were found.');
const publicRecords=records.map(({_bytes,...record})=>record);
const generatedAt=new Date().toISOString();
const assetManifest={schemaVersion:1,generatedAt,payloadFileCount:records.length,imageCount:records.filter(record=>imagePattern.test(record.path)).length,videoCount:records.filter(record=>/\.(webm|mp4|mov)$/i.test(record.path)).length,sourceBytes:records.reduce((total,record)=>total+record.bytes,0),cases:caseSummaries,files:publicRecords,excluded};
const readme=`MONO 完整素材包\n\n這些檔案來自已留下 evidence.json 的 E2E 案例與示範素材來源紀錄。\n\n- cases/<案例>/outputs：App 最終成品。\n- cases/<案例>/raw-ai 與 model-responses：有保留時，為模型原始回傳圖片。\n- cases/<案例>/source：來源商品照片。\n- 每個案例的 copy.txt、manifest.json、detail-page.html：完整文案、設定、生成指令与詳情頁。\n- samples：開發期間預先產生的 7 張示範圖；來源與模型限制見 sample-provenance.json。\n- asset-manifest.json：每個資料檔的大小與 SHA-256，可確認完整性；不代表商品正確性或模型品質已通過人工驗收。\n\n若是分包，請下載 package-index.json 列出的所有分包，解壓到同一個資料夾，再開啟詳情頁。資料路徑保持原本案例關係。\nUI 操作截圖留在 HTML 測試報告；每案例 bundle.zip 的內容已解壓納入，本包不重複嵌入 ZIP。\n示範組版、開發期 AI 素材與真實模型呼叫必須依各自的 provider/model/證據判讀。\n`;
const archives=[];const pendingWrites=[];
function estimate(entries){return entries.reduce((sum,entry)=>sum+entry.bytes+Buffer.byteLength(entry.path)*2+512,0)+Buffer.byteLength(JSON.stringify(entries.map(({_bytes,...entry})=>entry)))+Buffer.byteLength(readme)+4096;}
async function buildArchive(file,entries,role,category=null,part=null,extra={}){
 const zip=new JSZip();
 for(const entry of entries)zip.file(entry.path,entry._bytes,{compression:mediaPattern.test(entry.path)?'STORE':'DEFLATE',compressionOptions:{level:6}});
 const manifest=role==='index'||role==='all'?assetManifest:{...assetManifest,files:entries.map(({_bytes,...entry})=>entry),payloadFileCount:entries.length,archiveCategory:category,archivePart:part};
 zip.file('asset-manifest.json',JSON.stringify(manifest,null,2),{compression:'DEFLATE'});zip.file('README.txt',readme,{compression:'DEFLATE'});
 for(const [name,value]of Object.entries(extra))zip.file(name,JSON.stringify(value,null,2),{compression:'DEFLATE'});
 const bytes=await zip.generateAsync({type:'nodebuffer',streamFiles:true,compression:'STORE'});
 if(bytes.length>limit)throw new Error(`${file} exceeds ${maxMiB} MiB. A single case/file may need a smaller per-case export; no files were omitted.`);
 // Reopen the exact archive bytes, validate ZIP CRCs, then hash every payload after decompression.
 const reopened=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const expectedCount=entries.length+2+Object.keys(extra).length;
 if(Object.values(reopened.files).filter(item=>!item.dir).length!==expectedCount)throw new Error(`Archive entry count mismatch: ${file}`);
 for(const entry of entries){const actual=await reopened.file(entry.path)?.async('nodebuffer');if(!actual||actual.length!==entry.bytes||hash(actual)!==entry.sha256)throw new Error(`Archive payload mismatch: ${file}/${entry.path}`);}
 JSON.parse(await reopened.file('asset-manifest.json').async('string'));
 archives.push({file,role,category,part,bytes:bytes.length,sha256:hash(bytes),payloadFileCount:entries.length,imageCount:entries.filter(entry=>imagePattern.test(entry.path)).length,verified:true});
 const temporary=path.join(outputRoot,`.${file}.packaging`);await fs.writeFile(temporary,bytes);pendingWrites.push({temporary,destination:path.join(outputRoot,file)});
}

await fs.mkdir(outputRoot,{recursive:true});
try{
 if(estimate(records)<=limit){await buildArchive('all-outputs.zip',records,'all');}
 else{
  for(const category of ['food','beauty','fashion','common']){
   const selected=records.filter(record=>record.category===category);if(!selected.length)continue;
   const groups=new Map();for(const record of selected){const key=record.caseId??'samples';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record);}
   const chunks=[];let chunk=[];
   for(const group of groups.values()){
    const groupsToAdd=estimate(group)>limit?group.map(file=>[file]):[group];
    for(const item of groupsToAdd){if(estimate(item)>limit)throw new Error(`One file exceeds archive limit: ${item[0].path}. No files were omitted.`);if(chunk.length&&estimate([...chunk,...item])>limit){chunks.push(chunk);chunk=[];}chunk.push(...item);}
   }
   if(chunk.length)chunks.push(chunk);
   for(let i=0;i<chunks.length;i++)await buildArchive(`all-outputs-${category}${chunks.length>1?`-${String(i+1).padStart(2,'0')}`:''}.zip`,chunks[i],'category',category,i+1);
  }
  await buildArchive('all-outputs.zip',[],'index',null,null,{'package-index.json':{schemaVersion:1,generatedAt,mode:'split',message:'Download every listed archive and extract them into one directory.',archives:[...archives]}});
 }
 for(const [file,snapshot]of snapshots){const current=await fs.stat(file);if(current.size!==snapshot.size||current.mtimeMs!==snapshot.mtimeMs)throw new Error(`Input changed before package completion: ${relative(file)}. Wait for E2E/report writers to finish.`);}
 for(const write of pendingWrites)await fs.rename(write.temporary,write.destination);
 const summary={schemaVersion:1,generatedAt,mode:archives.some(archive=>archive.role==='index')?'split':'single',rootZip:'all-outputs.zip',maxArchiveMiB:maxMiB,payloadFileCount:assetManifest.payloadFileCount,imageCount:assetManifest.imageCount,videoCount:assetManifest.videoCount,sourceBytes:assetManifest.sourceBytes,archives,excludedFileCount:excluded.length};
 await fs.writeFile(path.join(outputRoot,'asset-packages.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify(summary,null,2));
}catch(error){for(const write of pendingWrites)await fs.rm(write.temporary,{force:true});throw error;}
