import hashlib
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import product_image as studio
from compose_promo import load_product


class ProductImageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.source = self.folder/'source.png'
        self.output = self.folder/'processed.png'
        photo = Image.new('RGBA', (400, 500), (0, 0, 0, 0))
        ImageDraw.Draw(photo).rectangle((120, 80, 279, 419), fill=(210, 38, 48, 255))
        photo.save(self.source)
        self.digest = hashlib.sha256(self.source.read_bytes()).hexdigest()

    def tearDown(self):
        self.assertEqual(hashlib.sha256(self.source.read_bytes()).hexdigest(), self.digest)
        self.temp.cleanup()

    def test_default_preserves_photo_pixels_and_alpha(self):
        studio.process(self.source, self.output, {})
        with Image.open(self.source) as original, Image.open(self.output) as output:
            self.assertEqual(original.tobytes(), output.tobytes())
            self.assertEqual(output.mode, 'RGBA')

    def test_rejects_overwrite_and_existing_destination(self):
        with self.assertRaises(studio.ProcessingError): studio.process(self.source, self.source, {})
        studio.process(self.source, self.output, {})
        before = self.output.read_bytes()
        with self.assertRaises(FileExistsError): studio.process(self.source, self.output, {})
        self.assertEqual(before, self.output.read_bytes())

    def test_rejects_invalid_options_and_opaque_cutout(self):
        for config in [dict(brightness=float('nan')), dict(contrast=-1), dict(scale=3), dict(position_x=2),
                       dict(shadow='true'), dict(remove_background=1), dict(background='bad'), dict(background_color='red'),
                       dict(remove_background=True, background='original')]:
            with self.subTest(config=config), self.assertRaises(studio.ProcessingError): studio.options(config)
        opaque = self.folder/'opaque.jpg'
        Image.new('RGB', (200, 300), 'white').save(opaque)
        with self.assertRaises(studio.ProcessingError) as ctx:
            studio.process(opaque, self.output, dict(background='solid'))
        self.assertEqual(ctx.exception.code, 'ISOLATION_REQUIRED')
        self.assertFalse(self.output.exists())

    def test_placement_preserves_aspect_and_product_inside_canvas(self):
        for i, (px, py) in enumerate([(-1, -1), (0, 0), (1, 1)]):
            out = self.folder/f'pose-{i}.png'
            studio.process(self.source, out, dict(background='transparent', scale=.7, position_x=px, position_y=py))
            with Image.open(out) as result:
                bbox = result.getchannel('A').getbbox()
                self.assertIsNotNone(bbox)
                x, y, right, bottom = bbox
                self.assertGreaterEqual(x, 0); self.assertGreaterEqual(y, 0)
                self.assertLessEqual(right, 400); self.assertLessEqual(bottom, 500)
                self.assertAlmostEqual((right-x)/(bottom-y), 160/340, delta=.01)

    def test_background_and_shadow_keep_product_color(self):
        studio.process(self.source, self.output, dict(background='solid', background_color='#eef2ff', shadow=True, scale=.6))
        with Image.open(self.output) as result:
            self.assertEqual(result.getpixel((0, 0)), (238, 242, 255, 255))
            self.assertEqual(result.getpixel((200, 250)), (210, 38, 48, 255))
            self.assertEqual(result.getchannel('A').getextrema(), (255, 255))

    def test_enhancement_preserves_alpha(self):
        studio.process(self.source, self.output, dict(brightness=1.1, contrast=1.05, sharpness=1.2))
        with Image.open(self.source) as original, Image.open(self.output) as output:
            self.assertIsNone(ImageChops.difference(original.getchannel('A'), output.getchannel('A')).getbbox())
            self.assertNotEqual(original.getpixel((200, 250)), output.getpixel((200, 250)))

    def test_no_model_does_not_silently_fake_removal(self):
        with patch.object(studio, 'MODEL_PATH', self.folder/'missing.onnx'):
            state = studio.capabilities()
            self.assertFalse(state['ready'])
            with self.assertRaises(studio.ProcessingError) as ctx:
                studio.process(self.source, self.output, dict(background='transparent', remove_background=True))
            self.assertEqual(ctx.exception.code, 'BACKGROUND_UNAVAILABLE')
            self.assertFalse(self.output.exists())

    def test_corrupt_model_is_not_loaded(self):
        model = self.folder/'bad.onnx'; model.write_bytes(b'not a model')
        with patch.object(studio, 'MODEL_PATH', model): self.assertFalse(studio.model_valid())

    def test_poster_loader_retains_source_transparency(self):
        loaded = load_product(self.source)
        self.assertEqual(loaded.mode, 'RGBA')
        self.assertEqual(loaded.getpixel((0, 0))[3], 0)
        self.assertEqual(loaded.getpixel((200, 250)), (210, 38, 48, 255))

    def test_max_size_and_exif_orientation(self):
        wide = self.folder/'wide.jpg'
        photo = Image.new('RGB', (3000, 1500), 'red')
        exif = Image.Exif(); exif[274] = 6
        photo.save(wide, exif=exif)
        info = studio.process(wide, self.output, {})
        self.assertEqual((info['width'], info['height']), (1024, 2048))

    @unittest.skipUnless(os.environ.get('RUN_LOCAL_AI_TESTS') == '1', 'Set RUN_LOCAL_AI_TESTS=1 with local model installed')
    def test_real_cpu_model_outputs_mask_without_repainting_rgb(self):
        self.assertTrue(studio.capabilities()['ready'])
        photo = Image.new('RGBA', (400, 500), (245, 245, 245, 255))
        draw = ImageDraw.Draw(photo)
        draw.rounded_rectangle((120, 80, 280, 420), radius=20, fill=(210, 38, 48, 255))
        draw.rectangle((125, 200, 275, 270), fill='yellow')
        result = studio.remove_background(photo)
        self.assertEqual(result.size, photo.size)
        self.assertLess(result.getchannel('A').getextrema()[0], 255)
        self.assertGreater(result.getchannel('A').getextrema()[1], 0)
        self.assertIsNone(ImageChops.difference(result.convert('RGB'), photo.convert('RGB')).getbbox())


if __name__ == '__main__': unittest.main()
