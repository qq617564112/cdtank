"""Publish outline-font styles and source image bounds for ordinary UI lettering."""
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image
from source_ui_metrics import manual_catalogue, manual_style

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'recovery/output/web-assets'
SOURCE = ROOT / 'art/hd-assets/font-sources'
OUTPUT = ROOT / 'apps/web/src/interface/resources/source-text-artwork.json'

DIGIT_SETS = {
    'baiseheitizi0': 'ScoreHT', 'cheapfont0': 'Cheap', 'daheitizi0': 'BigHT',
    'fangjianbianhao0': 'MediumHT', 'hongseheitizi0': 'RedHT',
    'xiaoheitizi0': 'SmallHT',
}


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
    ui = json.loads((RUNTIME / 'ui.json').read_text())
    inventory = json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())
    manual = manual_catalogue()
    replaced = set(json.loads((ROOT / 'scripts/ui-manual-text.json').read_text())['assets']) | set(manual['textAssets'])
    deferred = {row['source']: row for row in inventory['textures'] if row['source'] in replaced}
    selections = []
    for imageset in ui['imagesets']:
        family = imageset['attributes']['Name']
        for region in imageset['images']:
            if region['asset'] not in deferred:
                continue
            entry = manual['textAssets'].get(region['asset']) or manual['assets'][region['asset']]
            text, face = entry['text'], entry.get('face', 'sans')
            selections.append((family, region, text, face))
    characters = set('0123456789+-=×∞:%/kmhBENS .～—')
    characters.update(''.join(text for _, _, text, _ in selections))
    for category in ('assets', 'textAssets'):
        for entry in manual[category].values():
            characters.update(entry.get('text', ''))
            for run in entry.get('runs', []):
                characters.update(run.get('text', ''))
    export_fonts(characters)
    assets, numeric, source_styles = {}, {}, {}
    for family, region, text, face in selections:
        reference = (family, region['Name'])
        if reference in source_styles:
            assets[region['asset']] = source_styles[reference]
            continue
        with Image.open(ROOT / deferred[region['asset']]['original']) as image:
            image = image.convert('RGBA')
            entry = manual['assets'][region['asset']]
            result = manual_style(image, entry)
            if family == 'fangjianbianhao0':
                result.update(shadow='#555214', shadowX=1, shadowY=1)
            assets[region['asset']] = result
            source_styles[reference] = result
        if family in DIGIT_SETS:
            numeric.setdefault(DIGIT_SETS[family], {})['-' if text == '−' else text] = region['asset']
    for source, entry in {**manual['assets'], **manual['textAssets']}.items():
        if source not in deferred and source not in manual['textAssets']:
            continue
        if 'inkBounds' in entry:
            with Image.open(ROOT / 'art/hd-assets/original' / source) as image:
                assets[source] = manual_style(image.convert('RGBA'), {**assets.get(source, {}), **entry})
        elif source in assets:
            assets[source].update(entry)
    deferred.update((source, {}) for source in manual['textAssets'])
    OUTPUT.write_text(json.dumps(dict(assets=assets, numeric=numeric,
                                     replacedImages=sorted(deferred)), ensure_ascii=False, indent=2) + '\n')
    rules = []
    for source, text in assets.items():
        if text.get('runs'):
            continue
        selector = f'[data-source-asset="{source}"]:not(.source-static-image):not(.source-state-button)'
        face = f"CDTank-Source{text['face'].title()}" if text['face'] != 'brush' else 'CDTank-Xiangjiao'
        rules.append(selector + ' {\n  container-type: size;\n  overflow: hidden;\n}')
        declarations = {'content': json.dumps(text['text'], ensure_ascii=False), 'position': 'absolute',
                        'inset': 'auto', 'left': f"{text['x'] / text['width'] * 100:.6f}%",
                        'top': f"{text['y'] / text['height'] * 100:.6f}%", 'display': 'block',
                        'width': 'max-content', 'white-space': 'pre', 'transform-origin': 'left top',
                        'transform': f"scaleX({text['scaleX']})", 'font-family': f"'{face}', sans-serif",
                        'font-size': f"{text['size'] / text['width'] * 100:.6f}cqw",
                        'line-height': f"{text['lineHeight'] / text['width'] * 100:.6f}cqw",
                        'font-weight': '700', 'font-style': 'normal', 'letter-spacing': '0', 'text-transform': 'none',
                        'color': text['colour'], '-webkit-text-stroke': f"{text['stroke'] / text['width'] * 100:.6f}cqw {text['outline']}",
                        'paint-order': 'stroke fill', 'pointer-events': 'none'}
        if text.get('shadow'):
            declarations['text-shadow'] = f"{text['shadowX'] / text['width'] * 100:.6f}cqw {text['shadowY'] / text['width'] * 100:.6f}cqw 0 {text['shadow']}"
        rules.append(selector + ':not([data-source-button-label="external"]):not(:has(> .source-text-artwork))::after {\n' +
                     '\n'.join(f'  {key}: {value};' for key, value in declarations.items()) + '\n}')
    OUTPUT.with_name('source-text-artwork-generated.css').write_text('\n\n'.join(rules) + '\n')
    print(f'Published {len(assets)} text regions, {len(numeric)} numeric styles and four outline fonts')


if __name__ == '__main__':
    main()
