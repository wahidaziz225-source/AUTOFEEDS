import json
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
from creative_layout import plan as creative_plan, STYLES
from layer_recorder import LayerRecorder, RecordedDraw

Image.MAX_IMAGE_PIXELS = 100_000_000

# tema: (warna utama, warna gelap, warna aksen)
THEMES = {
    "merah": ((220, 38, 38), (153, 27, 27), (255, 214, 10)),
    "biru": ((37, 99, 235), (30, 58, 138), (250, 204, 21)),
    "ungu": ((124, 58, 237), (67, 56, 202), (253, 224, 71)),
    "oranye": ((249, 115, 22), (194, 65, 12), (255, 255, 255)),
    "hijau": ((22, 163, 74), (21, 94, 52), (253, 224, 71)),
    "pink": ((219, 39, 119), (131, 24, 67), (254, 240, 138)),
    "tosca": ((13, 148, 136), (19, 78, 74), (253, 224, 71)),
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
F_IMPACT = ["C:/Windows/Fonts/impact.ttf", "C:/Windows/Fonts/arialbd.ttf", "arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
F_BLACK = ["C:/Windows/Fonts/ariblk.ttf", "C:/Windows/Fonts/arialbd.ttf", "arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
F_BOLD = ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf", "arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
F_REG = ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf", "arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
TITLE_FONTS = [F_IMPACT, F_BLACK, F_BOLD]

NAME_COLOR = (30, 41, 59)
GREY = (100, 116, 139)
WHITE = (255, 255, 255)


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
    size = int(start)
    while size > min_size:
        f = load_font(paths, size)
        if d.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    f=load_font(paths,min_size)
    while size>2 and d.textlength(text,font=f)>max_w:
        size-=1;f=load_font(paths,size)
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
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def gradient(size, c1, c2, mode):
    w, h = size
    img = Image.new("RGB", size, c1)
    d = ImageDraw.Draw(img)
    if mode == "h":
        for x in range(w):
            d.line([(x, 0), (x, h)], fill=mix(c1, c2, x / max(1, w - 1)))
    else:
        for y in range(h):
            d.line([(0, y), (w, y)], fill=mix(c1, c2, y / max(1, h - 1)))
    return img


def decorate(base, W, H, kind, rng):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(layer)
    if kind == "rays":
        cx, cy = W / 2, H * 0.12
        n, R = 28, max(W, H) * 1.6
        for i in range(0, n, 2):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            dl.polygon([(cx, cy),
                        (cx + R * math.cos(a0), cy + R * math.sin(a0)),
                        (cx + R * math.cos(a1), cy + R * math.sin(a1))],
                       fill=(255, 255, 255, 22))
    elif kind == "dots":
        step = int(W * 0.07)
        r = int(step * 0.16)
        for gy in range(0, H + step, step):
            off = step // 2 if (gy // step) % 2 else 0
            for gx in range(0, W + step, step):
                dl.ellipse([gx + off - r, gy - r, gx + off + r, gy + r], fill=(255, 255, 255, 34))
    elif kind == "stripes":
        band = int(W * 0.10)
        shift = int(H * 0.6)
        for x0 in range(0, W + shift, band * 2):
            dl.polygon([(x0, 0), (x0 + band, 0), (x0 + band - shift, H), (x0 - shift, H)],
                       fill=(255, 255, 255, 20))
    else:
        for _ in range(6):
            r = int(W * rng.uniform(0.08, 0.24))
            cx, cy = int(W * rng.uniform(0, 1)), int(H * rng.uniform(0, 1))
            dl.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, rng.randint(24, 44)))
    return Image.alpha_composite(base, layer)


def load_product(path):
    with Image.open(path) as im:
        im.load()
        im = ImageOps.exif_transpose(im)
        return im.convert("RGBA")


def cx_of(d, text, font, x, w, centered):
    return x + (w - d.textlength(text, font=font)) / 2 if centered else x


def strike_text(d, x, y, text, font, color):
    b = d.textbbox((0, 0), text, font=font)
    d.text((x, y), text, font=font, fill=color)
    sy = y + (b[1] + b[3]) / 2
    d.line([(x, sy), (x + (b[2] - b[0]), sy)], fill=color, width=max(2, font.size // 12))


def draw_tag(d, x, y, w, h, text, st, pad):
    if not text:
        return
    c2, accent = st.get("tag_ink", st["c2"]), st["accent"]
    if len(text) <= 6:
        r = int(min(w, h) * 0.12)
        cx, cy = x + w - r - pad // 2, y + r + pad // 2
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=accent, outline=WHITE, width=max(3, r // 10))
        f = fit_font(d, text, F_IMPACT, int(r * 1.5), int(r * 0.9), 12)
        b = d.textbbox((0, 0), text, font=f)
        d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - (b[3] - b[1]) / 2 - b[1]), text, font=f, fill=c2)
        return
    f = load_font(F_IMPACT, max(14, int(min(w, h) * 0.075)))
    lines = wrap(d, text, f, int(w * 0.46), 2)
    lw = max(d.textlength(ln, font=f) for ln in lines)
    lh = int(f.size * 1.15)
    bw, bh = int(lw + f.size * 1.2), int(len(lines) * lh + f.size * 0.7)
    bx, by = x + w - bw - pad // 2, y + pad // 2
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=int(bh * 0.25),
                        fill=accent, outline=WHITE, width=3)
    for i, ln in enumerate(lines):
        d.text((bx + (bw - d.textlength(ln, font=f)) / 2, by + int(f.size * 0.3) + i * lh),
               ln, font=f, fill=c2)


def draw_text_block(d, x, y, w, h, item, st, centered, stack):
    # Allocate the available box before choosing fonts; preserve the complete price.
    price,old=item.get('price_text') or '',item.get('old_text') or ''
    gap=max(1,h*.025)
    name_budget=h*(.42 if old and price else .52 if price else .94)
    old_budget=h*.16 if old and price else 0
    price_budget=max(1,h-name_budget-old_budget-3*gap) if price else 0
    max_lines=3 if st.get('hero') else 2
    nf_size=max(2,min(40,int(name_budget/max_lines/1.2)))
    nf=load_font(F_BOLD,nf_size)
    lines=wrap(d,item['name'],nf,max(1,w),max_lines)
    while nf_size>2 and (' '.join(lines)!=' '.join(item['name'].split()) or len(lines)*nf_size*1.2>name_budget):
        nf_size-=1;nf=load_font(F_BOLD,nf_size);lines=wrap(d,item['name'],nf,max(1,w),max_lines)
    line_h=nf_size*1.2
    of=fit_font(d,old,F_REG,w,max(2,int(old_budget*.75)),2) if old_budget else None
    old_h=of.size*1.3 if of else 0
    pf=fit_font(d,price,F_IMPACT,max(1,w*.84),max(2,int(price_budget*.78)),2) if price else None
    tb=(0,0,0,0);px=py=pill_w=pill_h=0
    if pf:
        while True:
            tb=d.textbbox((0,0),price,font=pf)
            px,py=max(1,int(pf.size*.35)),max(1,int(pf.size*.22))
            pill_w,pill_h=tb[2]-tb[0]+2*px,tb[3]-tb[1]+2*py
            if (pill_h<=price_budget and pill_w<=w) or pf.size<=2:break
            pf=load_font(F_IMPACT,pf.size-1)
    total=len(lines)*line_h+(gap+old_h+gap+pill_h if price else 0)
    ly=y if stack else y+max(0,(h-total)/2)
    for ln in lines:
        d.text((cx_of(d,ln,nf,x,w,centered),ly),ln,font=nf,fill=NAME_COLOR);ly+=line_h
    if not price:return
    ly+=gap
    if of:
        strike_text(d,cx_of(d,old,of,x,w,centered),ly,old,of,GREY);ly+=old_h
    ly+=gap
    pill_y=y+h-pill_h if stack else ly
    pill_x=x+(w-pill_w)/2 if centered else x
    style=st['pill'];radius=pill_h/2 if style=='pill' else pill_h*(.18 if style=='rect' else .32)
    outline=st['accent'] if style=='tag' else None
    d.rounded_rectangle([pill_x,pill_y,pill_x+pill_w,pill_y+pill_h],radius=radius,fill=st['c1'],outline=outline,width=min(4,max(1,int(pill_h/8))) if outline else 0)
    d.text((pill_x+px-tb[0],pill_y+py-tb[1]),price,font=pf,fill=st.get('price_ink',st['accent']))


def draw_card(canvas, d, x, y, w, h, item, st, badge, show_price):
    radius = int(min(w, h) * st["radius"])
    d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=(255, 255, 255, 255))
    if st["card"] == "outline":
        d.rounded_rectangle([x, y, x + w, y + h], radius=radius, outline=st["accent"], width=6)
    pad = int(min(w, h) * 0.05)
    horizontal = (w > h * 1.3 or (st.get("style") == "premium" and w > h)) and show_price

    hero = st.get("hero", False)
    concept = st.get("style")
    if hero and concept in ("premium", "editorial"):
        # Split spread, with a large photograph and an independent price column.
        iw = int(w * (.53 if concept == "premium" else .60))
        box = (x + pad, y + pad, iw - pad, h - 2 * pad)
        tx, ty, tw, th = x + iw + pad, y + int(h * .28), w - iw - 2 * pad, int(h * .55)
        if concept == "editorial":
            box = (x + w - iw, y + pad, iw - pad, h - 2 * pad)
            tx, tw = x + pad, w - iw - 2 * pad
        centered, stack = False, False
    elif hero and concept == "spotlight":
        box = (x + pad, y + pad, w - 2 * pad, int(h * .65))
        tx, ty, tw, th = x + pad, y + int(h * .72), w - 2 * pad, int(h * .25)
        centered, stack = True, True
    elif hero and concept == "flash":
        box = (x + int(w * .27), y + pad, int(w * .68), int(h * .60))
        tx, ty, tw, th = x + pad, y + int(h * .69), w - 2 * pad, int(h * .28)
        centered, stack = False, True
    elif horizontal:
        side = h - 2 * pad
        box = (x + pad, y + pad, side, side)
        tx, ty, tw, th = x + h, y + pad, w - h - pad, h - 2 * pad
        centered, stack = False, False
    else:
        ratio = 0.56 if show_price else 0.74
        img_h = int((h - 2 * pad) * ratio)
        box = (x + pad, y + pad, w - 2 * pad, img_h)
        tx, ty = x + pad, y + pad + img_h + pad // 2
        tw, th = w - 2 * pad, h - (2 * pad + img_h) - pad // 2
        centered, stack = True, True

    if st.get("flip") and st.get("hero"):
        box = (x + w - (box[0] - x) - box[2], box[1], box[2], box[3])
        tx = x + w - (tx - x) - tw

    try:
        im = ImageOps.contain(load_product(item["path"]), (box[2], box[3]), Image.Resampling.LANCZOS)
        ix, iy = box[0] + (box[2] - im.width) // 2, box[1] + (box[3] - im.height) // 2
        canvas.alpha_composite(im, (ix, iy))
        if isinstance(d, RecordedDraw):
            d.recorder.image(load_product(item["path"]), "Foto produk: " + item["name"], ix, iy, im.width, im.height)
    except Exception as exc:
        raise ValueError("Foto produk gagal dibaca") from exc

    tag = item.get('tag') or ''
    if tag and len(tag)<=6:
        tag_radius=int(min(w,h)*.12)
        tag_left=x+w-2*tag_radius-pad//2
        tag_bottom=y+2*tag_radius+pad//2
        if tx+tw>tag_left and ty<tag_bottom:
            reserve=max(0,tag_bottom+max(4,int(pad*.2))-ty)
            if th-reserve>8:ty+=reserve;th-=reserve
    draw_text_block(d, tx, ty, tw, th, item, st, centered, stack)

    tag = item.get("tag") or ""
    draw_tag(d, x, y, w, h, tag, st, pad)

    if badge and (len(tag) <= 6 or w >= 380):
        bf = load_font(F_BOLD, max(16, int(min(w, h) * 0.065)))
        bb = d.textbbox((0, 0), badge, font=bf)
        bw, bh = bb[2] - bb[0], bb[3] - bb[1]
        px, py = int(bh * 0.7), int(bh * 0.5)
        bx, by = x + pad, y + pad
        d.rounded_rectangle([bx, by, bx + bw + 2 * px, by + bh + 2 * py],
                            radius=(bh + 2 * py) // 2, fill=st["c1"])
        d.text((bx + px - bb[0], by + py - bb[1]), badge, font=bf, fill=st.get("primary_ink", WHITE))


def draw_bundle_panel(d, x, y, w, h, bundle, st):
    c2, accent = st.get("tag_ink", st["c2"]), st["accent"]
    d.rounded_rectangle([x, y, x + w, y + h], radius=int(h * 0.18), fill=accent, outline=WHITE, width=5)
    pad = int(h * 0.12)
    left_w = int(w * 0.44)

    lf = fit_font(d, bundle["label"], F_IMPACT, left_w - pad, int(h * 0.34), 16)
    lb = d.textbbox((0, 0), bundle["label"], font=lf)
    tag = bundle.get("tag") or ""
    tf = fit_font(d, tag, F_BOLD, left_w - pad, int(h * 0.17), 12) if tag else None
    block = (lb[3] - lb[1]) + (int(tf.size * 1.8) if tf else 0)
    ty = y + (h - block) // 2
    d.text((x + pad - lb[0], ty - lb[1]), bundle["label"], font=lf, fill=c2)
    if tf:
        d.text((x + pad, ty + (lb[3] - lb[1]) + int(tf.size * 0.6)), tag, font=tf, fill=c2)

    rx, rw = x + left_w, w - left_w - pad
    price = bundle["price_text"]
    pf = fit_font(d, price, F_IMPACT, rw, int(h * 0.56), 18)
    pb = d.textbbox((0, 0), price, font=pf)
    old = bundle.get("old_text") or ""
    of = fit_font(d, old, F_REG, rw, int(h * 0.2), 12) if old else None
    old_h = int(of.size * 1.3) if of else 0
    total = old_h + (pb[3] - pb[1])
    ry = y + (h - total) // 2
    if of:
        strike_text(d, rx + (rw - d.textlength(old, font=of)) / 2, ry, old, of, c2)
    d.text((rx + (rw - (pb[2] - pb[0])) / 2 - pb[0], ry + old_h - pb[1]), price, font=pf, fill=c2)


def luminance(color):
    values=[v/255 for v in color[:3]]
    values=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values]
    return .2126*values[0]+.7152*values[1]+.0722*values[2]


def contrast(a,b):
    high,low=sorted((luminance(a),luminance(b)),reverse=True)
    return (high+.05)/(low+.05)


def ink_on(color):
    return (15,23,42) if luminance(color)>.179 else WHITE


def main():
    global F_REG, F_BOLD, F_IMPACT, F_BLACK
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    out = sys.argv[2]
    recorder = LayerRecorder(sys.argv[3]) if len(sys.argv) > 3 else None
    rng = random.Random(spec.get("seed", 1))

    fmt = spec["format"]
    if fmt=='custom':
        W,H=spec.get('width'),spec.get('height')
        if isinstance(W,bool) or isinstance(H,bool) or not isinstance(W,int) or not isinstance(H,int) or not 512<=W<=4096 or not 512<=H<=4096 or not 1/3<=W/H<=3:
            raise ValueError('Ukuran khusus harus 512–4096 px, rasio 1:3 sampai 3:1.')
    else:
        W,H=FORMATS[fmt]
    style = spec.get("style", "retail")
    if style not in STYLES:
        raise ValueError("Konsep tidak valid")
    theme = spec["theme"]
    if theme not in THEMES:
        theme = rng.choice(list(THEMES))
    c1, c2, accent = THEMES[theme]
    brand = spec.get('brand')
    logo = None
    if brand:
        def rgb(value):
            return tuple(int(value[i:i+2],16) for i in (1,3,5))
        c1,c2,accent = (rgb(brand[key]) for key in ('primary_color','secondary_color','accent_color'))
        families = {
            'Arial': ('arial.ttf','arialbd.ttf'), 'Impact': ('impact.ttf','impact.ttf'),
            'Georgia': ('georgia.ttf','georgiab.ttf'), 'Verdana': ('verdana.ttf','verdanab.ttf'),
            'Courier New': ('cour.ttf','courbd.ttf'), 'DejaVu Sans': ('DejaVuSans.ttf','DejaVuSans-Bold.ttf'),
        }
        regular,bold = families[brand['font_family']]
        F_REG = ['C:/Windows/Fonts/'+regular, '/usr/share/fonts/truetype/dejavu/'+regular] + F_REG
        F_BOLD = ['C:/Windows/Fonts/'+bold, '/usr/share/fonts/truetype/dejavu/'+bold] + F_BOLD
        F_IMPACT = F_BOLD
        F_BLACK = F_BOLD
        if brand.get('logo_path'):
            logo = load_product(brand['logo_path'])

    card_style = rng.choice(["round", "sharp", "soft", "outline"])
    st = {
        "c1": c1, "c2": c2, "accent": accent,
        "deco": rng.choice(["rays", "dots", "stripes", "circles"]),
        "card": card_style,
        "radius": {"round": 0.06, "sharp": 0.012, "soft": 0.12, "outline": 0.05}[card_style],
        "pill": rng.choice(["pill", "rect", "tag"]),
        "head": rng.choice(["plain", "ribbon", "underline"]),
        "grad": rng.choice(["v", "h"]),
        "tfont": rng.choice(TITLE_FONTS),
    }

    st["style"] = style
    st["flip"] = spec.get("layout_variant", 0) == 1
    # Art direction is selected by concept, not randomized decoration.
    directions = {
        "premium": ((247, 245, 240), (235, 232, 225), "plain", "rect", .015),
        "flash": (c1, c2, "ribbon", "tag", .025),
        "frozen": ((225, 246, 252), (181, 222, 240), "plain", "pill", .09),
        "editorial": ((239, 235, 228), (215, 208, 197), "underline", "rect", .005),
        "retail": (c1, c2, "plain", "rect", .04),
        "spotlight": ((24, 32, 48), (44, 57, 75), "plain", "pill", .12),
    }
    bg1, bg2, st["head"], st["pill"], st["radius"] = directions[style]
    st["card"] = "round"
    st["tfont"] = F_REG if style == "premium" else F_BOLD if style in ("frozen", "editorial") else F_IMPACT
    if brand:
        st['price_ink']=accent if contrast(c1,accent)>=3 else ink_on(c1)
        st['primary_ink']=ink_on(c1)
        st['tag_ink']=ink_on(accent)
        st['white_ink']=c1 if contrast(c1,WHITE)>=3 else ink_on(WHITE)
    canvas = gradient((W, H), bg1, bg2, "v").convert("RGBA")
    if style == "flash":
        canvas = decorate(canvas, W, H, "rays", rng)
    elif style == "editorial":
        ImageDraw.Draw(canvas).polygon([(W * .65, 0), (W, 0), (W, H * .8), (W * .88, H)], fill=c1)
    elif style == "frozen":
        ImageDraw.Draw(canvas).ellipse([int(-W*.3), int(H*.35), int(W*1.3), int(H*1.3)], fill=(243, 252, 255))
    header_color = c2 if style in ("premium", "frozen", "editorial") else WHITE
    if brand:
        header_bg=c2 if st['head']=='ribbon' else bg1
        header_color=header_color if contrast(header_color,header_bg)>=3 else ink_on(header_bg)

    items = spec["items"]
    n = len(items)
    st["hero"] = n == 1
    bundle = spec.get("bundle") if spec.get("mode") == "bundle" else None
    landscape = W > H
    margin = int(W * 0.05)
    gap = int(W * 0.025)

    title = (spec.get("title") or "").strip()
    subtitle = (spec.get("subtitle") or "").strip()
    footer_text = (spec.get("footer") or "").strip()

    header_h = int(H * ((0.24 if landscape else 0.18) if subtitle else (0.2 if landscape else 0.14)))
    if st["head"] == "ribbon":
        header_h += int(H * 0.012)
    footer_h = int(H * (0.14 if landscape else 0.075)) if footer_text or logo is not None else 0
    bottom_margin = footer_h + gap if footer_h else int(H * 0.03)

    panel_h = 0
    if bundle:
        panel_h = int(H * (0.30 if landscape else 0.17))

    grid_top = header_h
    grid_h = H - bottom_margin - grid_top - (panel_h + gap if bundle else 0)
    rects = creative_plan(style, (margin, grid_top, W - 2 * margin, grid_h), n, landscape)
    if st["flip"]:
        rects = [(W - x - w, y, w, h) for x, y, w, h in rects]

    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    shadow_rects = list(rects)
    if bundle:
        shadow_rects.append((margin, H - bottom_margin - panel_h, W - 2 * margin, panel_h))
    for (x, y, w, h) in shadow_rects:
        sd.rounded_rectangle([x, y + 10, x + w, y + h + 10],
                             radius=int(min(w, h) * max(st["radius"], 0.02)), fill=(0, 0, 0, 120))
    shadow = sh.filter(ImageFilter.GaussianBlur(14))
    if recorder:
        recorder.image(canvas, "Background", 0, 0)
        recorder.image(shadow, "Bayangan panel", 0, 0)
    canvas = Image.alpha_composite(canvas, shadow)
    d = RecordedDraw(canvas, recorder) if recorder else ImageDraw.Draw(canvas, "RGBA")

    if title:
        head = st["head"]
        tw_max = W - 2 * margin - (60 if head == "ribbon" else 0)
        tf = fit_font(d, title, st["tfont"], tw_max, int(H * (0.14 if landscape else 0.085)), 24)
        if subtitle:
            # Fit the whole header block, including subtitle pill, above the grid.
            while tf.size>6:
                test_box=d.textbbox((0,0),title,font=tf)
                sf_test=fit_font(d,subtitle,F_BOLD,W-2*margin-80,max(16,int(tf.size*.38)),14)
                sub_box=d.textbbox((0,0),subtitle,font=sf_test)
                sub_height=sub_box[3]-sub_box[1]
                factor=.45 if st['head']=='ribbon' else .32 if st['head']=='underline' else .25
                bottom=int(header_h*.10)+(test_box[3]-test_box[1])+int(tf.size*factor)+sub_height+2*int(sub_height*.5)
                if bottom<=header_h-max(4,int(gap*.4)):break
                tf=load_font(st['tfont'],tf.size-1)
        tb = d.textbbox((0, 0), title, font=tf)
        tw, th = tb[2] - tb[0], tb[3] - tb[1]
        tx = (W - tw) / 2 - tb[0]
        if st["flip"] and st["head"] != "ribbon":
            tx = margin - tb[0]
        ty0 = int(header_h * 0.10)
        ty = ty0 - tb[1]
        pady = int(tf.size * 0.18)

        if head == "ribbon":
            padx = int(tf.size * 0.5)
            d.rounded_rectangle([(W - tw) / 2 - padx, ty0 - pady, (W + tw) / 2 + padx, ty0 + th + pady],
                                radius=(th + 2 * pady) // 4, fill=c2, outline=accent, width=5)
            d.text((tx, ty), title, font=tf, fill=header_color)
            sub_y = ty0 + th + int(tf.size * 0.45)
        elif head == "underline":
            d.text((tx + 2, ty + 2), title, font=tf, fill=(0, 0, 0, 15))
            d.text((tx, ty), title, font=tf, fill=header_color)
            bar_y = ty0 + th + int(tf.size * 0.14)
            d.rounded_rectangle([tx + tb[0], bar_y, tx + tb[0] + tw, bar_y + 8], radius=4, fill=accent)
            sub_y = ty0 + th + int(tf.size * 0.32)
        else:
            d.text((tx + 2, ty + 2), title, font=tf, fill=(0, 0, 0, 15))
            d.text((tx, ty), title, font=tf, fill=header_color)
            sub_y = ty0 + th + int(tf.size * 0.25)

        if subtitle:
            sf = fit_font(d, subtitle, F_BOLD, W - 2 * margin - 80, max(16, int(tf.size * 0.38)), 14)
            sb = d.textbbox((0, 0), subtitle, font=sf)
            sw, sh_ = sb[2] - sb[0], sb[3] - sb[1]
            spx, spy = int(sh_ * 0.9), int(sh_ * 0.5)
            sx = (W - sw - 2 * spx) / 2
            d.rounded_rectangle([sx, sub_y, sx + sw + 2 * spx, sub_y + sh_ + 2 * spy],
                                radius=(sh_ + 2 * spy) // 2, fill=(255, 255, 255, 240))
            d.text((sx + spx - sb[0], sub_y + spy - sb[1]), subtitle, font=sf, fill=st.get("white_ink", c1))

    if footer_h:
        d.rectangle([0, H - footer_h, W, H], fill=c2)
        if recorder: recorder.layers[-1]["brandRole"] = "footer"
        text_x = margin
        if logo is not None:
            box_w, box_h = int(footer_h*1.5), int(footer_h*.72)
            lx, ly = margin, H-footer_h+(footer_h-box_h)//2
            d.rounded_rectangle([lx-4,ly-4,lx+box_w+4,ly+box_h+4],radius=8,fill=WHITE)
            if recorder: recorder.layers[-1]["brandRole"] = "logo"
            stamp = ImageOps.contain(logo,(box_w,box_h),Image.Resampling.LANCZOS)
            ix,iy = lx+(box_w-stamp.width)//2,ly+(box_h-stamp.height)//2
            canvas.alpha_composite(stamp,(ix,iy))
            if recorder:
                recorder.image(logo,'Logo brand',ix,iy,stamp.width,stamp.height)
                recorder.layers[-1]["brandRole"] = "logo"
            text_x = lx+box_w+gap
        if footer_text:
            text_width = W-margin-text_x
            ff = fit_font(d, footer_text, F_BOLD, text_width, int(footer_h * 0.5), 14)
            fb = d.textbbox((0, 0), footer_text, font=ff)
            footer_ink = ink_on(c2) if brand else WHITE
            d.text((text_x+(text_width-(fb[2]-fb[0]))/2-fb[0], H-footer_h+(footer_h-(fb[3]-fb[1]))/2-fb[1]),footer_text,font=ff,fill=footer_ink)
            if recorder: recorder.layers[-1]["brandRole"] = "footer"

    badge = (spec.get("badge") or "").strip()
    for (x, y, w, h), item in zip(rects, items):
        draw_card(canvas, d, x, y, w, h, item, st, badge, show_price=not bundle)

    if bundle:
        draw_bundle_panel(d, margin, H - bottom_margin - panel_h, W - 2 * margin, panel_h, bundle, st)

    canvas.convert("RGB").save(out, "JPEG", quality=95, optimize=True)
    if spec.get('png_output'):
        canvas.convert('RGB').save(spec['png_output'],'PNG',optimize=True)
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