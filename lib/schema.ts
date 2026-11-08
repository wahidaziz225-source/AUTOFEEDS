export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS image_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  stored_filename TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  options_json TEXT NOT NULL,
  engine TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_variants_image ON image_variants(image_id);

CREATE TABLE IF NOT EXISTS image_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  description TEXT,
  objects TEXT,
  dominant_colors TEXT,
  visible_text TEXT,
  context TEXT,
  raw_response TEXT,
  model TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generated_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  analysis_id INTEGER REFERENCES image_analysis(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL,
  tone TEXT,
  content TEXT NOT NULL,
  is_edited INTEGER NOT NULL DEFAULT 0,
  is_saved INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS promo_designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  layout_format TEXT NOT NULL,
  theme TEXT NOT NULL,
  items_json TEXT NOT NULL,
  output_filename TEXT NOT NULL UNIQUE,
  preview_filename TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS promo_generation (
  design_id INTEGER PRIMARY KEY REFERENCES promo_designs(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL,
  request_json TEXT NOT NULL,
  style TEXT NOT NULL,
  seed INTEGER NOT NULL,
  layout_variant INTEGER NOT NULL DEFAULT 0,
  is_saved INTEGER NOT NULL DEFAULT 0,
  parent_design_id INTEGER REFERENCES promo_designs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_promo_batch ON promo_generation(batch_id);
-- Fase 1: tabel untuk desain berbasis layer dan Brand Kit (dipakai fase 2-7)
CREATE TABLE IF NOT EXISTS designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  format TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  style TEXT,
  doc_json TEXT NOT NULL,
  thumb_filename TEXT,
  is_saved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS design_revisions (
  design_id INTEGER PRIMARY KEY REFERENCES designs(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1,
  source_promo_id INTEGER REFERENCES promo_designs(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS design_assets (
  id TEXT PRIMARY KEY,
  design_id INTEGER NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_design_assets_owner ON design_assets(design_id);
CREATE TABLE IF NOT EXISTS brand_kits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  logo_filename TEXT,
  primary_color TEXT NOT NULL DEFAULT '#dc2626',
  secondary_color TEXT NOT NULL DEFAULT '#1e293b',
  accent_color TEXT NOT NULL DEFAULT '#facc15',
  font_family TEXT NOT NULL DEFAULT 'Arial',
  footer_text TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS brand_profiles (
  brand_id INTEGER PRIMARY KEY REFERENCES brand_kits(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1,
  options_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS brand_assets (
  id TEXT PRIMARY KEY,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS brand_templates (
  design_id INTEGER PRIMARY KEY REFERENCES designs(id) ON DELETE CASCADE,
  brand_id INTEGER REFERENCES brand_kits(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS content_context (
  content_id INTEGER PRIMARY KEY REFERENCES generated_contents(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  parent_content_id INTEGER REFERENCES generated_contents(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_designs_created ON designs(created_at);
CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at);
CREATE INDEX IF NOT EXISTS idx_images_category ON images(category_id);
CREATE INDEX IF NOT EXISTS idx_analysis_image ON image_analysis(image_id);
CREATE INDEX IF NOT EXISTS idx_contents_image ON generated_contents(image_id);
CREATE INDEX IF NOT EXISTS idx_contents_created ON generated_contents(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at);
`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  ai_provider: "gemini",
  image_provider: "cloudflare",
  cloudflare_account_id: "",
  cloudflare_api_token: "",
  cloudflare_image_model: "@cf/black-forest-labs/flux-2-klein-4b",
  openai_api_key: "",
  openai_image_model: "gpt-image-2.5-sunburst",
  gemini_api_key: "",
  gemini_text_model: "gemini-2.5-flash",
  gemini_vision_model: "gemini-2.5-flash",
  gemini_image_model: "gemini-2.5-flash-image",
  ollama_url: "http://localhost:11434",
  vision_model: "qwen2.5vl:3b",
  text_model: "qwen2.5:3b",
  ollama_timeout_seconds: "600",
  max_upload_mb: "10",
  default_language: "id",
};

export const DEFAULT_CATEGORIES = [
  "Produk",
  "Makanan & Minuman",
  "Fashion",
  "Promosi Toko",
  "Lainnya",
];
