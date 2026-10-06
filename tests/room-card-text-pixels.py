"""Compare visible native-scale card digits with original mono glyph alpha."""
import json
import sys
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
library = json.loads((root / 'recovery/output/web-assets/ui-font-raster.json').read_text())
face = next(f for f in library['faces'] if f['dpi'] == 96)
atlas = Image.open(root / 'recovery/output/web-assets' / face['atlas']['asset']).convert('RGBA')
rows = []
for capture in json.load(open(sys.argv[1])):
    field = capture['field']
    screen = field['screen']
    assert abs(screen['width'] - 30) < .01
    glyph = field['glyphs'][0]
    rect = glyph['rect']
    source = next(g for g in face['glyphs'] if g['codepoint'] == int(glyph['codepoint']))
    shot = Image.open(capture['file']).convert('RGB')
    opacity = capture['opacity']
    assert opacity == 1
    expected_white = (255, 255, 255)
    opaque = transparent = clipped = 0
    # The screenshot samples preserve Chrome's native background raster placement.
    for y in range(source['height']):
        for x in range(source['width']):
            point = (round(rect['x']) + x, round(rect['y']) + y)
            if not (screen['x'] <= point[0] < screen['x'] + screen['width'] and screen['y'] <= point[1] < screen['y'] + screen['height']):
                clipped += 1
                continue
            alpha = atlas.getpixel((source['x'] + x, source['y'] + y))[3]
            actual = shot.getpixel(point)
            if alpha:
                assert actual == expected_white, (capture['state'], point, actual)
                opaque += 1
            else:
                assert actual != expected_white, (capture['state'], point, 'transparent original sample')
                transparent += 1
    assert opaque > 0 and transparent > 0
    # The original advance is centred in the 30px text area; ink offset then positions the bitmap.
    expected_x = screen['x'] + (30 - float(field['extent'])) / 2 + source['inkX']
    assert abs(rect['x'] - expected_x) < .01
    rows.append({'file': capture['file'], 'state': capture['state'], 'sourceCodepoint': source['codepoint'],
                 'effectiveOpacity': opacity, 'expectedWhiteRgb': expected_white, 'opaqueSourcePixels': opaque, 'transparentBackgroundPixels': transparent, 'clippedPixels': clipped,
                 'actualInk': rect, 'clip': screen, 'centredOrigin': expected_x})
print(json.dumps({'status': 'PASS', 'samples': rows, 'scope': 'Actual original mono digit pixels, white colour, centred advance and window clipping at existing card scale 1.'}))
