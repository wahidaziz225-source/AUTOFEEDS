import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(fs.readFileSync(new URL('../lib/design-document.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2017}}).outputText;
const {validateCanvasSize,validateDocument,resizeDocument,newLayer}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
test('custom export dimensions are integer, bounded and not excessively narrow',()=>{
 for(const [w,h] of [[1200,900],[512,512],[4096,4096],[600,1800]])assert.deepEqual(validateCanvasSize(w,h),{width:w,height:h});
 for(const [w,h] of [[511,900],[4097,1080],[700.5,900],['1200',900],[NaN,900],[512,4096]])assert.throws(()=>validateCanvasSize(w,h));
});
test('custom documents survive validation and preserve text values',()=>{
 const doc={version:1,title:'Custom',format:'custom',width:1200,height:800,layers:[newLayer('text',{text:'Rp24.799'})]};
 assert.equal(validateDocument(doc).layers[0].text,'Rp24.799');
 assert.throws(()=>validateDocument({...doc,width:20}));
});
test('custom canvas resize preserves product ratio and fills the background',()=>{
 const photo=newLayer('image',{name:'Foto produk',assetId:crypto.randomUUID(),width:200,height:300});
 const bg=newLayer('image',{name:'Background',assetId:crypto.randomUUID(),x:0,y:0,width:1080,height:1350});
 const doc={version:1,title:'Test',format:'feed',width:1080,height:1350,layers:[bg,photo]};
 const result=resizeDocument(doc,'custom',1200,700);validateDocument(result);
 assert.equal(result.layers[0].width,1200);assert.equal(result.layers[0].height,700);
 assert.ok(Math.abs(result.layers[1].width/result.layers[1].height-2/3)<.0001);
});
