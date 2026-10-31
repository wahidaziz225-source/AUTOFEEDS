import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),temp=fs.mkdtempSync(path.join(os.tmpdir(),'autofeeds-phase7-')),dataDir=path.join(temp,'data');
const port=Number(process.env.PHASE7_TEST_PORT||3067),base=`http://127.0.0.1:${port}`,log=fs.openSync(path.join(temp,'server.log'),'w');
let server,browser,complete=false,responseMode='normal';const prompts=[];
const stub=createServer(async(req,res)=>{if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);prompts.push(body.prompt);res.setHeader('Content-Type','application/json');if(responseMode==='error'){res.statusCode=500;res.end(JSON.stringify({error:'fixture unavailable'}));return;}res.end(JSON.stringify({response:responseMode==='empty'?'':body.format==='json'?JSON.stringify({description:'Nugget dalam kemasan',objects:['nugget'],dominant_colors:['merah'],visible_text:[],context:'produk'}):'Friendly product caption: Rp25.000. Unknown price Rp99.000.'}));}else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({models:[{name:'fixture-model'}]}));}});
async function start(){server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{stdio:['ignore',log,log],env:{...process.env,AUTOFEEDS_DATA_DIR:dataDir}});for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error(fs.readFileSync(path.join(temp,'server.log'),'utf8'));try{if((await fetch(base+'/api/brand-kits')).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Server unavailable');}
async function stop(){if(server&&server.exitCode===null){const end=once(server,'exit');server.kill();await end;}}
async function api(url,body,status=200,method='POST'){const r=await fetch(base+url,body===undefined?undefined:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,`${url}: ${await r.clone().text()}`);return r.json();}
async function upload(file){const form=new FormData();form.append('file',new Blob([fs.readFileSync(path.join(temp,file))],{type:'image/png'}),file);const r=await fetch(base+'/api/images',{method:'POST',body:form});assert.equal(r.status,201);return (await r.json()).id;}
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
try{
 await new Promise(resolve=>stub.listen(0,'127.0.0.1',resolve));const stubPort=stub.address().port;
 const fixture=spawnSync('python',['-c',`from PIL import Image,ImageDraw
from pathlib import Path
import sys
p=Path(sys.argv[1]);im=Image.new('RGBA',(400,500),(0,0,0,0));ImageDraw.Draw(im).rectangle((90,50,310,450),fill='#d62638');im.save(p/'phase7.png');Image.new('RGBA',(300,100),'#1d4ed8').save(p/'logo.png')`,temp]);assert.equal(fixture.status,0,fixture.stderr.toString());
 await start();await api('/api/settings',{settings:{ollama_url:`http://127.0.0.1:${stubPort}`,text_model:'fixture-model',default_language:'en'}},200,'PUT');
 const imageId=await upload('phase7.png'),logoId=await upload('logo.png');
 const values={name:'BRAND A',primary_color:'#1d4ed8',secondary_color:'#172554',accent_color:'#fde047',font_family:'Arial',footer_text:'Footer A - hubungi toko',voice:'Ramah dan jelas A',promo_style:'retail',promo_format:'feed',promo_title:'PROMO BRAND A',promo_badge:'PROMO',tone:'friendly',language:'en',is_default:true,logo_image_id:logoId};
 const {kit:a}=await api('/api/brand-kits',values,201);assert.equal((await api('/api/brand-kits')).kits.length,1);
 const logoHash=hash(Buffer.from(await(await fetch(base+`/api/brand-logo?id=${a.logo_asset_id}`)).arrayBuffer()));
 const promoBody={count:1,format:'feed',theme:'merah',style:'retail',brand_kit_id:a.id,promo_type:'harga_spesial',items:[{image_id:imageId,name:'Nugget 500 gram',price:'24799',old_price:'30999'}]};
 const firstPromo=await api('/api/promo',promoBody,201),firstEditor=await api('/api/designs',{promo_id:firstPromo.id},201);
 assert.ok(firstEditor.doc.layers.some(l=>l.brandRole==='logo'&&l.kind==='image'));assert.ok(firstEditor.doc.layers.some(l=>l.text===values.footer_text));assert.ok(firstEditor.doc.layers.some(l=>l.text==='Rp24.799'));
 const generated=await api('/api/content',{image_id:imageId,content_type:'education',tone:'hard_selling',brand_kit_id:a.id,manual_facts:{description:'Nugget ayam 500 gram'},extra:'Harga Rp25.000'},201);
 assert.equal(generated.content.language,'en');assert.equal(generated.content.brand_name,'BRAND A');assert.ok(generated.content.content.includes('Rp25.000'));assert.ok(generated.content.content.includes('[isi harga]'));
 assert.ok(prompts.at(-1).includes('English'));assert.ok(prompts.at(-1).includes('jangan menciptakan'));assert.ok(prompts.at(-1).includes('Ramah dan jelas A'));
 await api('/api/content',{id:generated.content.id,is_saved:true},200,'PATCH');assert.ok((await api('/api/content?saved=1')).contents.some(c=>c.id===generated.content.id));
 const {kit:b}=await api('/api/brand-kits',{...values,name:'BRAND B',primary_color:'#dc2626',secondary_color:'#7f1d1d',footer_text:'Footer B - pesan sekarang',voice:'Gaya B',logo_image_id:null,language:'id'},201);
 const kits=(await api('/api/brand-kits')).kits;assert.equal(kits.filter(k=>k.is_default).length,1);assert.equal(kits.find(k=>k.is_default).id,b.id);
 await api('/api/brand-kits',{...a,name:'STALE'},409,'PATCH');
 const currentA=kits.find(k=>k.id===a.id);await api('/api/brand-kits',{...currentA,name:'BRAND A CHANGED',footer_text:'Footer A CHANGED',voice:'Gaya A CHANGED'},200,'PATCH');
 const repeated=await api('/api/content',{source_content_id:generated.content.id,language:'id',extra:'Rp100.000'},201);assert.equal(repeated.content.brand_name,'BRAND A');assert.equal(repeated.content.language,'en');assert.ok(prompts.at(-1).includes('Ramah dan jelas A'));assert.ok(!prompts.at(-1).includes('Gaya A CHANGED'));
 const applied=await api('/api/design-brand',{design_id:firstEditor.id,revision:1,doc:firstEditor.doc,brand_kit_id:b.id});assert.ok(applied.doc.layers.some(l=>l.text==='Rp24.799'));assert.ok(applied.doc.layers.some(l=>l.text===b.footer_text));
 await api('/api/designs',{id:firstEditor.id,revision:1,doc:applied.doc},200,'PATCH');await api('/api/design-brand',{design_id:firstEditor.id,revision:1,doc:applied.doc,brand_kit_id:b.id},409);
 const template=await api('/api/brand-templates',{brand_id:a.id,design_id:firstEditor.id,name:'Template Brand'},201);assert.equal((await api('/api/brand-templates')).templates.length,1);
 const used=await api('/api/brand-templates',{use_id:template.id},201);assert.notEqual(used.doc.layers.find(l=>l.kind==='image')?.assetId,template.doc.layers.find(l=>l.kind==='image')?.assetId);
 await api('/api/brand-kits',{...values,name:'BAD',primary_color:'red'},400);
 await api('/api/content',{image_id:imageId,content_type:'cta',tone:'friendly',language:'xx',manual_facts:{description:'Produk'}},400);
 await api('/api/content',{image_id:imageId,content_type:'cta',tone:'friendly',manual_facts:{description:''}},400);
 responseMode='empty';await api('/api/content',{source_content_id:generated.content.id},502);responseMode='error';await api('/api/content',{source_content_id:generated.content.id},500);responseMode='normal';
 if(process.env.PHASE7_UI==='1'){
  const {chromium}=require('playwright');let executablePath=process.env.PHASE7_CHROMIUM||chromium.executablePath(),args=['--no-sandbox'];
  if(process.env.PHASE7_BROWSER_MODULE){const portable=(await import(process.env.PHASE7_BROWSER_MODULE)).default;executablePath=await portable.executablePath();args=portable.args;}
  browser=await chromium.launch({executablePath,args,headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base+'/brand-kit');await page.getByRole('button',{name:/BRAND B/}).click();assert.equal(await page.getByLabel('Nama brand',{exact:true}).inputValue(),'BRAND B');
  await page.getByLabel('Panduan gaya bahasa',{exact:true}).fill('Ramah dan jelas untuk browser test');await page.getByRole('button',{name:'Simpan Brand Kit',exact:true}).click();await page.getByRole('status').filter({hasText:'Brand Kit tersimpan'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/autofeeds-phase7-brand-desktop.png',fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Gunakan template',exact:true}).click();await page.getByLabel('Nama desain',{exact:true}).waitFor();await page.getByLabel('Brand Kit editor',{exact:true}).selectOption(String(b.id));await page.getByRole('button',{name:'Terapkan Brand Kit',exact:true}).click();await page.getByRole('status').filter({hasText:'Brand diterapkan'}).waitFor();assert.ok((await page.locator('[data-layer-id] text').allTextContents()).includes('Rp24.799'));await page.getByRole('button',{name:/^Simpan/}).click();await page.getByRole('status').filter({hasText:'Perubahan tersimpan'}).waitFor();
  await page.goto(base+'/promo');await page.getByLabel('Brand Kit',{exact:true}).locator(`option[value="${b.id}"]`).waitFor({state:'attached'});assert.equal(await page.getByLabel('Brand Kit',{exact:true}).inputValue(),String(b.id));
  await page.goto(base+'/content-studio');await page.getByRole('button',{name:'phase7.png'}).click();await page.getByLabel('Deskripsi',{exact:true}).fill('Nugget ayam 500 gram, informasi dari pemilik');await page.getByPlaceholder(/Contoh: Nugget Ayam/).fill('Harga Rp25.000');await page.getByLabel('Bahasa hasil',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Call to Action',exact:true}).click();await page.getByRole('button',{name:'Buat konten',exact:true}).click();
  const firstResult=page.locator('[data-content-id]').first();await firstResult.waitFor();assert.ok((await firstResult.locator('textarea').inputValue()).includes('[isi harga]'));
  await firstResult.getByRole('button',{name:'Simpan ke Library',exact:true}).click();await page.getByText('Tersimpan di Library',{exact:true}).first().waitFor();
  const download=page.waitForEvent('download');await page.locator('[data-content-id]').first().getByRole('button',{name:'Unduh .txt',exact:true}).click();const file=await download;assert.ok(fs.readFileSync(await file.path(),'utf8').includes('Rp25.000'));
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().right<=0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/autofeeds-phase7-content-mobile.png',fullPage:true,animations:'disabled'});
  assert.deepEqual(errors,[]);await browser.close();browser=undefined;console.log('PASS browser: edit Brand Kit, default brand in Promo Composer, manual Content Studio, language, CTA, save and TXT download, desktop/mobile overflow.');
 }
 await api(`/api/analyze?image_id=${imageId}`,{},202);let analysis;for(let i=0;i<100;i++){analysis=await api(`/api/analyze?image_id=${imageId}`);if(analysis.job?.status==='done')break;await new Promise(r=>setTimeout(r,20));}assert.ok(analysis.analysis);const analyzed=await api('/api/content',{image_id:imageId,content_type:'cta',tone:'friendly',language:'id',brand_kit_id:0,extra:'Harga Rp25.000'},201);assert.equal(analyzed.content.language,'id');assert.equal(analyzed.content.brand_name,null);assert.ok(prompts.at(-1).includes('Bahasa Indonesia'));
 await api(`/api/brand-kits?id=${a.id}`,{},200,'DELETE');assert.equal((await api('/api/brand-templates')).templates.find(t=>t.design_id===template.id).brand_id,null);
 await api(`/api/images?id=${logoId}`,{},200,'DELETE');assert.equal(hash(Buffer.from(await(await fetch(base+`/api/brand-logo?id=${a.logo_asset_id}`)).arrayBuffer())),logoHash);
 const restoredPromo=await api('/api/promo',{regenerate_id:firstPromo.id},201),restoredDoc=await api('/api/designs',{promo_id:restoredPromo.id},201);assert.ok(restoredDoc.doc.layers.some(l=>l.text===values.footer_text));assert.ok(restoredDoc.doc.layers.some(l=>l.brandRole==='logo'&&l.kind==='image'));
 const afterDeleted=await api('/api/content',{source_content_id:generated.content.id},201);assert.equal(afterDeleted.content.brand_name,'BRAND A');
 await api(`/api/designs?id=${firstEditor.id}`,{},200,'DELETE');await api('/api/brand-templates',{use_id:template.id},201);
 await stop();await start();assert.ok((await api('/api/brand-kits')).kits.some(k=>k.id===b.id));assert.ok((await api('/api/content?image_id='+imageId)).contents.some(c=>c.id===generated.content.id));assert.equal((await api('/api/brand-templates')).templates.length,1);
 await api(`/api/brand-templates?id=${template.id}`,{},200,'DELETE');assert.equal((await api('/api/brand-templates')).templates.length,0);assert.equal((await fetch(base+`/api/designs?id=${used.id}`)).status,200);
 console.log('PASS API: kit CRUD/revisions/default, persistent logo snapshots, branded poster/editor, template independence, manual facts, languages, price filter, content snapshots, Ollama transport/error handling, restart persistence. Text generation is tested against an explicit HTTP fixture, not a real language model.');complete=true;
}finally{
 if(!complete)console.error(fs.readFileSync(path.join(temp,'server.log'),'utf8'));
 await browser?.close();await stop();stub.closeAllConnections();await new Promise(resolve=>stub.close(resolve));fs.closeSync(log);fs.rmSync(temp,{recursive:true,force:true});
}
