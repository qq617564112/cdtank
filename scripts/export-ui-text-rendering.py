"""Publish outline fonts for live button captions."""
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from source_ui_metrics import manual_catalogue

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'recovery/output/web-assets'
SOURCE = ROOT / 'art/hd-assets/font-sources'



def export_fonts(characters):
    paths = {}
    for face, name in [('sans', 'NotoSansSC'), ('latin', 'Arimo'), ('digits', 'ArchivoBlack'), ('serif', 'SourceSerif')]:
        filename = f'{name}-variable.ttf' if face != 'digits' else 'ArchivoBlack-Regular.ttf'
        font = TTFont(SOURCE / filename)
        if 'fvar' in font:
            axes = {'wght': 700, **({'opsz': 20} if face == 'serif' else {})}
            font = instantiateVariableFont(font, axes, inplace=True)
        options = subset.Options()
        options.layout_features = ['kern']
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=''.join(sorted(characters)))
        subsetter.subset(font)
        family = f'CDTank Source {face.title()}'
        for platform, encoding, language in [(3, 1, 0x409), (1, 0, 0)]:
            for name_id, value in [(1, family), (4, family + ' Bold'),
                                   (6, family.replace(' ', '') + '-Bold'), (16, family)]:
                font['name'].setName(value, name_id, platform, encoding, language)
        ttf = SOURCE / f'{name}-ui-bold.ttf'
        font.save(ttf)
        font.flavor = 'woff'
        font.save(RUNTIME / f'ui/fonts/source-{face}-bold.woff')
        paths[face] = ttf
    return paths


def main():
    manual = manual_catalogue()
    characters = set('0123456789+-=×∞:%/kmhBENS .～—')
    for category in ('assets', 'textAssets'):
        for entry in manual[category].values():
            characters.update(entry.get('text', ''))
            for run in entry.get('runs', []):
                characters.update(run.get('text', ''))
    export_fonts(characters)
    print('Published four outline fonts for button captions')


if __name__ == '__main__':
    main()
