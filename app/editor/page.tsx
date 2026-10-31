"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {exportDesign,type ExportKind} from "@/lib/design-export";
import type {BrandKit} from "@/lib/brand-options";
import { DESIGN_FORMATS, DESIGN_FONTS, constrainLayer, documentSvg, newLayer, resizeDocument, validateCanvasSize, type DesignDocument, type DesignLayer } from "@/lib/design-document";
import { commitHistory, initialHistory, undoHistory, redoHistory, type DesignHistory } from "@/lib/design-history";

type Saved = { id: number; title: string; updated_at: string };
type Photo = { id: number; name: string };
type Drag = { mode: string; startX: number; startY: number; history: DesignHistory; layer: DesignLayer };
const field="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";
const button="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium disabled:opacity-40";
async function api(url:string,body?:unknown,method="POST"){
  const response=await fetch(url,body===undefined?{cache:"no-store"}:{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Permintaan gagal.");return data;
}
const download=(blob:Blob,name:string)=>{const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

export default function EditorPage(){
  const [brands,setBrands]=useState<BrandKit[]>([]),[brandId,setBrandId]=useState(0);
  const [saved,setSaved]=useState<Saved[]>([]),[photos,setPhotos]=useState<Photo[]>([]),[photoId,setPhotoId]=useState(0);
  const [id,setId]=useState(0),[revision,setRevision]=useState(1),[history,setHistory]=useState<DesignHistory|null>(null);
  const [selected,setSelected]=useState<string|null>(null),[savedJson,setSavedJson]=useState("");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [customWidth,setCustomWidth]=useState(1200),[customHeight,setCustomHeight]=useState(900),[quality,setQuality]=useState(.95);
  const [zoom,setZoom]=useState(.45),[newFormat,setNewFormat]=useState<DesignDocument['format']>('feed');
  const canvas=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null),upload=useRef<HTMLInputElement>(null);
  const doc=history?.present??null,layer=doc?.layers.find(l=>l.id===selected),dirty=doc?JSON.stringify(doc)!==savedJson:false;
  const assetUrl=useCallback((asset:string)=>`/api/design-assets?design_id=${id}&asset_id=${asset}`,[id]);
  const refresh=useCallback(async()=>{
    const [list,images,kits]=await Promise.all([api('/api/designs'),api('/api/images'),api('/api/brand-kits')]);
    setBrands(kits.kits);setBrandId(current=>current||kits.kits.find((k:BrandKit)=>k.is_default)?.id||0);
    setSaved(list.designs);setPhotos(images.images);setPhotoId(current=>current||images.images[0]?.id||0);
  },[]);
  function accept(data:{id:number;doc:DesignDocument;revision:number}){
    setId(data.id);setRevision(data.revision);setHistory(initialHistory(data.doc));setSavedJson(JSON.stringify(data.doc));setSelected(null);setNotice("");
  }
  useEffect(()=>{
    let cancelled=false;
    (async()=>{try{
      await refresh();const initial=Number(new URLSearchParams(window.location.search).get('id'));
      if(initial>0){const data=await api(`/api/designs?id=${initial}`);if(!cancelled)accept(data);}
    }catch(e){if(!cancelled)setError((e as Error).message);}finally{if(!cancelled)setLoading(false);}})();
    return()=>{cancelled=true;};
  },[refresh]);
  const docWidth=doc?.width;
  useEffect(()=>{
    if(!docWidth||!viewport.current)return;
    const width=docWidth;
    const observer=new ResizeObserver(entries=>setZoom(Math.max(.1,Math.min(1,(entries[0].contentRect.width-24)/width))));
    observer.observe(viewport.current);return()=>observer.disconnect();
  },[docWidth]);
  useEffect(()=>{
    if(!dirty)return;
    const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    const navigate=(e:MouseEvent)=>{const a=(e.target as Element).closest?.('a');if(a&&!a.hasAttribute('download')&&new URL(a.href,location.href).pathname!==location.pathname&&!confirm('Ada perubahan yang belum disimpan. Tinggalkan editor?')){e.preventDefault();e.stopPropagation();}};
    window.addEventListener('beforeunload',unload);document.addEventListener('click',navigate,true);
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',navigate,true);};
  },[dirty]);
  function commit(next:DesignDocument){setHistory(current=>current?commitHistory(current,next):initialHistory(next));setNotice("");}
  function updateLayer(patch:Partial<DesignLayer>){if(!doc||!layer)return;const updated=constrainLayer({...layer,...patch},doc.width,doc.height);commit({...doc,layers:doc.layers.map(l=>l.id===layer.id?updated:l)});}
  async function openDesign(designId:number){if(dirty&&!confirm('Buka dokumen lain dan lepaskan perubahan yang belum disimpan?'))return;setBusy(true);setError("");try{accept(await api(`/api/designs?id=${designId}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function createDesign(){if(dirty&&!confirm('Buat dokumen baru dan lepaskan perubahan yang belum disimpan?'))return;setBusy(true);setError("");try{accept(await api('/api/designs',{format:newFormat,...(newFormat==='custom'?validateCanvasSize(customWidth,customHeight):{})}));await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function save(){if(!doc||busy)return;setBusy(true);setError("");try{const result=await api('/api/designs',{id,revision,doc},'PATCH');setRevision(result.revision);setSavedJson(JSON.stringify(doc));setNotice('Perubahan tersimpan.');await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function copyDesign(){if(!doc||busy)return;setBusy(true);setError("");try{accept(await api('/api/designs',{copy_id:id,doc}));setNotice('Salinan dokumen tersimpan; dokumen sebelumnya tetap tersedia.');await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function applyBrand(){if(!doc||!brandId||busy)return;setBusy(true);setError("");try{const result=await api('/api/design-brand',{design_id:id,revision,doc,brand_kit_id:brandId});commit(result.doc);setNotice('Brand diterapkan. Periksa susunan dan klik Simpan untuk menyimpan perubahan.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function removeDesign(){if(!id||!confirm('Hapus dokumen editor ini? Poster asal tetap tersedia.'))return;setBusy(true);setError("");try{await api(`/api/designs?id=${id}`,{},'DELETE');setHistory(null);setId(0);setSavedJson('');setSelected(null);await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  function add(kind:'text'|'rect'|'ellipse'){
    if(!doc)return;if(doc.layers.length>=400){setError('Maksimal 400 layer. Hapus layer sebelum menambah elemen.');return;}const added=constrainLayer(newLayer(kind,kind==='ellipse'?{name:'Lingkaran',width:180,height:180,fill:'#facc15'}:kind==='rect'?{name:'Bidang',fill:'#dc2626'}:{}),doc.width,doc.height);
    commit({...doc,layers:[...doc.layers,added]});setSelected(added.id);
  }
  async function importPhoto(imageId:number){
    if(!doc||!imageId)return;if(doc.layers.length>=400){setError('Maksimal 400 layer.');return;}setBusy(true);setError("");try{
      const result=await api('/api/design-assets',{design_id:id,image_id:imageId}),asset=result.asset;
      const scale=Math.min(doc.width*.5/asset.width,doc.height*.5/asset.height,1);
      const added=newLayer('image',{name:'Foto / logo',assetId:asset.id,width:asset.width*scale,height:asset.height*scale});
      commit({...doc,layers:[...doc.layers,constrainLayer(added,doc.width,doc.height)]});setSelected(added.id);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function uploadLogo(file:File){
    if(!doc)return;setBusy(true);setError("");try{
      const form=new FormData();form.append('file',file);form.append('name',file.name);
      const response=await fetch('/api/images',{method:'POST',body:form}),result=await response.json();
      if(!response.ok)throw new Error(result.error||'Upload gagal.');
      await refresh();setBusy(false);await importPhoto(result.id);
    }catch(e){setError((e as Error).message);setBusy(false);}
  }
  function duplicate(){if(!doc||!layer||layer.locked)return;if(doc.layers.length>=400){setError('Maksimal 400 layer.');return;}const copy=constrainLayer({...layer,id:crypto.randomUUID(),name:layer.name+' salinan',x:layer.x+24,y:layer.y+24},doc.width,doc.height);commit({...doc,layers:[...doc.layers,copy]});setSelected(copy.id);}
  function deleteLayer(){if(!doc||!layer||layer.locked)return;commit({...doc,layers:doc.layers.filter(l=>l.id!==layer.id)});setSelected(null);}
  function reorder(direction:number){if(!doc||!layer||layer.locked)return;const layers=[...doc.layers],from=layers.findIndex(l=>l.id===layer.id),to=Math.max(0,Math.min(layers.length-1,from+direction));[layers[from],layers[to]]=[layers[to],layers[from]];commit({...doc,layers});}
  function align(axis:'x'|'y',position:number){if(!doc||!layer||layer.locked)return;updateLayer(axis==='x'?{x:(doc.width-layer.width)*position}:{y:(doc.height-layer.height)*position});}
  function pointerDown(e:React.PointerEvent<HTMLDivElement>){
    if(!doc||!history||busy)return;
    const target=e.target as Element,handle=target.closest('[data-mode]'),node=target.closest('[data-layer-id]');
    const key=handle?selected:node?.getAttribute('data-layer-id');const chosen=doc.layers.find(l=>l.id===key);
    setSelected(chosen?.id??null);if(!chosen||chosen.locked)return;
    e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
    drag.current={mode:handle?.getAttribute('data-mode')??'move',startX:e.clientX,startY:e.clientY,history,layer:chosen};
  }
  function pointerMove(e:React.PointerEvent<HTMLDivElement>){
    const current=drag.current;if(!current||!doc||!canvas.current)return;
    const rect=canvas.current.getBoundingClientRect(),sx=doc.width/rect.width,sy=doc.height/rect.height;
    const dx=(e.clientX-current.startX)*sx,dy=(e.clientY-current.startY)*sy,l=current.layer;
    let patch:Partial<DesignLayer>={x:l.x+dx,y:l.y+dy};
    if(current.mode==='resize'){
      const angle=l.rotation*Math.PI/180,localX=dx*Math.cos(angle)+dy*Math.sin(angle),localY=-dx*Math.sin(angle)+dy*Math.cos(angle);
      let width=Math.max(4,l.width+localX),height=Math.max(4,l.height+localY);
      if(l.kind==='image'){const scale=Math.max(width/l.width,height/l.height);width=l.width*scale;height=l.height*scale;}
      patch={width,height,...(l.kind==='text'?{fontSize:(l.fontSize??32)*height/l.height}:{})};
    }
    if(current.mode==='rotate'){
      const centerX=rect.left+(l.x+l.width/2)/sx,centerY=rect.top+(l.y+l.height/2)/sy;
      patch={rotation:Math.atan2(e.clientY-centerY,e.clientX-centerX)*180/Math.PI+90};
    }
    const updated=constrainLayer({...l,...patch},doc.width,doc.height);
    setHistory({...current.history,present:{...current.history.present,layers:current.history.present.layers.map(item=>item.id===l.id?updated:item)}});
  }
  function pointerUp(){const current=drag.current;if(!current)return;setHistory(h=>h?commitHistory(current.history,h.present):h);drag.current=null;}
  async function exportFile(kind:ExportKind){
    if(!doc)return;setBusy(true);setError("");try{
      const blob=await exportDesign(doc,assetUrl,kind,quality);download(blob,`desain-${id}-${doc.width}x${doc.height}.${kind}`);
      setNotice(`${kind.toUpperCase()} ${doc.width}×${doc.height} diunduh. Perubahan dokumen tetap perlu disimpan.`);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  function applyCustomSize(){if(!doc)return;try{commit(resizeDocument(doc,'custom',customWidth,customHeight));setNotice('Ukuran khusus diterapkan. Periksa susunan lalu Simpan.');}catch(e){setError((e as Error).message);}}

  function keyboard(e:React.KeyboardEvent){
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void save();return;}
    if(busy||!history||['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();setHistory(e.shiftKey?redoHistory(history):undoHistory(history));return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();setHistory(redoHistory(history));return;}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteLayer();return;}
    if(layer&&!layer.locked&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=e.shiftKey?10:1;updateLayer({x:layer.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y:layer.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)});}
  }
  function dimension(key:'width'|'height',value:number){if(!layer||!Number.isFinite(value))return;const patch:Partial<DesignLayer>={[key]:Math.max(1,value)};if(layer.kind==='image')patch[key==='width'?'height':'width']=Math.max(1,value)*(key==='width'?layer.height/layer.width:layer.width/layer.height);if(key==='height'&&layer.kind==='text')patch.fontSize=(layer.fontSize??32)*Math.max(1,value)/layer.height;updateLayer(patch);}

  return <div className="mx-auto max-w-[1600px] space-y-4" onKeyDown={keyboard} tabIndex={-1}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Design Editor</h1><p className="mt-1 text-sm text-slate-500">Edit layer, simpan dokumen, lalu unduh hasil. Poster asal tetap tersedia.</p></div><Link href="/promo" className={button}>← Promo Composer</Link></header>
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <label className="text-xs">Canvas baru <select aria-label="Format canvas baru" value={newFormat} onChange={e=>setNewFormat(e.target.value as DesignDocument['format'])} className="ml-2 rounded border p-1">{Object.entries(DESIGN_FORMATS).map(([key,size])=><option key={key} value={key}>{size.label}</option>)}<option value="custom">Ukuran khusus</option></select></label>
      {newFormat==='custom'&&<><input aria-label="Lebar canvas baru" type="number" min="512" max="4096" value={customWidth} onChange={e=>setCustomWidth(Number(e.target.value))} className="w-24 rounded border p-2 text-xs"/><span>×</span><input aria-label="Tinggi canvas baru" type="number" min="512" max="4096" value={customHeight} onChange={e=>setCustomHeight(Number(e.target.value))} className="w-24 rounded border p-2 text-xs"/></>}
      <button disabled={busy||loading} onClick={createDesign} className={button}>Buat desain baru</button>
      <select aria-label="Buka dokumen" disabled={busy} value={id||''} onChange={e=>void openDesign(Number(e.target.value))} className="max-w-64 rounded-lg border p-2 text-xs"><option value="">Buka dokumen tersimpan</option>{saved.map(d=><option key={d.id} value={d.id}>#{d.id} · {d.title}</option>)}</select>
      {busy&&<span role="status" className="text-xs text-indigo-600">Memproses…</span>}
    </div>
    {loading?<p className="p-6 text-sm text-slate-500">Memuat editor…</p>:!doc?<div className="rounded-2xl border bg-white p-8 text-sm text-slate-600">Buat canvas baru atau pilih <strong>Edit desain (salinan)</strong> pada hasil Promo Composer.</div>:<>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input aria-label="Nama desain" value={doc.title} maxLength={120} onChange={e=>commit({...doc,title:e.target.value})} className="min-w-0 rounded-lg border p-2 text-sm"/>
        <button onClick={save} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">Simpan{dirty?' *':''}</button>
        <button disabled={!history?.past.length} onClick={()=>setHistory(h=>h?undoHistory(h):h)} className={button}>Undo</button><button disabled={!history?.future.length} onClick={()=>setHistory(h=>h?redoHistory(h):h)} className={button}>Redo</button>
        <button onClick={()=>void exportFile('jpg')} className={button}>Unduh JPG</button><button onClick={()=>void exportFile('png')} className={button}>Unduh PNG</button><button onClick={()=>void exportFile('svg')} className={button}>Unduh SVG</button>
        <button onClick={copyDesign} className={button}>Salin dokumen</button>
        <button onClick={removeDesign} className={button+' text-rose-600'}>Hapus dokumen</button>
        <select aria-label="Brand Kit editor" value={brandId} onChange={e=>setBrandId(Number(e.target.value))} className="max-w-48 rounded-lg border p-2 text-xs"><option value={0}>Pilih Brand Kit</option>{brands.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}</select><button disabled={!brandId} onClick={applyBrand} className={button}>Terapkan Brand Kit</button>
        <span className="text-xs text-slate-500">#{id} · revisi {revision} · {dirty?'Belum disimpan':'Tersimpan'}</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-[200px_minmax(0,1fr)_260px]">
        <section className="min-w-0 space-y-3 rounded-xl border bg-white p-3">
          <h2 className="text-sm font-semibold">Layer ({doc.layers.length}/400)</h2>
          <div className="flex flex-wrap gap-1"><button onClick={()=>add('text')} className={button}>+ Teks</button><button onClick={()=>add('rect')} className={button}>+ Bidang</button><button onClick={()=>add('ellipse')} className={button}>+ Lingkaran</button></div>
          <label className="block text-xs">Foto tersimpan<select value={photoId||''} onChange={e=>setPhotoId(Number(e.target.value))} className={field}><option value="">Pilih foto</option>{photos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <div className="flex flex-wrap gap-1"><button disabled={!photoId} onClick={()=>void importPhoto(photoId)} className={button}>+ Foto</button><button onClick={()=>upload.current?.click()} className={button}>Upload logo/foto</button></div>
          <input ref={upload} aria-label="Upload logo atau foto" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadLogo(file);e.target.value='';}}/>
          <div className="max-h-80 space-y-1 overflow-y-auto xl:max-h-[36rem]">{[...doc.layers].reverse().map(l=><button key={l.id} onClick={()=>setSelected(l.id)} className={`block w-full truncate rounded-lg px-2 py-2 text-left text-xs ${selected===l.id?'bg-indigo-100 text-indigo-800':'bg-slate-50 text-slate-600'}`} title={l.name}>{l.locked?'🔒 ':''}{!l.visible?'(tersembunyi) ':''}{l.name}</button>)}</div>
        </section>
        <section className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs"><label>Zoom <input aria-label="Zoom canvas" type="range" min="0.1" max="1.5" step="0.05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><span>{Math.round(zoom*100)}%</span><label>JPG <select aria-label="Kualitas JPG" value={quality} onChange={e=>setQuality(Number(e.target.value))} className="rounded border p-1"><option value={.85}>85%</option><option value={.95}>95%</option><option value={1}>100%</option></select></label>
            <select aria-label="Ukuran canvas" value={doc.format} onChange={e=>{if(e.target.value==='custom'){setCustomWidth(doc.width);setCustomHeight(doc.height);commit(resizeDocument(doc,'custom',doc.width,doc.height));}else commit(resizeDocument(doc,e.target.value as DesignDocument['format']));}} className="rounded border p-1">{Object.entries(DESIGN_FORMATS).map(([key,size])=><option key={key} value={key}>{size.width}×{size.height}</option>)}<option value="custom">Ukuran khusus</option></select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs"><span>Ukuran khusus:</span><input aria-label="Lebar khusus" type="number" min="512" max="4096" value={customWidth} onChange={e=>setCustomWidth(Number(e.target.value))} className="w-24 rounded border p-2"/>×<input aria-label="Tinggi khusus" type="number" min="512" max="4096" value={customHeight} onChange={e=>setCustomHeight(Number(e.target.value))} className="w-24 rounded border p-2"/><button onClick={applyCustomSize} className={button}>Terapkan ukuran</button></div>
          <div ref={viewport} className="max-h-[48rem] min-w-0 overflow-auto rounded-xl bg-slate-200 p-3">
            <div ref={canvas} tabIndex={0} role="application" aria-label="Canvas editor. Pilih layer lalu gunakan tombol panah untuk menggeser." className="relative bg-white shadow-lg outline-none" style={{width:doc.width*zoom,height:doc.height*zoom,touchAction:'none'}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
              <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{__html:documentSvg(doc,assetUrl)}}/>
              {layer&&layer.visible&&<svg viewBox={`0 0 ${doc.width} ${doc.height}`} className="pointer-events-none absolute inset-0 h-full w-full"><g transform={`translate(${layer.x} ${layer.y}) rotate(${layer.rotation} ${layer.width/2} ${layer.height/2})`}><rect width={layer.width} height={layer.height} fill="none" stroke="#4f46e5" strokeWidth={2/zoom}/>{!layer.locked&&<><rect data-mode="resize" x={layer.width-6/zoom} y={layer.height-6/zoom} width={12/zoom} height={12/zoom} fill="#4f46e5" className="pointer-events-auto cursor-nwse-resize"/><line x1={layer.width/2} y1="0" x2={layer.width/2} y2={-24/zoom} stroke="#4f46e5" strokeWidth={2/zoom}/><circle data-mode="rotate" cx={layer.width/2} cy={-24/zoom} r={6/zoom} fill="#4f46e5" className="pointer-events-auto cursor-grab"/></>}</g></svg>}
            </div>
          </div>
          <p className="text-xs text-slate-500">Seret untuk memindah; pegangan kotak untuk ukuran dan bulatan untuk rotasi. Foto tetap proporsional. Ctrl+S: simpan · Ctrl+Z/Y: undo/redo · panah: geser. Harga, harga coret, dan diskon merupakan layer terpisah. PNG mempertahankan transparansi; sembunyikan Background jika tidak diperlukan.</p>
        </section>
        <section className="min-w-0 space-y-3 rounded-xl border bg-white p-3">
          <h2 className="text-sm font-semibold">Properti layer</h2>
          {!layer?<p className="text-xs text-slate-500">Pilih layer pada canvas atau daftar layer.</p>:<>
            <label className="block text-xs">Nama layer<input value={layer.name} maxLength={120} onChange={e=>updateLayer({name:e.target.value})} className={field}/></label>
            <div className="flex gap-3 text-xs"><label><input type="checkbox" checked={layer.visible} onChange={e=>updateLayer({visible:e.target.checked})}/> Tampilkan</label><label><input type="checkbox" checked={layer.locked} onChange={e=>updateLayer({locked:e.target.checked})}/> Kunci</label></div>
            <fieldset disabled={layer.locked} className="space-y-3 disabled:opacity-50">
              {layer.kind==='text'&&<>
                <label className="block text-xs">Isi teks<textarea aria-label="Isi teks" value={layer.text} maxLength={2000} onChange={e=>updateLayer({text:e.target.value.replace(/\r?\n/g,' ')})} className={field}/></label>
                <label className="block text-xs">Font<select value={layer.fontFamily} onChange={e=>updateLayer({fontFamily:e.target.value})} className={field}>{DESIGN_FONTS.map(f=><option key={f}>{f}</option>)}</select></label>
                <label className="block text-xs">Ukuran font<input type="number" min="6" max="600" value={Math.round(layer.fontSize??32)} onChange={e=>{const value=Number(e.target.value);if(value>=6&&value<=600)updateLayer({fontSize:value,height:layer.height*value/(layer.fontSize??32)});}} className={field}/></label>
                <label className="flex gap-2 text-xs"><input type="checkbox" checked={layer.bold} onChange={e=>updateLayer({bold:e.target.checked})}/>Tebal</label>
              </>}
              {layer.kind!=='image'&&<div className="flex justify-between text-xs"><label>Warna <input aria-label="Warna layer" type="color" value={/^#[0-9a-fA-F]{6}/.test(layer.fill)?layer.fill.slice(0,7):'#ffffff'} onChange={e=>updateLayer({fill:e.target.value})}/></label><label>Garis <input aria-label="Warna garis" type="color" value={/^#[0-9a-fA-F]{6}/.test(layer.stroke)?layer.stroke.slice(0,7):'#000000'} onChange={e=>updateLayer({stroke:e.target.value,strokeWidth:Math.max(1,layer.strokeWidth)})}/></label></div>}
              {layer.kind==='image'&&<button className={button} onClick={()=>updateLayer({kind:'rect',fill:'#f8fafc',stroke:'none',strokeWidth:0,radius:0})}>Ganti gambar dengan bidang warna</button>}
              <div className="grid grid-cols-2 gap-2">{(['x','y','width','height','rotation'] as const).map(key=><label key={key} className="text-xs">{{x:'Posisi X',y:'Posisi Y',width:'Lebar',height:'Tinggi',rotation:'Rotasi'}[key]}<input aria-label={key} type="number" step="1" value={Math.round(layer[key])} onChange={e=>{const value=Number(e.target.value);if(!Number.isFinite(value))return;if(key==='width'||key==='height')dimension(key,value);else updateLayer({[key]:key==='rotation'?Math.max(-360,Math.min(360,value)):value});}} className={field}/></label>)}</div>
              <label className="block text-xs">Opacity {Math.round(layer.opacity*100)}%<input aria-label="Opacity" type="range" min="0" max="1" step="0.05" value={layer.opacity} onChange={e=>updateLayer({opacity:Number(e.target.value)})} className="w-full"/></label>
              {layer.kind==='rect'&&<label className="block text-xs">Sudut membulat<input type="number" min="0" max="4096" value={Math.round(layer.radius??0)} onChange={e=>updateLayer({radius:Math.max(0,Math.min(4096,Number(e.target.value)))})} className={field}/></label>}
              <div className="flex flex-wrap gap-1"><button onClick={()=>align('x',0)} className={button}>Kiri</button><button onClick={()=>align('x',.5)} className={button}>Tengah X</button><button onClick={()=>align('x',1)} className={button}>Kanan</button><button onClick={()=>align('y',0)} className={button}>Atas</button><button onClick={()=>align('y',.5)} className={button}>Tengah Y</button><button onClick={()=>align('y',1)} className={button}>Bawah</button></div>
              <div className="flex flex-wrap gap-1"><button onClick={()=>reorder(1)} className={button}>Naik layer</button><button onClick={()=>reorder(-1)} className={button}>Turun layer</button><button onClick={duplicate} className={button}>Duplikat</button><button onClick={deleteLayer} className={button+' text-rose-600'}>Hapus layer</button></div>
            </fieldset>
          </>}
        </section>
      </div>
      </fieldset>
    </>}
  </div>;
}
