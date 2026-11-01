"""Creative Styles Library for AUTOfEEDS AI Creative Studio.
Defines 16 distinct visual styles, category-specific visual intelligence,
and procedural background and lighting effects.
"""

import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

# 16 Distinct Visual Styles
DESIGN_STYLES = {
    "premium_ad": {
        "id": "premium_ad",
        "name": "Premium Product Advertising",
        "tagline": "Panggung studio mewah, pencahayaan dramatis, dan tipografi elegan.",
        "bg_type": "studio_spotlight",
        "primary": (18, 20, 26),
        "secondary": (30, 35, 48),
        "accent": (245, 158, 11),
        "text": (255, 255, 255),
        "muted": (148, 163, 184),
        "pedestal": True,
        "badge_style": "gold_capsule",
    },
    "modern_minimalist": {
        "id": "modern_minimalist",
        "name": "Modern Minimalist",
        "tagline": "Ruang negatif lega, komposisi bersih, dan estetika arsitektural.",
        "bg_type": "clean_neutral",
        "primary": (248, 250, 252),
        "secondary": (241, 245, 249),
        "accent": (15, 23, 42),
        "text": (15, 23, 42),
        "muted": (100, 116, 139),
        "pedestal": False,
        "badge_style": "minimal_tag",
    },
    "luxury_commercial": {
        "id": "luxury_commercial",
        "name": "Luxury Commercial",
        "tagline": "Nuansa hitam arang, aksen emas berkilau, dan suasana eksklusif.",
        "bg_type": "luxury_onyx",
        "primary": (12, 13, 16),
        "secondary": (24, 27, 34),
        "accent": (217, 119, 6),
        "text": (255, 255, 255),
        "muted": (156, 163, 175),
        "pedestal": True,
        "badge_style": "gold_seal",
    },
    "bold_promo": {
        "id": "bold_promo",
        "name": "Bold Promotional Design",
        "tagline": "Energi tinggi, diskon mencolok, dan kontras komersial tegas.",
        "bg_type": "dynamic_burst",
        "primary": (225, 29, 72),
        "secondary": (159, 18, 57),
        "accent": (250, 204, 21),
        "text": (255, 255, 255),
        "muted": (254, 205, 211),
        "pedestal": False,
        "badge_style": "flash_banner",
    },
    "food_photo": {
        "id": "food_photo",
        "name": "Food Photography Advertisement",
        "tagline": "Pencahayaan hangat menggugah selera dengan suasana kuliner gourmet.",
        "bg_type": "warm_culinary",
        "primary": (69, 26, 3),
        "secondary": (120, 53, 15),
        "accent": (245, 158, 11),
        "text": (255, 255, 255),
        "muted": (253, 230, 138),
        "pedestal": True,
        "badge_style": "organic_stamp",
    },
    "3d_product": {
        "id": "3d_product",
        "name": "3D Product Advertising",
        "tagline": "Podium 3D dengan pencahayaan isometrik dan bayangan mengambang nyata.",
        "bg_type": "podium_3d",
        "primary": (30, 27, 75),
        "secondary": (49, 46, 129),
        "accent": (129, 140, 248),
        "text": (255, 255, 255),
        "muted": (199, 210, 254),
        "pedestal": True,
        "badge_style": "floating_orb",
    },
    "editorial": {
        "id": "editorial",
        "name": "Editorial Magazine",
        "tagline": "Layout majalah fashion asimetris dengan tipografi artistik berani.",
        "bg_type": "magazine_grid",
        "primary": (245, 245, 244),
        "secondary": (231, 229, 228),
        "accent": (120, 53, 15),
        "text": (28, 25, 23),
        "muted": (120, 113, 108),
        "pedestal": False,
        "badge_style": "editorial_pill",
    },
    "clean_commercial": {
        "id": "clean_commercial",
        "name": "Clean Commercial Layout",
        "tagline": "Standar official store marketplace: rapi, informatif, dan terpercaya.",
        "bg_type": "clean_store",
        "primary": (241, 245, 249),
        "secondary": (226, 232, 240),
        "accent": (14, 165, 233),
        "text": (15, 23, 42),
        "muted": (71, 85, 105),
        "pedestal": True,
        "badge_style": "trust_badge",
    },
    "korean_style": {
        "id": "korean_style",
        "name": "Korean Advertising Style",
        "tagline": "Estetika pastel lembut, sudut membulat, dan pencahayaan studio hangat.",
        "bg_type": "soft_pastel",
        "primary": (253, 242, 248),
        "secondary": (245, 208, 226),
        "accent": (219, 39, 119),
        "text": (74, 4, 38),
        "muted": (157, 23, 77),
        "pedestal": True,
        "badge_style": "rounded_pastel",
    },
    "japanese_minimalist": {
        "id": "japanese_minimalist",
        "name": "Japanese Minimalist",
        "tagline": "Ketenangan Zen, kertas bertekstur alami, dan harmoni ruang seimbang.",
        "bg_type": "zen_paper",
        "primary": (250, 248, 245),
        "secondary": (238, 234, 226),
        "accent": (185, 28, 28),
        "text": (41, 37, 36),
        "muted": (120, 113, 108),
        "pedestal": False,
        "badge_style": "hanko_seal",
    },
    "modern_typography": {
        "id": "modern_typography",
        "name": "Modern Typography",
        "tagline": "Headline raksasa terintegrasi dengan produk dalam gaya modern Bauhaus.",
        "bg_type": "type_integrated",
        "primary": (15, 23, 42),
        "secondary": (30, 41, 59),
        "accent": (234, 88, 12),
        "text": (255, 255, 255),
        "muted": (148, 163, 184),
        "pedestal": False,
        "badge_style": "heavy_block",
    },
    "cinematic": {
        "id": "cinematic",
        "name": "Cinematic Product Poster",
        "tagline": "Efek pencahayaan volumetrik dramatis dengan nuansa blockbuster film.",
        "bg_type": "volumetric_light",
        "primary": (8, 12, 20),
        "secondary": (19, 29, 45),
        "accent": (56, 189, 248),
        "text": (255, 255, 255),
        "muted": (148, 163, 184),
        "pedestal": True,
        "badge_style": "lens_flare_badge",
    },
    "flash_sale": {
        "id": "flash_sale",
        "name": "Flash Sale Promotion",
        "tagline": "Rasa urgensi tinggi dengan stiker diskon berenergi dan aksen neon.",
        "bg_type": "neon_energy",
        "primary": (67, 20, 7),
        "secondary": (124, 45, 18),
        "accent": (251, 191, 36),
        "text": (255, 255, 255),
        "muted": (254, 215, 170),
        "pedestal": False,
        "badge_style": "urgent_tag",
    },
    "catalog_design": {
        "id": "catalog_design",
        "name": "Catalog Product Design",
        "tagline": "Grid spesifikasi rapi dengan fitur berpoin untuk katalog ritel.",
        "bg_type": "clean_specs",
        "primary": (255, 255, 255),
        "secondary": (241, 245, 249),
        "accent": (37, 99, 235),
        "text": (15, 23, 42),
        "muted": (100, 116, 139),
        "pedestal": True,
        "badge_style": "spec_pill",
    },
    "creative_collage": {
        "id": "creative_collage",
        "name": "Creative Collage",
        "tagline": "Komposisi berlapis tekstur kertas, stiker estetis, dan blok diagonal.",
        "bg_type": "diagonal_collage",
        "primary": (243, 244, 246),
        "secondary": (229, 231, 235),
        "accent": (236, 72, 153),
        "text": (17, 24, 39),
        "muted": (107, 114, 128),
        "pedestal": False,
        "badge_style": "tape_sticker",
    },
    "frozen_food": {
        "id": "frozen_food",
        "name": "Premium Frozen Food Advertisement",
        "tagline": "Efek kabut dingin kristal dipadukan dengan kesegaran produk makanan.",
        "bg_type": "frost_culinary",
        "primary": (14, 116, 144),
        "secondary": (8, 51, 68),
        "accent": (251, 191, 36),
        "text": (255, 255, 255),
        "muted": (207, 250, 254),
        "pedestal": True,
        "badge_style": "frozen_ice_pill",
    },
}

# Product Categories with visual rules
PRODUCT_CATEGORIES = {
    "food": {
        "id": "food",
        "label": "Makanan & Kuliner",
        "recommended_styles": ["food_photo", "frozen_food", "bold_promo", "premium_ad"],
        "temp": "warm",
    },
    "beverage": {
        "id": "beverage",
        "label": "Minuman & Segar",
        "recommended_styles": ["cinematic", "bold_promo", "korean_style", "3d_product"],
        "temp": "fresh",
    },
    "beauty": {
        "id": "beauty",
        "label": "Kecantikan & Skincare",
        "recommended_styles": ["korean_style", "modern_minimalist", "luxury_commercial", "editorial"],
        "temp": "soft",
    },
    "fashion": {
        "id": "fashion",
        "label": "Fashion & Apparel",
        "recommended_styles": ["editorial", "modern_typography", "creative_collage", "japanese_minimalist"],
        "temp": "chic",
    },
    "electronics": {
        "id": "electronics",
        "label": "Elektronik & Gadget",
        "recommended_styles": ["3d_product", "cinematic", "clean_commercial", "premium_ad"],
        "temp": "cyber",
    },
    "household": {
        "id": "household",
        "label": "Kebutuhan Rumah Tangga",
        "recommended_styles": ["clean_commercial", "catalog_design", "bold_promo", "modern_minimalist"],
        "temp": "clean",
    },
    "general": {
        "id": "general",
        "label": "Semua Kategori (Umum)",
        "recommended_styles": list(DESIGN_STYLES.keys()),
        "temp": "neutral",
    },
}

# Content Sizes
CONTENT_FORMATS = {
    "portrait": (1080, 1350, "Instagram Portrait 4:5"),
    "square": (1080, 1080, "Instagram Feed 1:1"),
    "story": (1080, 1920, "Instagram Story / Reels 9:16"),
    "facebook": (1200, 630, "Facebook Post Landscape"),
    "banner": (1200, 400, "Banner Promosi"),
}


def mix_colors(c1, c2, t):
    t = max(0.0, min(1.0, float(t)))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def generate_style_background(W, H, style_conf, rng):
    bg_type = style_conf.get("bg_type", "studio_spotlight")
    p1 = style_conf["primary"]
    p2 = style_conf["secondary"]
    accent = style_conf["accent"]

    # 1. Base gradient
    gw, gh = max(32, W // 16), max(32, H // 16)
    thumb = Image.new("RGB", (gw, gh), p1)
    td = ImageDraw.Draw(thumb)
    for y in range(gh):
        t = y / max(1, gh - 1)
        col = mix_colors(p1, p2, math.pow(t, 1.15))
        td.line([(0, y), (gw, y)], fill=col)
    canvas = thumb.resize((W, H), Image.Resampling.BICUBIC).convert("RGBA")

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    # 2. Procedural effects based on style type
    if bg_type in ("studio_spotlight", "luxury_onyx", "volumetric_light"):
        # Central dramatic ambient light
        spot_w, spot_h = int(W * 1.2), int(H * 0.75)
        spot_x, spot_y = (W - spot_w) // 2, int(H * 0.18)
        spot_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        glow_color = (*accent, 60) if bg_type == "luxury_onyx" else (255, 255, 255, 45)
        ImageDraw.Draw(spot_img).ellipse([spot_x, spot_y, spot_x + spot_w, spot_y + spot_h], fill=glow_color)
        spot_img = spot_img.filter(ImageFilter.GaussianBlur(int(W * 0.16)))
        overlay = Image.alpha_composite(overlay, spot_img)

        # Micro sparkle stars
        od = ImageDraw.Draw(overlay)
        for _ in range(6):
            sx, sy = int(W * rng.uniform(0.06, 0.94)), int(H * rng.uniform(0.04, 0.94))
            sr = int(rng.uniform(6, 12))
            od.polygon([(sx, sy - sr * 2), (sx + sr // 2, sy - sr // 2), (sx + sr * 2, sy),
                        (sx + sr // 2, sy + sr // 2), (sx, sy + sr * 2), (sx - sr // 2, sy + sr // 2),
                        (sx - sr * 2, sy), (sx - sr // 2, sy - sr // 2)], fill=(*accent, rng.randint(90, 160)))

    elif bg_type in ("warm_culinary", "frost_culinary"):
        # Culinary warmth or cold frost bokeh
        for _ in range(5):
            r = int(W * rng.uniform(0.14, 0.30))
            cx = int(W * rng.uniform(-0.1, 1.1))
            cy = int(H * rng.uniform(0.1, 0.85))
            orb = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(orb).ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*accent, rng.randint(20, 45)))
            orb = orb.filter(ImageFilter.GaussianBlur(int(r * 0.5)))
            overlay = Image.alpha_composite(overlay, orb)

    elif bg_type in ("clean_neutral", "zen_paper", "magazine_grid"):
        # Subtle architectural grid or serene negative space lines
        od = ImageDraw.Draw(overlay)
        margin = int(W * 0.05)
        # Refined frame border
        od.rectangle([margin, margin, W - margin, H - margin], outline=(*p2, 100), width=1)

    elif bg_type in ("dynamic_burst", "neon_energy"):
        # Burst energy rays
        cx, cy = W // 2, int(H * 0.15)
        n, R = 24, max(W, H) * 1.5
        od = ImageDraw.Draw(overlay)
        for i in range(0, n, 2):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            od.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)),
                        (cx + R * math.cos(a1), cy + R * math.sin(a1))], fill=(255, 255, 255, 18))

    return Image.alpha_composite(canvas, overlay)


def draw_3d_podium(canvas, px, py, pw, ph, accent, p2):
    # Renders an elegant 3D cylindrical pedestal strictly underneath the product base
    cx = px + pw // 2
    base_y = py + ph
    podium_w = int(pw * 1.15)
    podium_h = max(20, int(ph * 0.12))

    x0 = cx - podium_w // 2
    y0 = base_y - int(podium_h * 0.4)
    x1 = cx + podium_w // 2
    y1 = y0 + podium_h
    body_h = max(30, int(ph * 0.18))

    # 1. Pedestal grounding drop shadow
    pad = 40
    s_img = Image.new("RGBA", (podium_w + pad * 2, podium_h + body_h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(s_img).ellipse([pad, pad + body_h, pad + podium_w, pad + body_h + podium_h + 10], fill=(0, 0, 0, 110))
    s_img = s_img.filter(ImageFilter.GaussianBlur(16))
    canvas.alpha_composite(s_img, (x0 - pad, y0 - pad + 10))

    d = ImageDraw.Draw(canvas)
    # 2. Cylinder vertical side walls
    d.rectangle([x0, y0 + podium_h // 2, x1, y0 + podium_h // 2 + body_h], fill=(*p2, 240))

    # 3. Bottom ellipse
    d.ellipse([x0, y0 + body_h, x1, y1 + body_h], fill=(*p2, 255))

    # 4. Top stage surface (sleek reflection)
    d.ellipse([x0, y0, x1, y1], fill=(*mix_colors(p2, (255, 255, 255), 0.35), 250), outline=(*accent, 200), width=2)
    # Inner subtle rim
    d.ellipse([x0 + 4, y0 + 2, x1 - 4, y1 - 2], outline=(255, 255, 255, 140), width=1)
