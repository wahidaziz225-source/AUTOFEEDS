import fs from "node:fs";
import {NextResponse} from "next/server";
import {getDb,logActivity} from "@/lib/db";
import {cloneDocument,designAssetPath} from "@/lib/design-storage";
const bad=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(req:Request){const brand=new URL(req.url).searchParams.get("brand_id");const templates=getDb().prepare("SELECT t.*,b.name AS brand_name FROM brand_templates t LEFT JOIN brand_kits b ON b.id=t.brand_id ORDER BY t.design_id DESC LIMIT 100").all() as {brand_id:number|null}[];return NextResponse.json({templates:brand?templates.filter(t=>t.brand_id===Number(brand)):templates});}
export async function POST(req:Request){
 let assets:{id:string;width:number;height:number}[]=[],persisted=false;
 try{
  const body=await req.json(),db=getDb(),using=body?.use_id!==undefined;
  const source=Number(using?body.use_id:body?.design_id);if(!Number.isSafeInteger(source)||source<=0)return bad("ID dokumen tidak valid.");
  if(using&&!db.prepare("SELECT design_id FROM brand_templates WHERE design_id=?").get(source))return bad("Template tidak ditemukan.",404);
  const brand=body.brand_id==null?null:Number(body.brand_id);if(!using&&(!Number.isSafeInteger(brand)||!db.prepare("SELECT id FROM brand_kits WHERE id=?").get(brand)))return bad("Pilih Brand Kit yang tersedia.");
  const name=String(body.name??'Template brand').trim();if(!name||name.length>100)return bad("Nama template tidak valid.");
  const result=cloneDocument(source);assets=result.assets;const doc=result.doc;
  doc.title=using?(doc.title+' salinan').slice(0,120):name;
  const id=db.transaction(()=>{
   const id=Number(db.prepare("INSERT INTO designs(title,format,width,height,style,doc_json,is_saved) VALUES(?,?,?,?,?,?,1)").run(doc.title,doc.format,doc.width,doc.height,'editor',JSON.stringify(doc)).lastInsertRowid);
   db.prepare("INSERT INTO design_revisions(design_id) VALUES(?)").run(id);
   for(const a of assets)db.prepare("INSERT INTO design_assets(id,design_id,width,height) VALUES(?,?,?,?)").run(a.id,id,a.width,a.height);
   if(!using)db.prepare("INSERT INTO brand_templates(design_id,brand_id,name) VALUES(?,?,?)").run(id,brand,name);
   logActivity(using?'Gunakan template brand':'Simpan template brand','design',id,null);return id;
  })();persisted=true;return NextResponse.json({id,doc,revision:1},{status:201});
 }catch(e){return bad(e instanceof Error?e.message:"Template gagal diproses.");}
 finally{if(!persisted)for(const a of assets)fs.rmSync(designAssetPath(a.id)!,{force:true});}
}
export async function DELETE(req:Request){
 const id=Number(new URL(req.url).searchParams.get('id')),db=getDb();if(!Number.isSafeInteger(id)||id<=0)return bad("ID tidak valid.");
 if(!db.prepare("SELECT design_id FROM brand_templates WHERE design_id=?").get(id))return bad("Template tidak ditemukan.",404);
 const assets=db.prepare("SELECT id FROM design_assets WHERE design_id=?").all(id) as {id:string}[];
 db.transaction(()=>{db.prepare("DELETE FROM designs WHERE id=?").run(id);logActivity('Hapus template brand','design',id,null);})();
 for(const a of assets)fs.rmSync(designAssetPath(a.id)!,{force:true});return NextResponse.json({ok:true});
}
