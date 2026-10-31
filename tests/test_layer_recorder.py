import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from creative_layout import STYLES
from compose_promo import FORMATS


class LayerRecorderTests(unittest.TestCase):
    def test_trace_all_concepts_formats_and_modes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/'product.png'
            photo=Image.new('RGBA',(400,500),(0,0,0,0));ImageDraw.Draw(photo).rectangle((100,50,300,450),fill='#d62638');photo.save(source)
            original=source.read_bytes()
            for index,(style,fmt,mode) in enumerate(itertools.product(STYLES,FORMATS,('items','bundle'))):
                with self.subTest(style=style,format=fmt,mode=mode):
                    folder=root/f'case-{index}';folder.mkdir()
                    item=dict(path=str(source),name='Nugget Ayam Original 500 gram',price_text='Rp24.799' if mode=='items' else '',old_text='Rp30.999' if mode=='items' else '',tag='-20%' if mode=='items' else '')
                    spec=dict(format=fmt,theme='merah',seed=42,style=style,layout_variant=index%2,mode=mode,
                              title='PROMO AKHIR PEKAN',subtitle='Berlaku 1–7 November',footer='ANTOFROZEN • Pesan via WhatsApp',badge='PROMO',
                              items=[item] if mode=='items' else [item]*6,
                              bundle=dict(label='PAKET HEMAT',price_text='Rp125.000',old_text='Rp150.000',tag='HEMAT Rp25.000'))
                    (folder/'spec.json').write_text(json.dumps(spec),encoding='utf8')
                    subprocess.run([sys.executable,str(ROOT/'scripts/compose_promo.py'),str(folder/'spec.json'),str(folder/'poster.jpg'),str(folder)],check=True,capture_output=True)
                    data=json.loads((folder/'document.json').read_text())
                    self.assertEqual((data['width'],data['height']),FORMATS[fmt])
                    self.assertGreater(len(data['layers']),10)
                    expected='Rp24.799' if mode=='items' else 'Rp125.000'
                    self.assertTrue(any(l.get('text')==expected for l in data['layers']))
                    self.assertEqual(len({l['id'] for l in data['layers']}),len(data['layers']))
                    product_layers=[l for l in data['layers'] if l['kind']=='image' and l['name'].startswith('Foto produk:')]
                    self.assertEqual(len(product_layers),len(spec['items']))
                    for layer in data['layers']:
                        for field in ('x','y','width','height'):self.assertTrue(math.isfinite(layer[field]))
                    for asset in data['assets']:
                        with Image.open(folder/f"{asset['id']}.png") as image:
                            self.assertEqual(image.mode,'RGBA')
                            self.assertEqual(image.size,(asset['width'],asset['height']))
            self.assertEqual(source.read_bytes(),original)

    def test_layer_recording_does_not_change_poster_render(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);source=folder/'photo.png';Image.new('RGB',(200,300),'red').save(source)
            spec=dict(format='feed',theme='merah',seed=42,style='retail',layout_variant=1,mode='items',title='PROMO',subtitle='',footer='',badge='',items=[dict(path=str(source),name='Produk',price_text='Rp24.799',old_text='Rp30.999',tag='-20%')])
            file=folder/'spec.json';file.write_text(json.dumps(spec))
            script=str(ROOT/'scripts/compose_promo.py')
            subprocess.run([sys.executable,script,str(file),str(folder/'plain.jpg')],check=True,capture_output=True)
            subprocess.run([sys.executable,script,str(file),str(folder/'traced.jpg'),str(folder)],check=True,capture_output=True)
            self.assertEqual((folder/'plain.jpg').read_bytes(),(folder/'traced.jpg').read_bytes())


if __name__=='__main__':unittest.main()
