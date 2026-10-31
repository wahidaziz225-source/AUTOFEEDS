"""Deterministic composition planning. All rectangles remain inside the content area."""
import math

STYLES = ("premium", "flash", "frozen", "editorial", "retail", "spotlight")


def grid(x, y, w, h, count, columns, gap):
    rows = math.ceil(count / columns)
    cw, ch = (w - gap * (columns - 1)) / columns, (h - gap * (rows - 1)) / rows
    return [(int(x + (i % columns) * (cw + gap)),
             int(y + (i // columns) * (ch + gap)), int(cw), int(ch))
            for i in range(count)]


def plan(style, area, count, landscape=False):
    if style not in STYLES or not 1 <= count <= 6:
        raise ValueError("Konsep atau jumlah produk tidak valid")
    x, y, w, h = area
    gap = max(12, int(w * .025))
    if count == 1:
        # Different internal image/text arrangements are applied by the renderer.
        inset = {"premium": .06, "flash": 0, "frozen": .025,
                 "editorial": .015, "retail": .04, "spotlight": .08}[style]
        dx, dy = int(w * inset), int(h * inset)
        return [(x + dx, y + dy, w - 2 * dx, h - 2 * dy)]
    if style in ("flash", "editorial"):
        # Feature a hero product, with supporting products in a separate rail.
        split = .54 if style == "flash" else .43
        hero_w = int((w - gap) * split)
        rest_w = w - gap - hero_w
        cols = math.ceil((count - 1) / 2) if landscape else (2 if count > 3 else 1)
        hero = (x, y, hero_w, h)
        rest = grid(x + hero_w + gap, y, rest_w, h, count - 1, cols, gap)
        return [hero] + rest if style == "flash" else rest + [hero]
    if style == "spotlight":
        # Tiered composition: a centered upper row, wider lower row.
        top = max(1, count // 2)
        top_h = int((h - gap) * .53)
        top_w = int(w * .84)
        return (grid(x + (w - top_w) // 2, y, top_w, top_h, top, top, gap)
                + grid(x, y + top_h + gap, w, h - top_h - gap,
                       count - top, count - top, gap))
    cols = (min(count, 3) if landscape else (2 if count > 1 else 1))
    if style == "premium":
        cols = min(count, 3) if landscape else (1 if count <= 3 else 2)
    elif style == "frozen":
        cols = min(count, 2) if landscape else (2 if count <= 4 else 3)
    return grid(x, y, w, h, count, cols, gap)
