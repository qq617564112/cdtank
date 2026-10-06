"""Compare original numeric bitmap ink with actual room-card PNG samples."""
import json
import math
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
            field = card['field']['rect']
            matched = []
            # Source 2x2 opaque homogeneous interiors survive browser filtering.
            for y in range(image.height - 1):
                for x in range(image.width - 1):
                    colour = image.getpixel((x, y))
                    if colour[3] != 255 or any(image.getpixel((x+dx,y+dy)) != colour for dx,dy in [(1,0),(0,1),(1,1)]):
                        continue
                    px = int(box['x'] + (x+1) * box['width']/image.width)
                    py = int(box['y'] + (y+1) * box['height']/image.height)
                    if not (field['x'] <= px+.5 < field['x']+field['width'] and field['y'] <= py+.5 < field['y']+field['height']):
                        continue
                    rgb = shot.getpixel((px,py))
                    if rgb == colour[:3]:
                        matched.append({'source':[x,y], 'screen':[px,py], 'rgb':list(rgb)})
            filtered = []
            # Original clipping can leave only filtered bottom ink; compare premultiplied
            # bilinear RGBA over the current panel using the actual destination rectangle.
            for py in range(math.ceil(max(box['y'], field['y'])), math.floor(min(box['y']+box['height'], field['y']+field['height']))):
                for px in range(math.ceil(max(box['x'], field['x'])), math.floor(min(box['x']+box['width'], field['x']+field['width']))):
                    sx = (px+.5-box['x'])/box['width']*image.width-.5
                    sy = (py+.5-box['y'])/box['height']*image.height-.5
                    expected = [0.,0.,0.]
                    for yy in [math.floor(sy), math.floor(sy)+1]:
                        for xx in [math.floor(sx), math.floor(sx)+1]:
                            weight = (1-abs(sx-xx))*(1-abs(sy-yy))
                            rgba = image.getpixel((max(0,min(image.width-1,xx)),max(0,min(image.height-1,yy))))
                            alpha = rgba[3]/255
                            for i,bg in enumerate([38,59,73]):
                                expected[i] += weight*(rgba[i]*alpha+bg*(1-alpha))
                    rgb = shot.getpixel((px,py))
                    if expected[0] > 150 and max(abs(expected[i]-rgb[i]) for i in range(3)) <= 2:
                        filtered.append({'sourceUV':[sx,sy], 'screen':[px,py], 'rgb':list(rgb), 'predictedRGB':expected})
            assert matched or filtered, (capture['label'], card['id'], actual, 'No original numeric ink in actual clipped PNG')
            samples.append({'id':card['id'], 'codepoint':actual['codepoint'], 'asset':actual['asset'], 'matches':matched, 'filteredMatches':filtered})
    rows.append({'file':capture['file'], 'label':capture['label'], 'numericInk':samples})
assert len(rows) == 12
print(json.dumps({'status':'PASS','captures':rows,'scope':'Original MediumHT digit RGBA opaque interiors under white colour multiplier; source native1 metrics inside Web stage projection. Filtered visible ink additionally compares source premultiplied bilinear RGBA over current panel within two channel levels; full GPU framebuffer is unclaimed.'}))
