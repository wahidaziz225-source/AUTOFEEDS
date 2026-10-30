import json
import sys

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 100_000_000


def main():
    if len(sys.argv) < 3:
        print("Pemakaian: resize_image.py <sumber> <tujuan> [sisi_maks]", file=sys.stderr)
        sys.exit(2)

    src, dst = sys.argv[1], sys.argv[2]
    max_side = int(sys.argv[3]) if len(sys.argv) > 3 else 1024

    with Image.open(src) as im:
        im.load()
        im = ImageOps.exif_transpose(im)
        width, height = im.size

        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            background = Image.new("RGB", im.size, (255, 255, 255))
            background.paste(im, mask=im.split()[-1])
            im = background
        else:
            im = im.convert("RGB")

        im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        im.save(dst, "JPEG", quality=85, optimize=True)

    print(json.dumps({"width": width, "height": height}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)