"""AUTOfEEDS Poster Studio - CC0 Asset Bundle Generator
Generates high-resolution decorative elements, brush strokes, and icons.
All generated assets are released under CC0 1.0 Universal (Public Domain Dedication).
"""

import math
import os
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BUNDLE_DIRS = [
    ROOT / "public" / "assets" / "poster-bundle",
    ROOT / "storage" / "assets" / "poster-bundle",
]

def ensure_dirs():
    for bdir in BUNDLE_DIRS:
        for sub in ["leaves", "chili", "crumbs", "splashes", "swooshes", "sparkles", "brush", "icons"]:
            (bdir / sub).mkdir(parents=True, exist_ok=True)

def write_license():
    license_text = """CC0 1.0 Universal (CC0 1.0) Public Domain Dedication
The person who associated a work with this deed has dedicated the work to the public domain by waiving all of his or her rights to the work worldwide under copyright law, including all related and neighboring rights, to the extent allowed by law.
You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission.
"""
    for bdir in BUNDLE_DIRS:
        (bdir / "LICENSE.txt").write_text(license_text, encoding="utf-8")

def save_to_all(image, rel_path):
    for bdir in BUNDLE_DIRS:
        target = bdir / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, format="PNG", optimize=True)

# 1. Fresh Green Leaves
def generate_leaves():
    for idx, (tint, angle) in enumerate([
        ((46, 125, 50), 25),
        ((67, 160, 71), -35),
        ((27, 94, 32), 65),
        ((102, 187, 106), -15)
    ], 1):
        size = 300
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # Teardrop / oval leaf shape
        cx, cy = size // 2, size // 2
        leaf_pts = []
        for a in range(0, 360, 6):
            rad = math.radians(a)
            # Asymmetric radius creates a leaf tip
            r = 110 * (1 - 0.45 * math.cos(rad)) * (1 + 0.1 * math.sin(rad * 2))
            x = cx + r * math.sin(rad)
            y = cy - r * math.cos(rad) * 1.35
            leaf_pts.append((x, y))

        d.polygon(leaf_pts, fill=(*tint, 245))

        # Main stem / central vein
        tip_y = cy - 145
        base_y = cy + 120
        d.line([(cx, base_y), (cx, tip_y)], fill=(165, 214, 167, 220), width=4)

        # Side veins
        for vy in range(int(tip_y + 35), int(base_y - 25), 24):
            frac = (vy - tip_y) / (base_y - tip_y)
            vw = int(48 * (1 - frac * 0.4))
            d.line([(cx, vy), (cx - vw, vy - 16)], fill=(165, 214, 167, 170), width=2)
            d.line([(cx, vy), (cx + vw, vy - 16)], fill=(165, 214, 167, 170), width=2)

        # Subtle highlight on left side
        hl_pts = [(p[0] - 6, p[1]) for p in leaf_pts[:len(leaf_pts)//2]]
        d.line(hl_pts, fill=(200, 230, 201, 140), width=4)

        im = im.rotate(angle, resample=Image.Resampling.BICUBIC)
        im = im.filter(ImageFilter.SMOOTH_MORE)
        save_to_all(im, f"leaves/leaf_{idx}.png")

# 2. Chili Slices & Pepper Flakes
def generate_chili():
    # 1. Round ring slice
    im1 = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
    d1 = ImageDraw.Draw(im1)
    d1.ellipse([20, 20, 220, 220], fill=(220, 38, 38, 255), outline=(153, 27, 27, 255), width=8)
    d1.ellipse([65, 65, 175, 175], fill=(0, 0, 0, 0))
    # Seeds
    for sx, sy in [(90, 80), (145, 95), (120, 150)]:
        d1.ellipse([sx - 12, sy - 8, sx + 12, sy + 8], fill=(254, 240, 138, 255), outline=(202, 138, 4, 255), width=2)
    save_to_all(im1, "chili/chili_ring.png")

    # 2. Diagonal slice
    im2 = Image.new("RGBA", (260, 260), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(im2)
    d2.polygon([(40, 110), (120, 40), (220, 130), (130, 220)], fill=(225, 29, 72, 255), outline=(159, 18, 57, 255))
    d2.polygon([(75, 115), (125, 75), (185, 130), (135, 180)], fill=(255, 255, 255, 0))
    # Seeds
    d2.ellipse([100, 110, 124, 126], fill=(253, 224, 71, 255))
    d2.ellipse([135, 135, 155, 150], fill=(253, 224, 71, 255))
    im2 = im2.rotate(22, resample=Image.Resampling.BICUBIC)
    save_to_all(im2, "chili/chili_slice.png")

    # 3. Flakes cluster
    im3 = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    d3 = ImageDraw.Draw(im3)
    rng = random.Random(42)
    for _ in range(18):
        fx = rng.randint(20, 180)
        fy = rng.randint(20, 180)
        fw = rng.randint(6, 18)
        fh = rng.randint(4, 14)
        c = rng.choice([(220, 38, 38), (185, 28, 28), (245, 158, 11), (252, 211, 77)])
        d3.polygon([(fx, fy), (fx + fw, fy + rng.randint(-3, 3)), (fx + fw - 3, fy + fh), (fx - 2, fy + fh - 2)], fill=(*c, 240))
    save_to_all(im3, "chili/chili_flakes.png")

# 3. Crispy Crumbs & Flakes
def generate_crumbs():
    for idx, seed in enumerate([101, 202, 303], 1):
        im = Image.new("RGBA", (250, 250), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        rng = random.Random(seed)
        for _ in range(25):
            cx = rng.randint(25, 225)
            cy = rng.randint(25, 225)
            cr = rng.randint(4, 16)
            color = rng.choice([
                (245, 158, 11),   # Golden amber
                (217, 119, 6),    # Deep golden crust
                (251, 191, 36),   # Crisp yellow
                (180, 83, 9),     # Dark toasted
            ])
            pts = []
            for a in range(0, 360, 45):
                rad = math.radians(a)
                jitter = rng.uniform(0.65, 1.35)
                pts.append((cx + cr * jitter * math.cos(rad), cy + cr * jitter * math.sin(rad)))
            d.polygon(pts, fill=(*color, rng.randint(210, 255)))
        im = im.filter(ImageFilter.SMOOTH)
        save_to_all(im, f"crumbs/crumbs_{idx}.png")

# 4. Splashes & Sauce Droplets
def generate_splashes():
    # 1. Radiant sauce burst
    im1 = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    d1 = ImageDraw.Draw(im1)
    cx, cy = 150, 150
    # Core drop
    d1.ellipse([110, 110, 190, 190], fill=(225, 29, 72, 240))
    d1.ellipse([125, 125, 150, 145], fill=(255, 255, 255, 120))  # Gloss highlight
    # Droplets radiating out
    for angle in [15, 65, 125, 195, 245, 310]:
        rad = math.radians(angle)
        dist = random.randint(70, 115)
        dr = random.randint(6, 16)
        dx = cx + dist * math.cos(rad)
        dy = cy + dist * math.sin(rad)
        d1.ellipse([dx - dr, dy - dr, dx + dr, dy + dr], fill=(225, 29, 72, 220))
        d1.ellipse([dx - dr + 2, dy - dr + 2, dx - dr + 6, dy - dr + 6], fill=(255, 255, 255, 160))
    save_to_all(im1, "splashes/splash_red.png")

    # 2. Golden mustard/cheese splash
    im2 = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(im2)
    d2.ellipse([115, 115, 185, 185], fill=(245, 158, 11, 245))
    d2.ellipse([130, 125, 155, 145], fill=(254, 240, 138, 190))
    for angle in [30, 90, 160, 220, 280, 340]:
        rad = math.radians(angle)
        dist = random.randint(65, 110)
        dr = random.randint(7, 15)
        dx = cx + dist * math.cos(rad)
        dy = cy + dist * math.sin(rad)
        d2.ellipse([dx - dr, dy - dr, dx + dr, dy + dr], fill=(245, 158, 11, 230))
    save_to_all(im2, "splashes/splash_gold.png")

# 5. Dynamic Motion Swooshes & Speed Lines
def generate_swooshes():
    # 1. Curved dynamic speed arc
    im1 = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    d1 = ImageDraw.Draw(im1)
    pts1 = []
    pts2 = []
    for t in range(0, 100):
        frac = t / 100.0
        x = 50 + frac * 300
        y = 350 - math.sin(frac * math.pi * 0.85) * 260
        w = math.sin(frac * math.pi) * 16
        pts1.append((x, y - w / 2))
        pts2.append((x, y + w / 2))
    d1.polygon(pts1 + pts2[::-1], fill=(255, 255, 255, 200))
    im1 = im1.filter(ImageFilter.GaussianBlur(1.5))
    save_to_all(im1, "swooshes/swoosh_arc.png")

    # 2. Action speed streaks
    im2 = Image.new("RGBA", (450, 200), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(im2)
    for y, length, width, alpha in [
        (40, 280, 6, 210),
        (75, 410, 10, 255),
        (110, 340, 8, 220),
        (150, 240, 5, 170),
    ]:
        d2.polygon([(30, y - width // 2), (30 + length, y - 1), (30 + length, y + 1), (30, y + width // 2)],
                   fill=(253, 224, 71, alpha))
    save_to_all(im2, "swooshes/speed_streaks.png")

# 6. Golden Radiant Sparkles
def generate_sparkles():
    for idx, (sz, color) in enumerate([
        (160, (254, 240, 138)),
        (220, (255, 255, 255)),
        (140, (251, 191, 36))
    ], 1):
        im = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        c = sz // 2
        # 4-pointed star
        flare_len = sz * 0.44
        flare_w = sz * 0.08
        pts = [
            (c, c - flare_len), (c + flare_w, c - flare_w),
            (c + flare_len, c), (c + flare_w, c + flare_w),
            (c, c + flare_len), (c - flare_w, c + flare_w),
            (c - flare_len, c), (c - flare_w, c - flare_w)
        ]
        d.polygon(pts, fill=(*color, 245))
        d.ellipse([c - flare_w * 1.5, c - flare_w * 1.5, c + flare_w * 1.5, c + flare_w * 1.5], fill=(255, 255, 255, 255))
        im = im.filter(ImageFilter.GaussianBlur(1.2))
        save_to_all(im, f"sparkles/sparkle_{idx}.png")

# 7. Authentic Procedural Acrylic Yellow Brush Stroke Badge
def generate_brush_stroke():
    W, H = 800, 180
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(77)

    # Base vibrant yellow paint fill with feathered ragged ends
    base_color = (250, 204, 21)   # Bright vibrant yellow #facc15
    dark_shade = (234, 179, 8)    # Amber bristle streak #eab308
    light_shade = (254, 240, 138) # Light yellow bristle highlight #fef08a

    # Simulate realistic multi-bristle brush stroke sweeps
    for lane in range(25, H - 25, 4):
        y_center = lane + rng.randint(-2, 2)
        start_x = rng.randint(20, 65)
        end_x = W - rng.randint(20, 60)
        h_bristle = rng.randint(8, 18)
        color = rng.choice([base_color, dark_shade, base_color, light_shade])
        d.rounded_rectangle([start_x, y_center - h_bristle // 2, end_x, y_center + h_bristle // 2],
                            radius=h_bristle // 2, fill=(*color, rng.randint(220, 255)))

    # Add angled ragged bristle tips at left & right
    for _ in range(35):
        lx = rng.randint(15, 60)
        ly = rng.randint(35, H - 35)
        lw = rng.randint(15, 45)
        d.line([(lx, ly), (lx + lw, ly)], fill=(*dark_shade, 230), width=rng.randint(2, 5))

        rx = W - rng.randint(20, 70)
        ry = rng.randint(35, H - 35)
        rw = rng.randint(15, 45)
        d.line([(rx - rw, ry), (rx, ry)], fill=(*dark_shade, 230), width=rng.randint(2, 5))

    im = im.filter(ImageFilter.SMOOTH)
    save_to_all(im, "brush/brush_swipe_yellow.png")

# 8. Benefit Badge Icons (Vector-quality 128x128 icons)
def generate_icons():
    icons_to_make = [
        ("halal", lambda d, s: (
            # Shield with crescent/star
            d.polygon([(s*0.5, s*0.12), (s*0.84, s*0.25), (s*0.84, s*0.60), (s*0.5, s*0.88), (s*0.16, s*0.60), (s*0.16, s*0.25)], fill=(22, 101, 52, 255)),
            d.ellipse([s*0.35, s*0.35, s*0.65, s*0.65], fill=(255, 255, 255, 255)),
            d.ellipse([s*0.42, s*0.35, s*0.68, s*0.65], fill=(22, 101, 52, 255))
        )),
        ("clock", lambda d, s: (
            # 3-minute ready clock
            d.ellipse([s*0.15, s*0.15, s*0.85, s*0.85], fill=(30, 64, 175, 255), outline=(255, 255, 255, 255), width=4),
            d.line([(s*0.5, s*0.5), (s*0.5, s*0.28)], fill=(255, 255, 255, 255), width=5),
            d.line([(s*0.5, s*0.5), (s*0.68, s*0.5)], fill=(255, 255, 255, 255), width=5),
            d.ellipse([s*0.46, s*0.46, s*0.54, s*0.54], fill=(254, 240, 138, 255))
        )),
        ("leaf", lambda d, s: (
            # Natural herb leaf
            d.polygon([(s*0.5, s*0.15), (s*0.82, s*0.45), (s*0.65, s*0.82), (s*0.35, s*0.82), (s*0.18, s*0.45)], fill=(21, 128, 61, 255)),
            d.line([(s*0.5, s*0.82), (s*0.5, s*0.25)], fill=(255, 255, 255, 240), width=4),
            d.line([(s*0.5, s*0.55), (s*0.32, s*0.42)], fill=(255, 255, 255, 200), width=3),
            d.line([(s*0.5, s*0.55), (s*0.68, s*0.42)], fill=(255, 255, 255, 200), width=3)
        )),
        ("flame", lambda d, s: (
            # Flame / crispy icon
            d.polygon([(s*0.5, s*0.15), (s*0.65, s*0.4), (s*0.82, s*0.55), (s*0.75, s*0.85), (s*0.25, s*0.85), (s*0.18, s*0.55), (s*0.35, s*0.4)], fill=(225, 29, 72, 255)),
            d.polygon([(s*0.5, s*0.45), (s*0.62, s*0.62), (s*0.55, s*0.8), (s*0.45, s*0.8), (s*0.38, s*0.62)], fill=(253, 224, 71, 255))
        )),
        ("heart", lambda d, s: (
            # Premium quality heart
            d.ellipse([s*0.2, s*0.22, s*0.54, s*0.56], fill=(190, 24, 93, 255)),
            d.ellipse([s*0.46, s*0.22, s*0.8, s*0.56], fill=(190, 24, 93, 255)),
            d.polygon([(s*0.21, s*0.42), (s*0.79, s*0.42), (s*0.5, s*0.84)], fill=(190, 24, 93, 255))
        )),
        ("shield", lambda d, s: (
            # Quality guarantee shield with check
            d.polygon([(s*0.5, s*0.15), (s*0.85, s*0.28), (s*0.85, s*0.62), (s*0.5, s*0.88), (s*0.15, s*0.62), (s*0.15, s*0.28)], fill=(15, 118, 110, 255)),
            d.line([(s*0.35, s*0.52), (s*0.47, s*0.64), (s*0.68, s*0.38)], fill=(255, 255, 255, 255), width=5)
        )),
        ("star", lambda d, s: (
            # 5-point star
            d.polygon([
                (s*0.5, s*0.12), (s*0.62, s*0.38), (s*0.88, s*0.38),
                (s*0.68, s*0.55), (s*0.75, s*0.85), (s*0.5, s*0.68),
                (s*0.25, s*0.85), (s*0.32, s*0.55), (s*0.12, s*0.38),
                (s*0.38, s*0.38)
            ], fill=(245, 158, 11, 255), outline=(217, 119, 6, 255), width=2)
        )),
        ("truck", lambda d, s: (
            # Free shipping truck
            d.rounded_rectangle([s*0.15, s*0.32, s*0.62, s*0.68], radius=4, fill=(59, 130, 246, 255)),
            d.polygon([(s*0.62, s*0.42), (s*0.82, s*0.42), (s*0.85, s*0.55), (s*0.85, s*0.68), (s*0.62, s*0.68)], fill=(37, 99, 235, 255)),
            d.ellipse([s*0.26, s*0.64, s*0.42, s*0.80], fill=(15, 23, 42, 255)),
            d.ellipse([s*0.64, s*0.64, s*0.80, s*0.80], fill=(15, 23, 42, 255))
        )),
    ]

    sz = 140
    for name, draw_fn in icons_to_make:
        im = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        draw_fn(d, sz)
        im = im.filter(ImageFilter.SMOOTH)
        save_to_all(im, f"icons/icon_{name}.png")

def main():
    print("Building CC0 Poster Studio Asset Bundle...")
    ensure_dirs()
    write_license()
    generate_leaves()
    generate_chili()
    generate_crumbs()
    generate_splashes()
    generate_swooshes()
    generate_sparkles()
    generate_brush_stroke()
    generate_icons()
    print("Asset bundle successfully created with CC0 license!")

if __name__ == "__main__":
    main()

