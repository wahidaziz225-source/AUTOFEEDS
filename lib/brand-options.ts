export const BRAND_FONTS=["Arial","Impact","Georgia","Verdana","Courier New","DejaVu Sans"] as const;
export const BRAND_DEFAULTS={name:"",primary_color:"#dc2626",secondary_color:"#1e293b",accent_color:"#facc15",font_family:"Arial",footer_text:"",voice:"",promo_style:"retail",promo_format:"feed",promo_title:"PROMO SPESIAL",promo_badge:"PROMO",tone:"profesional",language:"id",is_default:false};
export type BrandFields=typeof BRAND_DEFAULTS;
export type BrandKit=BrandFields&{id:number;revision:number;logo_asset_id:string|null};
export type BrandSnapshot=BrandKit;
const STYLES=["premium","flash","frozen","editorial","retail","spotlight"],FORMATS=["feed","square","story","landscape"];
const TONES=["profesional","santai","persuasif","promosi","informatif","kreatif","friendly","hard_selling","soft_selling"];
export function validateBrand(value:unknown):BrandFields{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Brand Kit tidak valid.");
 const raw=value as Record<string,unknown>,out={...BRAND_DEFAULTS};
 const limits={name:100,footer_text:80,voice:600,promo_title:40,promo_badge:16} as const;
 for(const key of Object.keys(limits) as (keyof typeof limits)[]){const v=raw[key]??out[key];if(typeof v!=="string"||v.length>limits[key])throw new Error(`Isi ${key} terlalu panjang/tidak valid.`);out[key]=v.trim();}
 if(!out.name)throw new Error("Nama brand wajib diisi.");
 for(const key of ["primary_color","secondary_color","accent_color"] as const){const v=raw[key]??out[key];if(typeof v!=="string"||!/^#[0-9a-fA-F]{6}$/.test(v))throw new Error("Warna brand harus HEX enam digit.");out[key]=v;}
 const choices={font_family:BRAND_FONTS,promo_style:STYLES,promo_format:FORMATS,tone:TONES,language:["id","en"]} as const;
 for(const key of Object.keys(choices) as (keyof typeof choices)[]){const v=raw[key]??out[key];if(typeof v!=="string"||!(choices[key] as readonly string[]).includes(v))throw new Error(`Pilihan ${key} tidak valid.`);out[key]=v;}
 if(raw.is_default!==undefined&&typeof raw.is_default!=="boolean")throw new Error("Status default tidak valid.");out.is_default=(raw.is_default??false) as boolean;return out;
}
export function validateBrandSnapshot(raw:unknown):BrandSnapshot|null{
 if(raw==null)return null;
 const fields=validateBrand(raw),v=raw as Record<string,unknown>;
 if(!Number.isSafeInteger(v.id)||Number(v.id)<=0||!Number.isSafeInteger(v.revision)||Number(v.revision)<1)throw new Error("Snapshot brand tidak valid.");
 if(v.logo_asset_id!==null&&(typeof v.logo_asset_id!=="string"||!/^[0-9a-f-]{36}$/.test(v.logo_asset_id)))throw new Error("Logo tidak valid.");
 return {...fields,id:Number(v.id),revision:Number(v.revision),logo_asset_id:v.logo_asset_id as string|null};
}
