"use client";
import {documentSvg,validateDocument,type DesignDocument} from "./design-document";
export type ExportKind='jpg'|'png'|'svg';
export async function exportDesign(doc:DesignDocument,assetUrl:(id:string)=>string,kind:ExportKind,quality=.95):Promise<Blob>{
 validateDocument(doc);
 if(!['jpg','png','svg'].includes(kind)||!Number.isFinite(quality)||quality<.7||quality>1)throw new Error('Pengaturan ekspor tidak valid.');
 const assets=new Map<string,string>();
 for(const layer of doc.layers)if(layer.visible&&layer.kind==='image'&&layer.assetId&&!assets.has(layer.assetId)){
  const response=await fetch(assetUrl(layer.assetId));if(!response.ok)throw new Error('Aset hilang; ekspor dibatalkan.');
  const blob=await response.blob();if(blob.type!=='image/png')throw new Error('Format aset tidak valid.');
  const uri=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Gagal membaca aset.'));reader.readAsDataURL(blob);});assets.set(layer.assetId,uri);
 }
 await document.fonts.ready;
 const xml=documentSvg(doc,id=>assets.get(id)!),blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
 if(kind==='svg')return blob;
 const url=URL.createObjectURL(blob);
 try{
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=doc.width;canvas.height=doc.height;
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas tidak tersedia pada browser ini.');
  if(kind==='jpg'){context.fillStyle='#ffffff';context.fillRect(0,0,doc.width,doc.height);}
  context.drawImage(image,0,0);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Ekspor gagal.')),'image/'+(kind==='jpg'?'jpeg':'png'),quality));
 }finally{URL.revokeObjectURL(url);}
}
