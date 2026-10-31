import fs from "node:fs";
import {getDb} from "@/lib/db";
import {brandAssetPath} from "@/lib/brands";
export async function GET(req:Request){
 const id=new URL(req.url).searchParams.get('id')??'',file=brandAssetPath(id);
 if(!file||!getDb().prepare("SELECT id FROM brand_assets WHERE id=?").get(id)||!fs.existsSync(file))return new Response('Logo tidak ditemukan',{status:404});
 return new Response(new Uint8Array(fs.readFileSync(file)),{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
}
