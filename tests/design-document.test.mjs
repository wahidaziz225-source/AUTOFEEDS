import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const moduleOf=async name=>{const source=fs.readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);};
const {validateDocument,newLayer,constrainLayer,resizeDocument,documentSvg}=await moduleOf('design-document');
const {initialHistory,commitHistory,undoHistory,redoHistory}=await moduleOf('design-history');
const doc=()=>({version:1,title:'Uji editor',format:'feed',width:1080,height:1350,layers:[newLayer('text',{text:'Rp24.799'})]});
test('validated layer model rejects code, external image sources and malformed geometry',()=>{
  assert.equal(validateDocument(doc()).layers[0].text,'Rp24.799');
  for(const patch of [{x:NaN},{width:Infinity},{opacity:2},{fill:'url(https://example.com/a.svg)'},{fontFamily:'javascript:alert(1)'},{kind:'script'},{kind:'image',assetId:'https://evil.example/a.png'}])assert.throws(()=>validateDocument({...doc(),layers:[{...doc().layers[0],...patch}]}));
  assert.throws(()=>validateDocument({...doc(),format:'toString'}));
  const layer=doc().layers[0];assert.throws(()=>validateDocument({...doc(),layers:[layer,layer]}));
});
test('rotated layers remain inside the canvas',()=>{
  for(let angle=-360;angle<=360;angle+=15){
    const layer=constrainLayer({...doc().layers[0],x:-100,y:1500,width:1800,height:150,rotation:angle},1080,1350);
    const radians=angle*Math.PI/180,bw=Math.abs(layer.width*Math.cos(radians))+Math.abs(layer.height*Math.sin(radians)),bh=Math.abs(layer.width*Math.sin(radians))+Math.abs(layer.height*Math.cos(radians));
    assert.ok(layer.x+layer.width/2-bw/2>=-.001);assert.ok(layer.y+layer.height/2-bh/2>=-.001);
    assert.ok(layer.x+layer.width/2+bw/2<=1080.001);assert.ok(layer.y+layer.height/2+bh/2<=1350.001);
    validateDocument({...doc(),layers:[layer]});
  }
});
test('changing canvas format preserves image proportions',()=>{
  const photo=newLayer('image',{assetId:crypto.randomUUID(),width:400,height:200});
  const resized=resizeDocument({...doc(),layers:[photo]},'story');assert.equal(resized.width,1080);assert.equal(resized.height,1920);
  assert.equal(resized.layers[0].width/resized.layers[0].height,2);validateDocument(resized);
});
test('SVG escapes user text and embeds only expected primitives',()=>{
  const d=doc();d.layers[0].text='<script>alert("XSS")</script> & harga';
  const svg=documentSvg(validateDocument(d),id=>`/api/design-assets?asset_id=${id}`);
  assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('foreignObject'));
  assert.ok(svg.includes('Rp24.799')===false);
});
test('undo/redo preserves complete immutable documents and clears redo after new edits',()=>{
  let h=initialHistory(doc());const original=JSON.stringify(h.present);
  h=commitHistory(h,{...h.present,title:'Edit 1'});h=commitHistory(h,{...h.present,title:'Edit 2'});
  h=undoHistory(h);assert.equal(h.present.title,'Edit 1');h=redoHistory(h);assert.equal(h.present.title,'Edit 2');
  h=undoHistory(h);h=commitHistory(h,{...h.present,title:'Cabang baru'});assert.equal(h.future.length,0);
  h=undoHistory(h);h=undoHistory(h);assert.equal(JSON.stringify(h.present),original);
  for(let i=0;i<100;i++)h=commitHistory(h,{...h.present,title:String(i)});assert.equal(h.past.length,80);
});
