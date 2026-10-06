"""Compare original sort button opaque interiors with actual browser screenshots."""
import json
from pathlib import Path
import sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
rows=[]
for capture in json.load(open(sys.argv[1])):
 state=capture['state'];original=Image.open(ROOT/'recovery/output/web-assets'/state['images'][0]['asset']).convert('RGBA');shot=Image.open(ROOT/capture['file']).convert('RGB');box=state['rect'];samples=[]
 for sy in range(1,original.height-1):
  for sx in range(1,original.width-1):
   colour=original.getpixel((sx,sy))
   if colour[3]!=255 or any(original.getpixel((sx+dx,sy+dy))!=colour for dx in [-1,0,1]for dy in [-1,0,1]):continue
   px=int(box['x']+(sx+.5)*box['width']/original.width);py=int(box['y']+(sy+.5)*box['height']/original.height);actual=shot.getpixel((px,py));assert actual==colour[:3],(capture['label'],[sx,sy],[px,py],actual,colour);samples.append({'source':[sx,sy],'screen':[px,py],'rgb':list(actual)})
 assert samples,capture['label']
 rows.append({'file':capture['file'],'source':state['source'],'state':state['state'],'asset':state['images'][0]['asset'],'samples':samples})
assert len(rows)==18
print(json.dumps({'status':'PASS','captures':rows,'scope':'Both original source sort buttons, Normal/Hover/Pushed, three viewport opaque homogeneous interior RGB; fractional edge/GPU equivalence unclaimed.'}))
