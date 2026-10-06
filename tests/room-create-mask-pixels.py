"""Verify source mask PNG blending against captured open and closed formal pages."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'recovery/output'
report = json.loads((OUTPUT / 'browser-room-create-mask.json').read_text())
source = Image.open(OUTPUT / 'web-assets/ui/regions/60/128.png').convert('RGBA')
rows = []
for check in report['checks']:
    if not check['name'].startswith('source mask geometry'):
        continue
    result = check['result']
    x, y = result['sample']['x'], result['sample']['y']
    before = Image.open(ROOT / check['closed']).convert('RGB').getpixel((x, y))
    actual = Image.open(ROOT / check['open']).convert('RGB').getpixel((x, y))
    rectangle = result['rect']
    scaled = source.resize((round(rectangle['width']), round(rectangle['height'])), Image.Resampling.BILINEAR)
    pixel = scaled.getpixel((round(x - rectangle['x']), round(y - rectangle['y'])))
    expected = tuple(round(pixel[channel] * pixel[3] / 255 + before[channel] * (1 - pixel[3] / 255)) for channel in range(3))
    error = max(abs(a - b) for a, b in zip(actual, expected))
    row = {'viewport': [result['width'], result['height']], 'point': [x, y], 'sourceRGBA': pixel,
           'closedRGB': before, 'expectedRGB': expected, 'openRGB': actual, 'maxChannelError': error}
    rows.append(row)
    assert pixel[3] == 153 and error <= 2, row
(OUTPUT / 'room-create-mask-pixels.json').write_text(json.dumps({'status': 'PASS', 'checks': rows,
    'scope': 'Actual Chromium source-PNG alpha blending at one exposed-background point per viewport. Original CEGUI parent-alpha and GPU output remain unverified.'}, indent=2) + '\n')
print('PASS:', len(rows), 'actual source mask PNG blend captures')
