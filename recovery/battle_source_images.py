"""Publish original battle image references and source dimensions."""
import json
from pathlib import Path
from PIL import Image

ASSETS = Path('recovery/output/web-assets')


def original_image(asset):
    with Image.open(ASSETS / asset) as image:
        return {'width': image.width, 'height': image.height, 'asset': asset}


def emit_module(target, export_name, shapes, description):
    lines = ["import type {BattleVectorShape} from './battle-screen-vectors';", '',
             f'/** {description} */',
             f'export const {export_name}: Readonly<Record<string, BattleVectorShape>> = {{']
    for name, shape in shapes.items():
        lines.append(f'  {json.dumps(name)}: {json.dumps(shape, separators=(",", ":"))},')
    lines.extend(['};', ''])
    Path(target).write_text('\n'.join(lines))
    print(f'{len(shapes)} original image references: {target}')
