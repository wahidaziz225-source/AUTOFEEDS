import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getDb } from "./db";
import { UPLOAD_DIR, resolveUploadPath } from "./storage";
import { processedPath } from "./image-processing";
import { constrainLayer, validateDocument, type DesignDocument } from "./design-document";
import { rendererBrand } from "./brands";
import { validateBrandSnapshot } from "./brand-options";
import type { PromoSpec, PromoSpecItem } from "./promo";
const run = promisify(execFile);
export const ASSET_DIR = path.join(UPLOAD_DIR, "design-assets");
export function designAssetPath(id: string) { return /^[0-9a-f-]{36}$/.test(id) ? path.join(ASSET_DIR, `${id}.png`) : null; }
export function imageSource(imageId: number, variantId?: number | null): string {
  const db = getDb();
  const row = variantId
    ? db.prepare("SELECT stored_filename FROM image_variants WHERE image_id=? AND id=?").get(imageId, variantId)
    : db.prepare("SELECT stored_filename FROM images WHERE id=?").get(imageId);
  const file = row as { stored_filename: string } | undefined;
  const source = file && (variantId ? processedPath(file.stored_filename) : resolveUploadPath(file.stored_filename));
  if (!source || !fs.existsSync(source)) throw new Error("Foto sumber tidak tersedia. Pilih foto yang masih tersimpan.");
  return source;
}
export async function copyEditorAsset(imageId: number, variantId?: number | null) {
  const source = imageSource(imageId, variantId), id = crypto.randomUUID();
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  const destination = designAssetPath(id)!;
  const specFile = path.join(ASSET_DIR, `${id}.json`);
  fs.writeFileSync(specFile, JSON.stringify({ source, destination }));
  try {
    const { stdout } = await run(process.env.AUTOFEEDS_PYTHON || "python", [path.join(process.cwd(), "scripts/copy_design_asset.py"), specFile], { timeout: 60_000, windowsHide: true });
    const size = JSON.parse(stdout.trim()) as { width: number; height: number };
    return { id, ...size };
  } catch { fs.rmSync(destination, { force: true }); throw new Error("Gagal menyalin aset foto. Periksa Python/Pillow dan ukuran gambar."); }
  finally { fs.rmSync(specFile, { force: true }); }
}
export async function tracePromo(promoId: number) {
  const row = getDb().prepare(`SELECT p.items_json,p.title,p.layout_format,p.theme,m.request_json,m.seed,m.style,m.layout_variant
    FROM promo_designs p LEFT JOIN promo_generation m ON m.design_id=p.id WHERE p.id=?`).get(promoId) as
    { items_json: string; title: string; layout_format: string; theme: string; request_json: string | null; seed: number; style: string; layout_variant: number } | undefined;
  if (!row) throw new Error("Poster tidak ditemukan.");
  if (!row.request_json) throw new Error("Poster ini belum memiliki data layer. Buat poster baru melalui Promo Composer terlebih dahulu.");
  const request = JSON.parse(row.request_json), metadata = JSON.parse(row.items_json);
  const items: PromoSpecItem[] = metadata.items.map((i: { image_id: number; variant_id: number | null; name: string; price: string; old: string; tag: string }) => ({
    path: imageSource(i.image_id, i.variant_id), name: i.name, price_text: i.price, old_text: i.old, tag: i.tag,
  }));
  const spec: PromoSpec = { width:request.width, height:request.height, format: row.layout_format, theme: row.theme, seed: row.seed, style: row.style,
    layout_variant: row.layout_variant, brand: rendererBrand(validateBrandSnapshot(request.brand_snapshot)), mode: request.promo_type === "bundling" ? "bundle" : "items",
    title: typeof request.title === "string" ? request.title : row.title, subtitle: request.subtitle || "", footer: request.footer || "", badge: request.badge || "", items, bundle: metadata.bundle };
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  const folder = fs.mkdtempSync(path.join(ASSET_DIR, ".trace-"));
  const copied: string[] = [];
  try {
    const specFile = path.join(folder, "spec.json"); fs.writeFileSync(specFile, JSON.stringify(spec));
    await run(process.env.AUTOFEEDS_PYTHON || "python", [path.join(process.cwd(), "scripts/compose_promo.py"), specFile, path.join(folder, "preview.jpg"), folder], { timeout: 60_000, windowsHide: true });
    const raw = JSON.parse(fs.readFileSync(path.join(folder,"document.json"),"utf8")) as DesignDocument & { assets: { id: string; width: number; height: number }[] };
    // Keep imported geometry safely within the canvas; source prices/text are unchanged.
    raw.layers = raw.layers.map(l => constrainLayer(l, raw.width, raw.height));
    const doc = validateDocument(raw);
    for (const asset of raw.assets) {
      const destination = designAssetPath(asset.id);
      if (!destination) throw new Error("Aset renderer tidak valid.");
      fs.copyFileSync(path.join(folder,`${asset.id}.png`),destination,fs.constants.COPYFILE_EXCL); copied.push(asset.id);
    }
    return { doc, assets: raw.assets };
  } catch (error) {
    for (const id of copied) fs.rmSync(designAssetPath(id)!,{force:true});
    throw error;
  } finally { fs.rmSync(folder,{recursive:true,force:true}); }
}

export function cloneDocument(sourceId:number,input?:unknown){
 const db=getDb(),row=db.prepare("SELECT d.doc_json FROM designs d JOIN design_revisions r ON r.design_id=d.id WHERE d.id=?").get(sourceId) as {doc_json:string}|undefined;
 if(!row)throw new Error("Dokumen sumber tidak ditemukan.");
 const doc=validateDocument(input??JSON.parse(row.doc_json)),assets:{id:string;width:number;height:number}[]=[],mapping=new Map<string,string>();
 try{
  for(const layer of doc.layers)if(layer.kind==='image'){
   const old=layer.assetId!;
   if(!mapping.has(old)){
    const asset=db.prepare("SELECT width,height FROM design_assets WHERE id=? AND design_id=?").get(old,sourceId) as {width:number;height:number}|undefined;
    const file=designAssetPath(old);if(!asset||!file||!fs.existsSync(file))throw new Error("Aset sumber hilang atau bukan milik dokumen.");
    const id=crypto.randomUUID();fs.copyFileSync(file,designAssetPath(id)!,fs.constants.COPYFILE_EXCL);assets.push({id,...asset});mapping.set(old,id);
   }
   layer.assetId=mapping.get(old)!;
  }
  return {doc,assets};
 }catch(e){for(const asset of assets)fs.rmSync(designAssetPath(asset.id)!,{force:true});throw e;}
}
