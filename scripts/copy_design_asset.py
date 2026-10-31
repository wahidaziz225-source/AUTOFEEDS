import json
from pathlib import Path
import sys
import warnings
from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS = 24_000_000
warnings.simplefilter('error', Image.DecompressionBombWarning)
try:
    spec = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    with Image.open(spec['source']) as source:
        source.load(); image = ImageOps.exif_transpose(source).convert('RGBA')
        image.thumbnail((4096,4096),Image.Resampling.LANCZOS)
        with open(spec['destination'],'xb') as output: image.save(output,format='PNG')
    print(json.dumps(dict(width=image.width,height=image.height)))
except Exception as exc:
    print(str(exc),file=sys.stderr);sys.exit(1)
