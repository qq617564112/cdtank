"""Compare opaque source-state pixels with actual native-scale Chromium captures."""
import json
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'recovery/output'
report = json.loads((OUTPUT / 'browser-room-create-visual-states.json').read_text())
rows = []
for check in report['checks']:
    if not check['name'].startswith('source state '):
        continue
    reference = Image.open(OUTPUT / 'web-assets' / check['expected']).convert('RGBA')
    actual = Image.open(ROOT / check['screenshot']).convert('RGBA')
    reference = reference.resize(actual.size, Image.Resampling.BILINEAR)
    opaque = reference.getchannel('A').point(lambda alpha: 255 if alpha == 255 else 0)
    differences = ImageChops.difference(reference.convert('RGB'), actual.convert('RGB'))
    samples = [difference for difference, alpha in zip(differences.get_flattened_data(), opaque.get_flattened_data()) if alpha]
    errors = sorted(max(pixel) for pixel in samples)
    # XML control dimensions can resample the atlas by one pixel; bound browser/Pillow filtering differences.
    percentile = errors[int((len(errors) - 1) * .95)] if errors else 255
    row = {'state': check['name'], 'source': check['expected'], 'capture': check['screenshot'],
           'dimensions': actual.size, 'opaquePixels': len(errors), 'p95ChannelError': percentile,
           'maxChannelError': max(errors, default=255)}
    rows.append(row)
    assert len(errors) > 100, row
    assert max(errors, default=255) <= 8, row
(OUTPUT / 'room-create-visual-pixels.json').write_text(json.dumps({'status': 'PASS', 'checks': rows,
    'scope': 'Opaque button interiors against exported source PNGs at native 800x600 scale; allows at most 8/255 per-channel for browser/Pillow control-size sampling; excludes alpha edges, text, frames and original GPU output.'}, indent=2) + '\n')
print('PASS:', len(rows), 'native-scale source state pixel captures')
