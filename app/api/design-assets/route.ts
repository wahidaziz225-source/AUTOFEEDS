import fs from "node:fs";
import { NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { copyEditorAsset, designAssetPath } from "@/lib/design-storage";
const bad=(error:string,status=400)=>NextResponse.json({error},{status});
const valid=(n:number)=>Number.isSafeInteger(n)&&n>0;
export async function GET(req:Request){
  const query=new URL(req.url).searchParams,id=query.get("asset_id")??"",design=Number(query.get("design_id"));
  const file=designAssetPath(id);
  if(!valid(design)||!file)return bad("Aset tidak valid.");
  if(!getDb().prepare("SELECT id FROM design_assets WHERE id=? AND design_id=?").get(id,design)||!fs.existsSync(file))return bad("Aset tidak ditemukan.",404);
  return new Response(new Uint8Array(fs.readFileSync(file)),{headers:{"Content-Type":"image/png","Cache-Control":"private, max-age=31536000, immutable","X-Content-Type-Options":"nosniff"}});
}
export async function POST(req:Request){
  let asset:{id:string;width:number;height:number}|undefined;
  try{
    const body=await req.json(),design=Number(body?.design_id),image=Number(body?.image_id),variant=body?.variant_id==null?null:Number(body.variant_id);
    if(!valid(design)||!valid(image)||(variant!==null&&!valid(variant)))return bad("ID tidak valid.");
    const db=getDb();if(!db.prepare("SELECT design_id FROM design_revisions WHERE design_id=?").get(design))return bad("Dokumen tidak ditemukan.",404);
    asset=await copyEditorAsset(image,variant);
    db.transaction(()=>{db.prepare("INSERT INTO design_assets(id,design_id,width,height) VALUES(?,?,?,?)").run(asset!.id,design,asset!.width,asset!.height);logActivity("Tambah aset editor","design",design,null);})();
    return NextResponse.json({asset},{status:201});
  }catch(e){if(asset)fs.rmSync(designAssetPath(asset.id)!,{force:true});return bad(e instanceof Error?e.message:"Gagal menambah aset.");}
}
