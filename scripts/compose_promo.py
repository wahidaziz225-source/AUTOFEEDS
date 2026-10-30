import json
import math
import re
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

Image.MAX_IMAGE_PIXELS = 100_000_000

# tema: (warna utama, warna gelap, warna aksen)
THEMES = {
    "merah": ((220, 38, 38), (153, 27, 27), (255, 214, 10)),
    "biru": ((37, 99, 235), (30, 58, 138), (250, 204, 21)),
    "ungu": ((124, 58, 237), (67, 56, 202), (253, 224, 71)),
    "oranye": ((249, 115, 22), (194, 65, 12), (255, 255, 255)),
    "hijau": ((22, 163, 74), (21, 94, 52), (253, 224, 71)),
}
FORMATS = {
    "feed": (1080, 1350),
    "square": (1080, 1080),
    "story": (1080, 1920),
    "landscape": (1200, 630),
}
PLANS = {
    "feed": {1: [1], 2: [2], 3: [2, 1], 4: [2, 2], 5: [3, 2], 6: [3, 3]},
    "square": {1: [1], 2: [2], 3: [2, 1], 4: [2, 2], 5: [3, 2], 6: [3, 3]},
    "story": {1: [1], 2: [1, 1], 3: [1, 1, 1], 4: [2, 2], 5: [2, 2, 1], 6: [2, 2, 2]},
}
FONT_IMPACT = ["C:/Windows/Fonts/impact.ttf", "C:/Windows/Fonts/arialbd.ttf", "arialbd.ttf"]
FONT_BOLD = ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf", "arialbd.ttf"]
FONT_REG = ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf", "arial.ttf"]

NAME_COLOR = (30, 41, 59)
GREY = (100, 116, 139)
DISC_FILL = (250, 204, 21)
DISC_TEXT = (127, 29, 29)


def load_font(paths, size):
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
    size = start
    while size > min_size:
        f = load_font(paths, size)
        if d.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return load_font(paths, min_size)


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


def parse_amount(s):
    digits = re.sub(r"\D", "", s or "")
    return int(digits) if digits else None


def format_price(s):
    s = (s or "").strip()
    if re.fullmatch(r"[\d.,]+", s):
        digits = re.sub(r"\D", "", s)
        if digits:
            return "Rp" + f"{int(digits):,}".replace(",", ".")
    return s


def gradient(size, c1, c2):
    w, h = size
    img = Image.new("RGB", size, c1)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)))
    return img


def decorate(base, W, H):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(layer)
    cx, cy = W / 2, H * 0.12
    n, R = 28, max(W, H) * 1.6
    for i in range(0, n, 2):
        a0 = 2 * math.pi * i / n
        a1 = 2 * math.pi * (i + 1) / n
        dl.polygon(
            [(cx, cy),
             (cx + R * math.cos(a0), cy + R * math.sin(a0)),
             (cx + R * math.cos(a1), cy + R * math.sin(a1))],
            fill=(255, 255, 255, 22),
        )
    for fx, fy, fr, a in [(0.04, 0.06, 0.18, 38), (0.98, 0.32, 0.14, 30),
                          (0.02, 0.72, 0.16, 30), (0.96, 0.96, 0.22, 38)]:
        r = int(W * fr)
        cxx, cyy = int(W * fx), int(H * fy)
        dl.ellipse([cxx - r, cyy - r, cxx + r, cyy + r], fill=(255, 255, 255, a))
    return Image.alpha_composite(base, layer)


def load_product(path):
    with Image.open(path) as im:
        im.load()
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            return bg
        return im.convert("RGB")


def centered_x(d, text, font, x, w, centered):
    tw = d.textlength(text, font=font)
    return x + (w - tw) / 2 if centered else x


def draw_text_block(d, x, y, w, h, item, c1, accent, centered, stack):
    nf_size = max(16, min(40, int(h * 0.14)))
    nf = load_font(FONT_BOLD, nf_size)
    lines = wrap(d, item["name"], nf, w, 2)
    line_h = int(nf_size * 1.2)

    old = format_price(item.get("old_price") or "")
    of, old_h = None, 0
    if old:
        of = fit_font(d, old, FONT_REG, w, max(14, int(h * 0.11)), 12)
        old_h = int(of.size * 1.3)

    price = format_price(item["price"])
    pf = fit_font(d, price, FONT_IMPACT, int(w * 0.84), max(24, int(h * 0.24)), 16)
    tb = d.textbbox((0, 0), price, font=pf)
    px, py = int(pf.size * 0.35), int(pf.size * 0.22)
    pill_w = (tb[2] - tb[0]) + 2 * px
    pill_h = (tb[3] - tb[1]) + 2 * py

    gap1, gap2 = int(h * 0.02), int(h * 0.03)
    total = len(lines) * line_h + gap1 + old_h + gap2 + pill_h
    ly = y if stack else y + max(0, (h - total) // 2)

    for ln in lines:
        d.text((centered_x(d, ln, nf, x, w, centered), ly), ln, font=nf, fill=NAME_COLOR)
        ly += line_h
    ly += gap1

    if old and of:
        ob = d.textbbox((0, 0), old, font=of)
        ox = centered_x(d, old, of, x, w, centered)
        d.text((ox, ly), old, font=of, fill=GREY)
        sy = ly + (ob[1] + ob[3]) / 2
        d.line([(ox, sy), (ox + (ob[2] - ob[0]), sy)], fill=GREY, width=max(2, of.size // 12))
        ly += old_h
    ly += gap2

    pill_y = (y + h - pill_h) if stack else ly
    pill_x = x + (w - pill_w) / 2 if centered else x
    d.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
                        radius=pill_h // 2, fill=c1)
    d.text((pill_x + px - tb[0], pill_y + py - tb[1]), price, font=pf, fill=accent)


def draw_card(canvas, d, x, y, w, h, item, c1, c2, accent, badge):
    radius = int(min(w, h) * 0.06)
    d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=(255, 255, 255, 255))
    pad = int(min(w, h) * 0.05)
    horizontal = w > h * 1.3

    if horizontal:
        side = h - 2 * pad
        box = (x + pad, y + pad, side, side)
        tx, ty = x + h, y + pad
        tw, th = w - h - pad, h - 2 * pad
        centered, stack = False, False
    else:
        img_h = int((h - 2 * pad) * 0.56)
        box = (x + pad, y + pad, w - 2 * pad, img_h)
        tx, ty = x + pad, y + pad + img_h + pad // 2
        tw, th = w - 2 * pad, h - (2 * pad + img_h) - pad // 2
        centered, stack = True, True

    try:
        im = ImageOps.contain(load_product(item["path"]), (box[2], box[3]), Image.Resampling.LANCZOS)
        canvas.paste(im, (box[0] + (box[2] - im.width) // 2, box[1] + (box[3] - im.height) // 2))
    except Exception:
        pass

    draw_text_block(d, tx, ty, tw, th, item, c1, accent, centered, stack)

    if badge:
        bf = load_font(FONT_BOLD, max(16, int(min(w, h) * 0.065)))
        bb = d.textbbox((0, 0), badge, font=bf)
        bw, bh = bb[2] - bb[0], bb[3] - bb[1]
        px, py = int(bh * 0.7), int(bh * 0.5)
        bx, by = x + pad, y + pad
        d.rounded_rectangle([bx, by, bx + bw + 2 * px, by + bh + 2 * py],
                            radius=(bh + 2 * py) // 2, fill=c1)
        d.text((bx + px - bb[0], by + py - bb[1]), badge, font=bf, fill=(255, 255, 255))

    # badge diskon: dihitung dari harga yang Anda isi, bukan karangan
    new_v, old_v = parse_amount(item["price"]), parse_amount(item.get("old_price") or "")
    if new_v and old_v and old_v > new_v:
        pct = round((old_v - new_v) / old_v * 100)
        if pct >= 1:
            r = int(min(w, h) * 0.12)
            cx, cy = x + w - r - pad // 2, y + r + pad // 2
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=DISC_FILL, outline=(255, 255, 255), width=max(3, r // 10))
            txt = f"-{pct}%"
            df = fit_font(d, txt, FONT_IMPACT, int(r * 1.5), int(r * 0.9), 12)
            db = d.textbbox((0, 0), txt, font=df)
            d.text((cx - (db[2] - db[0]) / 2 - db[0], cy - (db[3] - db[1]) / 2 - db[1]),
                   txt, font=df, fill=DISC_TEXT)


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    out = sys.argv[2]
    fmt = spec["format"]
    W, H = FORMATS[fmt]
    c1, c2, accent = THEMES[spec["theme"]]
    canvas = decorate(gradient((W, H), c1, c2).convert("RGBA"), W, H)

    items = spec["items"]
    n = len(items)
    landscape = W > H
    margin = int(W * 0.05)
    gap = int(W * 0.025)

    title = (spec.get("title") or "").strip()
    subtitle = (spec.get("subtitle") or "").strip()
    footer_text = (spec.get("footer") or "").strip()

    header_h = int(H * (0.24 if landscape else (0.18 if subtitle else 0.14)))
    footer_h = int(H * (0.14 if landscape else 0.075)) if footer_text else 0
    bottom_margin = footer_h + gap if footer_text else int(H * 0.03)

    plan = [n] if landscape else PLANS[fmt][n]
    rows, maxcols = len(plan), max(plan)
    grid_top = header_h
    grid_h = H - bottom_margin - grid_top
    cw = (W - 2 * margin - (maxcols - 1) * gap) // maxcols
    ch = (grid_h - (rows - 1) * gap) // rows

    rects = []
    for r, cols in enumerate(plan):
        row_w = cols * cw + (cols - 1) * gap
        x0 = margin + ((W - 2 * margin) - row_w) // 2
        y0 = grid_top + r * (ch + gap)
        for c in range(cols):
            rects.append((x0 + c * (cw + gap), y0, cw, ch))

    # bayangan lembut di bawah kartu
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for (x, y, w, h) in rects:
        sd.rounded_rectangle([x, y + 10, x + w, y + h + 10], radius=int(min(w, h) * 0.06), fill=(0, 0, 0, 120))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    canvas = Image.alpha_composite(canvas, sh)
    d = ImageDraw.Draw(canvas, "RGBA")

    if title:
        tf = fit_font(d, title, FONT_IMPACT, W - 2 * margin, int(H * (0.14 if landscape else 0.085)), 24)
        tb = d.textbbox((0, 0), title, font=tf)
        tx = (W - (tb[2] - tb[0])) / 2 - tb[0]
        ty = int(header_h * 0.10) - tb[1]
        d.text((tx + 4, ty + 5), title, font=tf, fill=(0, 0, 0, 90))
        d.text((tx, ty), title, font=tf, fill=(255, 255, 255))
        if subtitle:
            sf = fit_font(d, subtitle, FONT_BOLD, W - 2 * margin - 80, max(16, int(tf.size * 0.38)), 14)
            sb = d.textbbox((0, 0), subtitle, font=sf)
            sw, sh_ = sb[2] - sb[0], sb[3] - sb[1]
            spx, spy = int(sh_ * 0.9), int(sh_ * 0.5)
            sx = (W - sw - 2 * spx) / 2
            sy = int(header_h * 0.10) + (tb[3] - tb[1]) + int(tf.size * 0.25)
            d.rounded_rectangle([sx, sy, sx + sw + 2 * spx, sy + sh_ + 2 * spy],
                                radius=(sh_ + 2 * spy) // 2, fill=(255, 255, 255, 240))
            d.text((sx + spx - sb[0], sy + spy - sb[1]), subtitle, font=sf, fill=c1)

    if footer_text:
        d.rectangle([0, H - footer_h, W, H], fill=c2)
        ff = fit_font(d, footer_text, FONT_BOLD, W - 2 * margin, int(footer_h * 0.5), 14)
        fb = d.textbbox((0, 0), footer_text, font=ff)
        d.text(((W - (fb[2] - fb[0])) / 2 - fb[0], H - footer_h + (footer_h - (fb[3] - fb[1])) / 2 - fb[1]),
               footer_text, font=ff, fill=(255, 255, 255))

    badge = (spec.get("badge") or "").strip()
    for (x, y, w, h), item in zip(rects, items):
        draw_card(canvas, d, x, y, w, h, item, c1, c2, accent, badge)

    canvas.convert("RGB").save(out, "JPEG", quality=93, optimize=True)
    print(json.dumps({"width": W, "height": H}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)