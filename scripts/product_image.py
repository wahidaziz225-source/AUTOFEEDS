"""Non-destructive local product photography. Never generates packaging pixels."""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys
import warnings

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

# Bound decoded images and working output for machines with 16 GB RAM.
Image.MAX_IMAGE_PIXELS = 24_000_000
warnings.simplefilter('error', Image.DecompressionBombWarning)
MODEL_PATH = Path(os.environ.get('AUTOFEEDS_DATA_DIR') or Path(__file__).resolve().parents[1]) / 'storage' / 'models' / 'u2netp.onnx'
MODEL_MD5 = '8e83ca70e441ab06c318d82300c84806'
ENGINE = 'U2NETP / ONNX Runtime CPU'


class ProcessingError(ValueError):
    def __init__(self, message, code='INVALID_IMAGE_OPTIONS'):
        super().__init__(message)
        self.code = code


def model_valid():
    if not MODEL_PATH.is_file():
        return False
    # Validate the official small model, never load arbitrary/corrupt ONNX bytes.
    return hashlib.md5(MODEL_PATH.read_bytes()).hexdigest() == MODEL_MD5


def capabilities():
    if not importlib.util.find_spec('onnxruntime') or not importlib.util.find_spec('numpy'):
        return dict(ready=False, reason='Paket AI lokal belum terpasang. Ikuti petunjuk Pemasangan AI lokal.', engine=ENGINE)
    if not model_valid():
        return dict(ready=False, reason='Model u2netp.onnx belum tersedia atau checksum tidak cocok. Jalankan pemasangan model.', engine=ENGINE)
    try:
        import onnxruntime  # noqa: F401
    except Exception:
        return dict(ready=False, reason='ONNX Runtime tidak dapat dimuat. Periksa instalasi Python dan runtime Windows.', engine=ENGINE)
    return dict(ready=True, reason='Model lokal tersedia. Hasil mask tetap perlu diperiksa pada preview.', engine=ENGINE)


def options(value):
    if not isinstance(value, dict):
        raise ProcessingError('Pengaturan foto harus berupa objek.')
    result = dict(remove_background=False, background='original', background_color='#f1f5f9',
                  brightness=1, contrast=1, sharpness=1, scale=.85, position_x=0, position_y=0, shadow=False)
    result.update(value)
    for key in ('remove_background', 'shadow'):
        if not isinstance(result[key], bool):
            raise ProcessingError('Pilihan hapus background dan bayangan harus berupa boolean.')
    if result['background'] not in ('original', 'transparent', 'solid'):
        raise ProcessingError('Background tidak valid.')
    if not isinstance(result['background_color'], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', result['background_color']):
        raise ProcessingError('Warna background tidak valid.')
    for key, low, high in (('brightness', .8, 1.2), ('contrast', .8, 1.2), ('sharpness', 1, 1.5),
                           ('scale', .4, 1), ('position_x', -1, 1), ('position_y', -1, 1)):
        n = result[key]
        if isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) or not low <= n <= high:
            raise ProcessingError(f'Nilai {key} di luar batas.')
    if result['background'] == 'original' and (result['remove_background'] or result['shadow']):
        raise ProcessingError('Pilih background transparan atau warna untuk isolasi/bayangan.')
    return result


def remove_background(image):
    state = capabilities()
    if not state['ready']:
        raise ProcessingError(state['reason'], 'BACKGROUND_UNAVAILABLE')
    import numpy as np
    import onnxruntime as ort
    # U2NETP preprocessing and output mask follow the official rembg U2netpSession.
    # Inference only predicts alpha: RGB data continues to come from the source photo.
    try:
        session_options = ort.SessionOptions()
        session_options.intra_op_num_threads = 2
        session_options.inter_op_num_threads = 1
        session = ort.InferenceSession(str(MODEL_PATH), sess_options=session_options,
                                      providers=['CPUExecutionProvider'])
        sample = np.asarray(image.convert('RGB').resize((320, 320), Image.Resampling.LANCZOS), dtype=np.float32)
        sample /= max(float(sample.max()), 1e-6)
        sample = (sample - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)
        sample = np.transpose(sample, (2, 0, 1))[None, ...].astype(np.float32)
        prediction = session.run(None, {session.get_inputs()[0].name: sample})[0][0, 0]
        low, high = float(prediction.min()), float(prediction.max())
        if not np.isfinite(prediction).all() or high - low < 1e-6:
            raise ProcessingError('AI tidak menemukan mask produk yang dapat digunakan.', 'MASK_FAILED')
        alpha = Image.fromarray(np.uint8(np.clip((prediction-low)/(high-low), 0, 1)*255))
        alpha = alpha.resize(image.size, Image.Resampling.LANCZOS)
        result = image.copy()
        result.putalpha(ImageChops.multiply(image.getchannel('A'), alpha))
        return result
    except ProcessingError:
        raise
    except Exception as exc:
        raise ProcessingError('Model AI gagal memproses foto. Periksa ONNX Runtime dan model lokal.', 'MODEL_FAILED') from exc


def process(source, destination, raw_options):
    config = options(raw_options)
    source, destination = Path(source), Path(destination)
    if source.resolve() == destination.resolve():
        raise ProcessingError('Foto asli tidak boleh ditimpa.')
    with Image.open(source) as original:
        if original.width * original.height > Image.MAX_IMAGE_PIXELS:
            raise ProcessingError('Foto melebihi batas 24 megapiksel.')
        original.load()
        photo = ImageOps.exif_transpose(original).convert('RGBA')
    photo.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
    size = photo.size
    if config['remove_background']:
        photo = remove_background(photo)
    # Preserve source alpha while applying small user-selected adjustments to RGB.
    alpha = photo.getchannel('A')
    rgb = photo.convert('RGB')
    for key, enhancer in (('brightness', ImageEnhance.Brightness), ('contrast', ImageEnhance.Contrast), ('sharpness', ImageEnhance.Sharpness)):
        if config[key] != 1:
            rgb = enhancer(rgb).enhance(config[key])
    photo = rgb.convert('RGBA')
    photo.putalpha(alpha)
    if config['background'] != 'original':
        if alpha.getextrema()[0] == 255:
            raise ProcessingError('Foto masih memiliki background. Aktifkan hapus background AI atau gunakan PNG transparan.', 'ISOLATION_REQUIRED')
        bounds = alpha.getbbox()
        if not bounds:
            raise ProcessingError('Produk tidak terlihat setelah isolasi. Gunakan foto asli atau foto lain.', 'MASK_FAILED')
        product = photo.crop(bounds)
        max_w = max(1, round(size[0]*config['scale']))
        max_h = max(1, round(size[1]*config['scale']))
        product = ImageOps.contain(product, (max_w, max_h), Image.Resampling.LANCZOS)
        x = round((size[0]-product.width)*(config['position_x']+1)/2)
        y = round((size[1]-product.height)*(config['position_y']+1)/2)
        background = config['background_color'] if config['background'] == 'solid' else (0, 0, 0, 0)
        canvas = Image.new('RGBA', size, background)
        if config['shadow']:
            mask = Image.new('L', size, 0)
            mask.paste(product.getchannel('A').point(lambda a: round(a*.25)), (x, y+max(2, round(size[1]*.012))))
            shadow = Image.new('RGBA', size, (0, 0, 0, 0))
            shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(max(2, size[0]*.012))))
            canvas = Image.alpha_composite(canvas, shadow)
        canvas.alpha_composite(product, (x, y))
        photo = canvas
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive output: UUIDs are generated by the server; never replace existing files.
    with destination.open('xb') as output:
        photo.save(output, format='PNG', optimize=True)
    return dict(width=photo.width, height=photo.height, engine=ENGINE if config['remove_background'] else 'Pillow', options=config)


def main():
    if sys.argv[1:] == ['--capabilities']:
        print(json.dumps(capabilities()))
        return
    spec = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    result = process(spec['source'], spec['destination'], spec['options'])
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps(dict(error=str(exc), code=getattr(exc, 'code', 'PROCESSING_FAILED'))), file=sys.stderr)
        sys.exit(1)
