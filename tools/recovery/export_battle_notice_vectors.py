"""Publish original opening and outcome image references from client layouts."""
import json
from battle_source_images import ASSETS, emit_module, original_image


def export_vectors():
    ui = json.loads((ASSETS / 'ui.json').read_text())
    controls = {
        'game_main.xml': ['picFight', 'picModeSplash', 'picTeamMode', 'picConquerMode',
                          'picVIPMode', 'picMeleeMode', 'picDestroyMode'],
        'game_summary.xml': ['picWin', 'picLose', 'picDraw'],
    }
    shapes = {}
    for suffix, names in controls.items():
        layout = next(layout for layout in ui['layouts'] if layout['path'] == f'ui/layouts/{suffix}')
        titles = [control['name'] for control in layout['windows'] if control['parent'] in names]
        for name in [*names, *titles]:
            control = next(control for control in layout['windows'] if control['name'] == name)
            set_name, image_name = control['properties']['Image'][4:].split(' image:', 1)
            sets = [imageset for imageset in ui['imagesets'] if imageset['attributes']['Name'] == set_name]
            source = next((imageset for imageset in sets if 'imagesets_dds/' in imageset['path']), sets[0])
            region = next(region for region in source['images'] if region['Name'] == image_name)
            shapes[name] = original_image(region['asset'])
    emit_module('apps/web/src/render/battle-notice-vector-geometry.ts', 'BATTLE_NOTICE_VECTORS', shapes,
                'Original published mode instructions, Fight, splash and outcome artwork.')


if __name__ == '__main__':
    export_vectors()
