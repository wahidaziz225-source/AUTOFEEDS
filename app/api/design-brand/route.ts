import fs from "node:fs";
import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {getDb} from "@/lib/db";
import {selectedBrand,brandAssetPath} from "@/lib/brands";
import {designAssetPath} from "@/lib/design-storage";
import {validateDocument} from "@/lib/design-document";
import {applyBrandDocument} from "@/lib/brand-document";
const bad=(error:string,status=400)=>NextResponse.json({error},{status});
export async function POST(req:Request){
 let copied:string|undefined,persisted=false;
 try{
  const raw=await req.text();if(raw.length>2_000_000)return bad('Dokumen terlalu besar.',413);
  const body=JSON.parse(raw),id=Number(body?.design_id),revision=body?.revision,doc=validateDocument(body.doc),db=getDb();
  if(!Number.isSafeInteger(id)||id<=0)return bad('ID desain tidak valid.');
  const current=db.prepare('SELECT revision FROM design_revisions WHERE design_id=?').get(id) as {revision:number}|undefined;
  if(!current)return bad('Dokumen tidak ditemukan.',404);if(current.revision!==revision)return bad('Revisi berubah. Muat ulang atau salin dokumen.',409);
  for(const l of doc.layers)if(l.kind==='image'&&!db.prepare('SELECT id FROM design_assets WHERE id=? AND design_id=?').get(l.assetId,id))return bad('Aset bukan milik dokumen.');
  const brand=selectedBrand(body.brand_kit_id);if(!brand)return bad('Pilih Brand Kit terlebih dahulu.');
  let logo:{id:string;width:number;height:number}|undefined;
  if(brand.logo_asset_id){
   const asset=db.prepare('SELECT width,height FROM brand_assets WHERE id=?').get(brand.logo_asset_id) as {width:number;height:number}|undefined;
   const source=brandAssetPath(brand.logo_asset_id);if(!asset||!source||!fs.existsSync(source))return bad('Logo brand tidak tersedia.');
   copied=crypto.randomUUID();fs.copyFileSync(source,designAssetPath(copied)!,fs.constants.COPYFILE_EXCL);logo={id:copied,...asset};
  }
  const next=validateDocument(applyBrandDocument(doc,brand,logo));
  if(logo)db.prepare('INSERT INTO design_assets(id,design_id,width,height) VALUES(?,?,?,?)').run(logo.id,id,logo.width,logo.height);
  persisted=true;return NextResponse.json({doc:next,revision,brand_name:brand.name});
 }catch(e){return bad(e instanceof Error?e.message:'Brand gagal diterapkan.');}
 finally{if(copied&&!persisted)fs.rmSync(designAssetPath(copied)!,{force:true});}
}
