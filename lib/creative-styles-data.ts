export interface CreativeStyle {
  id: string;
  name: string;
  tagline: string;
  bg_type: string;
  primary: [number, number, number];
  secondary: [number, number, number];
  accent: [number, number, number];
  text: [number, number, number];
  muted: [number, number, number];
  pedestal: boolean;
  badge_style: string;
}

export interface CreativeCategory {
  id: string;
  label: string;
  recommended_styles: string[];
  temp: string;
}

export interface ContentFormat {
  id: string;
  label: string;
  width: number;
  height: number;
  aspect: string;
}

export const CREATIVE_STYLES: CreativeStyle[] = [
  {
    id: "premium_ad",
    name: "Premium Product Advertising",
    tagline: "Panggung studio mewah, pencahayaan dramatis, dan tipografi elegan.",
    bg_type: "studio_spotlight",
    primary: [18, 20, 26],
    secondary: [30, 35, 48],
    accent: [245, 158, 11],
    text: [255, 255, 255],
    muted: [148, 163, 184],
    pedestal: true,
    badge_style: "gold_capsule"
  },
  {
    id: "modern_minimalist",
    name: "Modern Minimalist",
    tagline: "Ruang negatif lega, komposisi bersih, dan estetika arsitektural.",
    bg_type: "clean_neutral",
    primary: [248, 250, 252],
    secondary: [241, 245, 249],
    accent: [15, 23, 42],
    text: [15, 23, 42],
    muted: [100, 116, 139],
    pedestal: false,
    badge_style: "minimal_tag"
  },
  {
    id: "luxury_commercial",
    name: "Luxury Commercial",
    tagline: "Nuansa hitam arang, aksen emas berkilau, dan suasana eksklusif.",
    bg_type: "luxury_onyx",
    primary: [12, 13, 16],
    secondary: [24, 27, 34],
    accent: [217, 119, 6],
    text: [255, 255, 255],
    muted: [156, 163, 175],
    pedestal: true,
    badge_style: "gold_seal"
  },
  {
    id: "bold_promo",
    name: "Bold Promotional Design",
    tagline: "Energi tinggi, diskon mencolok, dan kontras komersial tegas.",
    bg_type: "dynamic_burst",
    primary: [225, 29, 72],
    secondary: [159, 18, 57],
    accent: [250, 204, 21],
    text: [255, 255, 255],
    muted: [254, 205, 211],
    pedestal: false,
    badge_style: "flash_banner"
  },
  {
    id: "food_photo",
    name: "Food Photography Advertisement",
    tagline: "Pencahayaan hangat menggugah selera dengan suasana kuliner gourmet.",
    bg_type: "warm_culinary",
    primary: [69, 26, 3],
    secondary: [120, 53, 15],
    accent: [245, 158, 11],
    text: [255, 255, 255],
    muted: [253, 230, 138],
    pedestal: true,
    badge_style: "organic_stamp"
  },
  {
    id: "3d_product",
    name: "3D Product Advertising",
    tagline: "Podium 3D dengan pencahayaan isometrik dan bayangan mengambang nyata.",
    bg_type: "podium_3d",
    primary: [30, 27, 75],
    secondary: [49, 46, 129],
    accent: [129, 140, 248],
    text: [255, 255, 255],
    muted: [199, 210, 254],
    pedestal: true,
    badge_style: "floating_orb"
  },
  {
    id: "editorial",
    name: "Editorial Magazine",
    tagline: "Layout majalah fashion asimetris dengan tipografi artistik berani.",
    bg_type: "magazine_grid",
    primary: [245, 245, 244],
    secondary: [231, 229, 228],
    accent: [120, 53, 15],
    text: [28, 25, 23],
    muted: [120, 113, 108],
    pedestal: false,
    badge_style: "editorial_pill"
  },
  {
    id: "clean_commercial",
    name: "Clean Commercial Layout",
    tagline: "Standar official store marketplace: rapi, informatif, dan terpercaya.",
    bg_type: "clean_store",
    primary: [241, 245, 249],
    secondary: [226, 232, 240],
    accent: [14, 165, 233],
    text: [15, 23, 42],
    muted: [71, 85, 105],
    pedestal: true,
    badge_style: "trust_badge"
  },
  {
    id: "korean_style",
    name: "Korean Advertising Style",
    tagline: "Estetika pastel lembut, sudut membulat, dan pencahayaan studio hangat.",
    bg_type: "soft_pastel",
    primary: [253, 242, 248],
    secondary: [245, 208, 226],
    accent: [219, 39, 119],
    text: [74, 4, 38],
    muted: [157, 23, 77],
    pedestal: true,
    badge_style: "rounded_pastel"
  },
  {
    id: "japanese_minimalist",
    name: "Japanese Minimalist",
    tagline: "Ketenangan Zen, kertas bertekstur alami, dan harmoni ruang seimbang.",
    bg_type: "zen_paper",
    primary: [250, 248, 245],
    secondary: [238, 234, 226],
    accent: [185, 28, 28],
    text: [41, 37, 36],
    muted: [120, 113, 108],
    pedestal: false,
    badge_style: "hanko_seal"
  },
  {
    id: "modern_typography",
    name: "Modern Typography",
    tagline: "Headline raksasa terintegrasi dengan produk dalam gaya modern Bauhaus.",
    bg_type: "type_integrated",
    primary: [15, 23, 42],
    secondary: [30, 41, 59],
    accent: [234, 88, 12],
    text: [255, 255, 255],
    muted: [148, 163, 184],
    pedestal: false,
    badge_style: "heavy_block"
  },
  {
    id: "cinematic",
    name: "Cinematic Product Poster",
    tagline: "Efek pencahayaan volumetrik dramatis dengan nuansa blockbuster film.",
    bg_type: "volumetric_light",
    primary: [8, 12, 20],
    secondary: [19, 29, 45],
    accent: [56, 189, 248],
    text: [255, 255, 255],
    muted: [148, 163, 184],
    pedestal: true,
    badge_style: "lens_flare_badge"
  },
  {
    id: "flash_sale",
    name: "Flash Sale Promotion",
    tagline: "Rasa urgensi tinggi dengan stiker diskon berenergi dan aksen neon.",
    bg_type: "neon_energy",
    primary: [67, 20, 7],
    secondary: [124, 45, 18],
    accent: [251, 191, 36],
    text: [255, 255, 255],
    muted: [254, 215, 170],
    pedestal: false,
    badge_style: "urgent_tag"
  },
  {
    id: "catalog_design",
    name: "Catalog Product Design",
    tagline: "Grid spesifikasi rapi dengan fitur berpoin untuk katalog ritel.",
    bg_type: "clean_specs",
    primary: [255, 255, 255],
    secondary: [241, 245, 249],
    accent: [37, 99, 235],
    text: [15, 23, 42],
    muted: [100, 116, 139],
    pedestal: true,
    badge_style: "spec_pill"
  },
  {
    id: "creative_collage",
    name: "Creative Collage",
    tagline: "Komposisi berlapis tekstur kertas, stiker estetis, dan blok diagonal.",
    bg_type: "diagonal_collage",
    primary: [243, 244, 246],
    secondary: [229, 231, 235],
    accent: [236, 72, 153],
    text: [17, 24, 39],
    muted: [107, 114, 128],
    pedestal: false,
    badge_style: "tape_sticker"
  },
  {
    id: "frozen_food",
    name: "Premium Frozen Food Advertisement",
    tagline: "Efek kabut dingin kristal dipadukan dengan kesegaran produk makanan.",
    bg_type: "frost_culinary",
    primary: [14, 116, 144],
    secondary: [8, 51, 68],
    accent: [251, 191, 36],
    text: [255, 255, 255],
    muted: [207, 250, 254],
    pedestal: true,
    badge_style: "frozen_ice_pill"
  }
];

export const PRODUCT_CATEGORIES: CreativeCategory[] = [
  { id: "general", label: "Semua Kategori (Umum)", recommended_styles: ["premium_ad", "modern_minimalist", "bold_promo", "3d_product"], temp: "neutral" },
  { id: "food", label: "Makanan & Kuliner", recommended_styles: ["food_photo", "frozen_food", "bold_promo", "premium_ad"], temp: "warm" },
  { id: "beverage", label: "Minuman & Segar", recommended_styles: ["cinematic", "bold_promo", "korean_style", "3d_product"], temp: "fresh" },
  { id: "beauty", label: "Kecantikan & Skincare", recommended_styles: ["korean_style", "modern_minimalist", "luxury_commercial", "editorial"], temp: "soft" },
  { id: "fashion", label: "Fashion & Apparel", recommended_styles: ["editorial", "modern_typography", "creative_collage", "japanese_minimalist"], temp: "chic" },
  { id: "electronics", label: "Elektronik & Gadget", recommended_styles: ["3d_product", "cinematic", "clean_commercial", "premium_ad"], temp: "cyber" },
  { id: "household", label: "Kebutuhan Rumah Tangga", recommended_styles: ["clean_commercial", "catalog_design", "bold_promo", "modern_minimalist"], temp: "clean" }
];

export const CONTENT_FORMATS: ContentFormat[] = [
  { id: "portrait", label: "Instagram Portrait 4:5 (1080 × 1350)", width: 1080, height: 1350, aspect: "4:5" },
  { id: "square", label: "Instagram Feed 1:1 (1080 × 1080)", width: 1080, height: 1080, aspect: "1:1" },
  { id: "story", label: "Instagram Story / Reels 9:16 (1080 × 1920)", width: 1080, height: 1920, aspect: "9:16" },
  { id: "facebook", label: "Facebook Post (1200 × 630)", width: 1200, height: 630, aspect: "1.91:1" },
  { id: "banner", label: "Banner Promosi (1200 × 400)", width: 1200, height: 400, aspect: "3:1" }
];
