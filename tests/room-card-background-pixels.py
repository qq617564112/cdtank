"""Check original background RGBA in actual uncovered screenshot regions."""
import json
from pathlib import Path
import sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
a=Image.open(ROOT/'recovery/output/web-assets/ui/regions/60/0.png').convert('RGBA');rows=[]
for c in json.load(open(sys.argv[1])):
 s=c['state'];r=s['background']['rect'];shot=Image.open(ROOT/c['file']).convert('RGB');opaque=[];alpha=[]
 excluded=[x['rect']for x in s['cards']+s['controls']]
 for y in range(2,a.height-2,2):
  for x in range(2,a.width-2,2):
   rgba=a.getpixel((x,y))
   if any(a.getpixel((x+dx,y+dy))!=rgba for dx in [-1,0,1]for dy in [-1,0,1]):continue
   px=int(r['x']+(x+.5)*r['width']/a.width);py=int(r['y']+(y+.5)*r['height']/a.height)
   if any(b['x']-2<=px<=b['x']+b['width']+2 and b['y']-2<=py<=b['y']+b['height']+2 for b in excluded):continue
   expected=tuple(round(rgba[i]*rgba[3]/255+bg*(1-rgba[3]/255))for i,bg in enumerate([38,59,73]));actual=shot.getpixel((px,py))
   assert max(abs(actual[i]-expected[i])for i in range(3))<=1,(c['label'],x,y,rgba,actual,expected)
   record={'source':[x,y],'screen':[px,py],'rgba':list(rgba),'actualRGB':list(actual),'expectedRGB':list(expected)}
   (opaque if rgba[3]==255 else alpha).append(record)
 assert opaque,(c['label'],'no source opaque interior')
 rows.append({'file':c['file'],'label':c['label'],'opaqueCount':len(opaque),'alphaCount':len(alpha),'partialAlphaCount':sum(0<p['rgba'][3]<255 for p in alpha),'opaque':opaque[:24],'alpha':alpha[:24]})
assert len(rows)==6
print(json.dumps({'status':'PASS','captures':rows,'scope':'Original 615x317 region stretched into615x316 source window; unobscured homogeneous RGBA interiors blend over current Web panel within1 level. Source GPU edge sampling/full framebuffer equivalence unclaimed.'}))
