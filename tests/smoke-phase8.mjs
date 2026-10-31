import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),temp=fs.mkdtempSync(path.join(os.tmpdir(),'autofeeds-phase8-')),dataDir=path.join(temp,'data');
const port=Number(process.env.PHASE8_TEST_PORT||3068),base=`http://127.0.0.1:${port}`,log=fs.openSync(path.join(temp,'server.log'),'w');
let server,browser,complete=false;
async function start(){server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{stdio:['ignore',log,log],env:{...process.env,AUTOFEEDS_DATA_DIR:dataDir}});for(let i=0;i<80;i++){if(server.exitCode!==null)throw Error(fs.readFileSync(path.join(temp,'server.log'),'utf8'));try{if((await fetch(base+'/api/designs')).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Server unavailable');}
async function stop(){if(server&&server.exitCode===null){const end=once(server,'exit');server.kill();await end;}}
async function api(url,body,status=200,method='POST'){const r=await fetch(base+url,body===undefined?undefined:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,`${url}: ${await r.clone().text()}`);return r.json();}
function checkImage(file,w,h,kind,alpha){const code="from PIL import Image;import sys;im=Image.open(sys.argv[1]);assert im.size==(int(sys.argv[2]),int(sys.argv[3])),im.size;assert im.format==sys.argv[4];"+(alpha==='transparent'?"assert im.mode=='RGBA';assert im.getpixel((0,0))[3]==0;assert im.getchannel('A').getbbox() is not None":alpha==='white'?"assert im.convert('RGB').getpixel((0,0))==(255,255,255)":"");const result=spawnSync('python',['-c',code,file,String(w),String(h),kind]);assert.equal(result.status,0,result.stderr.toString());}
const hash=data=>createHash('sha256').update(data).digest('hex');
try{
 const fixture=path.join(temp,'photo.png');const setup=spawnSync('python',['-c',`from PIL import Image,ImageDraw,ImageFont
import sys
im=Image.new('RGBA',(600,800),(0,0,0,0));d=ImageDraw.Draw(im);d.rounded_rectangle((80,40,520,760),radius=30,fill='#dc2626');d.rectangle((90,240,510,490),fill='#facc15');font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',34);d.text((135,295),'FOTO CONTOH',font=font,fill='#7f1d1d');d.text((200,360),'DEMO',font=font,fill='#7f1d1d');im.save(sys.argv[1])`,fixture]);assert.equal(setup.status,0,setup.stderr.toString());
 await start();for(const route of ['/dashboard','/upload','/image-studio','/analyzer','/promo','/editor','/brand-kit','/content-studio','/library','/history','/settings'])assert.equal((await fetch(base+route)).status,200);
 const form=new FormData();form.append('file',new Blob([fs.readFileSync(fixture)],{type:'image/png'}),'Produk DEMO.png');const uploaded=await fetch(base+'/api/images',{method:'POST',body:form});assert.equal(uploaded.status,201);const {id:imageId}=await uploaded.json();
 const original=hash(Buffer.from(await(await fetch(base+`/api/image-file?id=${imageId}`)).arrayBuffer()));
 let first,custom,firstDoc;
 for(const [format,width,height]of [['feed',1080,1350],['square',1080,1080],['story',1080,1920],['landscape',1200,630],['custom',1200,800]]){
  const poster=await api('/api/promo',{count:format==='custom'?4:1,format,width,height,theme:'merah',style:'flash',brand_kit_id:0,promo_type:'harga_spesial',title:'PROMO DEMO',subtitle:'Contoh tampilan, bukan penawaran',footer:'ANTOFROZEN • DATA DEMO',items:[{image_id:imageId,name:'Nugget Ayam 500 g — DEMO',price:'24799',old_price:'30999'}]},201);
  if(!first)first=poster;if(format==='custom')custom=poster;
  for(const kind of ['jpg','png']){const r=await fetch(base+`/api/promo-file?id=${poster.id}&format=${kind}&download=1`);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),kind==='png'?'image/png':'image/jpeg');const file=path.join(temp,`${format}.${kind}`);fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));checkImage(file,width,height,kind==='png'?'PNG':'JPEG');}
  if(!firstDoc)firstDoc=await api('/api/designs',{promo_id:poster.id},201);
 }
 assert.equal((await fetch(base+`/api/promo-file?id=${first.id}&format=gif`)).status,400);
 const again=await api('/api/promo',{regenerate_id:custom.id},201);const edited=await api('/api/designs',{promo_id:again.id},201);assert.equal(edited.doc.width,1200);assert.equal(edited.doc.height,800);assert.equal(edited.doc.format,'custom');
 for(const [width,height]of [[511,800],[4097,900],[512,4096],[900.5,900]]){await api('/api/designs',{format:'custom',width,height},400);await api('/api/promo',{count:1,format:'custom',width,height,theme:'merah',style:'retail',promo_type:'harga_spesial',items:[{image_id:imageId,price:'25000'}]},400);}
 const promoDir=path.join(dataDir,'storage','uploads','promo');for(const file of fs.readdirSync(promoDir).filter(f=>f.endsWith('.png')))fs.unlinkSync(path.join(promoDir,file));
 const fallback=await fetch(base+`/api/promo-file?id=${first.id}&format=png&download=1`);assert.equal(fallback.status,200);const oldPng=path.join(temp,'legacy.png');fs.writeFileSync(oldPng,Buffer.from(await fallback.arrayBuffer()));checkImage(oldPng,1080,1350,'PNG');
 const transparent=await api('/api/designs',{format:'custom',width:960,height:720},201);transparent.doc.layers[0].visible=false;transparent.doc.layers.push({id:randomUUID(),name:'Harga DEMO',kind:'text',x:80,y:100,width:600,height:70,rotation:0,opacity:1,visible:true,locked:false,fill:'#dc2626',stroke:'none',strokeWidth:0,text:'Rp24.799 — DEMO',fontFamily:'Arial',fontSize:54,baseline:.8,bold:true});await api('/api/designs',{id:transparent.id,revision:1,doc:transparent.doc},200,'PATCH');
 if(process.env.PHASE8_UI==='1'){
  const {chromium}=require('playwright');let executablePath=process.env.PHASE8_CHROMIUM||chromium.executablePath(),args=['--no-sandbox'];
  if(process.env.PHASE8_BROWSER_MODULE){const portable=(await import(process.env.PHASE8_BROWSER_MODULE)).default;executablePath=await portable.executablePath();args=portable.args;}
  browser=await chromium.launch({executablePath,args,headless:true});const page=await browser.newPage({viewport:{width:1600,height:1150},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  async function downloaded(name){const event=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();return await(await event).path();}
  await page.goto(base+`/editor?id=${transparent.id}`);await page.getByLabel('Nama desain',{exact:true}).waitFor();
  checkImage(await downloaded('Unduh PNG'),960,720,'PNG','transparent');checkImage(await downloaded('Unduh JPG'),960,720,'JPEG','white');
  await page.getByLabel('Kualitas JPG',{exact:true}).selectOption('0.85');const low=fs.readFileSync(await downloaded('Unduh JPG'));await page.getByLabel('Kualitas JPG',{exact:true}).selectOption('1');const high=fs.readFileSync(await downloaded('Unduh JPG'));assert.notEqual(hash(low),hash(high));
  await page.getByLabel('Lebar khusus',{exact:true}).fill('1360');await page.getByLabel('Tinggi khusus',{exact:true}).fill('900');await page.getByRole('button',{name:'Terapkan ukuran',exact:true}).click();await page.getByRole('button',{name:/^Simpan/}).click();await page.getByRole('status').filter({hasText:'Perubahan tersimpan'}).waitFor();
  checkImage(await downloaded('Unduh PNG'),1360,900,'PNG','transparent');const xml=fs.readFileSync(await downloaded('Unduh SVG'),'utf8');assert.ok(xml.includes('width="1360"'));assert.ok(xml.includes('Rp24.799'));
  await page.goto(base+`/editor?id=${edited.id}`);await page.getByLabel('Nama desain',{exact:true}).waitFor();await page.getByLabel('Lebar khusus',{exact:true}).fill('1200');await page.getByLabel('Tinggi khusus',{exact:true}).fill('800');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/workspace/scratch/7f31e9a383e5/AUTOFEEDS-fase8-editor.png',fullPage:true,animations:'disabled'});
  await page.goto(base+'/promo');await page.getByRole('button',{name:'Produk DEMO.png'}).click();await page.getByLabel(/Harga promo/).fill('24799');await page.getByLabel(/Harga coret/).fill('30999');await page.getByLabel('Ukuran',{exact:true}).selectOption('custom');await page.getByLabel('Lebar poster khusus',{exact:true}).fill('1200');await page.getByLabel('Tinggi poster khusus',{exact:true}).fill('800');await page.getByRole('button',{name:'Buat 4 variasi desain',exact:true}).click();await page.getByRole('img',{name:'Hasil desain promo',exact:true}).waitFor();
  const pngEvent=page.waitForEvent('download');await page.getByRole('link',{name:'Unduh PNG',exact:true}).click();checkImage(await(await pngEvent).path(),1200,800,'PNG');
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('aside').getBoundingClientRect().right<=0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/workspace/scratch/7f31e9a383e5/AUTOFEEDS-fase8-mobile.png',fullPage:true,animations:'disabled'});assert.deepEqual(errors,[]);await browser.close();browser=undefined;
  console.log('PASS browser: transparent PNG, white JPG, actual JPG quality changes, exact 960×720/1360×900 exports, SVG, custom Composer batch/PNG, desktop/mobile.');
 }
 await stop();await start();const persisted=await api(`/api/designs?id=${transparent.id}`);assert.ok([960,1360].includes(persisted.doc.width));assert.equal((await fetch(base+`/api/promo-file?id=${custom.id}&format=png`)).status,200);
 assert.equal(hash(Buffer.from(await(await fetch(base+`/api/image-file?id=${imageId}`)).arrayBuffer())),original);
 console.log('PASS API: all four presets, custom batch, exact JPG/PNG dimensions and MIME, invalid size rejection, legacy PNG conversion, custom regeneration/editor, restart persistence and original photo integrity.');complete=true;
}finally{
 if(!complete)console.error(fs.readFileSync(path.join(temp,'server.log'),'utf8'));
 await browser?.close();await stop();fs.closeSync(log);fs.rmSync(temp,{recursive:true,force:true});
}
