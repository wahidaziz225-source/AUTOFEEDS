import fs from "node:fs";
import {NextResponse} from "next/server";
import {getDb,logActivity} from "@/lib/db";
import {validateBrand} from "@/lib/brand-options";
import {brandAssetPath,copyBrandLogo,listBrands} from "@/lib/brands";
const bad=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(req:Request){const id=new URL(req.url).searchParams.get("id"),kits=listBrands();return NextResponse.json({kits:id?kits.filter(k=>k.id===Number(id)):kits});}
async function write(req:Request,updating:boolean){
 let logo:{id:string;width:number;height:number}|undefined,persisted=false;
 try{
  const raw=await req.text();if(raw.length>12000)return bad("Pengaturan terlalu besar.",413);
  const body=JSON.parse(raw),fields=validateBrand(body),db=getDb(),id=Number(body.id);
  const existing=updating?listBrands().find(k=>k.id===id):undefined;
  if(updating&&!existing)return bad("Brand Kit tidak ditemukan.",404);
  if(updating&&body.revision!==existing!.revision)return bad("Brand Kit telah berubah. Muat ulang sebelum menyimpan.",409);
  if(body.logo_image_id!=null){const imageId=Number(body.logo_image_id);if(!Number.isSafeInteger(imageId)||imageId<=0)return bad("ID logo tidak valid.");logo=await copyBrandLogo(imageId);}
  if(body.remove_logo!==undefined&&typeof body.remove_logo!=="boolean")return bad("Pilihan logo tidak valid.");
  const logoFilename=logo?`${logo.id}.png`:body.remove_logo?null:existing?.logo_asset_id?`${existing.logo_asset_id}.png`:null;
  const savedId=db.transaction(()=>{
   if(updating){const current=db.prepare("SELECT revision FROM brand_profiles WHERE brand_id=?").get(id) as {revision:number}|undefined;if((current?.revision??1)!==body.revision)throw new Error("Brand Kit telah berubah. Muat ulang.");}
   if(fields.is_default){db.prepare("UPDATE brand_profiles SET revision=revision+1 WHERE brand_id IN(SELECT id FROM brand_kits WHERE is_default=1 AND id!=?)").run(updating?id:0);db.prepare("UPDATE brand_kits SET is_default=0").run();}
   let savedId=id;
   if(updating)db.prepare(`UPDATE brand_kits SET name=?,logo_filename=?,primary_color=?,secondary_color=?,accent_color=?,font_family=?,footer_text=?,is_default=?,updated_at=datetime('now') WHERE id=?`).run(fields.name,logoFilename,fields.primary_color,fields.secondary_color,fields.accent_color,fields.font_family,fields.footer_text,fields.is_default?1:0,id);
   else savedId=Number(db.prepare(`INSERT INTO brand_kits(name,logo_filename,primary_color,secondary_color,accent_color,font_family,footer_text,is_default) VALUES(?,?,?,?,?,?,?,?)`).run(fields.name,logoFilename,fields.primary_color,fields.secondary_color,fields.accent_color,fields.font_family,fields.footer_text,fields.is_default?1:0).lastInsertRowid);
   db.prepare(`INSERT INTO brand_profiles(brand_id,revision,options_json) VALUES(?,?,?) ON CONFLICT(brand_id) DO UPDATE SET revision=excluded.revision,options_json=excluded.options_json`).run(savedId,updating?existing!.revision+1:1,JSON.stringify(fields));
   if(logo)db.prepare("INSERT INTO brand_assets(id,width,height) VALUES(?,?,?)").run(logo.id,logo.width,logo.height);
   logActivity(updating?"Perbarui Brand Kit":"Buat Brand Kit","brand",savedId,fields.name);return savedId;
  })();persisted=true;return NextResponse.json({kit:listBrands().find(k=>k.id===savedId)},{status:updating?200:201});
 }catch(e){return bad(e instanceof Error?e.message:"Gagal menyimpan Brand Kit.");}
 finally{if(logo&&!persisted)fs.rmSync(brandAssetPath(logo.id)!,{force:true});}
}
export async function POST(req:Request){return write(req,false);}
export async function PATCH(req:Request){return write(req,true);}
export async function DELETE(req:Request){
 const id=Number(new URL(req.url).searchParams.get('id'));if(!Number.isSafeInteger(id)||id<=0)return bad("ID tidak valid.");
 const db=getDb();const result=db.prepare("DELETE FROM brand_kits WHERE id=?").run(id);if(!result.changes)return bad("Brand Kit tidak ditemukan.",404);
 logActivity("Hapus Brand Kit","brand",id,null);return NextResponse.json({ok:true});
}
