import sys
from PIL import Image
Image.MAX_IMAGE_PIXELS=100_000_000
try:
 with Image.open(sys.argv[1]) as image:
  image.load()
  with open(sys.argv[2],'xb') as output:image.convert('RGB').save(output,'PNG',optimize=True)
except Exception as error:
 print(str(error),file=sys.stderr);sys.exit(1)
