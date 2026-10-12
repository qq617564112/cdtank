"""Publish original HUD and crosshair image references."""
import json
from pathlib import Path
from battle_source_images import ASSETS, emit_module, original_image


def export_vectors():
    ui = json.loads((ASSETS / 'ui.json').read_text())
    catalog = json.loads((ASSETS / 'combat-catalog.json').read_text())
    source = next(entry for entry in ui['imagesets'] if entry['attributes']['Name'] == 'daoju0'
                  and 'imagesets_dds/' in entry['path'])
    icons = {int(region['Name'].split('\\')[-1].split('.')[0]): region['asset']
             for region in source['images']}
    sources = {
        'bar': 'ui/regions/77/7.png',
        'magazineFill': 'ui/regions/77/17.png',
        'magazineBackground': 'ui/regions/77/18.png',
        'lifeBackground': 'ui/regions/77/20.png',
        'lifeFill': 'ui/regions/77/21.png',
        'cooldown': 'ui/regions/77/70.png',
        'infinite': 'ui/regions/2/0.png',
    }
    for icon_id in sorted({item['iconId'] for item in catalog['items'] if 'iconId' in item}):
        sources[f'icon{icon_id}'] = icons[icon_id]
    shapes = {name: original_image(asset) for name, asset in sources.items()}
    emit_module('apps/web/src/render/battle-hud-vector-geometry.ts', 'BATTLE_HUD_VECTORS', shapes,
                'Original published HUD artwork and source dimensions.')
    target = Path('apps/web/src/render/battle-crosshair-geometry.ts')
    target.write_text("import type {BattleVectorShape} from './battle-screen-vectors';\n\n"
        '/** Original published 50×37 reload crosshair images. */\n'
        + '\n'.join(f'export const {name}: BattleVectorShape = {json.dumps(original_image(asset), separators=(",", ":"))};'
                    for name, asset in [('CROSSHAIR_BACKGROUND', 'ui/regions/77/47.png'),
                                        ('CROSSHAIR_FILL', 'ui/regions/77/48.png')]) + '\n')
    print(f'2 original crosshair images: {target}')


if __name__ == '__main__':
    export_vectors()
