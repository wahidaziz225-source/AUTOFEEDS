export const DESIGN_FORMATS = {
  feed: { width: 1080, height: 1350, label: "Instagram Portrait" },
  square: { width: 1080, height: 1080, label: "Instagram Square" },
  story: { width: 1080, height: 1920, label: "Instagram Story" },
  landscape: { width: 1200, height: 630, label: "Facebook Feed" },
} as const;
export const DESIGN_FONTS = ["Arial", "Impact", "Georgia", "Verdana", "Courier New", "DejaVu Sans"] as const;
export type DesignLayer = {
  id: string; name: string; kind: "text" | "image" | "rect" | "ellipse" | "path";
  x: number; y: number; width: number; height: number; rotation: number; opacity: number;
  visible: boolean; locked: boolean; fill: string; stroke: string; strokeWidth: number;
  text?: string; fontFamily?: string; fontSize?: number; bold?: boolean; baseline?: number;
  brandRole?: "footer" | "logo";
  assetId?: string; radius?: number; d?: string; pathWidth?: number; pathHeight?: number;
};
export type CanvasFormat=keyof typeof DESIGN_FORMATS|"custom";
export function validateCanvasSize(width:unknown,height:unknown):{width:number;height:number}{
  if(typeof width!=="number"||typeof height!=="number"||!Number.isInteger(width)||!Number.isInteger(height)||width<512||height<512||width>4096||height>4096||width/height<1/3||width/height>3)throw new Error("Ukuran khusus harus 512–4096 px per sisi, dengan rasio antara 1:3 dan 3:1.");
  return {width,height};
}
export type DesignDocument = { version: 1; title: string; format: CanvasFormat; width: number; height: number; layers: DesignLayer[] };
const number = (v: unknown, low: number, high: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < low || v > high) throw new Error("Ukuran/posisi layer tidak valid.");
  return v;
};
const color = (v: unknown) => {
  if (typeof v !== "string" || !/^(#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|none)$/.test(v)) throw new Error("Warna layer tidak valid.");
  return v;
};
export function constrainLayer(layer: DesignLayer, width: number, height: number): DesignLayer {
  let w = Math.max(1, layer.width), h = Math.max(1, layer.height);
  const radians = layer.rotation * Math.PI / 180, c = Math.abs(Math.cos(radians)), s = Math.abs(Math.sin(radians));
  const scale = Math.min(1, width / (w*c+h*s), height / (w*s+h*c));
  w *= scale; h *= scale;
  const bw = w*c+h*s, bh = w*s+h*c;
  const cx = Math.min(width-bw/2, Math.max(bw/2, layer.x+layer.width/2));
  const cy = Math.min(height-bh/2, Math.max(bh/2, layer.y+layer.height/2));
  return { ...layer, x: cx-w/2, y: cy-h/2, width: w, height: h,
    ...(layer.kind === "text" ? { fontSize: (layer.fontSize ?? 32) * h / layer.height } : {}) };
}
export function validateDocument(value: unknown): DesignDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dokumen tidak valid.");
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.title !== "string" || !v.title.trim() || v.title.length > 120 || typeof v.format !== "string" || (v.format!=="custom"&&!Object.hasOwn(DESIGN_FORMATS, v.format))) throw new Error("Identitas dokumen tidak valid.");
  const format = v.format as CanvasFormat;
  if(format==="custom")validateCanvasSize(v.width,v.height);
  if (format!=="custom"&&(v.width !== DESIGN_FORMATS[format].width || v.height !== DESIGN_FORMATS[format].height)) throw new Error("Ukuran dokumen tidak sesuai format.");
  if (!Array.isArray(v.layers) || v.layers.length > 400) throw new Error("Maksimal 400 layer per desain.");
  const ids = new Set<string>();
  const layers = v.layers.map(raw => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Layer tidak valid.");
    const l = raw as Record<string, unknown>;
    if (typeof l.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(l.id) || ids.has(l.id)) throw new Error("ID layer tidak valid/duplikat.");
    ids.add(l.id);
    if (typeof l.name !== "string" || l.name.length > 120 || !["text", "image", "rect", "ellipse", "path"].includes(String(l.kind))) throw new Error("Jenis layer tidak valid.");
    if (typeof l.visible !== "boolean" || typeof l.locked !== "boolean") throw new Error("Status layer tidak valid.");
    const layer: DesignLayer = {
      id: l.id, name: l.name, kind: l.kind as DesignLayer["kind"], x: number(l.x, -4096, 4096), y: number(l.y, -4096, 4096),
      width: number(l.width, .01, 8192), height: number(l.height, .01, 8192), rotation: number(l.rotation, -360, 360),
      opacity: number(l.opacity, 0, 1), visible: l.visible, locked: l.locked,
      fill: color(l.fill), stroke: color(l.stroke), strokeWidth: number(l.strokeWidth, 0, 100),
    };
    if (l.brandRole !== undefined) { if (!["footer","logo"].includes(String(l.brandRole))) throw new Error("Peran brand tidak valid."); layer.brandRole = l.brandRole as "footer" | "logo"; }
    if (l.kind === "image") {
      if (typeof l.assetId !== "string" || !/^[0-9a-f-]{36}$/.test(l.assetId)) throw new Error("Aset gambar tidak valid.");
      layer.assetId = l.assetId;
    }
    if (l.kind === "text") {
      if (typeof l.text !== "string" || l.text.length > 2000 || !DESIGN_FONTS.includes(l.fontFamily as typeof DESIGN_FONTS[number]) || typeof l.bold !== "boolean") throw new Error("Teks/font tidak valid.");
      Object.assign(layer, { text: l.text, fontFamily: l.fontFamily, bold: l.bold,
        fontSize: number(l.fontSize, .01, 1000), baseline: number(l.baseline, 0, 2) });
    }
    if (l.kind === "rect") layer.radius = number(l.radius ?? 0, 0, 4096);
    if (l.kind === "path") {
      if (typeof l.d !== "string" || l.d.length > 12000 || !/^[MLZmlz0-9eE.,+\s-]+$/.test(l.d)) throw new Error("Bentuk path tidak valid.");
      Object.assign(layer, { d: l.d, pathWidth: number(l.pathWidth, .01, 8192), pathHeight: number(l.pathHeight, .01, 8192) });
    }
    const result = constrainLayer(layer, v.width as number, v.height as number);
    // Reject out-of-canvas edits rather than silently changing the user's geometry.
    if (Math.abs(result.x-layer.x)>.1 || Math.abs(result.y-layer.y)>.1 || Math.abs(result.width-layer.width)>.1 || Math.abs(result.height-layer.height)>.1) throw new Error("Layer keluar dari canvas. Sesuaikan ukuran/posisi terlebih dahulu.");
    return layer;
  });
  return { version: 1, title: v.title.trim(), format, width: v.width as number, height: v.height as number, layers };
}
export function newLayer(kind: DesignLayer["kind"], overrides: Partial<DesignLayer> = {}): DesignLayer {
  return { id: crypto.randomUUID(), name: kind === "text" ? "Teks baru" : "Elemen baru", kind, x: 80, y: 120, width: 360, height: 100,
    rotation: 0, opacity: 1, visible: true, locked: false, fill: "#1e293b", stroke: "none", strokeWidth: 0,
    ...(kind === "text" ? { text: "Teks baru", fontFamily: "Arial", fontSize: 64, baseline: .8, bold: true } : {}),
    ...(kind === "rect" ? { radius: 16 } : {}), ...overrides };
}
export function resizeDocument(doc: DesignDocument, format: DesignDocument["format"], width?:number, height?:number): DesignDocument {
  const size = format==="custom"?validateCanvasSize(width,height):DESIGN_FORMATS[format], sx = size.width/doc.width, sy = size.height/doc.height;
  return { ...doc, format, ...size, layers: doc.layers.map(l => {
    const scale = Math.min(sx, sy), keep = (l.kind === "image" && !["Background","Bayangan panel"].includes(l.name)) || l.kind === "text";
    const w = l.width*(keep ? scale : sx), h = l.height*(keep ? scale : sy);
    return constrainLayer({ ...l, x: (l.x+l.width/2)*sx-w/2, y: (l.y+l.height/2)*sy-h/2, width: w, height: h,
      ...(l.kind === "text" ? { fontSize: (l.fontSize ?? 32)*scale } : {}) }, size.width, size.height);
  }) };
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export function layerSvg(l: DesignLayer, assetUrl: (id: string) => string): string {
  if (!l.visible) return "";
  const common = `fill="${escape(l.fill)}" stroke="${escape(l.stroke)}" stroke-width="${l.strokeWidth}"`;
  let content = "";
  if (l.kind === "rect") content = `<rect width="${l.width}" height="${l.height}" rx="${l.radius ?? 0}" ${common}/>`;
  if (l.kind === "ellipse") content = `<ellipse cx="${l.width/2}" cy="${l.height/2}" rx="${l.width/2}" ry="${l.height/2}" ${common}/>`;
  if (l.kind === "path") content = `<path d="${escape(l.d ?? '')}" transform="scale(${l.width/l.pathWidth!} ${l.height/l.pathHeight!})" ${common}/>`;
  if (l.kind === "text") content = `<text x="0" y="${l.height*(l.baseline ?? .8)}" font-family="${escape((l.fontFamily ?? 'Arial')+',Arial,sans-serif')}" font-size="${l.fontSize}" font-weight="${l.bold ? 700 : 400}" textLength="${Math.max(1,l.width)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve" ${common}>${escape(l.text ?? '')}</text>`;
  if (l.kind === "image") content = `<image width="${l.width}" height="${l.height}" href="${escape(assetUrl(l.assetId!))}" preserveAspectRatio="none"/>`;
  return `<g data-layer-id="${escape(l.id)}" opacity="${l.opacity}" transform="translate(${l.x} ${l.y}) rotate(${l.rotation} ${l.width/2} ${l.height/2})">${content}</g>`;
}
export function documentSvg(doc: DesignDocument, assetUrl: (id: string) => string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">${doc.layers.map(l => layerSvg(l, assetUrl)).join('')}</svg>`;
}
