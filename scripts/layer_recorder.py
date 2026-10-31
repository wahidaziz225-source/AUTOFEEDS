"""Record semantic foreground drawing while preserving the existing Pillow renderer."""
import uuid
from pathlib import Path
from PIL import Image, ImageDraw


def rgba(value):
    if value is None: return 'none'
    if isinstance(value, str): return value
    return '#' + ''.join(f'{int(v):02x}' for v in value)


class LayerRecorder:
    def __init__(self, folder):
        self.folder = Path(folder); self.folder.mkdir(parents=True, exist_ok=True)
        self.layers, self.assets = [], []

    def add(self, kind, name, x, y, w, h, **props):
        layer = dict(id=str(uuid.uuid4()), name=name[:120], kind=kind, x=float(x), y=float(y),
                     width=max(.01,float(w)), height=max(.01,float(h)), rotation=0, opacity=1,
                     visible=True, locked=False, fill='none', stroke='none', strokeWidth=0)
        layer.update(props); self.layers.append(layer)

    def image(self, image, name, x, y, width=None, height=None):
        width = image.width if width is None else width
        height = image.height if height is None else height
        image = image.copy()
        image.thumbnail((4096,4096), Image.Resampling.LANCZOS)
        asset = str(uuid.uuid4())
        image.save(self.folder / f'{asset}.png', format='PNG')
        self.assets.append(dict(id=asset, width=image.width, height=image.height))
        self.add('image', name, x, y, width, height, assetId=asset, locked=name in ('Background','Bayangan panel'))


class RecordedDraw:
    def __init__(self, image, recorder):
        self.draw = ImageDraw.Draw(image, 'RGBA'); self.recorder = recorder

    def __getattr__(self, key): return getattr(self.draw, key)

    def text(self, xy, text, font=None, fill=None, **kwargs):
        self.draw.text(xy, text, font=font, fill=fill, **kwargs)
        if not text: return
        if isinstance(fill, tuple) and len(fill) == 4 and fill[3] <= 15: return
        b = self.draw.textbbox((0,0), text, font=font)
        ascent = font.getmetrics()[0] if hasattr(font,'getmetrics') else font.size
        family, style = font.getname() if hasattr(font,'getname') else ('Arial','Regular')
        family = next((name for name in ('DejaVu Sans','Impact','Georgia','Verdana','Courier New') if name.split()[0] in family), 'Arial')
        self.recorder.add('text', text, xy[0], xy[1]+b[1], self.draw.textlength(text,font=font), max(1,b[3]-b[1]),
                          text=text, fontFamily=family, fontSize=font.size, bold='bold' in style.lower() or 'black' in style.lower(),
                          baseline=(ascent-b[1])/max(1,b[3]-b[1]), fill=rgba(fill))

    @staticmethod
    def box(xy):
        if len(xy)==2 and isinstance(xy[0],(tuple,list)): return (*xy[0],*xy[1])
        return xy

    def rectangle(self, xy, fill=None, outline=None, width=1):
        self.draw.rectangle(xy,fill=fill,outline=outline,width=width)
        x,y,r,b=self.box(xy)
        self.recorder.add('rect','Bidang',x,y,r-x,b-y,fill=rgba(fill),stroke=rgba(outline),strokeWidth=width if outline else 0,radius=0)

    def rounded_rectangle(self, xy, radius=0, fill=None, outline=None, width=1):
        self.draw.rounded_rectangle(xy,radius=radius,fill=fill,outline=outline,width=width)
        x,y,r,b=self.box(xy)
        self.recorder.add('rect','Panel / label harga',x,y,r-x,b-y,fill=rgba(fill),stroke=rgba(outline),strokeWidth=width if outline else 0,radius=radius)

    def ellipse(self, xy, fill=None, outline=None, width=1):
        self.draw.ellipse(xy,fill=fill,outline=outline,width=width)
        x,y,r,b=self.box(xy)
        self.recorder.add('ellipse','Lingkaran / diskon',x,y,r-x,b-y,fill=rgba(fill),stroke=rgba(outline),strokeWidth=width if outline else 0)

    def line(self, xy, fill=None, width=0, **kwargs):
        self.draw.line(xy,fill=fill,width=width,**kwargs)
        self.path(xy,fill=None,outline=fill,width=width,closed=False)

    def path(self, points, fill=None, outline=None, width=0, closed=True):
        x=min(p[0] for p in points);y=min(p[1] for p in points)
        w=max(1,max(p[0] for p in points)-x);h=max(1,max(p[1] for p in points)-y)
        d='M '+' L '.join(f'{p[0]-x},{p[1]-y}' for p in points)+(' Z' if closed else '')
        self.recorder.add('path','Garis / dekorasi',x,y,w,h,d=d,pathWidth=w,pathHeight=h,fill=rgba(fill),stroke=rgba(outline),strokeWidth=width)
