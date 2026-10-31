import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),temp=fs.mkdtempSync(path.join(os.tmpdir(),'autofeeds-phase6-')),dataDir=path.join(temp,'data');
const log=fs.openSync(path.join(temp,'server.log'),'w'),port=Number(process.env.PHASE6_TEST_PORT||3066),base=`http://127.0.0.1:${port}`;
let server,browser,completed=false;const documents=[],posters=[],images=[];
const digest=b=>createHash('sha256').update(b).digest('hex');
async function start(){server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{stdio:['ignore',log,log],env:{...process.env,AUTOFEEDS_DATA_DIR:dataDir}});for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error(fs.readFileSync(path.join(temp,'server.log'),'utf8'));try{if((await fetch(base+'/api/designs')).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Server unavailable');}
async function stop(){if(server&&server.exitCode===null){const end=once(server,'exit');server.kill();await end;}}
async function api(url,body,expected=200,method='POST'){const response=await fetch(base+url,body===undefined?undefined:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,expected,`${url}: ${await response.clone().text()}`);return response.json();}
try{
 const fixture=path.join(temp,'photo.png');const prepared=spawnSync('python',['-c',`from PIL import Image,ImageDraw
import sys
im=Image.new('RGBA',(400,500),(0,0,0,0));d=ImageDraw.Draw(im);d.rounded_rectangle((90,50,310,450),radius=20,fill='#d62638');d.rectangle((95,190,305,300),fill='yellow');im.save(sys.argv[1])`,fixture]);assert.equal(prepared.status,0,prepared.stderr.toString());
 await start();assert.equal((await fetch(base+'/editor')).status,200);
 const form=new FormData();form.append('file',new Blob([fs.readFileSync(fixture)],{type:'image/png'}),'phase6.png');const uploaded=await fetch(base+'/api/images',{method:'POST',body:form});assert.equal(uploaded.status,201);const {id:imageId}=await uploaded.json();images.push(imageId);
 const original=digest(Buffer.from(await(await fetch(base+`/api/image-file?id=${imageId}`)).arrayBuffer()));
 let first,firstPoster;
 for(const [index,style]of ['premium','flash','frozen','editorial','retail','spotlight'].entries()){
  const bundle=index===5;const item={image_id:imageId,name:'Nugget Ayam Original 500 gram',price:'24799',old_price:'30999'};
  const promo=await api('/api/promo',{count:1,format:['feed','square','story','landscape'][index%4],theme:'merah',style,promo_type:bundle?'bundling':'harga_spesial',bundle_price:'40000',title:'PROMO AKHIR PEKAN',subtitle:'Berlaku 1–7 November',footer:'ANTOFROZEN • Pesan via WhatsApp',badge:'PROMO',items:bundle?[item,item]:[item]},201);posters.push(promo.id);
  const editor=await api('/api/designs',{promo_id:promo.id},201);documents.push(editor.id);
  assert.ok(editor.doc.layers.filter(l=>l.kind==='image').length>=3);assert.ok(editor.doc.layers.some(l=>l.kind==='rect'));
  assert.ok(editor.doc.layers.some(l=>l.kind==='text'&&l.text===(bundle?'Rp40.000':'Rp24.799')));
  assert.ok(editor.doc.layers.every(l=>l.kind!=='image'||l.assetId));
  const fetched=await api(`/api/designs?id=${editor.id}`);assert.deepEqual(fetched.doc,editor.doc);
  if(!first){first=editor;firstPoster=promo.id;}
 }
 const copied=await api('/api/designs',{copy_id:first.id},201);documents.push(copied.id);assert.notEqual(copied.doc.layers[0].assetId,first.doc.layers[0].assetId);
 const blank=await api('/api/designs',{format:'square'},201);documents.push(blank.id);
 const foreign=first.doc.layers.find(l=>l.kind==='image').assetId;
 await api('/api/designs',{id:blank.id,revision:1,doc:{...blank.doc,layers:[...blank.doc.layers,{...first.doc.layers[0],assetId:foreign}]}},400,'PATCH');
 assert.equal((await fetch(base+`/api/design-assets?design_id=${blank.id}&asset_id=${foreign}`)).status,404);
 const price=first.doc.layers.find(l=>l.text==='Rp24.799'),edited=structuredClone(first.doc);edited.layers.find(l=>l.id===price.id).text='Rp22.500';
 const saved=await api('/api/designs',{id:first.id,revision:1,doc:edited},200,'PATCH');assert.equal(saved.revision,2);
 await api('/api/designs',{id:first.id,revision:1,doc:first.doc},409,'PATCH');
 const malicious=structuredClone(edited);malicious.layers[0].assetId='https://evil.example/file.png';await api('/api/designs',{id:first.id,revision:2,doc:malicious},400,'PATCH');
 const imported=await api('/api/design-assets',{design_id:first.id,image_id:imageId},201);
 assert.equal((await fetch(base+`/api/design-assets?design_id=${first.id}&asset_id=${imported.asset.id}`)).status,200);
 const jpgBefore=digest(Buffer.from(await(await fetch(base+`/api/promo-file?id=${firstPoster}`)).arrayBuffer()));
 await stop();await start();assert.equal((await api(`/api/designs?id=${first.id}`)).doc.layers.find(l=>l.id===price.id).text,'Rp22.500');
 console.log('PASS: all six poster concepts converted to real layers, four formats, bundle price, CRUD, immutable source poster, asset ownership and revision conflict.');
 if(process.env.PHASE6_UI==='1'){
  const {chromium}=require('playwright');let executablePath=process.env.PHASE6_CHROMIUM||chromium.executablePath(),args=['--no-sandbox'];
  if(process.env.PHASE6_BROWSER_MODULE){const portable=(await import(process.env.PHASE6_BROWSER_MODULE)).default;executablePath=await portable.executablePath();args=portable.args;}
  browser=await chromium.launch({executablePath,args,headless:true});const page=await browser.newPage({viewport:{width:1600,height:1200},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base+`/editor?id=${first.id}`);await page.getByLabel('Nama desain',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Rp24.799',exact:true}).click();assert.equal(await page.getByLabel('Isi teks',{exact:true}).inputValue(),'Rp22.500');
  await page.getByLabel('Isi teks',{exact:true}).fill('Rp21.000');await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await page.getByLabel('Isi teks',{exact:true}).inputValue(),'Rp22.500');await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await page.getByLabel('Isi teks',{exact:true}).inputValue(),'Rp21.000');
  const previousX=Number(await page.getByLabel('x',{exact:true}).inputValue());const element=page.locator(`g[data-layer-id="${price.id}"]`);await element.scrollIntoViewIfNeeded();const rect=await element.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+15,rect.y+rect.height/2+3,{steps:4});await page.mouse.up();assert.notEqual(Number(await page.getByLabel('x',{exact:true}).inputValue()),previousX);
  await page.getByRole('button',{name:/^Foto produk:/}).click();
  const imageRatio=Number(await page.getByLabel('width',{exact:true}).inputValue())/Number(await page.getByLabel('height',{exact:true}).inputValue());
  const resize=page.locator('[data-mode="resize"]');await resize.scrollIntoViewIfNeeded();const handle=await resize.boundingBox();
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+15,handle.y+handle.height/2+15,{steps:4});await page.mouse.up();
  const resizedRatio=Number(await page.getByLabel('width',{exact:true}).inputValue())/Number(await page.getByLabel('height',{exact:true}).inputValue());assert.ok(Math.abs(imageRatio-resizedRatio)<.02);
  await page.getByLabel('rotation',{exact:true}).fill('12');assert.equal(Number(await page.getByLabel('rotation',{exact:true}).inputValue()),12);
  const rotate=page.locator('[data-mode="rotate"]');await rotate.scrollIntoViewIfNeeded();const circle=await rotate.boundingBox();
  await page.mouse.move(circle.x+circle.width/2,circle.y+circle.height/2);await page.mouse.down();await page.mouse.move(circle.x+circle.width/2+20,circle.y+circle.height/2+10,{steps:4});await page.mouse.up();assert.notEqual(Number(await page.getByLabel('rotation',{exact:true}).inputValue()),12);
  await page.getByRole('button',{name:'Rp24.799',exact:true}).click();
  await page.getByRole('button',{name:'Duplikat',exact:true}).click();await page.getByRole('button',{name:'Hapus layer',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();
  await page.getByRole('button',{name:/^Simpan/}).click();await page.getByRole('status').filter({hasText:'Perubahan tersimpan'}).waitFor();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh JPG',exact:true}).click();const jpg=await download;const file=await jpg.path();const check=spawnSync('python',['-c','from PIL import Image;import sys;im=Image.open(sys.argv[1]);assert im.size==(1080,1350);print(im.format)',file]);assert.equal(check.status,0,check.stderr.toString());
  const svgDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh SVG',exact:true}).click();const svg=await svgDownload;const svgText=fs.readFileSync(await svg.path(),'utf8');assert.ok(svgText.includes('data:image/png;base64,'));assert.ok(svgText.includes('Rp21.000'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/autofeeds-phase6-desktop.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().right<=0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/autofeeds-phase6-mobile.png',fullPage:true,animations:'disabled'});assert.deepEqual(errors,[]);
  console.log('PASS browser: price editing, undo/redo, pointer drag, duplicate/delete, save, JPG dimensions, self-contained SVG and desktop/mobile overflow.');await browser.close();browser=undefined;
 }
 assert.equal(digest(Buffer.from(await(await fetch(base+`/api/promo-file?id=${firstPoster}`)).arrayBuffer())),jpgBefore);
 assert.equal(digest(Buffer.from(await(await fetch(base+`/api/image-file?id=${imageId}`)).arrayBuffer())),original);
 await api(`/api/images?id=${imageId}`,{},200,'DELETE');await api(`/api/promo?id=${firstPoster}`,{},200,'DELETE');
 const restored=await api(`/api/designs?id=${first.id}`);for(const l of restored.doc.layers.filter(l=>l.kind==='image'))assert.equal((await fetch(base+`/api/design-assets?design_id=${first.id}&asset_id=${l.assetId}`)).status,200);
 const savedAgain=await api('/api/designs',{id:first.id,revision:restored.revision,doc:restored.doc},200,'PATCH');assert.ok(savedAgain.revision>2);
 await api(`/api/designs?id=${blank.id}`,{},200,'DELETE');assert.equal((await fetch(base+`/api/designs?id=${blank.id}`)).status,404);
 console.log('PASS: restart persistence, original photo unchanged, editor assets survive deleting source image and source poster.');completed=true;
}finally{
 if(!completed)console.error(fs.readFileSync(path.join(temp,'server.log'),'utf8'));
 await browser?.close();if(server?.exitCode===null){for(const id of documents)await fetch(base+`/api/designs?id=${id}`,{method:'DELETE'}).catch(()=>{});for(const id of posters)await fetch(base+`/api/promo?id=${id}`,{method:'DELETE'}).catch(()=>{});for(const id of images)await fetch(base+`/api/images?id=${id}`,{method:'DELETE'}).catch(()=>{});}await stop();fs.closeSync(log);fs.rmSync(temp,{recursive:true,force:true});
}
