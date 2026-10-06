"""Compare actual native-size partial/full opaque source colours and window alpha."""
import json
import sys
from PIL import Image

rows = json.load(open(sys.argv[1]))
base = sys.argv[2]
row = next(r for r in rows if r['label'] == '800x600')
partial = Image.open(base+'-800x600-partial-crop.png').convert('RGB')
full = Image.open(base+'-800x600-full-crop.png').convert('RGB')
r = row['partial']['rect']
point = (14, 6)
a, b = partial.getpixel(point), full.getpixel(point)
expected = [0.6*(255-84), 0.6*(255-85), 0.6*(0-84)]
actual = [b[i]-a[i] for i in range(3)]
assert all(abs(actual[i]-expected[i]) <= 5 for i in range(3)), (point,a,b,expected,actual)
print(json.dumps({'status':'PASS','scope':'Actual opaque source47 gray vs source48 yellow at native 800x600; stationary ordinary player partial/full captures share backdrop within tolerance5/channel. Source Alpha0.6, no extra 128/255 alpha. Larger sizes verified separately by PNG/geometry.','point':point,'backgroundSource':[84,85,84,255],'progressSource':[255,255,0,255],'partial':a,'full':b,'expectedDifference':expected,'actualDifference':actual,'tolerance':5}))
