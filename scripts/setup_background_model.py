"""Explicit one-time download. The application itself never downloads AI models."""
import hashlib
from pathlib import Path
import sys
import urllib.request
from product_image import MODEL_PATH, MODEL_MD5

URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx'


def main():
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp = MODEL_PATH.with_suffix('.download')
    try:
        with urllib.request.urlopen(URL, timeout=60) as response, temp.open('wb') as output:
            total = 0
            while chunk := response.read(128 * 1024):
                total += len(chunk)
                if total > 10 * 1024 * 1024:
                    raise ValueError('Unduhan melebihi batas ukuran model u2netp.')
                output.write(chunk)
        if hashlib.md5(temp.read_bytes()).hexdigest() != MODEL_MD5:
            raise ValueError('Checksum model tidak cocok; file tidak dipasang.')
        temp.replace(MODEL_PATH)
        print('Model AI lokal berhasil dipasang:', MODEL_PATH)
    finally:
        temp.unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('Pemasangan model gagal:', str(exc), file=sys.stderr)
        sys.exit(1)
