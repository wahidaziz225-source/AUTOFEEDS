import fs from "node:fs";
import { NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { DESIGN_FORMATS, validateCanvasSize, newLayer, validateDocument, type DesignDocument } from "@/lib/design-document";
import { cloneDocument, designAssetPath, tracePromo } from "@/lib/design-storage";
const bad = (error: string, status=400) => NextResponse.json({error},{status});
const idOk = (n: number) => Number.isSafeInteger(n)&&n>0;
const SELECT = `SELECT d.id,d.title,d.format,d.width,d.height,d.updated_at,r.revision,r.source_promo_id FROM designs d JOIN design_revisions r ON r.design_id=d.id`;
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id"), db=getDb();
  if (id === null) return NextResponse.json({designs:db.prepare(`${SELECT} WHERE NOT EXISTS(SELECT 1 FROM brand_templates t WHERE t.design_id=d.id) ORDER BY d.id DESC LIMIT 100`).all()});
  if (!idOk(Number(id))) return bad("ID desain tidak valid.");
  const row=db.prepare(`SELECT d.doc_json,r.revision FROM designs d JOIN design_revisions r ON r.design_id=d.id WHERE d.id=?`).get(Number(id)) as {doc_json:string;revision:number}|undefined;
  if(!row)return bad("Desain tidak ditemukan.",404);
  return NextResponse.json({id:Number(id),doc:JSON.parse(row.doc_json),revision:row.revision});
}
export async function POST(req: Request) {
  let assets: {id:string;width:number;height:number}[]=[];
  let persisted=false;
  try {
    const raw=await req.text();if(raw.length>2_000_000)return bad("Dokumen terlalu besar.",413);
    const body=JSON.parse(raw); if (!body||typeof body!=="object"||Array.isArray(body)) return bad("Permintaan tidak valid.");
    let doc: DesignDocument, source: number|null=null;
    if (body.copy_id !== undefined) {
      const sourceId=Number(body.copy_id);
      if(!idOk(sourceId)||body.promo_id!==undefined)return bad("Dokumen sumber tidak valid.");
      const result=cloneDocument(sourceId,body.doc);doc=result.doc;assets=result.assets;
      doc.title=(doc.title+" salinan").slice(0,120);
    } else if (body.promo_id !== undefined) {
      source=Number(body.promo_id); if (!idOk(source)) return bad("ID poster tidak valid.");
      const result=await tracePromo(source);doc=result.doc;assets=result.assets;
    } else {
      const format=body.format??"feed";
      if (typeof format!=="string" || (format!=="custom"&&!Object.hasOwn(DESIGN_FORMATS,format))) return bad("Format tidak valid.");
      const key=format as DesignDocument["format"];
      const size=key==="custom"?validateCanvasSize(body.width,body.height):DESIGN_FORMATS[key];
      doc={version:1,title:"Desain baru",format:key,width:size.width,height:size.height,layers:[newLayer("rect",{name:"Background",x:0,y:0,width:size.width,height:size.height,fill:"#f8fafc",locked:true,radius:0})]};
    }
    const db=getDb();
    const id=db.transaction(()=>{
      const result=db.prepare(`INSERT INTO designs(title,format,width,height,style,doc_json,is_saved) VALUES(?,?,?,?,?,?,1)`)
        .run(doc.title,doc.format,doc.width,doc.height,"editor",JSON.stringify(doc));
      const id=Number(result.lastInsertRowid);
      db.prepare("INSERT INTO design_revisions(design_id,source_promo_id) VALUES(?,?)").run(id,source);
      const insert=db.prepare("INSERT INTO design_assets(id,design_id,width,height) VALUES(?,?,?,?)");
      for (const asset of assets) insert.run(asset.id,id,asset.width,asset.height);
      logActivity("Buat dokumen editor","design",id,source?`Salinan poster ${source}`:"Canvas baru");return id;
    })();
    persisted=true;return NextResponse.json({id,doc,revision:1},{status:201});
  } catch(e) {return bad(e instanceof Error?e.message:"Gagal membuat dokumen.",400);}
  finally {if(!persisted) for(const asset of assets) fs.rmSync(designAssetPath(asset.id)!,{force:true});}
}
export async function PATCH(req: Request) {
  try {
    const raw=await req.text(); if(raw.length>2_000_000) return bad("Dokumen terlalu besar.",413);
    const body=JSON.parse(raw),id=Number(body?.id),revision=body?.revision;
    if(!idOk(id)||!idOk(revision)) return bad("ID/revisi tidak valid.");
    const doc=validateDocument(body.doc),db=getDb();
    const current=db.prepare("SELECT revision FROM design_revisions WHERE design_id=?").get(id) as {revision:number}|undefined;
    if(!current)return bad("Desain tidak ditemukan.",404);
    if(current.revision!==revision)return bad("Desain telah diperbarui di tab lain. Muat ulang atau simpan sebagai dokumen baru.",409);
    const owns=db.prepare("SELECT id FROM design_assets WHERE id=? AND design_id=?");
    for(const layer of doc.layers) if(layer.kind==="image" && (!owns.get(layer.assetId,id)||!fs.existsSync(designAssetPath(layer.assetId!)!))) return bad("Aset gambar bukan milik dokumen ini atau file hilang.");
    const updated=db.transaction(()=>{
      const result=db.prepare("UPDATE design_revisions SET revision=revision+1 WHERE design_id=? AND revision=?").run(id,revision);
      if(!result.changes)return false;
      db.prepare("UPDATE designs SET title=?,format=?,width=?,height=?,doc_json=?,updated_at=datetime('now') WHERE id=?")
        .run(doc.title,doc.format,doc.width,doc.height,JSON.stringify(doc),id);
      logActivity("Simpan edit desain","design",id,`Revisi ${revision+1}`);return true;
    })();
    if(!updated)return bad("Konflik revisi. Muat ulang desain.",409);
    return NextResponse.json({ok:true,revision:revision+1});
  } catch(e){return bad(e instanceof Error?e.message:"Dokumen tidak valid.");}
}
export async function DELETE(req: Request) {
  const id=Number(new URL(req.url).searchParams.get("id"));if(!idOk(id))return bad("ID tidak valid.");
  const db=getDb();if(!db.prepare("SELECT design_id FROM design_revisions WHERE design_id=?").get(id))return bad("Desain tidak ditemukan.",404);
  const assets=db.prepare("SELECT id FROM design_assets WHERE design_id=?").all(id) as {id:string}[];
  db.transaction(()=>{db.prepare("DELETE FROM designs WHERE id=?").run(id);logActivity("Hapus dokumen editor","design",id,null);})();
  for(const asset of assets)fs.rmSync(designAssetPath(asset.id)!,{force:true});
  return NextResponse.json({ok:true});
}
