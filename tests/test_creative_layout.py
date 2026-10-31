import itertools
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from creative_layout import plan, STYLES
from compose_promo import FORMATS


class CreativeLayoutTests(unittest.TestCase):
    def test_bounds_and_nonoverlap(self):
        for style, (fmt, (w, h)), n in itertools.product(STYLES, FORMATS.items(), range(1, 7)):
            with self.subTest(style=style, format=fmt, count=n):
                area = (54, int(h*.22), w-108, int(h*.62))
                boxes = plan(style, area, n, w > h)
                self.assertEqual(len(boxes), n)
                for x, y, bw, bh in boxes:
                    self.assertGreater(bw, 0)
                    self.assertGreater(bh, 0)
                    self.assertGreaterEqual(x, area[0])
                    self.assertGreaterEqual(y, area[1])
                    self.assertLessEqual(x+bw, area[0]+area[2])
                    self.assertLessEqual(y+bh, area[1]+area[3])
                for a, b in itertools.combinations(boxes, 2):
                    self.assertTrue(a[0]+a[2] <= b[0] or b[0]+b[2] <= a[0]
                                    or a[1]+a[3] <= b[1] or b[1]+b[3] <= a[1])

    def test_compositions_differ_and_are_repeatable(self):
        layouts = [plan(s, (50, 200, 980, 900), 6) for s in STYLES]
        self.assertGreaterEqual(len({str(p) for p in layouts}), 5)
        self.assertEqual(layouts[0], plan('premium', (50, 200, 980, 900), 6))

    def test_render_all_formats_styles_and_modes(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source = folder / 'product.png'
            Image.new('RGB', (300, 500), '#d62638').save(source)
            original = source.read_bytes()
            item = dict(path=str(source), name='Nugget Ayam Original 500 gram',
                        price_text='Rp24.799', old_text='Rp30.999', tag='-20%')
            for style, (fmt, dims), mode, flip in itertools.product(STYLES, FORMATS.items(), ('items', 'bundle'), (0, 1)):
                with self.subTest(style=style, format=fmt, mode=mode, flip=flip):
                    spec = dict(format=fmt, style=style, theme='merah', seed=42, layout_variant=flip,
                                mode=mode, title='PROMO AKHIR PEKAN', subtitle='Berlaku 1–7 November',
                                footer='ANTOFROZEN • Pesan via WhatsApp', badge='PROMO',
                                items=[item] if mode == 'items' else [dict(item, price_text='', old_text='', tag='')]*6,
                                bundle=dict(label='PAKET HEMAT', price_text='Rp125.000', old_text='Rp150.000', tag='HEMAT Rp25.000'))
                    infile, outfile = folder/'spec.json', folder/'poster.jpg'
                    infile.write_text(json.dumps(spec), encoding='utf-8')
                    subprocess.run([sys.executable, str(ROOT/'scripts/compose_promo.py'), str(infile), str(outfile)],
                                   check=True, capture_output=True)
                    with Image.open(outfile) as im:
                        self.assertEqual(im.size, dims)
                        self.assertIsNotNone(ImageChops.difference(im, Image.new('RGB', dims, im.getpixel((0, 0)))).getbbox())
            self.assertEqual(source.read_bytes(), original)

    def test_missing_photo_fails_instead_of_blank_poster(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            spec = dict(format='feed', style='retail', theme='merah', items=[dict(path='missing.png', name='Produk')])
            (folder/'spec.json').write_text(json.dumps(spec))
            result = subprocess.run([sys.executable, str(ROOT/'scripts/compose_promo.py'), str(folder/'spec.json'), str(folder/'out.jpg')], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((folder/'out.jpg').exists())


if __name__ == '__main__':
    unittest.main()
