import json
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
from creative_layout import plan as creative_plan, STYLES
from layer_recorder import LayerRecorder, RecordedDraw, rgba

Image.MAX_IMAGE_PIXELS = 100_000_000

# Upgraded Curated Modern Themes (c1: primary/top, c2: deep contrast/bottom, accent: vibrant highlight)
THEMES = {
    "merah": ((190, 18, 60), (136, 19, 55), (255, 214, 10)),      # Ruby Crimson
    "biru": ((29, 78, 216), (23, 37, 84), (56, 189, 248)),        # Cobalt Blue
    "ungu": ((109, 40, 217), (59, 7, 100), (253, 224, 71)),       # Royal Violet
    "oranye": ((234, 88, 12), (154, 52, 18), (254, 240, 138)),    # Sunset Orange
    "hijau": ((21, 128, 61), (20, 83, 45), (253, 224, 71)),       # Jade Green
    "pink": ((190, 24, 93), (112, 26, 117), (254, 240, 138)),     # Mulberry Pink
    "tosca": ((15, 118, 110), (19, 78, 74), (94, 234, 212)),      # Oceanic Teal
    "midnight": ((15, 23, 42), (9, 13, 26), (6, 182, 212)),       # Midnight Dark Cyan
    "luxury_gold": ((24, 24, 27), (9, 9, 11), (245, 158, 11)),     # Royal Onyx Gold
    "sunset": ((225, 29, 72), (136, 19, 55), (251, 191, 36)),     # Crimson Sunset
    "emerald": ((6, 78, 59), (4, 47, 36), (52, 211, 153)),        # Deep Emerald Mint
}

FORMATS = {
    "feed": (1080, 1350),
    "square": (1080, 1080),
    "story": (1080, 1920),
    "landscape": (1200, 630),
}

# Typography
F_IMPACT = ["C:/Windows/Fonts/seguibl.ttf", "C:/Windows/Fonts/bahnschrift.ttf", "C:/Windows/Fonts/impact.ttf", "C:/Windows/Fonts/arialbd.ttf", "arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
F_BLACK = ["C:/Windows/Fonts/seguibl.ttf", "C:/Windows/Fonts/ariblk.ttf", "C:/Windows/Fonts/arialbd.ttf", "arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
F_BOLD = ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/seguisb.ttf", "C:/Windows/Fonts/arialbd.ttf", "arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
F_REG = ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf", "arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
TITLE_FONTS = [F_IMPACT, F_BLACK, F_BOLD]

NAME_COLOR = (15, 23, 42)
SLATE_MUTED = (100, 116, 139)
WHITE = (255, 255, 255)


def load_font(paths, size):
    size = max(6, int(size))
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def fit_font(d, text, paths, max_w, start, min_size):
    size = int(start)
    while size > min_size:
        f = load_font(paths, size)
        if d.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    f = load_font(paths, min_size)
    while size > 4 and d.textlength(text, font=f) > max_w:
        size -= 1
        f = load_font(paths, size)
    return f


def wrap(d, text, font, max_w, max_lines):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if d.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while last and d.textlength(last + "…", font=font) > max_w:
            last = last[:-1]
        lines[-1] = last + "…"
    out = []
    for ln in lines:
        while len(ln) > 1 and d.textlength(ln, font=font) > max_w:
            ln = ln[:-1]
        out.append(ln)
    return out


def mix(c1, c2, t):
    t = max(0.0, min(1.0, float(t)))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def load_product(path):
    with Image.open(path) as im:
        im.load()
        im = ImageOps.exif_transpose(im)
        return im.convert("RGBA")


def build_modern_background(W, H, c1, c2, accent, style, rng):
    # Smooth continuous gradient
    gw, gh = max(32, W // 10), max(32, H // 10)
    thumb = Image.new("RGB", (gw, gh), c1)
    td = ImageDraw.Draw(thumb)
    for y in range(gh):
        t = y / max(1, gh - 1)
        col = mix(c1, c2, math.pow(t, 1.25))
        td.line([(0, y), (gw, y)], fill=col)
    base = thumb.resize((W, H), Image.Resampling.BICUBIC).convert("RGBA")

    decor = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(decor)

    # 1. Central Ambient Stage Spotlight
    spot_w, spot_h = int(W * 1.15), int(H * 0.72)
    spot_x, spot_y = (W - spot_w) // 2, int(H * 0.16)
    spot_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(spot_layer).ellipse([spot_x, spot_y, spot_x + spot_w, spot_y + spot_h], fill=(*accent, 55))
    spot_layer = spot_layer.filter(ImageFilter.GaussianBlur(int(W * 0.18)))
    decor = Image.alpha_composite(decor, spot_layer)
    dd = ImageDraw.Draw(decor)

    # 2. Modern Decorative Accents
    deco_kind = rng.choice(["orbs", "grid", "rays", "sparkles"])
    if style == "flash" or deco_kind == "rays":
        cx, cy = W / 2, H * 0.14
        n, R = 28, max(W, H) * 1.6
        for i in range(0, n, 2):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            dd.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)),
                        (cx + R * math.cos(a1), cy + R * math.sin(a1))],
                       fill=(255, 255, 255, 20))
    elif deco_kind == "orbs":
        for _ in range(4):
            r = int(W * rng.uniform(0.12, 0.28))
            cx = int(W * rng.choice([-0.05, 0.15, 0.85, 1.05]))
            cy = int(H * rng.uniform(0.1, 0.9))
            orb_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(orb_layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*accent, rng.randint(25, 45)))
            orb_layer = orb_layer.filter(ImageFilter.GaussianBlur(int(r * 0.45)))
            decor = Image.alpha_composite(decor, orb_layer)
            dd = ImageDraw.Draw(decor)
    elif deco_kind == "grid":
        step = int(W * 0.05)
        r = max(2, int(step * 0.08))
        for gy in range(int(H * 0.08), int(H * 0.95), step):
            for gx in range(int(W * 0.06), int(W * 0.94), step):
                dd.ellipse([gx - r, gy - r, gx + r, gy + r], fill=(255, 255, 255, 18))

    # 3. Geometric Sparkle Stars (✦)
    for _ in range(8):
        sx, sy = int(W * rng.uniform(0.04, 0.96)), int(H * rng.uniform(0.02, 0.96))
        sr = int(rng.uniform(6, 14))
        dd.polygon([(sx, sy - sr * 2), (sx + sr // 2, sy - sr // 2), (sx + sr * 2, sy),
                    (sx + sr // 2, sy + sr // 2), (sx, sy + sr * 2), (sx - sr // 2, sy + sr // 2),
                    (sx - sr * 2, sy), (sx - sr // 2, sy - sr // 2)], fill=(*accent, rng.randint(90, 180)))

    return Image.alpha_composite(base, decor)


def draw_drop_shadow(canvas, x, y, w, h, radius, blur=24, offset_y=12, alpha=45):
    pad = blur * 2
    sw, sh = w + pad * 2, h + pad * 2
    s_img = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    sd = ImageDraw.Draw(s_img)
    sd.rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, fill=(0, 0, 0, int(alpha * 0.7)))
    sd.rounded_rectangle([pad, pad + offset_y // 2, pad + w, pad + h + offset_y // 2], radius=radius, fill=(0, 0, 0, int(alpha * 0.5)))
    s_img = s_img.filter(ImageFilter.GaussianBlur(blur // 2))
    canvas.alpha_composite(s_img, (x - pad, y - pad + offset_y))


def draw_product_contact_shadow(canvas, px, py, pw, ph):
    sw = int(pw * 0.72)
    sh = max(8, int(ph * 0.10))
    pad = 20
    s_img = Image.new("RGBA", (sw + pad * 2, sh + pad * 2), (0, 0, 0, 0))
    sd = ImageDraw.Draw(s_img)
    sd.ellipse([pad, pad, pad + sw, pad + sh], fill=(0, 0, 0, 85))
    s_img = s_img.filter(ImageFilter.GaussianBlur(7))
    canvas.alpha_composite(s_img, (px + (pw - sw) // 2 - pad, py + ph - sh // 2 - pad))


def draw_card(canvas, d, x, y, w, h, item, st, badge, show_price):
    radius = int(min(w, h) * 0.055)
    pad = int(min(w, h) * 0.04)
    is_hero = w > 600 or st.get("hero", False)

    # 1. Card Body
    d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=(255, 255, 255, 255), outline=(226, 232, 240, 220), width=2)

    # 2. Dynamic Layout Balancing:
    # For hero, give even more stage prominence (64%)
    stage_ratio = 0.64 if is_hero else 0.58
    stage_h = int((h - 2 * pad) * stage_ratio) if show_price else int((h - 2 * pad) * 0.80)
    stage_pad = int(pad * 0.6)
    stage_x0 = x + stage_pad
    stage_y0 = y + stage_pad
    stage_x1 = x + w - stage_pad
    stage_y1 = y + stage_h

    # Showcase Pedestal / Booth
    d.rounded_rectangle([stage_x0, stage_y0, stage_x1, stage_y1],
                        radius=max(4, radius - 4), fill=(248, 250, 252, 255))

    # Inner soft stage spotlight flare
    spot_r = int(min(stage_x1 - stage_x0, stage_y1 - stage_y0) * 0.45)
    scx, scy = (stage_x0 + stage_x1) // 2, (stage_y0 + stage_y1) // 2
    d.ellipse([scx - spot_r, scy - spot_r, scx + spot_r, scy + spot_r], fill=(255, 255, 255, 180))

    box = (stage_x0 + pad, stage_y0 + pad, (stage_x1 - stage_x0) - 2 * pad, (stage_y1 - stage_y0) - 2 * pad)

    # 3. Product Image + Grounding Contact Shadow
    try:
        raw_im = load_product(item["path"])
        im = ImageOps.contain(raw_im, (box[2], box[3]), Image.Resampling.LANCZOS)
        ix = box[0] + (box[2] - im.width) // 2
        iy = box[1] + (box[3] - im.height) // 2
        draw_product_contact_shadow(canvas, ix, iy, im.width, im.height)
        canvas.alpha_composite(im, (ix, iy))
        if isinstance(d, RecordedDraw):
            d.recorder.image(raw_im, "Foto produk: " + item.get("name", ""), ix, iy, im.width, im.height)
    except Exception as exc:
        raise ValueError("Foto produk gagal dibaca") from exc

    # 4. Text Block (Product Name, Slashed Old Price, Modern Price Pill)
    text_y = stage_y1 + int(pad * 0.8)
    text_h = y + h - text_y - pad
    draw_text_block(canvas, d, x + pad, text_y, w - 2 * pad, text_h, item, st)

    # 5. Discount Tag (Top Right)
    tag = item.get("tag") or ""
    if tag:
        draw_tag(canvas, d, x, y, w, h, tag, st, pad)

    # 6. Corner Badge (Top Left, e.g. "PROMO" or "BEST SELLER")
    if badge and w >= 220:
        bf = load_font(F_BOLD, max(11, int(min(w, h) * (0.028 if is_hero else 0.040))))
        badge_txt = badge.upper()
        bb = d.textbbox((0, 0), badge_txt, font=bf)
        bw, bh = bb[2] - bb[0], bb[3] - bb[1]
        bpx, bpy = int(bh * 0.65), int(bh * 0.35)
        bx, by = stage_x0 + 8, stage_y0 + 8
        d.rounded_rectangle([bx, by, bx + bw + 2 * bpx, by + bh + 2 * bpy],
                            radius=int(bh + 2 * bpy) // 2, fill=(15, 23, 42, 220))
        d.text((bx + bpx - bb[0], by + bpy - bb[1]), badge_txt, font=bf, fill=(255, 255, 255))


def draw_text_block(canvas, d, x, y, w, h, item, st):
    name = item.get("name") or "Produk"
    price = item.get("price_text") or ""
    old = item.get("old_text") or ""
    is_hero = w > 550 or st.get("hero", False)

    nf_size = max(22, min(36, int(w * 0.038))) if is_hero else max(16, min(24, int(w * 0.054)))
    nf = load_font(F_BOLD, nf_size)
    lines = wrap(d, name, nf, w, 2)
    line_h = int(nf.size * 1.25)
    name_total_h = len(lines) * line_h

    of = None
    old_h = 0
    old_txt = ""
    if old:
        of_size = max(15, min(22, int(w * 0.024))) if is_hero else max(12, min(16, int(w * 0.038)))
        of = load_font(F_REG, of_size)
        old_txt = f"Rp {old}" if not old.startswith("Rp") else old
        old_h = int(of_size * 1.35)

    pf_size = max(26, min(40, int(w * 0.045))) if is_hero else max(18, min(28, int(w * 0.065)))
    pf = load_font(F_IMPACT, pf_size)
    pb = d.textbbox((0, 0), price, font=pf)
    pw, ph = pb[2] - pb[0], pb[3] - pb[1]
    pill_px = max(24, int(ph * 0.85))
    pill_py = max(10, int(ph * 0.35))
    pill_w = pw + 2 * pill_px
    pill_h = ph + 2 * pill_py

    gap_name_old = 6 if old else 0
    gap_old_pill = 10 if price else 0
    total_block_h = name_total_h + gap_name_old + old_h + gap_old_pill + (pill_h if price else 0)

    if total_block_h > h:
        shrink = max(0.60, (h - 4) / max(1, total_block_h))
        nf_size = max(11, int(nf_size * shrink))
        nf = load_font(F_BOLD, nf_size)
        lines = wrap(d, name, nf, w, 2)
        line_h = int(nf.size * 1.25)
        name_total_h = len(lines) * line_h
        if old:
            of_size = max(9, int(of_size * shrink))
            of = load_font(F_REG, of_size)
            old_h = int(of_size * 1.35)
        if price:
            pf_size = max(12, int(pf_size * shrink))
            pf = load_font(F_IMPACT, pf_size)
            pb = d.textbbox((0, 0), price, font=pf)
            pw, ph = pb[2] - pb[0], pb[3] - pb[1]
            pill_px = max(12, int(ph * 0.75))
            pill_py = max(3, int(ph * 0.25))
            pill_w = pw + 2 * pill_px
            pill_h = ph + 2 * pill_py
        gap_name_old = int(gap_name_old * shrink)
        gap_old_pill = int(gap_old_pill * shrink)
        total_block_h = name_total_h + gap_name_old + old_h + gap_old_pill + (pill_h if price else 0)

    # Center the entire text stack vertically in the lower card section
    start_y = y + max(0, (h - total_block_h) // 2)

    cur_y = start_y
    for ln in lines:
        lx = x + (w - d.textlength(ln, font=nf)) / 2
        d.text((lx, cur_y), ln, font=nf, fill=NAME_COLOR)
        cur_y += line_h

    if old and of:
        cur_y += gap_name_old
        ob = d.textbbox((0, 0), old_txt, font=of)
        ow = ob[2] - ob[0]
        ox = x + (w - ow) / 2
        d.text((ox, cur_y), old_txt, font=of, fill=SLATE_MUTED)
        sy = cur_y + (ob[1] + ob[3]) / 2
        d.line([(ox - 3, sy), (ox + ow + 3, sy)], fill=(239, 68, 68), width=max(2, of.size // 9))
        cur_y += old_h

    if not price:
        return

    cur_y += gap_old_pill
    pill_x = x + (w - pill_w) / 2
    pill_y = cur_y

    c1, c2 = st["c1"], st["c2"]
    draw_drop_shadow(canvas, int(pill_x), int(pill_y), int(pill_w), int(pill_h), radius=pill_h // 2, blur=12, offset_y=4, alpha=55)

    pill_thumb = Image.new("RGBA", (int(pill_w), int(pill_h)), (0, 0, 0, 0))
    pt_draw = ImageDraw.Draw(pill_thumb)
    for py_idx in range(pill_h):
        t = py_idx / max(1, pill_h - 1)
        if "GRATIS" in price:
            g_col = mix((16, 185, 129), (5, 150, 105), t)
        else:
            g_col = mix(c1, c2, t)
        pt_draw.line([(0, py_idx), (pill_w, py_idx)], fill=(*g_col, 255))
    mask = Image.new("L", (int(pill_w), int(pill_h)), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pill_w, pill_h], radius=pill_h // 2, fill=255)
    canvas.paste(pill_thumb, (int(pill_x), int(pill_y)), mask)

    if isinstance(d, RecordedDraw):
        d.draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], radius=pill_h // 2, outline=(255, 255, 255, 170), width=1)
        d.recorder.add('rect', 'Panel / label harga', pill_x, pill_y, pill_w, pill_h,
                       fill=rgba(st["c1"]), stroke=rgba((255, 255, 255, 170)), strokeWidth=1, radius=pill_h // 2)
    else:
        d.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], radius=pill_h // 2, outline=(255, 255, 255, 170), width=1)
    d.text((pill_x + pill_px - pb[0], pill_y + pill_py - pb[1]), price, font=pf, fill=WHITE)


def draw_tag(canvas, d, x, y, w, h, text, st, pad):
    accent = st["accent"]
    tf_size = max(13, min(17, int(min(w, h) * 0.054)))
    tf = load_font(F_IMPACT, tf_size)
    tb = d.textbbox((0, 0), text, font=tf)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]

    tpx, tpy = max(14, int(th * 0.8)), int(th * 0.40)
    bw, bh = tw + 2 * tpx, th + 2 * tpy
    bx, by = x + w - bw - int(pad * 0.8), y + int(pad * 0.8)

    draw_drop_shadow(canvas, int(bx), int(by), int(bw), int(bh), radius=int(bh * 0.35), blur=8, offset_y=3, alpha=70)
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=int(bh * 0.35), fill=(*accent, 255), outline=WHITE, width=2)
    ink = (15, 23, 42) if sum(accent) / 3 > 130 else WHITE
    d.text((bx + tpx - tb[0], by + tpy - tb[1]), text, font=tf, fill=ink)


def draw_bundle_panel(canvas, d, x, y, w, h, bundle, st):
    c1, c2, accent = st["c1"], st["c2"], st["accent"]
    draw_drop_shadow(canvas, x, y, w, h, radius=int(h * 0.22), blur=24, offset_y=10, alpha=60)

    # Gradient fill for bundle panel
    panel_thumb = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pt_draw = ImageDraw.Draw(panel_thumb)
    for py in range(h):
        t = py / max(1, h - 1)
        pt_draw.line([(0, py), (w, py)], fill=(*mix(c2, c1, t), 255))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w, h], radius=int(h * 0.22), fill=255)
    canvas.paste(panel_thumb, (x, y), mask)

    d.rounded_rectangle([x, y, x + w, y + h], radius=int(h * 0.22), outline=(*accent, 220), width=3)
    pad = int(h * 0.12)
    left_w = int(w * 0.46)

    lf = fit_font(d, bundle["label"], F_IMPACT, left_w - pad, int(h * 0.34), 16)
    lb = d.textbbox((0, 0), bundle["label"], font=lf)
    tag = bundle.get("tag") or ""
    tf = fit_font(d, tag, F_BOLD, left_w - pad, int(h * 0.17), 12) if tag else None
    block = (lb[3] - lb[1]) + (int(tf.size * 1.8) if tf else 0)
    ty = y + (h - block) // 2
    d.text((x + pad - lb[0], ty - lb[1]), bundle["label"], font=lf, fill=WHITE)
    if tf:
        d.text((x + pad, ty + (lb[3] - lb[1]) + int(tf.size * 0.6)), tag, font=tf, fill=(*accent, 255))

    rx, rw = x + left_w, w - left_w - pad
    price = bundle["price_text"]
    pf = fit_font(d, price, F_IMPACT, rw, int(h * 0.54), 18)
    pb = d.textbbox((0, 0), price, font=pf)
    old = bundle.get("old_text") or ""
    of = fit_font(d, old, F_REG, rw, int(h * 0.2), 12) if old else None
    old_h = int(of.size * 1.3) if of else 0
    total = old_h + (pb[3] - pb[1])
    ry = y + (h - total) // 2
    if of:
        ob = d.textbbox((0, 0), old, font=of)
        ow = ob[2] - ob[0]
        ox = rx + (rw - ow) / 2
        d.text((ox, ry), old, font=of, fill=SLATE_MUTED)
        sy = ry + (ob[1] + ob[3]) / 2
        d.line([(ox - 2, sy), (ox + ow + 2, sy)], fill=(239, 68, 68), width=max(2, of.size // 9))
    d.text((rx + (rw - (pb[2] - pb[0])) / 2 - pb[0], ry + old_h - pb[1]), price, font=pf, fill=(*accent, 255))


def luminance(color):
    values = [v / 255 for v in color[:3]]
    values = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values]
    return .2126 * values[0] + .7152 * values[1] + .0722 * values[2]


def contrast(a, b):
    high, low = sorted((luminance(a), luminance(b)), reverse=True)
    return (high + .05) / (low + .05)


def ink_on(color):
    return (15, 23, 42) if luminance(color) > .179 else WHITE


def main():
    global F_REG, F_BOLD, F_IMPACT, F_BLACK
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    out = sys.argv[2]
    recorder = LayerRecorder(sys.argv[3]) if len(sys.argv) > 3 else None
    rng = random.Random(spec.get("seed", 1))

    fmt = spec["format"]
    if fmt == 'custom':
        W, H = spec.get('width'), spec.get('height')
        if isinstance(W, bool) or isinstance(H, bool) or not isinstance(W, int) or not isinstance(H, int) or not 512 <= W <= 4096 or not 512 <= H <= 4096 or not 1 / 3 <= W / H <= 3:
            raise ValueError('Ukuran khusus harus 512–4096 px, rasio 1:3 sampai 3:1.')
    else:
        W, H = FORMATS.get(fmt, (1080, 1350))

    style = spec.get("style", "retail")
    if style not in STYLES:
        style = "retail"
    theme = spec.get("theme", "merah")
    if theme not in THEMES:
        theme = rng.choice(list(THEMES))
    c1, c2, accent = THEMES[theme]

    brand = spec.get('brand')
    logo = None
    if brand:
        def rgb(value):
            return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))
        c1, c2, accent = (rgb(brand[key]) for key in ('primary_color', 'secondary_color', 'accent_color'))
        families = {
            'Arial': ('arial.ttf', 'arialbd.ttf'), 'Impact': ('impact.ttf', 'impact.ttf'),
            'Georgia': ('georgia.ttf', 'georgiab.ttf'), 'Verdana': ('verdana.ttf', 'verdanab.ttf'),
            'Courier New': ('cour.ttf', 'courbd.ttf'), 'DejaVu Sans': ('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'),
        }
        if brand.get('font_family') in families:
            regular, bold = families[brand['font_family']]
            F_REG = ['C:/Windows/Fonts/' + regular, '/usr/share/fonts/truetype/dejavu/' + regular] + F_REG
            F_BOLD = ['C:/Windows/Fonts/' + bold, '/usr/share/fonts/truetype/dejavu/' + bold] + F_BOLD
            F_IMPACT = F_BOLD
            F_BLACK = F_BOLD
        if brand.get('logo_path'):
            try:
                logo = load_product(brand['logo_path'])
            except Exception:
                logo = None

    st = {
        "c1": c1, "c2": c2, "accent": accent,
        "style": style,
        "flip": spec.get("layout_variant", 0) == 1,
    }

    # 1. Build Canvas Background with Ambient Light & Glow
    canvas = build_modern_background(W, H, c1, c2, accent, style, rng)

    items = spec["items"]
    n = len(items)
    bundle = spec.get("bundle") if spec.get("mode") == "bundle" else None
    landscape = W > H
    margin = int(W * 0.05)
    gap = int(W * 0.025)

    title = (spec.get("title") or "PROMO SPESIAL").strip()
    subtitle = (spec.get("subtitle") or "").strip()
    footer_text = (spec.get("footer") or "").strip()
    badge = (spec.get("badge") or "").strip()

    footer_h = int(H * (0.12 if landscape else 0.065)) if (footer_text or logo is not None) else 0
    bottom_margin = footer_h + gap if footer_h else int(H * 0.03)

    panel_h = 0
    if bundle:
        panel_h = int(H * (0.28 if landscape else 0.16))

    d_dummy = ImageDraw.Draw(canvas)

    # 2. Calculate Header Bounds First to guarantee cards never collide with header
    header_bottom = int(H * 0.04)
    if title:
        tf = fit_font(d_dummy, title, F_IMPACT, W - 2 * margin - 120, int(H * (0.10 if landscape else 0.068)), 22)
        tb = d_dummy.textbbox((0, 0), title, font=tf)
        tw, th = tb[2] - tb[0], tb[3] - tb[1]

        t_pad_x = int(th * 1.2)
        t_pad_y = int(th * 0.38)
        box_w = tw + 2 * t_pad_x
        box_h = th + 2 * t_pad_y
        box_x = (W - box_w) / 2
        box_y = int(H * 0.032)

        header_bottom = box_y + box_h
        if subtitle:
            sub_y = box_y + box_h + 12
            sf = fit_font(d_dummy, subtitle, F_BOLD, W - 2 * margin - 100, int(tf.size * 0.35), 14)
            sb = d_dummy.textbbox((0, 0), subtitle, font=sf)
            sh_ = sb[3] - sb[1]
            header_bottom = sub_y + sh_ + 2 * int(sh_ * 0.45)

    # 3. Calculate Grid Placement Cleanly Below Header
    grid_top = header_bottom + int(H * 0.024)
    grid_h = H - bottom_margin - grid_top - (panel_h + gap if bundle else 0)

    rects = creative_plan(style, (margin, grid_top, W - 2 * margin, grid_h), n, landscape)
    if st["flip"]:
        rects = [(W - x - w, y, w, h) for x, y, w, h in rects]

    # 4. Draw Soft Drop Shadows for all cards & bundle panel
    shadow_rects = list(rects)
    if bundle:
        shadow_rects.append((margin, H - bottom_margin - panel_h, W - 2 * margin, panel_h))
    for (rx, ry, rw, rh) in shadow_rects:
        draw_drop_shadow(canvas, rx, ry, rw, rh, radius=int(min(rw, rh) * 0.055), blur=28, offset_y=14, alpha=45)

    if recorder:
        recorder.image(canvas, "Background", 0, 0)

    d = RecordedDraw(canvas, recorder) if recorder else ImageDraw.Draw(canvas, "RGBA")

    # 5. Render 3D Header Ribbon
    if title:
        draw_drop_shadow(canvas, int(box_x), int(box_y), int(box_w), int(box_h), radius=box_h // 2, blur=18, offset_y=6, alpha=65)

        header_thumb = Image.new("RGBA", (int(box_w), int(box_h)), (0, 0, 0, 0))
        ht_draw = ImageDraw.Draw(header_thumb)
        for hy in range(box_h):
            t = hy / max(1, box_h - 1)
            ht_draw.line([(0, hy), (box_w, hy)], fill=(*mix(c2, c1, t), 255))
        h_mask = Image.new("L", (int(box_w), int(box_h)), 0)
        ImageDraw.Draw(h_mask).rounded_rectangle([0, 0, box_w, box_h], radius=box_h // 2, fill=255)
        canvas.paste(header_thumb, (int(box_x), int(box_y)), h_mask)

        d.rounded_rectangle([box_x, box_y, box_x + box_w, box_y + box_h], radius=box_h // 2, outline=(*accent, 220), width=3)
        tx = box_x + t_pad_x - tb[0]
        ty = box_y + t_pad_y - tb[1]
        d.text((tx + 2, ty + 2), title, font=tf, fill=(0, 0, 0, 90))
        d.text((tx, ty), title, font=tf, fill=WHITE)

        if subtitle:
            sub_y = box_y + box_h + 12
            sf = fit_font(d, subtitle, F_BOLD, W - 2 * margin - 100, int(tf.size * 0.35), 14)
            sb = d.textbbox((0, 0), subtitle, font=sf)
            sw, sh_ = sb[2] - sb[0], sb[3] - sb[1]
            spx, spy = int(sh_ * 0.9), int(sh_ * 0.45)
            sx = (W - sw - 2 * spx) / 2
            d.rounded_rectangle([sx, sub_y, sx + sw + 2 * spx, sub_y + sh_ + 2 * spy],
                                radius=(sh_ + 2 * spy) // 2, fill=(255, 255, 255, 235), outline=(*accent, 180), width=1)
            d.text((sx + spx - sb[0], sub_y + spy - sb[1]), subtitle, font=sf, fill=NAME_COLOR)

    # 6. Render Item Cards
    for (rx, ry, rw, rh), item in zip(rects, items):
        draw_card(canvas, d, rx, ry, rw, rh, item, st, badge, show_price=not bundle)

    # 7. Render Bundle Panel (if bundle promo)
    if bundle:
        draw_bundle_panel(canvas, d, margin, H - bottom_margin - panel_h, W - 2 * margin, panel_h, bundle, st)

    # 8. Render Modern Footer Banner
    if footer_h:
        d.rectangle([0, H - footer_h, W, H], fill=(*c2, 245))
        d.line([(0, H - footer_h), (W, H - footer_h)], fill=(*accent, 180), width=2)
        if recorder:
            recorder.layers[-1]["brandRole"] = "footer"
        text_x = margin
        if logo is not None:
            box_w, box_h = int(footer_h * 1.5), int(footer_h * .72)
            lx, ly = margin, H - footer_h + (footer_h - box_h) // 2
            d.rounded_rectangle([lx - 4, ly - 4, lx + box_w + 4, ly + box_h + 4], radius=8, fill=WHITE)
            if recorder:
                recorder.layers[-1]["brandRole"] = "logo"
            stamp = ImageOps.contain(logo, (box_w, box_h), Image.Resampling.LANCZOS)
            ix, iy = lx + (box_w - stamp.width) // 2, ly + (box_h - stamp.height) // 2
            canvas.alpha_composite(stamp, (ix, iy))
            if recorder:
                recorder.image(logo, 'Logo brand', ix, iy, stamp.width, stamp.height)
                recorder.layers[-1]["brandRole"] = "logo"
            text_x = lx + box_w + gap
        if footer_text:
            text_width = W - margin - text_x
            ff = fit_font(d, footer_text, F_BOLD, text_width, int(footer_h * 0.44), 14)
            fb = d.textbbox((0, 0), footer_text, font=ff)
            footer_ink = ink_on(c2) if brand else WHITE
            d.text((text_x + (text_width - (fb[2] - fb[0])) / 2 - fb[0], H - footer_h + (footer_h - (fb[3] - fb[1])) / 2 - fb[1]), footer_text, font=ff, fill=footer_ink)
            if recorder:
                recorder.layers[-1]["brandRole"] = "footer"

    # Save output
    canvas.convert("RGB").save(out, "JPEG", quality=95, optimize=True)
    if spec.get('png_output'):
        canvas.convert('RGB').save(spec['png_output'], 'PNG', optimize=True)
    if recorder:
        from pathlib import Path
        Path(recorder.folder / 'document.json').write_text(json.dumps(dict(version=1, title=title or 'Promo', format=fmt,
            width=W, height=H, layers=recorder.layers, assets=recorder.assets)), encoding='utf-8')
    print(json.dumps({"width": W, "height": H}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)