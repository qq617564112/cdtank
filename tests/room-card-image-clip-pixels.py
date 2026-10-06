"""Compare ordinary screenshots with source PNGs and same-page image-hidden baselines."""
import json,sys,math
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
rows=json.loads(Path(sys.argv[1]).read_text());results=[]
for row in rows:
 actual=Image.open(row['file']).convert('RGBA');base=Image.open(row['baseline']).convert('RGBA');clipped=visible=0;maxerror=0
 for item in row['images']:
  if item['hidden']:continue
  source=Image.open(ROOT/'recovery/output/web-assets'/item['asset']).convert('RGBA');r=item['rect'];card=item['cardRect'];scale=card['width']/120;edge=card['x']+19*scale
  for y in range(math.ceil(r['y']+1),math.floor(r['y']+r['height']-1)):
   for x in range(math.ceil(r['x']+1),math.floor(r['x']+r['width']-1)):
    sx=(x+.5-r['x'])/r['width']*source.width;sy=(y+.5-r['y'])/r['height']*source.height
    ix,iy=int(sx),int(sy)
    if not(1<=ix<source.width-1 and 1<=iy<source.height-1):continue
    color=source.getpixel((ix,iy))
    if x+.5<edge-1:
     if color[3]>0:
      assert actual.getpixel((x,y))==base.getpixel((x,y)),(row['label'],item['name'],'outside parent',x,y)
      clipped+=1
    elif x+.5>edge+1 and color[3]==255 and all(source.getpixel((ix+dx,iy+dy))==color for dx in [-1,0,1] for dy in [-1,0,1]):
     error=max(abs(a-b) for a,b in zip(actual.getpixel((x,y)),color));maxerror=max(maxerror,error)
     assert error<=1,(row['label'],item['name'],'visible source',x,y,error,color,actual.getpixel((x,y)))
     visible+=1
 assert clipped>0 and visible>0,(row['label'],clipped,visible)
 results.append({'label':row['label'],'clippedSourcePixelsEqualBaseline':clipped,'visibleOpaqueSourcePixels':visible,'maximumError':maxerror})
print(json.dumps({'status':'PASS','rows':results}))
