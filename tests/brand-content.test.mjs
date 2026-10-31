import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2017}}).outputText;
const uri=s=>`data:text/javascript;base64,${Buffer.from(compile(s)).toString('base64')}`;
const source=name=>fs.readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
const {validateBrand,validateBrandSnapshot,BRAND_DEFAULTS}=await import(uri(source('brand-options')));
const {buildPrompt,cleanOutput,priceValue,isTone,isContentType}=await import(uri(source('content')));
const documentUri=uri(source('design-document'));
const {newLayer,validateDocument}=await import(documentUri);
const {applyBrandDocument,readableInk}=await import(uri(source('brand-document').replace('"./design-document"',JSON.stringify(documentUri))));
const brand={...BRAND_DEFAULTS,id:1,revision:1,name:'ANTOFROZEN',logo_asset_id:null,voice:'Ramah dan jelas',footer_text:'Hubungi toko'};
test('brand fields are bounded and only supported colors/fonts are accepted',()=>{
 assert.equal(validateBrand(brand).name,'ANTOFROZEN');
 for(const patch of [{name:''},{primary_color:'red'},{font_family:'url(https://evil)'},{language:'xx'},{voice:'x'.repeat(601)},{promo_format:'custom'},{is_default:'true'}])assert.throws(()=>validateBrand({...brand,...patch}));
 assert.throws(()=>validateBrandSnapshot({...brand,logo_asset_id:'../../a.png'}));
});
test('brand application preserves product pixels references and exact manual price text',()=>{
 const image=newLayer('image',{name:'Foto produk',assetId:crypto.randomUUID(),width:200,height:300});
 const price=newLayer('text',{text:'Rp24.799',name:'Rp24.799'});
 const doc={version:1,title:'Tes',format:'feed',width:1080,height:1350,layers:[image,price]};
 const applied=applyBrandDocument(doc,brand);
 assert.equal(applied.layers.find(l=>l.id===image.id).assetId,image.assetId);
 assert.equal(applied.layers.find(l=>l.id===price.id).text,'Rp24.799');validateDocument(applied);
 assert.equal(doc.layers.length,2);
});
test('brand reapplication replaces semantic footer and logo without duplicating them',()=>{
 const doc={version:1,title:'Tes',format:'feed',width:1080,height:1350,layers:[]};
 const logo={id:crypto.randomUUID(),width:300,height:100};
 const once=applyBrandDocument(doc,brand,logo),twice=applyBrandDocument(once,brand,logo);
 assert.equal(once.layers.length,twice.layers.length);assert.equal(twice.layers.filter(l=>l.kind==='image'&&l.brandRole==='logo').length,1);
});
test('readable foreground switches with background luminance',()=>{assert.equal(readableInk('#ffffff'),'#0f172a');assert.equal(readableInk('#000000'),'#ffffff');});
test('requested language, tone and brand guidance reach the factual prompt',()=>{
 const prompt=buildPrompt({type:'education',tone:'hard_selling',description:'Nugget 500 gram',objects:'',colors:'',visibleText:'',context:'',extra:'Rp25.000',language:'en',brand});
 assert.ok(prompt.includes('English'));assert.ok(prompt.includes('ANTOFROZEN'));assert.ok(prompt.includes('Hard Selling'));
 assert.ok(prompt.includes('sertifikasi'));assert.ok(prompt.includes('urgensi stok/deadline palsu'));assert.ok(prompt.includes('jangan menciptakan'));
 for(const tone of ['friendly','hard_selling','soft_selling'])assert.ok(isTone(tone));for(const type of ['cta','education','copywriting'])assert.ok(isContentType(type));
});
test('currency normalization preserves actual supplied nominal values',()=>{
 assert.equal(priceValue('25','rb'),25000);assert.equal(priceValue('25,5','ribu'),25500);assert.equal(priceValue('1','juta'),1000000);
 assert.equal(cleanOutput('Promo Rp25rb dan IDR 25.000','Harga Rp25.000'),'Promo Rp25rb dan IDR 25.000');
 assert.equal(cleanOutput('Harga Rp25 juta','Harga Rp25.000'),'Harga [isi harga]');
});
test('weights and telephone digits never authorize hallucinated prices',()=>{
 assert.equal(cleanOutput('Rp500 dan Rp25000','Berat 500 gram, WA 081225000'),'[isi harga] dan [isi harga]');
 assert.equal(cleanOutput('Rp99.000 dan Rp25.000','Harga Rp25rb'),'[isi harga] dan Rp25.000');
 assert.equal(cleanOutput('Rp25.000. Rp99.000!','Harga Rp25.000'),'Rp25.000. [isi harga]!');
});
