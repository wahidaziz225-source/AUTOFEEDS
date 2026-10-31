import itertools,json,subprocess,sys,tempfile,unittest
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from creative_layout import STYLES

class ExportTests(unittest.TestCase):
 def test_custom_jpeg_and_lossless_png_dimensions_and_complete_price(self):
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp);source=folder/'photo.png';Image.new('RGBA',(400,500),'#d62638').save(source)
   original=source.read_bytes()
   for i,(style,size,mode) in enumerate(itertools.product(STYLES,[(512,512),(1200,800),(600,1600),(1536,512)],['items','bundle'])):
    with self.subTest(style=style,size=size,mode=mode):
     case=folder/str(i);case.mkdir()
     spec=dict(format='custom',width=size[0],height=size[1],theme='merah',seed=42,style=style,layout_variant=i%2,mode=mode,title='PROMO AKHIR PEKAN',subtitle='Berlaku pekan ini',footer='ANTOFROZEN • Pesan via WhatsApp',badge='PROMO',items=[dict(path=str(source),name='Nugget Ayam Original 500 gram',price_text='Rp24.799' if mode=='items' else '',old_text='Rp30.999' if mode=='items' else '',tag='-20%' if mode=='items' else '')]*6,bundle=dict(label='PAKET HEMAT',price_text='Rp125.000',old_text='Rp150.000',tag='HEMAT Rp25.000'),png_output=str(case/'poster.png'))
     (case/'spec.json').write_text(json.dumps(spec))
     subprocess.run([sys.executable,str(ROOT/'scripts/compose_promo.py'),str(case/'spec.json'),str(case/'poster.jpg'),str(case)],check=True,capture_output=True)
     for extension in ['jpg','png']:
      with Image.open(case/f'poster.{extension}') as output:self.assertEqual(output.size,size)
     doc=json.loads((case/'document.json').read_text());self.assertEqual(doc['format'],'custom')
     expected='Rp24.799' if mode=='items' else 'Rp125.000'
     prices=[l for l in doc['layers'] if l.get('text')==expected];self.assertEqual(len(prices),6 if mode=='items' else 1)
     if mode=='items':
      for index,layer in enumerate(doc['layers']):
       if layer.get('text')=='Rp24.799':
        old=[l for l in doc['layers'][:index] if l.get('text')=='Rp30.999'][-1]
        self.assertLessEqual(old['y']+old['height'],layer['y']+1)
     for layer in doc['layers']:
      if layer['kind']=='text':
       self.assertGreaterEqual(layer['x'],-1)
       self.assertLessEqual(layer['x']+layer['width'],size[0]+1)
       self.assertLessEqual(layer['y']+layer['height'],size[1]+1)
   self.assertEqual(source.read_bytes(),original)
 def test_invalid_custom_size_rejected_before_render(self):
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp);spec=folder/'spec.json';spec.write_text(json.dumps(dict(format='custom',width=100,height=900,items=[])))
   result=subprocess.run([sys.executable,str(ROOT/'scripts/compose_promo.py'),str(spec),str(folder/'out.jpg')],capture_output=True)
   self.assertNotEqual(result.returncode,0);self.assertFalse((folder/'out.jpg').exists())

if __name__=='__main__':unittest.main()
