"""Verify actual source slash ink in paging screenshots at all viewport scales."""
import json
from pathlib import Path
import sys
from PIL import Image
root = Path(__file__).resolve().parents[1]
library = json.loads((root / 'recovery/output/web-assets/ui-font-raster.json').read_text())
rows = []
for capture in json.load(open(sys.argv[1])):
    field = next(row for row in capture['state']['controls'] if row['name'] == 'yeshu')
    slash = next(g for g in field['glyphs'] if g['codepoint'] == 47)
    face = next(f for f in library['faces'] if f"SIMSUN-mono-{f['dpi']}.png" in slash['asset'])
    glyph = next(g for g in face['glyphs'] if g['codepoint'] == 47)
    atlas = Image.open(root / 'recovery/output/web-assets' / face['atlas']['asset']).convert('RGBA')
    shot = Image.open(capture['file']).convert('RGB')
    rect = slash['rect']
    matched = []
    for y in range(glyph['height']):
        for x in range(glyph['width']):
            if atlas.getpixel((glyph['x'] + x, glyph['y'] + y))[3] != 255:
                continue
            px = int(rect['x'] + (x + .5) * rect['width'] / glyph['width'])
            py = int(rect['y'] + (y + .5) * rect['height'] / glyph['height'])
            actual = shot.getpixel((px, py))
            # Fractional-scale mono edges blend source white with the current panel.
            alpha = [(actual[i] - channel) / (255 - channel) for i, channel in enumerate([38,59,73])]
            if min(alpha) > .2 and max(alpha) - min(alpha) < .015:
                matched.append({'source': [x, y], 'screen': [px, py], 'rgb': list(actual), 'whiteAlphaOverCurrentPanel': alpha})
    assert len(matched) >= 3, (capture['label'], matched)
    button_samples = []
    for button in [r for r in capture['state']['controls'] if r['name'] != 'yeshu']:
        original = Image.open(root / 'recovery/output/web-assets' / button['images'][0]['asset']).convert('RGBA')
        box = button['rect']
        matched_button = []
        for sy in range(1, original.height - 1):
            for sx in range(1, original.width - 1):
                colour = original.getpixel((sx, sy))
                if colour[3] != 255 or any(original.getpixel((sx+dx, sy+dy)) != colour for dx in [-1,0,1] for dy in [-1,0,1]):
                    continue
                px = int(box['x'] + (sx + .5) * box['width'] / original.width)
                py = int(box['y'] + (sy + .5) * box['height'] / original.height)
                actual = shot.getpixel((px, py))
                assert actual == colour[:3], (capture['label'], button['name'], button['state'], [sx,sy], [px,py], actual, colour)
                matched_button.append({'source':[sx,sy], 'screen':[px,py], 'rgb':list(actual)})
        assert matched_button, (capture['label'], button['name'], 'No opaque homogeneous interior samples')
        button_samples.append({'name':button['name'], 'state':button['state'], 'asset':button['images'][0]['asset'], 'samples':matched_button})
    rows.append({'file': capture['file'], 'dpi': face['dpi'], 'sourceSlash': glyph,
                 'actualSourceOpaqueCentreSamples': matched, 'buttonOpaqueInteriorSamples':button_samples, 'scope': 'Opaque interior samples at source-to-screen transformed positions; fractional edges unclaimed.'})
assert {row['dpi'] for row in rows} >= ({103,192} if '--no-native' in sys.argv else {96,103,192})
print(json.dumps({'status': 'PASS', 'samples': rows, 'scope': 'Actual original slash mono ink/white in first/last source page labels and three viewport projections.'}))
