import {constrainLayer,newLayer,type DesignDocument,type DesignLayer} from "./design-document";
import type {BrandSnapshot} from "./brand-options";
export function readableInk(color:string){
 const values=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return values[0]*.2126+values[1]*.7152+values[2]*.0722>.179?'#0f172a':'#ffffff';
}
export function applyBrandDocument(doc:DesignDocument,brand:BrandSnapshot,logo?:{id:string;width:number;height:number}):DesignDocument{
 const layers:DesignLayer[]=doc.layers.filter(l=>l.brandRole!=='logo'&&l.brandRole!=='footer').map((l):DesignLayer=>{
  if(l.kind==='image')return l.name==='Background'?{...l,kind:'rect',fill:brand.primary_color,stroke:'none',radius:0}:l;
  if(l.kind==='text'){
   const text=l.text??'',bodyInk=readableInk(brand.secondary_color)==='#ffffff'?brand.secondary_color:'#0f172a';
   const fill=l.fill.toLowerCase()==='#64748b'?l.fill:/^-\d+%$/.test(text)?readableInk(brand.accent_color):/^Rp|^IDR|PROMO|BELI|GRATIS|HEMAT/.test(text)||(l.y<doc.height*.2&&l.width>doc.width*.55)?readableInk(brand.primary_color):bodyInk;
   return {...l,fontFamily:brand.font_family,fill};
  }
  if(l.kind==='rect'&&l.name==='Background')return {...l,fill:brand.primary_color};
  if(l.kind==='ellipse')return {...l,fill:brand.accent_color};
  if(l.kind==='rect'&&l.fill.toLowerCase().startsWith('#ffffff'))return l;
  return {...l,fill:l.fill==='none'?'none':brand.primary_color,stroke:l.stroke==='none'?'none':brand.primary_color};
 });
 if(brand.footer_text||logo){
  const h=Math.max(64,Math.round(doc.height*.075)),margin=Math.round(doc.width*.04),top=doc.height-h;
  layers.push(newLayer('rect',{name:'Footer brand',brandRole:'footer',x:0,y:top,width:doc.width,height:h,fill:brand.secondary_color,radius:0}));
  let tx=margin;
  if(logo){
   const boxW=h*1.5,boxH=h*.72,scale=Math.min(boxW/logo.width,boxH/logo.height),w=logo.width*scale,height=logo.height*scale;
   layers.push(newLayer('rect',{name:'Latar logo',brandRole:'logo',x:margin-4,y:top+(h-boxH)/2-4,width:boxW+8,height:boxH+8,fill:'#ffffff',radius:8}));
   layers.push(newLayer('image',{name:'Logo brand',brandRole:'logo',assetId:logo.id,x:margin+(boxW-w)/2,y:top+(h-height)/2,width:w,height}));tx=margin+boxW+margin/2;
  }
  if(brand.footer_text)layers.push(newLayer('text',{name:'Footer brand',brandRole:'footer',text:brand.footer_text,fontFamily:brand.font_family,fontSize:Math.min(42,h*.4),baseline:.8,x:tx,y:top+h*.25,width:doc.width-margin-tx,height:h*.5,fill:readableInk(brand.secondary_color)}));
 }
 if(layers.length>400)throw new Error('Penerapan brand melebihi batas 400 layer. Hapus beberapa layer terlebih dahulu.');
 return {...doc,layers:layers.map(l=>constrainLayer(l,doc.width,doc.height))};
}
