"""Verify the four missing formal map-name glyphs and the preserved body atlas."""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
current=json.loads((ROOT/'recovery/output/web-assets/ui-font-raster.json').read_text())
previous=json.loads((ROOT/'recovery/output/waiting-room-font-450-raster.json').read_text())
names=[dict(mode=mode,mapId=int(row['values']['MapID']),name=row['values']['MapName']) for mode in range(1,6) for row in json.loads((ROOT/f'recovery/output/verified/tables/m00{mode}.json').read_text())['rows']]
checks=[]
for face in current['faces']:
 glyphs={g['codepoint']:g for g in face['glyphs']};assert len(glyphs)==454
 image=Image.open(ROOT/'recovery/output/web-assets'/face['atlas']['asset']).convert('RGBA')
 assert image.size==(face['atlas']['width'],face['atlas']['height'])
 assert set(image.getchannel('A').get_flattened_data())=={0,255}
 assert all(pixel[:3]==(255,255,255) for pixel in image.get_flattened_data())
 for row in names:assert all(ord(c) in glyphs for c in row['name']),(face['dpi'],row)
 old=next(f for f in previous['faces'] if f['dpi']==face['dpi']);old_image=Image.open(ROOT/f"recovery/output/waiting-room-font-450-{face['dpi']}.png").convert('RGBA')
 for original in old['glyphs']:
  glyph=glyphs[original['codepoint']]
  for field in ['advance','inkX','inkY','width','height','pixelMode']:assert glyph[field]==original[field],(face['dpi'],glyph,field)
  if glyph['width'] and glyph['height']:
   def crop(im,g):return im.crop((g['x'],g['y'],g['x']+g['width'],g['y']+g['height'])).tobytes()
   assert crop(image,glyph)==crop(old_image,original),(face['dpi'],glyph['codepoint'])
 added=[glyphs[ord(c)] for c in '早约翰房']
 assert set(glyphs)-{g['codepoint'] for g in old['glyphs']}==set(map(ord,'早约翰房'))
 assert all(g['width']>0 and g['height']>0 and g['advance']>0 and g['pixelMode']==1 for g in added)
 checks.append(dict(dpi=face['dpi'],glyphs=len(glyphs),maps=len(names),missing=0,unchangedPreviousGlyphs=len(old['glyphs']),added=added,atlas=dict(width=image.width,height=image.height),binaryAlpha=True,whiteRGB=True))
result=dict(status='PASS',checks=checks,scope='12 added original mono bitmap/advance/ink, every 26 formal MapName missing0, 1350 previous glyph crops/metrics unchanged')
(ROOT/'recovery/output/waiting-room-map-name-glyphs-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: four glyphs × 3 DPI / every 26 MapName missing0 / 1350 previous glyphs unchanged')
