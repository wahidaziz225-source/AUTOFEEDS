import type { DesignDocument } from "./design-document";
export type DesignHistory = { past: DesignDocument[]; present: DesignDocument; future: DesignDocument[] };
export const initialHistory = (doc: DesignDocument): DesignHistory => ({ past: [], present: doc, future: [] });
export function commitHistory(h: DesignHistory, doc: DesignDocument): DesignHistory {
  if (JSON.stringify(h.present) === JSON.stringify(doc)) return h;
  return { past: [...h.past, h.present].slice(-80), present: doc, future: [] };
}
export function undoHistory(h: DesignHistory): DesignHistory {
  if (!h.past.length) return h;
  return { past: h.past.slice(0,-1), present: h.past[h.past.length-1], future: [h.present,...h.future] };
}
export function redoHistory(h: DesignHistory): DesignHistory {
  if (!h.future.length) return h;
  return { past: [...h.past,h.present].slice(-80), present: h.future[0], future: h.future.slice(1) };
}
