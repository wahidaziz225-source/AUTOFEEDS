import { selectedBrand } from "@/lib/brands";
import { validateBrandSnapshot } from "@/lib/brand-options";
import { NextResponse } from "next/server";
import { getDb, getSetting, logActivity } from "@/lib/db";
import { ollamaGenerate } from "@/lib/ollama";
import { buildPrompt, cleanOutput, CONTENT_TYPES, isContentType, isTone } from "@/lib/content";

const g = globalThis as unknown as { __autofeedsGenBusy?: boolean };

const SELECT_COLS = `id, image_id, content_type, tone, content, is_edited, is_saved, created_at, updated_at,
 (SELECT language FROM content_context c WHERE c.content_id=generated_contents.id) AS language,
 (SELECT json_extract(snapshot_json,'$.brand.name') FROM content_context c WHERE c.content_id=generated_contents.id) AS brand_name,
 EXISTS(SELECT 1 FROM content_context c WHERE c.content_id=generated_contents.id) AS can_regenerate`;

// Daftar konten: ?image_id=5  atau  ?saved=1
export async function GET(req: Request) {
  const url = new URL(req.url);
  const imageId = Number(url.searchParams.get("image_id"));
  const db = getDb();
  let rows;
  if (Number.isInteger(imageId) && imageId > 0) {
    rows = db
      .prepare(`SELECT ${SELECT_COLS} FROM generated_contents WHERE image_id = ? ORDER BY id DESC`)
      .all(imageId);
  } else if (url.searchParams.get("saved") === "1") {
    rows = db
      .prepare(`SELECT ${SELECT_COLS} FROM generated_contents WHERE is_saved = 1 ORDER BY id DESC`)
      .all();
  } else {
    return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
  }
  return NextResponse.json({ contents: rows });
}

// Buat konten: body { image_id, content_type, tone, extra }
export async function POST(req: Request) {
  if (g.__autofeedsGenBusy) {
    return NextResponse.json(
      { error: "Masih ada konten yang sedang dibuat. Tunggu sampai selesai." },
      { status: 409 }
    );
  }
  g.__autofeedsGenBusy = true;
  try {
    const raw=await req.text();
    if(raw.length>20000)return NextResponse.json({error:"Permintaan terlalu besar."},{status:413});
    let body:Record<string,unknown>;
    try{body=JSON.parse(raw);if(!body||typeof body!=="object"||Array.isArray(body))throw new Error();}catch{return NextResponse.json({error:"JSON tidak valid."},{status:400});}
    const db=getDb();let parent:number|null=null;
    let snapshot: {image_id:number;content_type:string;tone:string;extra:string;language:"id"|"en";brand:ReturnType<typeof selectedBrand>;facts:{description:string;objects:string;colors:string;visibleText:string;context:string};analysis_id:number|null;source_mode:string};
    if(body.source_content_id!==undefined){
      parent=Number(body.source_content_id);
      if(!Number.isSafeInteger(parent)||parent<=0)return NextResponse.json({error:"ID konten tidak valid."},{status:400});
      const source=db.prepare("SELECT snapshot_json FROM content_context WHERE content_id=?").get(parent) as {snapshot_json:string}|undefined;
      if(!source)return NextResponse.json({error:"Konten lama belum memiliki snapshot. Gunakan formulir untuk membuat konten baru."},{status:409});
      snapshot=JSON.parse(source.snapshot_json);snapshot.brand=validateBrandSnapshot(snapshot.brand);
    }else{
      const imageId=Number(body.image_id),type=String(body.content_type??""),tone=String(body.tone??"");
      const language=body.language??getSetting("default_language")??"id";
      if(!Number.isSafeInteger(imageId)||imageId<=0||!isContentType(type)||!isTone(tone)||!["id","en"].includes(String(language)))return NextResponse.json({error:"Permintaan tidak valid."},{status:400});
      if(!db.prepare("SELECT id FROM images WHERE id=?").get(imageId))return NextResponse.json({error:"Foto tidak ditemukan."},{status:404});
      const extra=String(body.extra??"").slice(0,1000);let brand;
      try{brand=selectedBrand(body.brand_kit_id);}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
      let facts:{description:string;objects:string;colors:string;visibleText:string;context:string},analysisId:number|null=null,sourceMode='analysis';
      if(body.manual_facts!==undefined){
        const manual=body.manual_facts as Record<string,unknown>;
        if(!manual||typeof manual!=="object"||Array.isArray(manual)||typeof manual.description!=="string"||manual.description.trim().length<3)return NextResponse.json({error:"Isi deskripsi fakta produk manual minimal 3 karakter."},{status:400});
        const read=(key:string,max:number)=>typeof manual[key]==='string'?String(manual[key]).trim().slice(0,max):'';
        facts={description:read('description',2000),objects:read('objects',500),colors:read('dominant_colors',200),visibleText:read('visible_text',1000),context:read('context',500)};sourceMode='manual';
      }else{
        const analysis=db.prepare("SELECT id,description,objects,dominant_colors,visible_text,context FROM image_analysis WHERE image_id=? ORDER BY id DESC LIMIT 1").get(imageId) as {id:number;description:string;objects:string;dominant_colors:string;visible_text:string;context:string}|undefined;
        if(!analysis)return NextResponse.json({error:"Jalankan analisis atau isi fakta produk manual."},{status:400});
        analysisId=analysis.id;facts={description:analysis.description??'',objects:analysis.objects??'',colors:analysis.dominant_colors??'',visibleText:analysis.visible_text??'',context:analysis.context??''};
      }
      snapshot={image_id:imageId,content_type:type,tone,extra,language:language as 'id'|'en',brand,facts,analysis_id:analysisId,source_mode:sourceMode};
    }
    if(!db.prepare("SELECT id FROM images WHERE id=?").get(snapshot.image_id))return NextResponse.json({error:"Foto sumber sudah dihapus."},{status:404});
    const prompt=buildPrompt({type:snapshot.content_type,tone:snapshot.tone,...snapshot.facts,extra:snapshot.extra,language:snapshot.language,brand:snapshot.brand});
    const model=getSetting("text_model");
    const rawText=await ollamaGenerate({model,prompt,temperature:.7});
    const allowed=snapshot.extra+(snapshot.source_mode==='manual'?' '+snapshot.facts.description+' '+snapshot.facts.visibleText:'');
    const text=cleanOutput(rawText,allowed);
    if(!text)return NextResponse.json({error:"AI tidak menghasilkan teks. Coba lagi."},{status:502});
    const id=db.transaction(()=>{
      const analysisId=snapshot.analysis_id&&db.prepare('SELECT id FROM image_analysis WHERE id=?').get(snapshot.analysis_id)?snapshot.analysis_id:null;
      const result=db.prepare("INSERT INTO generated_contents(image_id,analysis_id,content_type,tone,content,model) VALUES(?,?,?,?,?,?)").run(snapshot.image_id,analysisId,snapshot.content_type,snapshot.tone,text,model);
      const id=Number(result.lastInsertRowid);
      db.prepare("INSERT INTO content_context(content_id,language,snapshot_json,parent_content_id) VALUES(?,?,?,?)").run(id,snapshot.language,JSON.stringify(snapshot),parent);
      const label=CONTENT_TYPES.find(t=>t.id===snapshot.content_type)?.label??snapshot.content_type;
      logActivity("Buat konten","content",id,`${label}; ${snapshot.language}; ${snapshot.source_mode}`);return id;
    })();
    return NextResponse.json({content:db.prepare(`SELECT ${SELECT_COLS} FROM generated_contents WHERE id=?`).get(id)},{status:201});
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membuat konten." },
      { status: 500 }
    );
  } finally {
    g.__autofeedsGenBusy = false;
  }
}

// Edit / simpan: body { id, content?, is_saved? }
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
    }
    const db = getDb();
    const row = db
      .prepare("SELECT content, is_saved FROM generated_contents WHERE id = ?")
      .get(id) as { content: string; is_saved: number } | undefined;
    if (!row) return NextResponse.json({ error: "Konten tidak ditemukan." }, { status: 404 });

    let content = row.content;
    let edited = false;
    if (typeof body.content === "string") {
      const c = body.content.trim().slice(0, 10000);
      if (!c) return NextResponse.json({ error: "Konten tidak boleh kosong." }, { status: 400 });
      if (c !== row.content) {
        content = c;
        edited = true;
      }
    }
    const saved = typeof body.is_saved === "boolean" ? (body.is_saved ? 1 : 0) : row.is_saved;

    db.prepare(
      `UPDATE generated_contents
       SET content = ?, is_saved = ?, is_edited = CASE WHEN ? THEN 1 ELSE is_edited END,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(content, saved, edited ? 1 : 0, id);

    if (edited) logActivity("Edit konten", "content", id, null);
    if (saved !== row.is_saved) {
      logActivity(saved ? "Simpan konten" : "Batal simpan konten", "content", id, null);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal menyimpan." },
      { status: 500 }
    );
  }
}

// Hapus: DELETE /api/content?id=5
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID tidak valid." }, { status: 400 });
  }
  const db = getDb();
  const res = db.prepare("DELETE FROM generated_contents WHERE id = ?").run(id);
  if (res.changes === 0) {
    return NextResponse.json({ error: "Konten tidak ditemukan." }, { status: 404 });
  }
  logActivity("Hapus konten", "content", id, null);
  return NextResponse.json({ ok: true });
}