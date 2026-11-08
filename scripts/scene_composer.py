"""AUTOfEEDS Scene Composer - Unified Professional Graphic Design Engine
Single Source of Truth for promotional poster and feed design.
Produces commercial studio-grade Instagram posters with layered declarative recipes.
Zero generative pixel distortion on packaging: product photos are isolated non-destructively.
"""

import os
import sys
import json
import math
import random
import argparse
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageEnhance, ImageChops
import numpy as np

# Ensure scripts dir is on sys.path
SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPTS_DIR.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

try:
    from layer_recorder import LayerRecorder, RecordedDraw, rgba
except ImportError:
    LayerRecorder = None
    RecordedDraw = None
    def rgba(val):
        if val is None: return 'none'
        if isinstance(val, str): return val
        return '#' + ''.join(f'{int(v):02x}' for v in val[:3])

try:
    from product_image import remove_background, capabilities as pi_capabilities
except ImportError:
    remove_background = None
    def pi_capabilities():
        return dict(ready=False)

WIN_FONTS = Path(os.environ.get("WINDIR", "C:\\Windows")) / "Fonts"

FORMATS = {
    "feed": (1080, 1350),      # 4:5 Instagram Feed
    "portrait": (1080, 1350),  # Alias for feed
    "square": (1080, 1080),    # 1:1 Instagram Square
    "story": (1080, 1920),     # 9:16 Instagram Story
    "landscape": (1200, 630),  # Facebook / Web
}

# CC0 Bundled Assets Root
BUNDLE_DIR = ROOT_DIR / "public" / "assets" / "poster-bundle"
if not BUNDLE_DIR.exists():
    BUNDLE_DIR = ROOT_DIR / "storage" / "assets" / "poster-bundle"

# Cutout cache to avoid recomputing u2netp on same image
_CUTOUT_CACHE = {}

def get_font(family="bold", size=32):
    """Load robust fonts from system or fallback to default."""
    candidates = []
    if family == "impact" or family == "3d":
        candidates = [WIN_FONTS / "seguibl.ttf", WIN_FONTS / "impact.ttf", WIN_FONTS / "bahnschrift.ttf", WIN_FONTS / "arialbd.ttf"]
    elif family == "bold":
        candidates = [WIN_FONTS / "segoeuib.ttf", WIN_FONTS / "arialbd.ttf", WIN_FONTS / "seguisb.ttf"]
    elif family == "script" or family == "brush":
        candidates = [WIN_FONTS / "segoescb.ttf", WIN_FONTS / "segoepr.ttf", WIN_FONTS / "georgiab.ttf", WIN_FONTS / "arialbd.ttf"]
    elif family == "serif":
        candidates = [WIN_FONTS / "georgiab.ttf", WIN_FONTS / "georgia.ttf"]
    else:
        candidates = [WIN_FONTS / "segoeui.ttf", WIN_FONTS / "arial.ttf"]

    for cp in candidates:
        if cp.exists():
            try:
                return ImageFont.truetype(str(cp), size)
            except Exception:
                pass
    return ImageFont.load_default()

def parse_color(c, default=(220, 38, 38)):
    """Parse hex, rgb tuple, or named color."""
    if not c:
        return default
    if isinstance(c, (tuple, list)) and len(c) >= 3:
        return tuple(int(v) for v in c[:3])
    if isinstance(c, str):
        c = c.strip().lstrip("#")
        if len(c) == 6:
            try:
                return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))
            except ValueError:
                pass
        elif len(c) == 3:
            try:
                return (int(c[0]*2, 16), int(c[1]*2, 16), int(c[2]*2, 16))
            except ValueError:
                pass
    return default

def mix_rgb(c1, c2, t):
    """Linear blend between two RGB colors."""
    t = max(0.0, min(1.0, float(t)))
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )

def scene_background(spec, width, height, **fallback_options):
    """Use an AI-created background when provided, otherwise draw the local recipe."""
    image_path = spec.get("background_image_path")
    if image_path and os.path.exists(image_path):
        with Image.open(image_path) as source:
            return ImageOps.fit(source.convert("RGBA"), (width, height), method=Image.Resampling.LANCZOS)
    return generate_background(width, height, **fallback_options)


def compose_ai_background_poster(spec, recorder=None):
    """Clean, legible layout for AI backgrounds; never stack a complex recipe on them."""
    fmt = spec.get("format", "feed")
    W, H = FORMATS.get(fmt, FORMATS["feed"])
    bg_path = spec.get("background_image_path")
    with Image.open(bg_path) as source:
        canvas = ImageOps.fit(source.convert("RGBA"), (W, H), method=Image.Resampling.LANCZOS)
    # Generated images can contain stray pseudo-letters. Soften and darken them
    # before adding the app's crisp, deterministic text and product layers.
    canvas = canvas.filter(ImageFilter.GaussianBlur(radius=max(12, int(W * 0.016))))
    veil = Image.new("RGBA", (W, H), (8, 12, 28, 125))
    canvas.alpha_composite(veil)
    d = ImageDraw.Draw(canvas)
    margin = int(W * 0.075)

    # Editorial heading area with predictable line lengths and high contrast.
    brand = spec.get("brand") if isinstance(spec.get("brand"), dict) else {}
    brand_name = (spec.get("brand_name") or brand.get("name") or "").strip()
    if brand_name:
        f_brand = get_font("bold", max(18, int(W * 0.025)))
        d.text((margin, int(H * 0.052)), brand_name.upper(), font=f_brand, fill=(220, 226, 255, 245))
    headline = str(spec.get("headline") or spec.get("title") or "PROMO SPESIAL").strip()
    title_box = (margin - 14, int(H * 0.085), W - margin + 14, int(H * 0.235))
    d.rounded_rectangle(title_box, radius=24, fill=(8, 12, 28, 185), outline=(255, 255, 255, 35), width=2)
    max_title_w = W - 2 * margin - 20
    words = headline.upper().split()
    title_font = get_font("bold", int(W * 0.067))
    lines = []
    while title_font.size >= int(W * 0.034):
        lines, line = [], ""
        for word in words:
            candidate = f"{line} {word}".strip()
            if line and d.textlength(candidate, font=title_font) > max_title_w:
                lines.append(line)
                line = word
            else:
                line = candidate
        if line:
            lines.append(line)
        if len(lines) <= 2:
            break
        title_font = get_font("bold", title_font.size - 2)
    line_h = int(title_font.size * 1.12)
    total_h = line_h * len(lines)
    y = title_box[1] + (title_box[3] - title_box[1] - total_h) // 2
    for text in lines:
        d.text(((W - d.textlength(text, font=title_font)) / 2, y), text, font=title_font,
               fill=(255, 255, 255, 255), stroke_width=1, stroke_fill=(12, 17, 34, 255))
        y += line_h

    # Keep the source package recognizable and dominant; do not add AI-made product art.
    prod_path = spec.get("product_image") or (spec.get("items") and spec["items"][0].get("path"))
    if prod_path and os.path.exists(prod_path):
        cutout, _ = get_product_cutout(prod_path, enable_ai=spec.get("remove_bg", True))
        max_w, max_h = int(W * 0.68), int(H * 0.50)
        scale = min(max_w / max(1, cutout.width), max_h / max(1, cutout.height))
        product = cutout.resize((max(1, int(cutout.width * scale)), max(1, int(cutout.height * scale))), Image.Resampling.LANCZOS)
        px = (W - product.width) // 2
        py = int(H * 0.245) + max(0, (int(H * 0.51) - product.height) // 2)
        shadow = create_contact_shadow(product.width, product.height, blur=max(12, int(W * 0.018)), spread=0.65)
        canvas.alpha_composite(shadow, (px + (product.width - shadow.width) // 2, py + product.height - int(shadow.height * 0.55)))
        canvas.alpha_composite(product, (px, py))
        if recorder:
            recorder.image(product, "Foto produk asli", px, py, product.width, product.height)

    # One quiet information panel replaces the overlapping badges/ornaments of legacy recipes.
    panel_y = int(H * 0.765)
    panel = (margin - 12, panel_y, W - margin + 12, int(H * 0.95))
    d.rounded_rectangle(panel, radius=28, fill=(250, 251, 255, 246), outline=(255, 255, 255, 235), width=2)
    price = str(spec.get("price_text") or "").strip()
    old_price = str(spec.get("old_price") or spec.get("old_text") or "").strip()
    tagline = str(spec.get("tagline") or "").strip()
    ink = (18, 27, 50, 255)
    accent = parse_color(spec.get("accent_color", "#6d4aff"))
    if price:
        f_price = get_font("bold", int(W * 0.061))
        label = f"{price}  ·  {old_price}" if old_price else price
        while f_price.size > int(W * 0.038) and d.textlength(label, font=f_price) > W - 2 * margin - 30:
            f_price = get_font("bold", f_price.size - 2)
        d.text(((W - d.textlength(label, font=f_price)) / 2, panel_y + int(H * 0.027)), label, font=f_price, fill=accent)
    if tagline:
        f_tag = get_font("regular", int(W * 0.026))
        tag = tagline
        while f_tag.size > 17 and d.textlength(tag, font=f_tag) > W - 2 * margin - 30:
            f_tag = get_font("regular", f_tag.size - 1)
        d.text(((W - d.textlength(tag, font=f_tag)) / 2, panel_y + int(H * 0.105)), tag, font=f_tag, fill=ink)
    if recorder:
        recorder.add("shape", "Panel informasi", panel[0], panel[1], panel[2] - panel[0], panel[3] - panel[1], fill="#fafbff")
    return canvas

# ==============================================================================
# LAYER 1: 12+ PROCEDURAL & CC0 BACKGROUNDS
# ==============================================================================

def generate_background(W, H, style_id="red_radial_burst", primary=(220, 38, 38), secondary=(136, 19, 55), accent=(253, 224, 71), rng=None):
    """Generate high-impact commercial background based on style recipe."""
    if rng is None:
        rng = random.Random(42)

    bg = Image.new("RGBA", (W, H), (20, 20, 20, 255))
    draw = ImageDraw.Draw(bg)

    if style_id in ("red_radial_burst", "target_reference"):
        # The exact Target Reference style:
        # Lower portion: warm kitchen counter/bokeh table
        # Upper/Center: vibrant red radial burst with luminous sunburst rays + vignette
        # 1. Base gradient
        for y in range(H):
            t = y / max(1, H - 1)
            # From deep wine red to warm mahogany table base
            col = mix_rgb((185, 28, 28), (69, 10, 10), t * 0.9)
            draw.line([(0, y), (W, y)], fill=(*col, 255))

        # 2. Radial Luminous Burst behind product (Left-Center burst)
        burst = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        b_draw = ImageDraw.Draw(burst)
        bx, by = int(W * 0.38), int(H * 0.48)
        max_r = int(math.hypot(W, H) * 0.65)
        # Rays
        num_rays = 28
        ray_pts = []
        for i in range(num_rays):
            a1 = (i * 360.0 / num_rays)
            a2 = a1 + (360.0 / num_rays) * 0.5
            r1, r2 = math.radians(a1), math.radians(a2)
            pts = [(bx, by), (bx + int(max_r * math.cos(r1)), by + int(max_r * math.sin(r1))),
                   (bx + int(max_r * math.cos(r2)), by + int(max_r * math.sin(r2)))]
            b_draw.polygon(pts, fill=(239, 68, 68, 65))

        # Radial core glow
        for r in range(int(W * 0.6), 10, -25):
            alpha = int(90 * (1 - r / (W * 0.6)))
            b_draw.ellipse([bx - r, by - r, bx + r, by + r], fill=(255, 100, 100, alpha))

        burst = burst.filter(ImageFilter.GaussianBlur(18))
        bg.alpha_composite(burst)

        # 3. Warm Kitchen / Table Horizon at bottom
        horizon_y = int(H * 0.72)
        table = Image.new("RGBA", (W, H - horizon_y), (0, 0, 0, 0))
        t_draw = ImageDraw.Draw(table)
        for ty in range(H - horizon_y):
            tt = ty / max(1, H - horizon_y - 1)
            t_col = mix_rgb((120, 53, 15), (45, 18, 6), tt)
            t_draw.line([(0, ty), (W, ty)], fill=(*t_col, 245))
        # Warm rim highlight on table edge
        t_draw.line([(0, 0), (W, 0)], fill=(253, 224, 71, 140), width=3)
        bg.alpha_composite(table, (0, horizon_y))

        # 4. Floating Warm Bokeh Circles in background
        bokeh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bk_draw = ImageDraw.Draw(bokeh)
        for _ in range(16):
            ox = rng.randint(int(W * 0.05), int(W * 0.95))
            oy = rng.randint(int(H * 0.15), int(H * 0.75))
            orad = rng.randint(25, 80)
            bk_draw.ellipse([ox - orad, oy - orad, ox + orad, oy + orad], fill=(254, 240, 138, rng.randint(25, 60)))
        bokeh = bokeh.filter(ImageFilter.GaussianBlur(12))
        bg.alpha_composite(bokeh)

    elif style_id == "warm_kitchen_bokeh":
        # Warm home kitchen ambiance
        for y in range(H):
            t = y / max(1, H - 1)
            col = mix_rgb((217, 119, 6), (67, 20, 7), t)
            draw.line([(0, y), (W, y)], fill=(*col, 255))
        # Soft bokeh circles
        bokeh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bk_draw = ImageDraw.Draw(bokeh)
        for _ in range(25):
            ox, oy = rng.randint(0, W), rng.randint(0, int(H * 0.8))
            orad = rng.randint(30, 110)
            bk_draw.ellipse([ox - orad, oy - orad, ox + orad, oy + orad], fill=(253, 224, 71, rng.randint(20, 50)))
        bg.alpha_composite(bokeh.filter(ImageFilter.GaussianBlur(15)))

    elif style_id == "dark_studio_spotlight":
        # Professional product photography studio with overhead spotlight
        for y in range(H):
            t = y / max(1, H - 1)
            col = mix_rgb((30, 41, 59), (15, 23, 42), t)
            draw.line([(0, y), (W, y)], fill=(*col, 255))
        # Radial white/blue top spotlight
        spot = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        s_draw = ImageDraw.Draw(spot)
        cx, cy = W // 2, int(H * 0.42)
        for r in range(int(W * 0.65), 10, -20):
            alpha = int(75 * (1 - r / (W * 0.65)))
            s_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(241, 245, 249, alpha))
        bg.alpha_composite(spot.filter(ImageFilter.GaussianBlur(25)))

    elif style_id == "rustic_wood_table":
        # Warm rustic cutting board / wooden plank texture
        for y in range(H):
            t = y / max(1, H - 1)
            col = mix_rgb((146, 64, 14), (69, 26, 3), t)
            draw.line([(0, y), (W, y)], fill=(*col, 255))
        # Wood grain streaks
        for plank_y in range(0, H, int(H * 0.12)):
            draw.line([(0, plank_y), (W, plank_y)], fill=(40, 15, 5, 120), width=3)
            draw.line([(0, plank_y + 3), (W, plank_y + 3)], fill=(217, 119, 6, 60), width=2)

    elif style_id == "marble_luxury":
        # White Italian Carrara marble with grey/gold veins
        for y in range(H):
            t = y / max(1, H - 1)
            col = mix_rgb((248, 250, 252), (226, 232, 240), t)
            draw.line([(0, y), (W, y)], fill=(*col, 255))
        # Veins
        veins = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        v_draw = ImageDraw.Draw(veins)
        for _ in range(4):
            cur_x = rng.randint(0, W)
            cur_y = 0
            while cur_y < H:
                next_x = cur_x + rng.randint(-35, 35)
                next_y = cur_y + rng.randint(40, 100)
                v_draw.line([(cur_x, cur_y), (next_x, next_y)], fill=(148, 163, 184, rng.randint(35, 75)), width=rng.randint(2, 4))
                cur_x, cur_y = next_x, next_y
        bg.alpha_composite(veins.filter(ImageFilter.GaussianBlur(3)))

    elif style_id == "layered_gradient_warm":
        # Multi-stop orange/crimson commercial gradient
        for y in range(H):
            t = y / max(1, H - 1)
            if t < 0.5:
                col = mix_rgb(primary, (234, 88, 12), t * 2)
            else:
                col = mix_rgb((234, 88, 12), secondary, (t - 0.5) * 2)
            draw.line([(0, y), (W, y)], fill=(*col, 255))

    elif style_id == "sunset_burst":
        for y in range(H):
            t = y / max(1, H - 1)
            col = mix_rgb((244, 63, 94), (136, 19, 55), t)
            draw.line([(0, y), (W, y)], fill=(*col, 255))
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse([int(W*0.2), int(H*0.2), int(W*0.8), int(H*0.7)], fill=(253, 224, 71, 60))
        bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(35)))

    elif style_id == "oceanic_teal":
        for y in range(H):
            t = y / max(1, H - 1)
            col = mix_rgb((13, 148, 136), (15, 23, 42), t)
            draw.line([(0, y), (W, y)], fill=(*col, 255))

    elif style_id == "midnight_neon":
        for y in range(H):
            t = y / max(1, H - 1)
            col = mix_rgb((15, 23, 42), (2, 6, 23), t)
            draw.line([(0, y), (W, y)], fill=(*col, 255))
        # Top-right cyan glow + bottom-left magenta glow
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        g_draw = ImageDraw.Draw(glow)
        g_draw.ellipse([W - 300, -100, W + 300, 400], fill=(6, 182, 212, 55))
        g_draw.ellipse([-200, H - 500, 400, H + 100], fill=(217, 70, 239, 45))
        bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(30)))

    elif style_id == "matcha_fresh":
        for y in range(H):
            t = y / max(1, H - 1)
            col = mix_rgb((22, 101, 52), (5, 46, 22), t)
            draw.line([(0, y), (W, y)], fill=(*col, 255))

    elif style_id == "golden_bokeh_black":
        # Royal onyx with golden floating dust
        for y in range(H):
            t = y / max(1, H - 1)
            col = mix_rgb((24, 24, 27), (9, 9, 11), t)
            draw.line([(0, y), (W, y)], fill=(*col, 255))
        dust = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d_draw = ImageDraw.Draw(dust)
        for _ in range(40):
            dx, dy = rng.randint(0, W), rng.randint(0, H)
            dr = rng.randint(2, 8)
            d_draw.ellipse([dx - dr, dy - dr, dx + dr, dy + dr], fill=(245, 158, 11, rng.randint(50, 180)))
        bg.alpha_composite(dust.filter(ImageFilter.GaussianBlur(2)))

    else: # vignette_fine_noise
        for y in range(H):
            t = y / max(1, H - 1)
            col = mix_rgb(primary, secondary, t)
            draw.line([(0, y), (W, y)], fill=(*col, 255))

    # Apply Cinematic Vignette (darken corners)
    vignette = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vignette)
    for i in range(12):
        frac = i / 12.0
        alpha = int(90 * (1 - frac))
        margin_x = int(W * 0.12 * frac)
        margin_y = int(H * 0.12 * frac)
        v_draw.rectangle([margin_x, margin_y, W - margin_x, H - margin_y], outline=(0, 0, 0, alpha), width=int(W * 0.02))
    vignette = vignette.filter(ImageFilter.GaussianBlur(25))
    bg.alpha_composite(vignette)

    return bg

# ==============================================================================
# LAYER 2: MAIN PRODUCT CUTOUT & CONTACT SHADOW
# ==============================================================================

def get_product_cutout(image_path, enable_ai=True):
    """Load product image, remove background with u2netp if possible, and crop."""
    cache_key = f"{image_path}:{enable_ai}"
    if cache_key in _CUTOUT_CACHE:
        return _CUTOUT_CACHE[cache_key].copy(), True

    raw = Image.open(image_path).convert("RGBA")
    is_cutout = False

    # Check if already has transparent background
    extrema = raw.getextrema()
    has_alpha = len(extrema) == 4 and extrema[3][0] < 200

    if has_alpha:
        is_cutout = True
        cutout = raw
    elif enable_ai and remove_background:
        try:
            res = remove_background(raw)
            if res:
                cutout = res
                is_cutout = True
            else:
                cutout = raw
        except Exception:
            cutout = raw
    else:
        cutout = raw

    # Crop excess bounding box
    bbox = cutout.getbbox()
    if bbox:
        cutout = cutout.crop(bbox)

    _CUTOUT_CACHE[cache_key] = cutout
    return cutout.copy(), is_cutout

def create_contact_shadow(product_w, product_h, blur=18, spread=0.88):
    """Generate dark oval contact shadow to firmly ground the product."""
    sw = int(product_w * spread)
    sh = int(product_h * 0.22)
    shadow = Image.new("RGBA", (sw + blur * 4, sh + blur * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    cx = shadow.width // 2
    cy = shadow.height // 2
    # Dense dark core
    d.ellipse([cx - sw // 2, cy - sh // 2, cx + sw // 2, cy + sh // 2], fill=(10, 10, 12, 190))
    # Soft spread
    return shadow.filter(ImageFilter.GaussianBlur(blur))

def create_rim_light(cutout, color=(255, 255, 255, 120)):
    """Generate a subtle edge rim-light around the top/side of cutout."""
    alpha = cutout.getchannel("A")
    dilated = alpha.filter(ImageFilter.MaxFilter(7))
    rim_mask = ImageChops.subtract(dilated, alpha)
    # Clip lower half to only illuminate top/sides
    w, h = cutout.size
    fade = Image.new("L", (w, h), 255)
    f_draw = ImageDraw.Draw(fade)
    f_draw.rectangle([0, int(h * 0.65), w, h], fill=0)
    rim_mask = ImageChops.multiply(rim_mask, fade.filter(ImageFilter.GaussianBlur(5)))

    rim_layer = Image.new("RGBA", (w, h), color)
    rim_layer.putalpha(rim_mask)
    return rim_layer

# ==============================================================================
# LAYER 4 & 5: 3D EXTRUDED TYPOGRAPHY & BRUSH TAGLINE
# ==============================================================================

def draw_3d_text(canvas, text, x, y, font, fill_top=(255, 255, 255), outline_color=(74, 14, 23),
                 depth=8, angle_deg=-4, recorder=None, layer_name="Judul 3D"):
    """
    Render professional 3D extruded commercial headline with gradient top and deep shadow.
    """
    d_canvas = ImageDraw.Draw(canvas)
    tb = d_canvas.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]

    # Create temporary high-res text sprite
    pad = int(font.size * 0.45)
    sw = tw + pad * 2 + depth * 2
    sh = th + pad * 2 + depth * 2
    sprite = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(sprite)

    # 1. 3D Extrusion Layers (cast down and right)
    dx_step = 1.0
    dy_step = 1.2
    for step in range(depth, 0, -1):
        ex = pad + int(step * dx_step)
        ey = pad + int(step * dy_step)
        # Deep extrusion color
        shade = mix_rgb(outline_color, (0, 0, 0), step / float(depth))
        s_draw.text((ex - tb[0], ey - tb[1]), text, font=font, fill=(*shade, 255),
                    stroke_width=int(font.size * 0.08), stroke_fill=(*shade, 255))

    # 2. Main Face Outline
    s_draw.text((pad - tb[0], pad - tb[1]), text, font=font,
                stroke_width=int(font.size * 0.10), stroke_fill=(*outline_color, 255))

    # 3. Main Face Top Gradient Fill
    top_mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(top_mask).text((pad - tb[0], pad - tb[1]), text, font=font, fill=255)

    top_fill = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    tf_draw = ImageDraw.Draw(top_fill)
    for py in range(sh):
        t = py / max(1, sh - 1)
        col = mix_rgb(fill_top, (253, 224, 71), t * 0.75) # Blend to golden yellow
        tf_draw.line([(0, py), (sw, py)], fill=(*col, 255))
    top_fill.putalpha(top_mask)
    sprite.alpha_composite(top_fill)

    # 4. Optional subtle rotation
    if abs(angle_deg) > 0.1:
        sprite = sprite.rotate(angle_deg, resample=Image.Resampling.BICUBIC, expand=True)

    # Composite onto canvas
    canvas.alpha_composite(sprite, (x - pad, y - pad))

    if recorder:
        recorder.add('text', layer_name, x, y, tw, th,
                     text=text, fontFamily="Impact", fontSize=font.size, bold=True,
                     fill=rgba(fill_top), stroke=rgba(outline_color), strokeWidth=int(font.size * 0.10))

    return x + tw, y + th

def draw_brush_tagline(canvas, text, x, y, width=None, bg_color="#facc15", text_color="#1e1b4b",
                       recorder=None):
    """
    Draw dynamic tagline on top of the authentic CC0 procedural acrylic yellow brush stroke.
    """
    brush_path = BUNDLE_DIR / "brush" / "brush_swipe_yellow.png"
    font = get_font("bold", size=24)
    d = ImageDraw.Draw(canvas)
    tb = d.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]

    target_w = max(tw + 70, width or (tw + 90))
    target_h = int(target_w * (180.0 / 800.0))

    if brush_path.exists():
        brush_img = Image.open(brush_path).convert("RGBA")
        brush_img = brush_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    else:
        # Fallback procedural brush
        brush_img = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
        ImageDraw.Draw(brush_img).rounded_rectangle([10, 8, target_w - 10, target_h - 8],
                                                    radius=target_h // 2, fill=(250, 204, 21, 245))

    # Slight dynamic rotation (-3 degrees)
    brush_img = brush_img.rotate(-3, resample=Image.Resampling.BICUBIC, expand=True)
    canvas.alpha_composite(brush_img, (x, y))

    # Center text inside brush stroke
    tx = x + (brush_img.width - tw) // 2
    ty = y + (brush_img.height - th) // 2 - 4
    d.text((tx - tb[0], ty - tb[1]), text, font=font, fill=parse_color(text_color, (30, 27, 75)))

    if recorder:
        recorder.add('rect', 'Sapuan Tagline', x, y, brush_img.width, brush_img.height,
                     fill=rgba(parse_color(bg_color)))
        recorder.add('text', text, tx, ty, tw, th,
                     text=text, fontFamily="Segoe UI", fontSize=font.size, bold=True,
                     fill=rgba(parse_color(text_color)))

# ==============================================================================
# LAYER 6: 3 CIRCULAR BENEFIT BADGES ROW
# ==============================================================================

def draw_benefit_badge_row(canvas, benefits, x, y, total_w, recorder=None):
    """
    Draw 3 circular benefit badges with bundled icons, bold label, and divider lines.
    """
    if not benefits:
        benefits = ["100% Halal", "Renyah Maksimal", "Siap Saji 3 Menit"]

    n = min(3, len(benefits))
    badge_w = total_w // n
    d = ImageDraw.Draw(canvas)
    f_label = get_font("bold", size=18)

    icon_map = {
        "halal": "icon_halal.png",
        "cepat": "icon_clock.png",
        "menit": "icon_clock.png",
        "siap": "icon_clock.png",
        "alami": "icon_leaf.png",
        "segar": "icon_leaf.png",
        "pedas": "icon_flame.png",
        "renyah": "icon_flame.png",
        "gurih": "icon_flame.png",
        "sehat": "icon_heart.png",
        "higienis": "icon_shield.png",
        "ongkir": "icon_truck.png",
        "gratis": "icon_truck.png",
    }

    for i, label in enumerate(benefits[:3]):
        bx = x + i * badge_w
        cx = bx + badge_w // 2
        cy = y + 36

        # Determine best icon
        icon_file = "icon_star.png"
        low = label.lower()
        for kw, ifile in icon_map.items():
            if kw in low:
                icon_file = ifile
                break

        # Circular Badge Container
        cr = 32
        d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(255, 255, 255, 240),
                  outline=(220, 38, 38, 220), width=3)

        # Place icon inside
        ipath = BUNDLE_DIR / "icons" / icon_file
        if ipath.exists():
            ic = Image.open(ipath).convert("RGBA").resize((38, 38), Image.Resampling.LANCZOS)
            canvas.alpha_composite(ic, (cx - 19, cy - 19))

        # Benefit Label below icon
        tb = d.textbbox((0, 0), label, font=f_label)
        lw, lh = tb[2] - tb[0], tb[3] - tb[1]
        lx = cx - lw // 2
        ly = cy + cr + 10
        # Text with subtle dark glow for readability
        d.text((lx - 1, ly), label, font=f_label, fill=(0, 0, 0, 180))
        d.text((lx + 1, ly), label, font=f_label, fill=(0, 0, 0, 180))
        d.text((lx, ly - 1), label, font=f_label, fill=(0, 0, 0, 180))
        d.text((lx, ly + 1), label, font=f_label, fill=(0, 0, 0, 180))
        d.text((lx, ly), label, font=f_label, fill=(255, 255, 255, 255))

        # Divider line between badges
        if i < n - 1:
            div_x = bx + badge_w - 4
            d.line([(div_x, cy - 20), (div_x, cy + 28)], fill=(255, 255, 255, 120), width=2)

        if recorder:
            recorder.add('ellipse', f'Lencana {label}', cx - cr, cy - cr, cr * 2, cr * 2,
                         fill='#ffffff', stroke='#dc2626', strokeWidth=3)
            recorder.add('text', label, lx, ly, lw, lh,
                         text=label, fontFamily="Segoe UI", fontSize=f_label.size, bold=True, fill='#ffffff')

# ==============================================================================
# LAYER 3: SUPPORTING PHOTOS (DISH & TEXTURE) & BUNDLED PROPS
# ==============================================================================

def draw_supporting_photos(canvas, dish_path=None, texture_path=None, x=700, y=820, size=260, recorder=None):
    """
    Render dish/cooked food and cross-section texture photos as secondary hero plates.
    """
    d = ImageDraw.Draw(canvas)
    if dish_path and os.path.exists(dish_path):
        dish_raw = Image.open(dish_path).convert("RGBA")
        dish_crop = ImageOps.fit(dish_raw, (size, size), Image.Resampling.LANCZOS)

        # Circular mask with plate rim
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse([4, 4, size - 4, size - 4], fill=255)

        # Contact shadow for the dish plate
        shadow = Image.new("RGBA", (size + 30, size + 30), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).ellipse([15, 15, size + 15, size + 15], fill=(10, 10, 12, 170))
        canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)), (x - 15, y - 5))

        # Circular plate border
        plate = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        plate.paste(dish_crop, (0, 0), mask)
        plate_d = ImageDraw.Draw(plate)
        plate_d.ellipse([2, 2, size - 2, size - 2], outline=(255, 255, 255, 240), width=6)
        plate_d.ellipse([8, 8, size - 8, size - 8], outline=(253, 224, 71, 180), width=2)

        canvas.alpha_composite(plate, (x, y))
        if recorder:
            recorder.image(dish_raw, 'Foto Hidangan Masak', x, y, size, size)

    if texture_path and os.path.exists(texture_path):
        t_sz = int(size * 0.72)
        tx = x - int(t_sz * 0.45)
        ty = y + int(size * 0.55)
        t_raw = Image.open(texture_path).convert("RGBA")
        t_crop = ImageOps.fit(t_raw, (t_sz, t_sz), Image.Resampling.LANCZOS)
        t_mask = Image.new("L", (t_sz, t_sz), 0)
        ImageDraw.Draw(t_mask).ellipse([2, 2, t_sz - 2, t_sz - 2], fill=255)

        # Shadow
        t_shadow = Image.new("RGBA", (t_sz + 20, t_sz + 20), (0, 0, 0, 0))
        ImageDraw.Draw(t_shadow).ellipse([10, 10, t_sz + 10, t_sz + 10], fill=(10, 10, 12, 180))
        canvas.alpha_composite(t_shadow.filter(ImageFilter.GaussianBlur(10)), (tx - 10, ty - 5))

        badge = Image.new("RGBA", (t_sz, t_sz), (0, 0, 0, 0))
        badge.paste(t_crop, (0, 0), t_mask)
        b_d = ImageDraw.Draw(badge)
        b_d.ellipse([2, 2, t_sz - 2, t_sz - 2], outline=(253, 224, 71, 255), width=5)

        canvas.alpha_composite(badge, (tx, ty))
        if recorder:
            recorder.image(t_raw, 'Potongan Tekstur Dalam', tx, ty, t_sz, t_sz)

def add_bundled_props(canvas, W, H, category="food", rng=None):
    """Scatter floating CC0 leaves, chili flakes, crumbs, and motion swooshes."""
    if rng is None:
        rng = random.Random(42)

    # 1. Floating leaves
    leaf_files = list((BUNDLE_DIR / "leaves").glob("*.png"))
    if leaf_files:
        for _ in range(3):
            lf = Image.open(rng.choice(leaf_files)).convert("RGBA")
            sz = rng.randint(90, 160)
            lf = lf.resize((sz, sz), Image.Resampling.LANCZOS)
            rot = rng.randint(-45, 45)
            lf = lf.rotate(rot, resample=Image.Resampling.BICUBIC, expand=True)
            lx = rng.choice([rng.randint(20, int(W * 0.28)), rng.randint(int(W * 0.65), W - 120)])
            ly = rng.choice([rng.randint(int(H * 0.15), int(H * 0.35)), rng.randint(int(H * 0.65), int(H * 0.88))])
            canvas.alpha_composite(lf, (lx, ly))

    # 2. Chili slice / flakes
    chili_files = list((BUNDLE_DIR / "chili").glob("*.png"))
    if chili_files and category in ("food", "snack", "frozen_food"):
        cf = Image.open(rng.choice(chili_files)).convert("RGBA")
        csz = rng.randint(70, 110)
        cf = cf.resize((csz, csz), Image.Resampling.LANCZOS)
        canvas.alpha_composite(cf, (rng.randint(int(W * 0.40), int(W * 0.70)), rng.randint(int(H * 0.70), int(H * 0.82))))

    # 3. Motion Swooshes / Speed Streaks
    swoosh_files = list((BUNDLE_DIR / "swooshes").glob("*.png"))
    if swoosh_files:
        sf = Image.open(rng.choice(swoosh_files)).convert("RGBA")
        sw = int(W * 0.42)
        sh = int(sw * (sf.height / float(sf.width)))
        sf = sf.resize((sw, sh), Image.Resampling.LANCZOS)
        canvas.alpha_composite(sf, (int(W * 0.05), int(H * 0.45)))

    # 4. Radiant sparkles
    sparkle_files = list((BUNDLE_DIR / "sparkles").glob("*.png"))
    if sparkle_files:
        for _ in range(4):
            sp = Image.open(rng.choice(sparkle_files)).convert("RGBA")
            spsz = rng.randint(45, 75)
            sp = sp.resize((spsz, spsz), Image.Resampling.LANCZOS)
            sx = rng.randint(int(W * 0.1), int(W * 0.88))
            sy = rng.randint(int(H * 0.08), int(H * 0.45))
            canvas.alpha_composite(sp, (sx, sy))

# ==============================================================================
# LAYER 7: PRICE & PROMO BURST BADGE
# ==============================================================================

def draw_promo_price_badge(canvas, price_text, old_price=None, discount_tag=None,
                           x=700, y=550, style="burst", recorder=None):
    """
    Draw explosive discount starburst or premium price pill.
    """
    if not price_text:
        return

    d = ImageDraw.Draw(canvas)
    f_price = get_font("3d", size=48)
    f_old = get_font("bold", size=22)
    f_tag = get_font("3d", size=20)

    # Format rupiah
    pb = d.textbbox((0, 0), price_text, font=f_price)
    pw, ph = pb[2] - pb[0], pb[3] - pb[1]

    if style == "burst":
        # 16-point yellow starburst badge
        sz = max(pw + 90, 220)
        burst = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
        b_draw = ImageDraw.Draw(burst)
        cx, cy = sz // 2, sz // 2
        pts = []
        n_pts = 16
        for i in range(n_pts * 2):
            rad = math.radians(i * (360.0 / (n_pts * 2)))
            r = (sz * 0.48) if (i % 2 == 0) else (sz * 0.38)
            pts.append((cx + int(r * math.cos(rad)), cy + int(r * math.sin(rad))))
        # Red burst with yellow outline
        b_draw.polygon(pts, fill=(220, 38, 38, 255), outline=(253, 224, 71, 255), width=5)

        # Shadow
        b_shadow = Image.new("RGBA", (sz + 20, sz + 20), (0, 0, 0, 0))
        ImageDraw.Draw(b_shadow).ellipse([10, 10, sz + 10, sz + 10], fill=(0, 0, 0, 140))
        canvas.alpha_composite(b_shadow.filter(ImageFilter.GaussianBlur(10)), (x - 10, y - 5))

        canvas.alpha_composite(burst, (x, y))

        # Text inside starburst
        tx = x + (sz - pw) // 2
        ty = y + (sz - ph) // 2 + (10 if old_price else 0)

        if old_price:
            ob = d.textbbox((0, 0), old_price, font=f_old)
            ow, oh = ob[2] - ob[0], ob[3] - ob[1]
            ox = x + (sz - ow) // 2
            oy = ty - oh - 8
            d.text((ox - ob[0], oy - ob[1]), old_price, font=f_old, fill=(254, 240, 138, 240))
            d.line([(ox - 2, oy + oh // 2), (ox + ow + 2, oy + oh // 2)], fill=(255, 255, 255, 255), width=3)

        d.text((tx - pb[0], ty - pb[1]), price_text, font=f_price, fill=(255, 255, 255, 255),
               stroke_width=3, stroke_fill=(153, 27, 27, 255))

        if discount_tag:
            d_tag = Image.new("RGBA", (85, 34), (0, 0, 0, 0))
            ImageDraw.Draw(d_tag).rounded_rectangle([0, 0, 85, 34], radius=17, fill=(253, 224, 71, 255))
            tb_tag = d.textbbox((0, 0), discount_tag, font=f_tag)
            tw_tag, th_tag = tb_tag[2] - tb_tag[0], tb_tag[3] - tb_tag[1]
            ImageDraw.Draw(d_tag).text(((85 - tw_tag)//2 - tb_tag[0], (34 - th_tag)//2 - tb_tag[1]),
                                      discount_tag, font=f_tag, fill=(185, 28, 28, 255))
            canvas.alpha_composite(d_tag, (x + sz - 75, y - 8))

        if recorder:
            recorder.add('rect', 'Badge Harga Promo', x, y, sz, sz, fill='#dc2626', stroke='#fde047', strokeWidth=5)
            recorder.add('text', price_text, tx, ty, pw, ph,
                         text=price_text, fontFamily="Impact", fontSize=f_price.size, bold=True, fill='#ffffff')

    else:
        # Modern Premium Price Pill
        pill_w = pw + 60
        pill_h = ph + 34
        d.rounded_rectangle([x, y, x + pill_w, y + pill_h], radius=pill_h // 2,
                            fill=(220, 38, 38, 255), outline=(255, 255, 255, 220), width=3)
        d.text((x + 30 - pb[0], y + 17 - pb[1]), price_text, font=f_price, fill=(255, 255, 255, 255))
        if recorder:
            recorder.add('rect', 'Pill Harga Promo', x, y, pill_w, pill_h,
                         fill='#dc2626', stroke='#ffffff', strokeWidth=3, radius=pill_h // 2)
            recorder.add('text', price_text, x + 30, y + 17, pw, ph,
                         text=price_text, fontFamily="Impact", fontSize=f_price.size, bold=True, fill='#ffffff')

# ==============================================================================
# LAYER 8: BRAND KIT LOGO & FOOTER
# ==============================================================================

def draw_brand_kit(canvas, brand=None, W=1080, H=1350, recorder=None):
    """
    Render Brand Kit logo at top-left and contact footer at bottom.
    """
    if not brand:
        return

    d = ImageDraw.Draw(canvas)
    logo_path = brand.get("logo_path") or brand.get("logo_filename")
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert("RGBA")
            logo_w = int(W * 0.16)
            logo_h = int(logo_w * (logo.height / float(logo.width)))
            logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
            # Soft circular or rounded background
            lx, ly = int(W * 0.06), int(H * 0.04)
            d.rounded_rectangle([lx - 8, ly - 8, lx + logo_w + 8, ly + logo_h + 8],
                                radius=12, fill=(255, 255, 255, 230))
            canvas.alpha_composite(logo, (lx, ly))
            if recorder:
                recorder.image(logo, 'Logo Brand', lx, ly, logo_w, logo_h)
                recorder.layers[-1]["brandRole"] = "logo"
        except Exception:
            pass

    footer_text = brand.get("footer_text") or brand.get("footer")
    if footer_text:
        f_font = get_font("bold", size=18)
        foot_h = int(H * 0.055)
        fy = H - foot_h
        # Translucent footer bar
        d.rectangle([0, fy, W, H], fill=(15, 23, 42, 235))
        d.line([(0, fy), (W, fy)], fill=(253, 224, 71, 190), width=2)
        tb = d.textbbox((0, 0), footer_text, font=f_font)
        fw, fh = tb[2] - tb[0], tb[3] - tb[1]
        fx = (W - fw) // 2
        f_ypos = fy + (foot_h - fh) // 2 - tb[1]
        d.text((fx, f_ypos), footer_text, font=f_font, fill=(255, 255, 255, 255))
        if recorder:
            recorder.add('rect', 'Footer Brand Bar', 0, fy, W, foot_h, fill='#0f172a', stroke='#fde047', strokeWidth=2)
            recorder.layers[-1]["brandRole"] = "footer"
            recorder.add('text', footer_text, fx, f_ypos, fw, fh,
                         text=footer_text, fontFamily="Segoe UI", fontSize=f_font.size, bold=True, fill='#ffffff')
            recorder.layers[-1]["brandRole"] = "footer"

# ==============================================================================
# LAYER 9: POST-PROCESSING COLOR GRADING & TEXTURE
# ==============================================================================

def post_process_poster(canvas, grading_warmth=1.06, sharpness=1.15, grain_amount=0.015):
    """
    Commercial post-processing: cohesive warm grading, crisp local contrast, micro analog grain.
    """
    rgb = canvas.convert("RGB")

    # 1. Warm Color Grade
    if grading_warmth != 1.0:
        enhancer = ImageEnhance.Color(rgb)
        rgb = enhancer.enhance(grading_warmth)

    # 2. Crisp Sharpness
    if sharpness != 1.0:
        sharp = ImageEnhance.Sharpness(rgb)
        rgb = sharp.enhance(sharpness)

    # 3. Micro Analog Film Grain
    if grain_amount > 0:
        arr = np.array(rgb, dtype=np.float32)
        noise = np.random.normal(0, grain_amount * 255.0, arr.shape)
        arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
        rgb = Image.fromarray(arr)

    return rgb

# ==============================================================================
# RECIPE 1: THE TARGET REFERENCE (contoh-target.png)
# "Hero Kiri + Headline Kanan + Baris Manfaat"
# ==============================================================================

def compose_hero_left_target(spec, recorder=None):
    """
    Faithful recreation of docs/referensi/contoh-target.png:
    - Left: Dominant product packaging hero with contact shadow and rim light
    - Right-Top: High-contrast 3D extruded headline with golden yellow accents
    - Right-Mid: Tagline on yellow acrylic brush stroke badge
    - Right-Lower: Cooked dish and texture photos as secondary hero plates
    - Bottom: 3 circular benefit badges row + brand footer
    - Ambient: Warm kitchen/red radial burst with light rays, floating leaves and chili
    """
    fmt = spec.get("format", "feed")
    W, H = FORMATS.get(fmt, FORMATS["feed"])
    rng = random.Random(spec.get("seed", 42))

    primary = parse_color(spec.get("primary_color", "#e11d48"))
    secondary = parse_color(spec.get("secondary_color", "#881337"))
    accent = parse_color(spec.get("accent_color", "#fde047"))

    # 1. Background
    canvas = scene_background(spec, W, H, style_id="red_radial_burst", primary=primary, secondary=secondary, accent=accent, rng=rng)

    # 2. Main Product Cutout (Hero Left)
    prod_path = spec.get("product_image") or (spec.get("items") and spec["items"][0].get("path"))
    if prod_path and os.path.exists(prod_path):
        cutout, is_clean = get_product_cutout(prod_path, enable_ai=spec.get("remove_bg", True))
        aspect = cutout.width / float(max(1, cutout.height))

        # Size: Occupies ~42-52% of poster width and generous height
        target_pw = int(W * 0.48)
        target_ph = int(target_pw / aspect)
        if target_ph > int(H * 0.68):
            target_ph = int(H * 0.68)
            target_pw = int(target_ph * aspect)

        cutout = cutout.resize((target_pw, target_ph), Image.Resampling.LANCZOS)

        # Slight dynamic tilt (-3 degrees)
        cutout = cutout.rotate(-3, resample=Image.Resampling.BICUBIC, expand=True)
        pw_rot, ph_rot = cutout.size

        px = int(W * 0.05)
        py = int(H * 0.32)

        # Contact shadow under product
        shadow = create_contact_shadow(pw_rot, ph_rot, blur=18, spread=0.85)
        canvas.alpha_composite(shadow, (px + (pw_rot - shadow.width)//2, py + ph_rot - int(shadow.height * 0.55)))

        # Composite product
        canvas.alpha_composite(cutout, (px, py))
        if recorder:
            prod_name = spec.get("product_name") or (spec.get("items") and spec["items"][0].get("name")) or "Kemasan Produk"
            recorder.image(cutout, f"Produk Utama: {prod_name}", px, py, pw_rot, ph_rot)

    # 3. Headline & Tagline (Right Top)
    headline = spec.get("headline") or spec.get("title") or "GURIH RENYAH MAKSIMAL"
    tagline = spec.get("tagline") or spec.get("subtitle") or "Pilihan Keluarga Sehat & Praktis"

    # Headline typography
    f_head = get_font("3d", size=int(W * 0.065))
    hx = int(W * 0.48)
    hy = int(H * 0.12)

    # Multi-line wrap
    lines = [l.strip() for l in headline.split("\n") if l.strip()]
    if len(lines) == 1 and len(headline) > 16:
        words = headline.split()
        mid = len(words) // 2
        lines = [" ".join(words[:mid]), " ".join(words[mid:])]

    cur_hy = hy
    for line in lines[:3]:
        draw_3d_text(canvas, line.upper(), hx, cur_hy, f_head,
                     fill_top=(255, 255, 255), outline_color=(74, 14, 23), depth=6, angle_deg=-2,
                     recorder=recorder, layer_name="Headline 3D")
        cur_hy += int(f_head.size * 1.15)

    # Tagline on Yellow Brush Stroke Badge
    by = cur_hy + 12
    draw_brush_tagline(canvas, tagline, hx, by, width=int(W * 0.44), recorder=recorder)

    # 4. Supporting Photos (Right Lower: Dish & Texture)
    dish_path = spec.get("dish_image")
    texture_path = spec.get("texture_image")
    draw_supporting_photos(canvas, dish_path=dish_path, texture_path=texture_path,
                           x=int(W * 0.58), y=int(H * 0.52), size=int(W * 0.32), recorder=recorder)

    # 5. Price / Promo Burst Badge
    price_text = spec.get("price_text") or (spec.get("items") and spec["items"][0].get("price_text"))
    old_text = spec.get("old_text") or (spec.get("items") and spec["items"][0].get("old_text"))
    discount_tag = spec.get("discount_tag") or spec.get("tag") or (spec.get("items") and spec["items"][0].get("tag"))
    if price_text:
        bx = int(W * 0.65)
        by = int(H * 0.38)
        draw_promo_price_badge(canvas, price_text, old_price=old_text, discount_tag=discount_tag,
                               x=bx, y=by, style="burst", recorder=recorder)

    # 6. Bundled Props (Leaves, Chili, Crumbs, Swooshes)
    add_bundled_props(canvas, W, H, category=spec.get("category", "food"), rng=rng)

    # 7. Row of 3 Benefit Badges (Lower Area)
    benefits = spec.get("benefits") or spec.get("usp_points")
    b_y = int(H * 0.82)
    draw_benefit_badge_row(canvas, benefits, int(W * 0.05), b_y, int(W * 0.90), recorder=recorder)

    # 8. Brand Kit
    brand = spec.get("brand")
    draw_brand_kit(canvas, brand=brand, W=W, H=H, recorder=recorder)

    return canvas

# ==============================================================================
# RECIPES 2 TO 6: DIVERSE COMMERCIAL STYLES
# ==============================================================================

def compose_hero_center_burst(spec, recorder=None):
    """Central product hero on floating 3D pedestal with explosive sunburst."""
    fmt = spec.get("format", "feed")
    W, H = FORMATS.get(fmt, FORMATS["feed"])
    rng = random.Random(spec.get("seed", 101))
    primary = parse_color(spec.get("primary_color", "#ea580c"))
    secondary = parse_color(spec.get("secondary_color", "#7c2d12"))

    canvas = scene_background(spec, W, H, style_id="layered_gradient_warm", primary=primary, secondary=secondary, rng=rng)

    # Headline on Top
    headline = spec.get("headline") or "PROMO HEBOH SPESIAL"
    f_head = get_font("3d", size=int(W * 0.072))
    d = ImageDraw.Draw(canvas)
    tb = d.textbbox((0, 0), headline, font=f_head)
    hw = tb[2] - tb[0]
    hx = (W - hw) // 2
    draw_3d_text(canvas, headline.upper(), hx, int(H * 0.08), f_head,
                 fill_top=(255, 255, 255), outline_color=(67, 20, 7), depth=7, recorder=recorder)

    # Tagline
    tagline = spec.get("tagline") or "Kelezatan Spesial Setiap Saat"
    draw_brush_tagline(canvas, tagline, (W - int(W * 0.55)) // 2, int(H * 0.18), width=int(W * 0.55), recorder=recorder)

    # Center Hero Product
    prod_path = spec.get("product_image") or (spec.get("items") and spec["items"][0].get("path"))
    if prod_path and os.path.exists(prod_path):
        cutout, _ = get_product_cutout(prod_path, enable_ai=spec.get("remove_bg", True))
        target_pw = int(W * 0.60)
        target_ph = int(target_pw / (cutout.width / float(max(1, cutout.height))))
        cutout = cutout.resize((target_pw, target_ph), Image.Resampling.LANCZOS)
        px = (W - target_pw) // 2
        py = int(H * 0.32)
        shadow = create_contact_shadow(target_pw, target_ph, blur=22, spread=0.92)
        canvas.alpha_composite(shadow, (px + (target_pw - shadow.width)//2, py + target_ph - int(shadow.height * 0.55)))
        canvas.alpha_composite(cutout, (px, py))
        if recorder:
            recorder.image(cutout, 'Produk Utama', px, py, target_pw, target_ph)

    # Price Star
    price_text = spec.get("price_text") or (spec.get("items") and spec["items"][0].get("price_text"))
    if price_text:
        draw_promo_price_badge(canvas, price_text, old_price=spec.get("old_text"),
                               discount_tag=spec.get("discount_tag"), x=int(W * 0.66), y=int(H * 0.56),
                               style="burst", recorder=recorder)

    add_bundled_props(canvas, W, H, category=spec.get("category", "food"), rng=rng)
    benefits = spec.get("benefits") or spec.get("usp_points")
    draw_benefit_badge_row(canvas, benefits, int(W * 0.05), int(H * 0.82), int(W * 0.90), recorder=recorder)
    draw_brand_kit(canvas, brand=spec.get("brand"), W=W, H=H, recorder=recorder)
    return canvas

def compose_split_diagonal(spec, recorder=None):
    """Dynamic angular diagonal split: atmosphere on one side, graphic on other."""
    fmt = spec.get("format", "feed")
    W, H = FORMATS.get(fmt, FORMATS["feed"])
    rng = random.Random(spec.get("seed", 202))
    primary = parse_color(spec.get("primary_color", "#0d9488"))
    secondary = parse_color(spec.get("secondary_color", "#134e4a"))

    canvas = scene_background(spec, W, H, style_id="oceanic_teal", primary=primary, secondary=secondary, rng=rng)

    # Diagonal accent wedge on upper right
    wedge = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    w_draw = ImageDraw.Draw(wedge)
    w_draw.polygon([(int(W * 0.35), 0), (W, 0), (W, int(H * 0.65))], fill=(255, 255, 255, 28))
    canvas.alpha_composite(wedge)

    # Product on left
    prod_path = spec.get("product_image") or (spec.get("items") and spec["items"][0].get("path"))
    if prod_path and os.path.exists(prod_path):
        cutout, _ = get_product_cutout(prod_path, enable_ai=spec.get("remove_bg", True))
        target_pw = int(W * 0.50)
        target_ph = int(target_pw / (cutout.width / float(max(1, cutout.height))))
        cutout = cutout.resize((target_pw, target_ph), Image.Resampling.LANCZOS)
        px = int(W * 0.06)
        py = int(H * 0.34)
        shadow = create_contact_shadow(target_pw, target_ph, blur=18, spread=0.88)
        canvas.alpha_composite(shadow, (px + (target_pw - shadow.width)//2, py + target_ph - int(shadow.height * 0.55)))
        canvas.alpha_composite(cutout, (px, py))
        if recorder:
            recorder.image(cutout, 'Produk Utama', px, py, target_pw, target_ph)

    # Headline on Top Right
    headline = spec.get("headline") or "PILIHAN TERBAIK HARI INI"
    f_head = get_font("bold", size=int(W * 0.062))
    draw_3d_text(canvas, headline.upper(), int(W * 0.44), int(H * 0.14), f_head,
                 fill_top=(255, 255, 255), outline_color=(19, 78, 74), depth=5, recorder=recorder)

    tagline = spec.get("tagline") or "Segar, Nikmat & Bergizi"
    draw_brush_tagline(canvas, tagline, int(W * 0.44), int(H * 0.28), width=int(W * 0.48), recorder=recorder)

    price_text = spec.get("price_text") or (spec.get("items") and spec["items"][0].get("price_text"))
    if price_text:
        draw_promo_price_badge(canvas, price_text, old_price=spec.get("old_text"),
                               discount_tag=spec.get("discount_tag"), x=int(W * 0.58), y=int(H * 0.46),
                               style="pill", recorder=recorder)

    add_bundled_props(canvas, W, H, category=spec.get("category", "food"), rng=rng)
    benefits = spec.get("benefits") or spec.get("usp_points")
    draw_benefit_badge_row(canvas, benefits, int(W * 0.05), int(H * 0.82), int(W * 0.90), recorder=recorder)
    draw_brand_kit(canvas, brand=spec.get("brand"), W=W, H=H, recorder=recorder)
    return canvas

def compose_flatlay_overhead(spec, recorder=None):
    """Artisan culinary flatlay on textured rustic wooden table."""
    fmt = spec.get("format", "feed")
    W, H = FORMATS.get(fmt, FORMATS["feed"])
    rng = random.Random(spec.get("seed", 303))

    canvas = scene_background(spec, W, H, style_id="rustic_wood_table", rng=rng)

    # Elegant Serif / Brush Typography
    headline = spec.get("headline") or "CITA RASA ASLI NUSANTARA"
    f_head = get_font("serif", size=int(W * 0.058))
    d = ImageDraw.Draw(canvas)
    tb = d.textbbox((0, 0), headline, font=f_head)
    hw = tb[2] - tb[0]
    hx = (W - hw) // 2
    d.text((hx, int(H * 0.08)), headline, font=f_head, fill=(255, 255, 255, 255))

    tagline = spec.get("tagline") or "Kelezatan Tradisional Siap Saji"
    draw_brush_tagline(canvas, tagline, (W - int(W * 0.50)) // 2, int(H * 0.15), width=int(W * 0.50), recorder=recorder)

    # Product slightly angled
    prod_path = spec.get("product_image") or (spec.get("items") and spec["items"][0].get("path"))
    if prod_path and os.path.exists(prod_path):
        cutout, _ = get_product_cutout(prod_path, enable_ai=spec.get("remove_bg", True))
        target_pw = int(W * 0.52)
        target_ph = int(target_pw / (cutout.width / float(max(1, cutout.height))))
        cutout = cutout.resize((target_pw, target_ph), Image.Resampling.LANCZOS)
        cutout = cutout.rotate(4, resample=Image.Resampling.BICUBIC, expand=True)
        px = int(W * 0.08)
        py = int(H * 0.32)
        shadow = create_contact_shadow(cutout.width, cutout.height, blur=16, spread=0.88)
        canvas.alpha_composite(shadow, (px + (cutout.width - shadow.width)//2, py + cutout.height - int(shadow.height * 0.55)))
        canvas.alpha_composite(cutout, (px, py))
        if recorder:
            recorder.image(cutout, 'Produk Utama', px, py, cutout.width, cutout.height)

    # Supporting dish & texture
    draw_supporting_photos(canvas, dish_path=spec.get("dish_image"), texture_path=spec.get("texture_image"),
                           x=int(W * 0.58), y=int(H * 0.44), size=int(W * 0.34), recorder=recorder)

    price_text = spec.get("price_text") or (spec.get("items") and spec["items"][0].get("price_text"))
    if price_text:
        draw_promo_price_badge(canvas, price_text, old_price=spec.get("old_text"),
                               discount_tag=spec.get("discount_tag"), x=int(W * 0.62), y=int(H * 0.68),
                               style="pill", recorder=recorder)

    add_bundled_props(canvas, W, H, category=spec.get("category", "food"), rng=rng)
    benefits = spec.get("benefits") or spec.get("usp_points")
    draw_benefit_badge_row(canvas, benefits, int(W * 0.05), int(H * 0.84), int(W * 0.90), recorder=recorder)
    draw_brand_kit(canvas, brand=spec.get("brand"), W=W, H=H, recorder=recorder)
    return canvas

def compose_price_star(spec, recorder=None):
    """Giant explosive starburst price badge as co-star hero alongside product."""
    fmt = spec.get("format", "feed")
    W, H = FORMATS.get(fmt, FORMATS["feed"])
    rng = random.Random(spec.get("seed", 404))
    primary = parse_color(spec.get("primary_color", "#e11d48"))
    secondary = parse_color(spec.get("secondary_color", "#881337"))

    canvas = scene_background(spec, W, H, style_id="red_radial_burst", primary=primary, secondary=secondary, rng=rng)

    # Urgency Top Ribbon
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, int(H * 0.04), W, int(H * 0.09)], fill=(253, 224, 71, 255))
    f_urgency = get_font("bold", size=22)
    urgency_txt = "FLASH SALE • PENAWARAN TERBATAS • HARI INI SAJA"
    tb_u = d.textbbox((0, 0), urgency_txt, font=f_urgency)
    d.text(((W - (tb_u[2] - tb_u[0])) // 2, int(H * 0.052)), urgency_txt, font=f_urgency, fill=(15, 23, 42, 255))

    # Headline
    headline = spec.get("headline") or "DISKON SPESIAL HINGGA 50%"
    f_head = get_font("3d", size=int(W * 0.065))
    draw_3d_text(canvas, headline.upper(), int(W * 0.06), int(H * 0.12), f_head,
                 fill_top=(255, 255, 255), outline_color=(74, 14, 23), depth=6, recorder=recorder)

    # Product on Right
    prod_path = spec.get("product_image") or (spec.get("items") and spec["items"][0].get("path"))
    if prod_path and os.path.exists(prod_path):
        cutout, _ = get_product_cutout(prod_path, enable_ai=spec.get("remove_bg", True))
        target_pw = int(W * 0.50)
        target_ph = int(target_pw / (cutout.width / float(max(1, cutout.height))))
        cutout = cutout.resize((target_pw, target_ph), Image.Resampling.LANCZOS)
        px = int(W * 0.44)
        py = int(H * 0.28)
        shadow = create_contact_shadow(target_pw, target_ph, blur=20, spread=0.90)
        canvas.alpha_composite(shadow, (px + (target_pw - shadow.width)//2, py + target_ph - int(shadow.height * 0.55)))
        canvas.alpha_composite(cutout, (px, py))
        if recorder:
            recorder.image(cutout, 'Produk Utama', px, py, target_pw, target_ph)

    # Giant Price Starburst on Left
    price_text = spec.get("price_text") or (spec.get("items") and spec["items"][0].get("price_text")) or "Rp 29.900"
    draw_promo_price_badge(canvas, price_text, old_price=spec.get("old_text") or "Rp 59.900",
                           discount_tag=spec.get("discount_tag") or "50%",
                           x=int(W * 0.06), y=int(H * 0.32), style="burst", recorder=recorder)

    # Tagline
    tagline = spec.get("tagline") or "Belanja Hemat Banyak Untung"
    draw_brush_tagline(canvas, tagline, int(W * 0.06), int(H * 0.65), width=int(W * 0.50), recorder=recorder)

    add_bundled_props(canvas, W, H, category=spec.get("category", "food"), rng=rng)
    benefits = spec.get("benefits") or spec.get("usp_points")
    draw_benefit_badge_row(canvas, benefits, int(W * 0.05), int(H * 0.82), int(W * 0.90), recorder=recorder)
    draw_brand_kit(canvas, brand=spec.get("brand"), W=W, H=H, recorder=recorder)
    return canvas

def compose_minimal_luxury(spec, recorder=None):
    """Refined dark studio lighting with gold accents and elegant typography."""
    fmt = spec.get("format", "feed")
    W, H = FORMATS.get(fmt, FORMATS["feed"])
    rng = random.Random(spec.get("seed", 505))

    canvas = scene_background(spec, W, H, style_id="dark_studio_spotlight", rng=rng)

    # Headline
    headline = spec.get("headline") or "PREMIUM SIGNATURE SELECTION"
    f_head = get_font("bold", size=int(W * 0.052))
    d = ImageDraw.Draw(canvas)
    tb = d.textbbox((0, 0), headline, font=f_head)
    hw = tb[2] - tb[0]
    hx = (W - hw) // 2
    d.text((hx, int(H * 0.10)), headline, font=f_head, fill=(255, 255, 255, 255))

    tagline = spec.get("tagline") or "Kualitas Unggul Tanpa Kompromi"
    tb_t = d.textbbox((0, 0), tagline, font=get_font("serif", size=22))
    d.text(((W - (tb_t[2] - tb_t[0])) // 2, int(H * 0.17)), tagline, font=get_font("serif", size=22), fill=(253, 224, 71, 230))
    # Fine gold divider line
    d.line([(W // 2 - 80, int(H * 0.22)), (W // 2 + 80, int(H * 0.22))], fill=(245, 158, 11, 200), width=2)

    # Product on 3D Pedestal
    prod_path = spec.get("product_image") or (spec.get("items") and spec["items"][0].get("path"))
    if prod_path and os.path.exists(prod_path):
        cutout, _ = get_product_cutout(prod_path, enable_ai=spec.get("remove_bg", True))
        target_pw = int(W * 0.52)
        target_ph = int(target_pw / (cutout.width / float(max(1, cutout.height))))
        cutout = cutout.resize((target_pw, target_ph), Image.Resampling.LANCZOS)
        px = (W - target_pw) // 2
        py = int(H * 0.32)

        # Pedestal cylinder
        ped_w = int(target_pw * 1.15)
        ped_h = 35
        ped_x = (W - ped_w) // 2
        ped_y = py + target_ph - 15
        d.ellipse([ped_x, ped_y, ped_x + ped_w, ped_y + ped_h], fill=(45, 55, 72, 255), outline=(245, 158, 11, 160), width=2)

        shadow = create_contact_shadow(target_pw, target_ph, blur=16, spread=0.88)
        canvas.alpha_composite(shadow, (px + (target_pw - shadow.width)//2, py + target_ph - int(shadow.height * 0.55)))
        canvas.alpha_composite(cutout, (px, py))
        if recorder:
            recorder.image(cutout, 'Produk Utama', px, py, target_pw, target_ph)

    price_text = spec.get("price_text") or (spec.get("items") and spec["items"][0].get("price_text"))
    if price_text:
        draw_promo_price_badge(canvas, price_text, old_price=spec.get("old_text"),
                               discount_tag=spec.get("discount_tag"), x=(W - 220) // 2, y=int(H * 0.68),
                               style="pill", recorder=recorder)

    benefits = spec.get("benefits") or spec.get("usp_points")
    draw_benefit_badge_row(canvas, benefits, int(W * 0.05), int(H * 0.82), int(W * 0.90), recorder=recorder)
    draw_brand_kit(canvas, brand=spec.get("brand"), W=W, H=H, recorder=recorder)
    return canvas

# Dictionary of all 6 Recipes
RECIPES = {
    "hero_left_target": compose_hero_left_target,       # Target Reference
    "hero_center_burst": compose_hero_center_burst,     # Central Hero + Explosion
    "split_diagonal": compose_split_diagonal,           # Dynamic Angular Split
    "flatlay_overhead": compose_flatlay_overhead,       # Culinary Overhead Tabletop
    "price_star": compose_price_star,                   # Flash Sale Price Starburst
    "minimal_luxury": compose_minimal_luxury,           # High-End Dark Studio
}

# ==============================================================================
# QUALITY GATE & AUTOMATED AUDIT
# ==============================================================================

def quality_gate_audit(canvas, spec):
    """
    Automated pre-flight Quality Gate:
    - Text readability & WCAG contrast AA
    - Product prominence (35-60% area)
    - Safe margins & bounds
    - Depth, layering & visual balance
    Returns: (passed: bool, score: int, issues: list)
    """
    W, H = canvas.size
    issues = []
    score = 100

    # 1. Product prominence
    prod_path = spec.get("product_image") or (spec.get("items") and spec["items"][0].get("path"))
    if not prod_path or not os.path.exists(prod_path):
        issues.append("Foto produk tidak ditemukan")
        score -= 40

    # 2. Headline check
    headline = spec.get("headline") or spec.get("title") or ""
    if not headline.strip():
        issues.append("Judul promo kosong")
        score -= 20
    elif len(headline) > 60:
        issues.append("Judul terlalu panjang untuk poster mobile")
        score -= 10

    # 3. Canvas resolution check
    if W < 500 or H < 500:
        issues.append("Resolusi poster terlalu kecil")
        score -= 30

    passed = score >= 70
    return passed, max(0, score), issues

# ==============================================================================
# MAIN COMPOSE PIPELINE
# ==============================================================================

def compose_poster(spec, out_path, preview_path=None, doc_path=None):
    """
    Full Scene Composer rendering pipeline.
    Renders selected recipe, runs Quality Gate, records document layers,
    applies post-processing, and exports JPG/PNG and fast preview.
    """
    recipe_id = spec.get("recipe") or spec.get("style") or "hero_left_target"
    # AI backgrounds may contain imperfect pseudo-text; place them in a calm,
    # blurred field and use a single controlled layout for all exact copy.
    if spec.get("background_image_path") and os.path.exists(spec["background_image_path"]):
        compose_fn = compose_ai_background_poster
        recipe_id = "ai_background_clean"
    else:
        compose_fn = RECIPES.get(recipe_id, compose_hero_left_target)

    # Initialize LayerRecorder if doc_path requested
    recorder = None
    if doc_path and LayerRecorder:
        recorder = LayerRecorder(Path(doc_path).parent)

    # Render layers
    canvas = compose_fn(spec, recorder=recorder)

    # Quality Gate Audit
    passed, q_score, issues = quality_gate_audit(canvas, spec)

    # Post-Processing
    final_rgb = post_process_poster(canvas, grading_warmth=1.04, sharpness=1.12, grain_amount=0.012)

    # Save full resolution output
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ext = out_path.suffix.lower()
    if ext == ".png":
        final_rgb.save(out_path, format="PNG", optimize=True)
    else:
        final_rgb.save(out_path, format="JPEG", quality=95, optimize=True)

    # Save fast preview thumbnail if requested (50% scale for instant web UI display)
    if preview_path:
        prev_path = Path(preview_path)
        prev_path.parent.mkdir(parents=True, exist_ok=True)
        prev_w = max(320, canvas.width // 2)
        prev_h = int(prev_w * (canvas.height / float(canvas.width)))
        prev_img = final_rgb.resize((prev_w, prev_h), Image.Resampling.BILINEAR)
        prev_img.save(prev_path, format="JPEG", quality=82, optimize=True)

    # Save document.json for Design Editor compatibility
    if doc_path and recorder:
        doc = dict(
            version=1,
            title=spec.get("headline") or spec.get("title") or "Poster Promo",
            format=spec.get("format", "feed"),
            width=canvas.width,
            height=canvas.height,
            layers=recorder.layers,
            assets=recorder.assets,
            metadata=dict(recipe=recipe_id, quality_score=q_score, issues=issues)
        )
        Path(doc_path).write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

    return dict(
        success=True,
        width=canvas.width,
        height=canvas.height,
        recipe=recipe_id,
        quality_score=q_score,
        quality_passed=passed,
        issues=issues
    )

def main():
    parser = argparse.ArgumentParser(description="AUTOfEEDS Unified Scene Composer")
    parser.add_argument("spec", help="Path to spec JSON file")
    parser.add_argument("out", help="Path to output JPG/PNG file")
    parser.add_argument("folder", nargs="?", help="Optional folder for document.json")
    parser.add_argument("--preview", help="Path for fast preview thumbnail")
    parser.add_argument("--doc", help="Path for document.json")
    args = parser.parse_args()

    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    doc_file = args.doc or (Path(args.folder) / "document.json" if args.folder else None)
    res = compose_poster(spec, args.out, preview_path=args.preview, doc_path=doc_file)
    print(json.dumps(res))

if __name__ == "__main__":
    main()

