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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at);
CREATE INDEX IF NOT EXISTS idx_images_category ON images(category_id);
CREATE INDEX IF NOT EXISTS idx_analysis_image ON image_analysis(image_id);
CREATE INDEX IF NOT EXISTS idx_contents_image ON generated_contents(image_id);
CREATE INDEX IF NOT EXISTS idx_contents_created ON generated_contents(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at);
`;

export const DEFAULT_SETTINGS: Record<string, string> = {
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