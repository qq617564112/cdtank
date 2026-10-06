"""Check unobscured framework regions against original DDS region PNGs."""
import json,sys,math
from PIL import Image
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
results=[]
zones={'picMainBackground':(60,8,500,18),'haoyou':(781,180,797,500)}
for row in json.loads(Path(sys.argv[1]).read_text()):
 screen=Image.open(row['file']).convert('RGBA');stage=row['state']['stage'];scale=stage['width']/800;checks=[]
 for name,zone in zones.items():
  picture=next(p for p in row['state']['sourcePictures'] if p['name']==name);count=0;maximum=0
  for piece in picture['images']:
   source=Image.open(ROOT/'recovery/output/web-assets'/piece['asset']).convert('RGBA');r=piece['rect']
   if r['width']<1 or r['height']<1:continue
   for x in range(max(math.ceil(r['x']+2),math.ceil(stage['x']+zone[0]*scale)),min(math.floor(r['x']+r['width']-2),math.floor(stage['x']+zone[2]*scale)),2):
    for y in range(max(math.ceil(r['y']+2),math.ceil(stage['y']+zone[1]*scale)),min(math.floor(r['y']+r['height']-2),math.floor(stage['y']+zone[3]*scale)),2):
     sx=int((x+.5-r['x'])/r['width']*source.width);sy=int((y+.5-r['y'])/r['height']*source.height)
     if not(1<=sx<source.width-1 and 1<=sy<source.height-1):continue
     color=source.getpixel((sx,sy))
     if color[3]!=255 or not all(source.getpixel((sx+dx,sy+dy))==color for dx in [-1,0,1] for dy in [-1,0,1]):continue
     error=max(abs(a-b) for a,b in zip(screen.getpixel((x,y)),color));assert error<=1,(row['label'],name,x,y,color,screen.getpixel((x,y)),error)
     maximum=max(maximum,error);count+=1
  assert count>10,(row['label'],name,count)
  checks.append({'source':name,'visibleOpaquePixels':count,'maximumError':maximum,'unobscuredLogicalZone':zone})
 results.append({'label':row['label'],'sourceChecks':checks})
print(json.dumps({'status':'PASS','rows':results}))
