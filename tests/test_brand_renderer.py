import itertools,json,subprocess,sys,tempfile,unittest
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from compose_promo import contrast,ink_on,FORMATS
from creative_layout import STYLES

class BrandRendererTests(unittest.TestCase):
 def test_brand_logo_palette_footer_and_layer_capture(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);source=root/'product.png';logo=root/'logo.png'
   Image.new('RGBA',(400,500),'#d62638').save(source)
   im=Image.new('RGBA',(300,100),(0,0,0,0));ImageDraw.Draw(im).rectangle((10,10,290,90),fill='#123456');im.save(logo)
   product_bytes=source.read_bytes();logo_bytes=logo.read_bytes()
   for i,(style,fmt) in enumerate(itertools.product(STYLES,FORMATS)):
    with self.subTest(style=style,format=fmt):
     folder=root/str(i);folder.mkdir()
     spec=dict(format=fmt,theme='merah',seed=42,style=style,layout_variant=i%2,mode='items',title='PROMO',subtitle='Berlaku pekan ini',footer='ANTOFROZEN • Hubungi toko',badge='PROMO',items=[dict(path=str(source),name='Nugget 500 gram',price_text='Rp24.799',old_text='Rp30.999',tag='-20%')],brand=dict(name='ANTOFROZEN',primary_color='#1d4ed8',secondary_color='#172554',accent_color='#fde047',font_family='Arial',logo_path=str(logo)))
     (folder/'spec.json').write_text(json.dumps(spec))
     subprocess.run([sys.executable,str(ROOT/'scripts/compose_promo.py'),str(folder/'spec.json'),str(folder/'poster.jpg'),str(folder)],check=True,capture_output=True)
     doc=json.loads((folder/'document.json').read_text())
     self.assertEqual(sum(l.get('brandRole')=='logo' and l['kind']=='image' for l in doc['layers']),1)
     self.assertTrue(any(l.get('text')=='Rp24.799' for l in doc['layers']))
     self.assertTrue(any(l.get('text')==spec['footer'] and l.get('brandRole')=='footer' for l in doc['layers']))
     self.assertTrue(any(l.get('fill')=='#1d4ed8' for l in doc['layers']))
   self.assertEqual(source.read_bytes(),product_bytes);self.assertEqual(logo.read_bytes(),logo_bytes)
 def test_ink_selection_has_readable_contrast(self):
  for color in [(255,255,255),(0,0,0),(230,230,220),(20,30,100),(220,38,38)]:self.assertGreater(contrast(color,ink_on(color)),3)

if __name__=='__main__':unittest.main()
