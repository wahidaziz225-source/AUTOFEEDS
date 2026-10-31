import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {promoPath} from "./promo";
const run=promisify(execFile);
// Older posters have only JPEGs; convert the stored JPEG without changing dimensions.
export async function promoPng(filename:string){
 const original=promoPath(filename),png=promoPath(filename.replace(/\.jpg$/,'.png'));
 if(!original||!png)return null;if(fs.existsSync(png))return png;if(!fs.existsSync(original))return null;
 const temporary=path.join(path.dirname(png),`.export-${crypto.randomUUID()}.png`);
 try{
  await run(process.env.AUTOFEEDS_PYTHON||'python',[path.join(process.cwd(),'scripts/convert_promo_png.py'),original,temporary],{timeout:60000,windowsHide:true});
  try{fs.copyFileSync(temporary,png,fs.constants.COPYFILE_EXCL);}catch(e){if(!fs.existsSync(png))throw e;}
  return png;
 }finally{fs.rmSync(temporary,{force:true});}
}
