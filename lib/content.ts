export const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "hard_selling", label: "Hard Selling" },
  { id: "soft_selling", label: "Soft Selling" },
  { id: "profesional", label: "Profesional" },
  { id: "santai", label: "Santai" },
  { id: "persuasif", label: "Persuasif" },
  { id: "promosi", label: "Promosi" },
  { id: "informatif", label: "Informatif" },
  { id: "kreatif", label: "Kreatif" },
] as const;
// Compare actual currency values; weights and telephone digits never authorize prices.
const PRICE = /\b(?:Rp\.?|IDR)\s*(\d+(?:[.,]\d+)*)(?:\s*(rb|ribu|k|jt|juta))?(?![A-Za-z0-9]|[.,]\d)/gi;
export function priceValue(number:string,suffix=''):number|null{
  const unit=suffix.toLowerCase();let value:number;
  if(unit){
    if(!/^\d+(?:[.,]\d{1,3})?$/.test(number))return null;
    value=Number(number.replace(',','.'))*(/^(jt|juta)$/.test(unit)?1_000_000:1000);
  }else{
    if(!/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(number))return null;
    value=Number(number.replace(/[.,]/g,''));
  }
  return Number.isSafeInteger(value)&&value>0?value:null;
}
export function cleanOutput(text: string, authorizedFacts: string): string {
  const allowed=new Set<number>();
  for(const match of authorizedFacts.matchAll(new RegExp(PRICE.source,'gi'))){const value=priceValue(match[1],match[2]);if(value!==null)allowed.add(value);}
  return text.replace(new RegExp(PRICE.source,'gi'),(whole,number:string,suffix:string)=>{
    const value=priceValue(number,suffix);return value!==null&&allowed.has(value)?whole:'[isi harga]';
  }).replace(/\*\*/g,'').trim().slice(0,10000);
}
