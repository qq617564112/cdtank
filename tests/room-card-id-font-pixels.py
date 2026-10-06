"""Compare original numeric bitmap ink with actual room-card PNG samples."""
import json
from pathlib import Path
import sys
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'recovery/output/web-assets/ui-fonts.json').read_text())
font = next(face for face in source['fonts'] if face['name'] == 'MediumHT')
glyphs = {glyph['codepoint']: glyph for glyph in font['glyphs']}
rows = []
for capture in json.load(open(sys.argv[1])):
    shot = Image.open(ROOT / capture['file']).convert('RGB')
    samples = []
    for card in capture['state']['cards']:
        for actual in card['field']['glyphs']:
            glyph = glyphs[actual['codepoint']]
            assert actual['asset'] == glyph['asset']
            image = Image.open(ROOT / 'recovery/output/web-assets' / glyph['asset']).convert('RGBA')
            box = actual['rect']
            matched = []
            # Source 2x2 opaque homogeneous interiors survive browser filtering.
            for y in range(image.height - 1):
                for x in range(image.width - 1):
                    colour = image.getpixel((x, y))
                    if colour[3] != 255 or any(image.getpixel((x+dx,y+dy)) != colour for dx,dy in [(1,0),(0,1),(1,1)]):
                        continue
                    px = int(box['x'] + (x+1) * box['width']/image.width)
                    py = int(box['y'] + (y+1) * box['height']/image.height)
                    rgb = shot.getpixel((px,py))
                    if rgb == colour[:3]:
                        matched.append({'source':[x,y], 'screen':[px,py], 'rgb':list(rgb)})
            assert matched, (capture['label'], card['id'], actual, 'No original opaque numeric ink in actual PNG')
            samples.append({'id':card['id'], 'codepoint':actual['codepoint'], 'asset':actual['asset'], 'matches':matched})
    rows.append({'file':capture['file'], 'label':capture['label'], 'numericInk':samples})
assert len(rows) == (3 if '--baseline-three' in sys.argv else 12)
print(json.dumps({'status':'PASS','captures':rows,'scope':'Original MediumHT digit RGBA opaque interiors under white colour multiplier; source native1 metrics inside Web stage projection. Fractional edge equivalence and original Windows HD auto-scale are unclaimed.'}))
