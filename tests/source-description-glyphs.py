"""Verify the finite original glyph library covers every formal map description."""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
current=json.loads((ROOT/'recovery/output/web-assets/ui-font-raster.json').read_text())
previous=json.loads((ROOT/'recovery/output/waiting-room-font-72-raster.json').read_text())
descriptions=[dict(mode=mode,mapId=int(row['values']['MapID']),text=row['values']['MapInfo']) for mode in range(1,6) for row in json.loads((ROOT/f'recovery/output/verified/tables/m00{mode}.json').read_text())['rows']]
assert current['status']=='PASS' and len(descriptions)==26
checks=[]
for face in current['faces']:
 glyphs={g['codepoint']:g for g in face['glyphs']};assert len(glyphs)==454
 image=Image.open(ROOT/'recovery/output/web-assets'/face['atlas']['asset']).convert('RGBA')
 assert image.size==(face['atlas']['width'],face['atlas']['height'])
 assert set(image.getchannel('A').get_flattened_data())=={0,255}
 assert all(pixel[:3]==(255,255,255) for pixel in image.get_flattened_data())
 for row in descriptions:assert all(ord(c) in glyphs for c in row['text']),(face['dpi'],row)
 old=next(f for f in previous['faces'] if f['dpi']==face['dpi']);old_image=Image.open(ROOT/f"recovery/output/waiting-room-font-72-{face['dpi']}.png").convert('RGBA')
 assert face['lineSpacing']==old['lineSpacing'] and face['baseline']==old['baseline']
 for original in old['glyphs']:
  glyph=glyphs[original['codepoint']]
  for field in ['advance','inkX','inkY','width','height','pixelMode']:assert glyph[field]==original[field],(face['dpi'],glyph,field)
  if glyph['width'] and glyph['height']:
   def crop(im,g):return im.crop((g['x'],g['y'],g['x']+g['width'],g['y']+g['height'])).tobytes()
   assert crop(image,glyph)==crop(old_image,original),(face['dpi'],glyph['codepoint'])
 space=glyphs[32];assert space['advance']>0 and space['width']==0 and space['height']==0
 checks.append(dict(dpi=face['dpi'],glyphs=len(glyphs),descriptions=len(descriptions),missing=0,unchangedStaticGlyphs=len(old['glyphs']),atlas=dict(width=image.width,height=image.height),binaryAlpha=True,whiteRGB=True))
result=dict(status='PASS',checks=checks,scope='1362 original mono glyph metadata/pixels, every supported MAPS description missing0, 216 existing static glyph crops/metrics unchanged, space zero ink positive advance')
(ROOT/'recovery/output/waiting-room-description-glyphs-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: 454 glyphs × 3 DPI / every 26 description missing0 / 216 original static glyphs unchanged')
