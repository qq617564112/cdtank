"""Publish original combat digit and Critical/Combo image references."""
import json
from battle_source_images import ASSETS, emit_module, original_image


def export_vectors():
    fonts = json.loads((ASSETS / 'ui-fonts.json').read_text())
    ui = json.loads((ASSETS / 'ui.json').read_text())
    shapes = {}
    for font in fonts['fonts']:
        if font['name'] in ('Damage', 'Benefit', 'Critical', 'Combo'):
            for glyph in font['glyphs']:
                shapes[glyph['asset']] = original_image(glyph['asset'])
    names = ('data\\ui\\zhandou\\1_baojishuziditu.tga',
             'data\\ui\\zhandou\\2_baojixianshidanwei.tga')
    for imageset in ui['imagesets']:
        if imageset['attributes']['Name'] == 'zhandou00':
            for region in imageset['images']:
                if region['Name'] in names:
                    shapes[region['asset']] = original_image(region['asset'])
    emit_module('apps/web/src/render/battle-text-vector-geometry.ts', 'BATTLE_TEXT_VECTORS', shapes,
                'Original published combat digit and Critical/Combo artwork.')


if __name__ == '__main__':
    export_vectors()
