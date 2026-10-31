import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { UPLOAD_DIR } from "./storage";
import { copyEditorAsset, designAssetPath } from "./design-storage";
import { BRAND_DEFAULTS, validateBrandSnapshot, type BrandKit, type BrandSnapshot } from "./brand-options";
export const BRAND_ASSET_DIR=path.join(UPLOAD_DIR,"brand-assets");
export const brandAssetPath=(id:string)=>/^[0-9a-f-]{36}$/.test(id)?path.join(BRAND_ASSET_DIR,`${id}.png`):null;
export function listBrands():BrandKit[]{
 const rows=getDb().prepare(`SELECT b.*,COALESCE(p.revision,1) AS revision,p.options_json FROM brand_kits b LEFT JOIN brand_profiles p ON p.brand_id=b.id ORDER BY b.is_default DESC,b.id DESC`).all() as Record<string,unknown>[];
 return rows.map(row=>({...BRAND_DEFAULTS,...(row.options_json?JSON.parse(String(row.options_json)):{}),id:Number(row.id),revision:Number(row.revision),name:String(row.name),primary_color:String(row.primary_color),secondary_color:String(row.secondary_color),accent_color:String(row.accent_color),font_family:String(row.font_family),footer_text:String(row.footer_text??""),is_default:row.is_default===1,logo_asset_id:row.logo_filename?String(row.logo_filename).replace(/\.png$/,''):null}));
}
export function selectedBrand(value:unknown):BrandSnapshot|null{
 if(value===0||value===null)return null;
 const kits=listBrands();
 if(value===undefined)return kits.find(k=>k.is_default)??null;
 const id=Number(value);if(!Number.isSafeInteger(id)||id<=0)throw new Error("ID Brand Kit tidak valid.");
 const kit=kits.find(k=>k.id===id);if(!kit)throw new Error("Brand Kit tidak ditemukan.");return validateBrandSnapshot(kit);
}
export async function copyBrandLogo(imageId:number){
 const asset=await copyEditorAsset(imageId);fs.mkdirSync(BRAND_ASSET_DIR,{recursive:true});
 const destination=brandAssetPath(asset.id)!;
 try{fs.renameSync(designAssetPath(asset.id)!,destination);return asset;}
 catch(e){fs.rmSync(designAssetPath(asset.id)!,{force:true});throw e;}
}
export function rendererBrand(snapshot:BrandSnapshot|null){
 if(!snapshot)return undefined;
 const logo=snapshot.logo_asset_id?brandAssetPath(snapshot.logo_asset_id):null;
 if(logo&&!fs.existsSync(logo))throw new Error("Logo brand tersimpan tidak ditemukan.");
 return {name:snapshot.name,primary_color:snapshot.primary_color,secondary_color:snapshot.secondary_color,accent_color:snapshot.accent_color,font_family:snapshot.font_family,logo_path:logo};
}
