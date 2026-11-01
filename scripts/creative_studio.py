"""AUTOfEEDS AI Creative Studio - Professional Graphic Design Engine
Generates commercial-grade promotional posters and carousels from raw product photos.
Maintains 100% product identity integrity (zero hallucination, no packaging distortion).
"""

import os
import sys
import json
import math
import random
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

# Import creative styles and background generator
try:
    from scripts.creative_styles import DESIGN_STYLES, PRODUCT_CATEGORIES, CONTENT_FORMATS, generate_style_background, draw_3d_podium, mix_colors
except ImportError:
    from creative_styles import DESIGN_STYLES, PRODUCT_CATEGORIES, CONTENT_FORMATS, generate_style_background, draw_3d_podium, mix_colors

# Background removal model helper
try:
    from scripts.product_image import remove_background
except ImportError:
    try:
        from product_image import remove_background
    except ImportError:
        remove_background = None

WIN_FONTS = Path(os.environ.get("WINDIR", "C:\\Windows")) / "Fonts"

def get_font(name="segoeuib.ttf", size=32):
    font_paths = [
        WIN_FONTS / name,
        WIN_FONTS / "arialbd.ttf",
        WIN_FONTS / "segoeui.ttf",
        WIN_FONTS / "arial.ttf",
    ]
    for fp in font_paths:
        if fp.exists():
            try:
                return ImageFont.truetype(str(fp), size)
            except Exception:
                pass
    return ImageFont.load_default()

def format_idr(val):
    if val is None or val == "":
        return None
    val_str = str(val).strip()
    digits = "".join(ch for ch in val_str if ch.isdigit())
    if not digits:
        return val_str
    try:
        num = int(digits)
        return f"Rp {num:,}".replace(",", ".")
    except Exception:
        return val_str

def get_style_fonts(style_id, base_scale=1.0):
    style_font_map = {
        "luxury_commercial": ("georgiab.ttf", "segoeui.ttf"),
        "editorial": ("georgiab.ttf", "arial.ttf"),
        "japanese_minimalist": ("segoeui.ttf", "arial.ttf"),
        "bold_promo": ("impact.ttf", "segoeuib.ttf"),
        "flash_sale": ("impact.ttf", "segoeuib.ttf"),
        "modern_typography": ("impact.ttf", "arialbd.ttf"),
        "3d_product": ("segoeuib.ttf", "segoeui.ttf"),
        "korean_style": ("segoeuib.ttf", "segoeui.ttf"),
        "frozen_food": ("segoeuib.ttf", "arialbd.ttf"),
    }
    head_name, body_name = style_font_map.get(style_id, ("segoeuib.ttf", "arialbd.ttf"))
    return head_name, body_name

def draw_rounded_card(draw, box, radius, fill, outline=None, width=1):
    x0, y0, x1, y1 = box
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def render_multi_drop_shadow(product_layer, offset_y=28, blur_radius=32, opacity=160):
    w, h = product_layer.size
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    alpha = product_layer.split()[3]
    shadow_mask = Image.new("L", (w, h), 0)
    shadow_mask.paste(alpha)
    
    black = Image.new("RGBA", (w, h), (0, 0, 0, opacity))
    shadow.paste(black, (0, 0), shadow_mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur_radius))
    return shadow

def render_contact_shadow(product_layer, width, height, px, py, pw, ph, opacity=190):
    shadow_canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow_canvas)
    
    cx = px + pw // 2
    ground_y = py + ph - int(ph * 0.04)
    sw = int(pw * 0.85)
    sh = max(18, int(ph * 0.14))
    
    draw.ellipse([cx - sw // 2, ground_y - sh // 2, cx + sw // 2, ground_y + sh // 2], fill=(0, 0, 0, opacity))
    shadow_canvas = shadow_canvas.filter(ImageFilter.GaussianBlur(16))
    return shadow_canvas

def draw_pill_badge(canvas, text, x, y, bg_color, text_color, font):
    d = ImageDraw.Draw(canvas)
    clean_text = text.upper()
    bbox = d.textbbox((0, 0), clean_text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    star_size = 8
    pad_x, pad_y = 22, 10
    bw = tw + pad_x * 2 + star_size * 2 + 10
    bh = th + pad_y * 2
    
    # Shadow
    s_img = Image.new("RGBA", (bw + 20, bh + 20), (0, 0, 0, 0))
    ImageDraw.Draw(s_img).rounded_rectangle([10, 10 + 4, 10 + bw, 10 + bh + 4], radius=bh//2, fill=(0, 0, 0, 80))
    s_img = s_img.filter(ImageFilter.GaussianBlur(8))
    canvas.alpha_composite(s_img, (x - 10, y - 10))
    
    # Pill
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle([x, y, x + bw, y + bh], radius=bh//2, fill=bg_color)
    
    # Draw vector diamond star icon
    sx = x + pad_x + star_size // 2
    sy = y + bh // 2
    d.polygon([(sx, sy - star_size), (sx + star_size // 2, sy),
               (sx, sy + star_size), (sx - star_size // 2, sy)], fill=text_color)
    
    d.text((sx + star_size + 8, y + pad_y), clean_text, fill=text_color, font=font)
    return bw, bh

def draw_discount_badge(canvas, discount_text, cx, cy, radius, bg_color, text_color, head_font, sub_font):
    badge_img = Image.new("RGBA", (radius * 2 + 30, radius * 2 + 30), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge_img)
    bcx, bcy = radius + 15, radius + 15
    
    # Drop shadow
    bd.ellipse([bcx - radius, bcy - radius + 6, bcx + radius, bcy + radius + 6], fill=(0, 0, 0, 90))
    badge_img = badge_img.filter(ImageFilter.GaussianBlur(10))
    bd = ImageDraw.Draw(badge_img)
    
    # Outer circle
    bd.ellipse([bcx - radius, bcy - radius, bcx + radius, bcy + radius], fill=bg_color, outline=(255, 255, 255, 230), width=3)
    # Inner dashed-like ring
    bd.ellipse([bcx - radius + 7, bcy - radius + 7, bcx + radius - 7, bcy + radius - 7], outline=(255, 255, 255, 130), width=1)
    
    # Text
    bbox1 = bd.textbbox((0, 0), "DISKON", font=sub_font)
    tw1 = bbox1[2] - bbox1[0]
    bd.text((bcx - tw1 // 2, bcy - int(radius * 0.60)), "DISKON", fill=text_color, font=sub_font)
    
    clean_disc = discount_text if "%" in discount_text or "OFF" in discount_text else f"{discount_text}%"
    bbox2 = bd.textbbox((0, 0), clean_disc, font=head_font)
    tw2, th2 = bbox2[2] - bbox2[0], bbox2[3] - bbox2[1]
    bd.text((bcx - tw2 // 2, bcy - th2 // 2 + 2), clean_disc, fill=text_color, font=head_font)
    
    bbox3 = bd.textbbox((0, 0), "OFF", font=sub_font)
    tw3 = bbox3[2] - bbox3[0]
    bd.text((bcx - tw3 // 2, bcy + int(radius * 0.35)), "OFF", fill=text_color, font=sub_font)
    
    canvas.alpha_composite(badge_img, (cx - bcx, cy - bcy))

def wrap_text(text, font, max_width, draw):
    words = text.split()
    lines = []
    current = []
    for w in words:
        test = " ".join(current + [w])
        bbox = draw.textbbox((0, 0), test, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            current.append(w)
        else:
            if current:
                lines.append(" ".join(current))
                current = [w]
            else:
                lines.append(w)
    if current:
        lines.append(" ".join(current))
    return lines


# ==============================================================================
# MAIN DESIGN COMPOSITION ENGINE
# ==============================================================================
def render_creative_design(
    product_img_path,
    style_id="premium_ad",
    format_id="portrait",
    variation_seed=42,
    product_name="Nama Produk",
    headline="Promo Spesial Hari Ini",
    description="",
    price_normal=None,
    price_promo=None,
    discount_tag=None,
    cta_text="Beli Sekarang",
    usp_points=None,
    composition_mode="hero_center",
    remove_bg=True,
    output_path=None
):
    rng = random.Random(variation_seed)
    style = DESIGN_STYLES.get(style_id, DESIGN_STYLES["premium_ad"])
    W, H, format_label = CONTENT_FORMATS.get(format_id, CONTENT_FORMATS["portrait"])

    # 1. Base Canvas & Background
    canvas = generate_style_background(W, H, style, rng)

    # 2. Typography Setup
    head_font_file, body_font_file = get_style_fonts(style_id)
    scale = W / 1080.0
    f_head = get_font(head_font_file, int(64 * scale))
    f_subhead = get_font(body_font_file, int(26 * scale))
    f_badge = get_font(head_font_file, int(22 * scale))
    f_price_big = get_font(head_font_file, int(52 * scale))
    f_price_strike = get_font(body_font_file, int(28 * scale))
    f_cta = get_font(head_font_file, int(26 * scale))
    f_tag = get_font(body_font_file, int(18 * scale))
    f_usp = get_font(body_font_file, int(22 * scale))

    # 3. Load & Process Product (Zero packaging modification)
    raw_prod = Image.open(product_img_path).convert("RGBA")
    
    # Isolate foreground if requested
    if remove_bg and remove_background:
        extrema = raw_prod.getextrema()
        # Has meaningful transparency?
        has_transparency = (len(extrema) == 4 and extrema[3][0] < 200)
        if not has_transparency:
            try:
                prod_isolated = remove_background(raw_prod)
                if prod_isolated:
                    raw_prod = prod_isolated
            except Exception as e:
                print(f"[remove_background] notice: {e}", file=sys.stderr)

    # Trim empty alpha borders to get true product bounds
    bbox = raw_prod.getbbox()
    if bbox:
        raw_prod = raw_prod.crop(bbox)

    # 4. Composition Matrix (Calculates product & text layout)
    # Available modes: hero_center, asymmetric_left, asymmetric_right, floating_podium, brutalist_split, minimal_anchor
    margin = int(W * 0.07)
    avail_w = W - margin * 2
    
    prod_w, prod_h = raw_prod.size
    aspect = prod_w / max(1, prod_h)

    # Layout coordinates
    if composition_mode == "asymmetric_left":
        # Product on left, text on right
        target_pw = int(W * 0.46)
        target_ph = int(target_pw / aspect)
        if target_ph > int(H * 0.65):
            target_ph = int(H * 0.65)
            target_pw = int(target_ph * aspect)
        px = margin
        py = int(H * 0.35)
        text_x = px + target_pw + int(W * 0.05)
        text_w = W - text_x - margin
        text_y = int(H * 0.28)
        align = "left"

    elif composition_mode == "asymmetric_right":
        # Product on right, text on left
        target_pw = int(W * 0.46)
        target_ph = int(target_pw / aspect)
        if target_ph > int(H * 0.65):
            target_ph = int(H * 0.65)
            target_pw = int(target_ph * aspect)
        px = W - margin - target_pw
        py = int(H * 0.35)
        text_x = margin
        text_w = px - margin - int(W * 0.04)
        text_y = int(H * 0.28)
        align = "left"

    elif composition_mode == "brutalist_split":
        # Top half product, bottom half text cards
        target_ph = int(H * 0.42)
        target_pw = int(target_ph * aspect)
        if target_pw > int(W * 0.75):
            target_pw = int(W * 0.75)
            target_ph = int(target_pw / aspect)
        px = (W - target_pw) // 2
        py = int(H * 0.12)
        text_x = margin
        text_w = avail_w
        text_y = py + target_ph + int(H * 0.04)
        align = "center"

    else:
        # hero_center / floating_podium (Default commercial hero)
        target_ph = int(H * 0.48)
        target_pw = int(target_ph * aspect)
        if target_pw > int(W * 0.72):
            target_pw = int(W * 0.72)
            target_ph = int(target_pw / aspect)
        px = (W - target_pw) // 2
        py = int(H * 0.36)
        text_x = margin
        text_w = avail_w
        text_y = int(H * 0.08)
        align = "center"

    prod_resized = raw_prod.resize((target_pw, target_ph), Image.Resampling.LANCZOS)

    # 5. Render Podium / Base Stage (if style supports pedestal)
    if style.get("pedestal", False) and composition_mode in ("hero_center", "floating_podium"):
        draw_3d_podium(canvas, px, py, target_pw, target_ph, style["accent"], style["secondary"])
    else:
        # Grounding contact shadow
        contact = render_contact_shadow(prod_resized, W, H, px, py, target_pw, target_ph, opacity=140)
        canvas = Image.alpha_composite(canvas, contact)

    # 6. Render Product with Multi-Drop Shadow
    shadow_layer = render_multi_drop_shadow(prod_resized, offset_y=int(24 * scale), blur_radius=int(28 * scale), opacity=150)
    canvas.alpha_composite(shadow_layer, (px, py + int(12 * scale)))
    canvas.alpha_composite(prod_resized, (px, py))

    # 7. Render Text & Promotional Layers
    draw = ImageDraw.Draw(canvas)

    # Top Brand / Style Pill
    curr_y = text_y
    badge_label = style["name"].upper() if align == "center" else "PENAWARAN TERBATAS"
    # Measure badge to center horizontally
    temp_bbox = draw.textbbox((0, 0), badge_label, font=f_badge)
    approx_w = (temp_bbox[2] - temp_bbox[0]) + int(70 * scale)
    pill_x = (W - approx_w) // 2 if align == "center" else text_x
    
    pill_w, pill_h = draw_pill_badge(
        canvas,
        badge_label,
        pill_x,
        curr_y,
        bg_color=(*style["secondary"], 230),
        text_color=style["accent"],
        font=f_badge
    )
    curr_y += pill_h + int(20 * scale)

    # Headline
    headline_lines = wrap_text(headline, f_head, text_w, draw)
    for line in headline_lines[:2]:
        bbox = draw.textbbox((0, 0), line, font=f_head)
        lw = bbox[2] - bbox[0]
        lh = bbox[3] - bbox[1]
        lx = (W - lw) // 2 if align == "center" else text_x
        draw.text((lx, curr_y), line, fill=style["text"], font=f_head)
        curr_y += int(lh * 1.35)

    curr_y += int(8 * scale)

    # Product Name
    if product_name:
        pname_lines = wrap_text(product_name, f_subhead, text_w, draw)
        for line in pname_lines[:2]:
            bbox = draw.textbbox((0, 0), line, font=f_subhead)
            lw = bbox[2] - bbox[0]
            lh = bbox[3] - bbox[1]
            lx = (W - lw) // 2 if align == "center" else text_x
            draw.text((lx, curr_y), line, fill=style["accent"], font=f_subhead)
            curr_y += int(lh * 1.35)

    # Short Description / Subheadline
    if description and len(headline_lines) <= 2:
        curr_y += int(6 * scale)
        desc_lines = wrap_text(description, f_tag, text_w, draw)
        for line in desc_lines[:2]:
            bbox = draw.textbbox((0, 0), line, font=f_tag)
            lw = bbox[2] - bbox[0]
            lh = bbox[3] - bbox[1]
            lx = (W - lw) // 2 if align == "center" else text_x
            draw.text((lx, curr_y), line, fill=style["muted"], font=f_tag)
            curr_y += int(lh * 1.4)
            curr_y += int((bbox[3] - bbox[1]) * 1.35)

    # 8. Render Discount Seal (Floating badge)
    if discount_tag or (price_normal and price_promo):
        disc_text = discount_tag
        if not disc_text and price_normal and price_promo:
            try:
                pn = float(str(price_normal).replace(".", "").replace(",", "").replace("Rp", "").strip())
                pp = float(str(price_promo).replace(".", "").replace(",", "").replace("Rp", "").strip())
                if pn > pp:
                    pct = int(round((pn - pp) / pn * 100))
                    disc_text = f"{pct}%"
            except Exception:
                disc_text = "HOT"
        
        if disc_text:
            badge_r = int(58 * scale)
            bx = px + target_pw - int(badge_r * 0.4)
            by = py - int(badge_r * 0.2)
            draw_discount_badge(
                canvas,
                str(disc_text),
                bx,
                by,
                badge_r,
                bg_color=style["accent"],
                text_color=(15, 23, 42) if sum(style["accent"]) > 400 else (255, 255, 255),
                head_font=get_font(head_font_file, int(30 * scale)),
                sub_font=get_font(body_font_file, int(15 * scale))
            )

    # 9. USP Points (if available)
    if usp_points and isinstance(usp_points, list) and len(usp_points) > 0:
        usp_y = py + target_ph + int(24 * scale)
        if align == "center" and usp_y < H - int(140 * scale):
            for usp in usp_points[:3]:
                usp_box = draw.textbbox((0, 0), f"✓ {usp}", font=f_usp)
                uw = usp_box[2] - usp_box[0]
                ux = (W - uw) // 2
                draw.text((ux, usp_y), f"✓ {usp}", fill=style["text"], font=f_usp)
                usp_y += int(usp_box[3] - usp_box[1] + 8 * scale)

    # 10. Bottom Commercial Footer (Pricing & CTA Button)
    footer_h = int(120 * scale)
    footer_y = H - footer_h - int(24 * scale)
    
    # Modern Glassmorphism Bar
    bar_w = W - margin * 2
    bar_x = margin
    draw_rounded_card(
        draw,
        (bar_x, footer_y, bar_x + bar_w, footer_y + footer_h),
        radius=int(24 * scale),
        fill=(*style["secondary"], 240),
        outline=(*style["accent"], 160),
        width=2
    )

    # Price section inside footer
    has_prices = bool(price_promo or price_normal)
    price_x = bar_x + int(28 * scale)
    py_center = footer_y + footer_h // 2

    if has_prices:
        cur_price_str = format_idr(price_promo) or ""
        old_price_str = format_idr(price_normal) or ""
        
        if cur_price_str:
            p_bbox = draw.textbbox((0, 0), cur_price_str, font=f_price_big)
            draw.text((price_x, py_center - (p_bbox[3] - p_bbox[1]) // 2 - 4), cur_price_str, fill=style["accent"], font=f_price_big)
            
            if old_price_str and old_price_str != cur_price_str:
                op_bbox = draw.textbbox((0, 0), old_price_str, font=f_price_strike)
                op_x = price_x + (p_bbox[2] - p_bbox[0]) + int(18 * scale)
                op_y = py_center - (op_bbox[3] - op_bbox[1]) // 2
                draw.text((op_x, op_y), old_price_str, fill=style["muted"], font=f_price_strike)
                # Strike-through line
                strike_y = op_y + (op_bbox[3] - op_bbox[1]) // 2 + 2
                draw.line([(op_x - 2, strike_y), (op_x + (op_bbox[2] - op_bbox[0]) + 2, strike_y)], fill=(239, 68, 68, 220), width=2)
    else:
        # Guarantee badge or stock alert
        draw.text((price_x, py_center - int(12 * scale)), "100% ORIGINAL & TERPERCAYA", fill=style["muted"], font=f_tag)

    # CTA Action Button (Right aligned in footer)
    cta_w = int(240 * scale)
    cta_h = int(68 * scale)
    cta_x = bar_x + bar_w - cta_w - int(24 * scale)
    cta_y = footer_y + (footer_h - cta_h) // 2
    
    # CTA button fill
    cta_fill = style["accent"]
    cta_text_col = (15, 23, 42) if sum(style["accent"]) > 400 else (255, 255, 255)
    draw_rounded_card(
        draw,
        (cta_x, cta_y, cta_x + cta_w, cta_y + cta_h),
        radius=int(cta_h // 2),
        fill=cta_fill
    )
    
    cta_box = draw.textbbox((0, 0), cta_text, font=f_cta)
    ctw, cth = cta_box[2] - cta_box[0], cta_box[3] - cta_box[1]
    draw.text((cta_x + (cta_w - ctw) // 2, cta_y + (cta_h - cth) // 2 - 2), cta_text, fill=cta_text_col, font=f_cta)

    # Save output
    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        # Convert RGBA to RGB for JPEG or save transparent PNG
        if output_path.lower().endswith(".png"):
            canvas.save(output_path, "PNG", optimize=True)
        else:
            canvas.convert("RGB").save(output_path, "JPEG", quality=95, optimize=True)

    return canvas


# ==============================================================================
# BATCH VARIATION GENERATOR (6 TO 12 DISTINCT DESIGNS)
# ==============================================================================
def generate_design_variations(
    product_img_path,
    output_dir,
    count=8,
    style_id=None,
    format_id="portrait",
    category_id="general",
    product_name="Nama Produk",
    headline="Promo Spesial",
    description="",
    price_normal=None,
    price_promo=None,
    discount_tag=None,
    cta_text="Beli Sekarang"
):
    os.makedirs(output_dir, exist_ok=True)
    results = []

    # Choose styles: if user didn't specify, pull from category recommendations or full library
    if style_id and style_id in DESIGN_STYLES:
        # Use user-selected style across various composition seeds
        selected_styles = [style_id] * count
    else:
        cat_info = PRODUCT_CATEGORIES.get(category_id, PRODUCT_CATEGORIES["general"])
        recs = cat_info.get("recommended_styles", list(DESIGN_STYLES.keys()))
        # Pool of unique styles
        selected_styles = []
        for i in range(count):
            selected_styles.append(recs[i % len(recs)])

    # Composition variations
    compositions = [
        "hero_center",
        "asymmetric_left",
        "asymmetric_right",
        "floating_podium",
        "brutalist_split",
        "hero_center",
        "asymmetric_left",
        "asymmetric_right",
        "floating_podium",
        "brutalist_split",
        "hero_center",
        "floating_podium"
    ]

    # Dynamic headline variations for diversity
    headline_templates = [
        headline,
        f"Eksklusif: {headline}",
        f"{headline} — Terbatas Hari Ini!",
        f"Spesial Rilis: {product_name}",
        f"Kualitas Juara {product_name}",
        f"Dapatkan Sekarang: {headline}",
        f"Rekomendasi Terbaik Minggu Ini",
        f"Pilihan Favorit: {product_name}",
        headline,
        f"Promo Hebat {product_name}",
        f"Upgrade Sekarang Dengan {product_name}",
        f"Jangan Lewatkan Penawaran Ini"
    ]

    for idx in range(count):
        seed = 1000 + idx * 77
        cur_style_id = selected_styles[idx]
        cur_comp = compositions[idx % len(compositions)]
        cur_head = headline_templates[idx % len(headline_templates)]
        
        file_name = f"variant_{idx + 1:02d}_{cur_style_id}.jpg"
        out_file = os.path.join(output_dir, file_name)
        
        print(f"Generating variant {idx+1}/{count}: {cur_style_id} ({cur_comp})...", file=sys.stderr)
        
        render_creative_design(
            product_img_path=product_img_path,
            style_id=cur_style_id,
            format_id=format_id,
            variation_seed=seed,
            product_name=product_name,
            headline=cur_head,
            description=description,
            price_normal=price_normal,
            price_promo=price_promo,
            discount_tag=discount_tag,
            cta_text=cta_text,
            composition_mode=cur_comp,
            remove_bg=True,
            output_path=out_file
        )
        
        style_meta = DESIGN_STYLES.get(cur_style_id, {})
        results.append({
            "index": idx + 1,
            "filename": file_name,
            "filepath": out_file,
            "style_id": cur_style_id,
            "style_name": style_meta.get("name", cur_style_id),
            "composition": cur_comp,
            "headline": cur_head,
            "format": format_id,
        })

    return results


# ==============================================================================
# INSTAGRAM CAROUSEL GENERATOR (5 SEAMLESS SLIDES)
# ==============================================================================
def generate_carousel_slides(
    product_img_path,
    output_dir,
    style_id="premium_ad",
    format_id="portrait",
    product_name="Nama Produk",
    headline="Solusi Terbaik Untuk Kebutuhan Anda",
    usp_points=None,
    detail_points=None,
    price_normal=None,
    price_promo=None,
    discount_tag=None,
    cta_text="Pesan Sekarang",
    profile_handle="@autofeeds.id"
):
    os.makedirs(output_dir, exist_ok=True)
    slides = []
    
    style = DESIGN_STYLES.get(style_id, DESIGN_STYLES["premium_ad"])
    W, H, _ = CONTENT_FORMATS.get(format_id, CONTENT_FORMATS["portrait"])
    scale = W / 1080.0
    
    default_usps = [
        "Kualitas Bahan Terjamin Grade A",
        "Formulasi Cepat & Hasil Maksimal",
        "Garansi Kepuasan 100% Uang Kembali"
    ]
    usps = usp_points if (usp_points and len(usp_points) >= 3) else default_usps
    
    # 5 Slide Definitions
    slide_configs = [
        {
            "slide_num": 1,
            "title": "HOOK / COVER",
            "headline": headline,
            "subhead": f"Kenapa {product_name} jadi pilihan nomor 1?",
            "comp": "hero_center",
            "badge": "SLIDE 1/5 • SWIPE 👉",
            "footer_note": "Swipe ke kiri untuk melihat rahasianya"
        },
        {
            "slide_num": 2,
            "title": "KEUNGGULAN UTAMA",
            "headline": "3 Keunggulan Mutlak",
            "subhead": "Yang membedakan kami dari kompetitor lain",
            "comp": "asymmetric_right",
            "badge": "SLIDE 2/5 • FITUR UNGGULAN",
            "footer_note": "Teruji & terbukti oleh ribuan pengguna"
        },
        {
            "slide_num": 3,
            "title": "DETAIL PRODUK",
            "headline": "Kualitas Tanpa Kompromi",
            "subhead": f"Setiap elemen {product_name} dirancang dengan teliti",
            "comp": "asymmetric_left",
            "badge": "SLIDE 3/5 • DETAIL SPESIFIKASI",
            "footer_note": "Standar mutu industri tertinggi"
        },
        {
            "slide_num": 4,
            "title": "PENAWARAN SPESIAL",
            "headline": "Harga Promo Terbatas!",
            "subhead": "Khusus pembelian hari ini sebelum kehabisan",
            "comp": "hero_center",
            "badge": "SLIDE 4/5 • PENAWARAN EKSKLUSIF",
            "footer_note": "Stok flash sale tersisa sedikit"
        },
        {
            "slide_num": 5,
            "title": "CALL TO ACTION",
            "headline": "Ambil Promo Sekarang!",
            "subhead": f"Klik link di bio atau kirim pesan DM ke {profile_handle}",
            "comp": "hero_center",
            "badge": "SLIDE 5/5 • SELESAI",
            "footer_note": "Pengiriman cepat ke seluruh Indonesia"
        }
    ]

    for conf in slide_configs:
        s_num = conf["slide_num"]
        out_file = os.path.join(output_dir, f"carousel_slide_{s_num}.jpg")
        
        # Render each slide with matching style & shared continuous visual identity
        render_creative_design(
            product_img_path=product_img_path,
            style_id=style_id,
            format_id=format_id,
            variation_seed=500 + s_num * 13,
            product_name=product_name,
            headline=conf["headline"],
            description=conf["subhead"],
            price_normal=price_normal if s_num in (4, 5) else None,
            price_promo=price_promo if s_num in (4, 5) else None,
            discount_tag=discount_tag if s_num == 4 else None,
            cta_text=cta_text if s_num in (4, 5) else "Swipe 👉",
            usp_points=usps if s_num == 2 else None,
            composition_mode=conf["comp"],
            remove_bg=True,
            output_path=out_file
        )
        
        slides.append({
            "slide": s_num,
            "title": conf["title"],
            "filename": f"carousel_slide_{s_num}.jpg",
            "filepath": out_file,
            "badge": conf["badge"]
        })

    return slides


# ==============================================================================
# CLI HANDLER (JSON INPUT / OUTPUT)
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(description="AUTOfEEDS AI Creative Studio Renderer")
    parser.add_argument("--mode", choices=["single", "variations", "carousel"], default="single")
    parser.add_argument("--json", help="Path to JSON parameter file or raw JSON string")
    parser.add_argument("--product-image", help="Path to raw product image")
    parser.add_argument("--style", default="premium_ad")
    parser.add_argument("--format", default="portrait")
    parser.add_argument("--count", type=int, default=8)
    parser.add_argument("--product-name", default="Produk Unggulan")
    parser.add_argument("--headline", default="Promo Spesial Hari Ini")
    parser.add_argument("--description", default="")
    parser.add_argument("--price-normal", default=None)
    parser.add_argument("--price-promo", default=None)
    parser.add_argument("--discount-tag", default=None)
    parser.add_argument("--cta-text", default="Beli Sekarang")
    parser.add_argument("--output", default="storage/creative_output/output.jpg")
    parser.add_argument("--output-dir", default="storage/creative_output")

    args = parser.parse_args()

    # Load JSON if passed
    params = {}
    if args.json:
        if os.path.exists(args.json):
            with open(args.json, "r", encoding="utf-8") as f:
                params = json.load(f)
        else:
            try:
                params = json.loads(args.json)
            except Exception:
                pass

    mode = params.get("mode", args.mode)
    product_img = params.get("product_image", args.product_image)
    if not product_img or not os.path.exists(product_img):
        print(json.dumps({"error": f"Product image not found: {product_img}"}))
        sys.exit(1)

    style_id = params.get("style", args.style)
    format_id = params.get("format", args.format)
    count = int(params.get("count", args.count))
    category_id = params.get("category", "general")
    product_name = params.get("product_name", args.product_name)
    headline = params.get("headline", args.headline)
    description = params.get("description", args.description)
    price_normal = params.get("price_normal", args.price_normal)
    price_promo = params.get("price_promo", args.price_promo)
    discount_tag = params.get("discount_tag", args.discount_tag)
    cta_text = params.get("cta_text", args.cta_text)
    usp_points = params.get("usp_points", None)

    out_path = params.get("output", args.output)
    out_dir = params.get("output_dir", args.output_dir)

    if mode == "single":
        render_creative_design(
            product_img_path=product_img,
            style_id=style_id,
            format_id=format_id,
            product_name=product_name,
            headline=headline,
            description=description,
            price_normal=price_normal,
            price_promo=price_promo,
            discount_tag=discount_tag,
            cta_text=cta_text,
            usp_points=usp_points,
            remove_bg=True,
            output_path=out_path
        )
        print(json.dumps({
            "status": "success",
            "mode": "single",
            "output_path": out_path,
            "style": style_id,
            "format": format_id
        }))

    elif mode == "variations":
        results = generate_design_variations(
            product_img_path=product_img,
            output_dir=out_dir,
            count=count,
            style_id=style_id if style_id != "auto" else None,
            format_id=format_id,
            category_id=category_id,
            product_name=product_name,
            headline=headline,
            description=description,
            price_normal=price_normal,
            price_promo=price_promo,
            discount_tag=discount_tag,
            cta_text=cta_text
        )
        print(json.dumps({
            "status": "success",
            "mode": "variations",
            "total": len(results),
            "output_dir": out_dir,
            "variants": results
        }))

    elif mode == "carousel":
        slides = generate_carousel_slides(
            product_img_path=product_img,
            output_dir=out_dir,
            style_id=style_id,
            format_id=format_id,
            product_name=product_name,
            headline=headline,
            usp_points=usp_points,
            price_normal=price_normal,
            price_promo=price_promo,
            discount_tag=discount_tag,
            cta_text=cta_text
        )
        print(json.dumps({
            "status": "success",
            "mode": "carousel",
            "total_slides": len(slides),
            "output_dir": out_dir,
            "slides": slides
        }))

if __name__ == "__main__":
    main()
