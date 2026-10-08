"""Describe simple source UI artwork as shared HTML/CSS drawing recipes."""
from collections import Counter, defaultdict
import json
from pathlib import Path
import re

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'apps/web/src/assets'
ORIGINALS = ROOT / 'art/hd-assets/original'
ART = ROOT / 'art/hd-ui-redraw'


def main():
    ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
    images = {image['asset']: image for sheet in ui['imagesets']
              for image in sheet['images'] if image.get('asset', '').startswith('ui/regions/')}
    drawings = {}
    families = defaultdict(list)

    def original(asset):
        return Image.open(ORIGINALS / asset).convert('RGBA')

    def colour(pixel):
        red, green, blue, alpha = pixel
        return f'#{red:02x}{green:02x}{blue:02x}' if alpha == 255 else \
            f'rgb({red} {green} {blue} / {alpha / 255:.3f})'

    def dominant(asset):
        with original(asset) as image:
            pixels = Counter(pixel for pixel in image.getdata() if pixel[3] > 0)
            return colour(pixels.most_common(1)[0][0])

    def bounds(asset):
        with original(asset) as image:
            left, top, right, bottom = image.getchannel('A').getbbox()
            return {'inset': f'{top / image.height * 100:.3f}% '
                    f'{(image.width - right) / image.width * 100:.3f}% '
                    f'{(image.height - bottom) / image.height * 100:.3f}% '
                    f'{left / image.width * 100:.3f}%'}

    def add(asset, family, before, after=None):
        drawings[asset] = {'before': before, **({'after': after} if after else {})}
        families[family].append(asset)

    def flat(asset, family, fill, **style):
        add(asset, family, {'background': fill, **style})

    def slice_style(position, fill, border, radius=7):
        style = {'background': fill}
        edges = [edge for edge in ('Top', 'Right', 'Bottom', 'Left') if edge in position]
        for edge in edges:
            if border:
                style[f'border-{edge.lower()}'] = f'1px solid {border}'
        if len(edges) == 2:
            corner = '-'.join(edge.lower() for edge in ('Top', 'Bottom', 'Left', 'Right')
                              if edge in edges)
            style[f'border-{corner}-radius'] = f'{radius}px'
        return style

    nine = {1: 'TopLeft', 2: 'TopRight', 3: 'BottomLeft', 4: 'BottomRight',
            5: 'Top', 6: 'Bottom', 7: 'Left', 8: 'Right', 9: 'Middle'}
    outer = {1: 'TopLeft', 2: 'TopRight', 3: 'BottomLeft', 4: 'BottomRight',
             5: 'Left', 6: 'Right', 7: 'Bottom', 8: 'Top', 9: 'Middle'}

    def panel(group, stem, fill, border, positions=nine, radius=7):
        for asset, image in images.items():
            name = image['Name'].split('\\')[-1].removesuffix('.tga')
            match = re.fullmatch(re.escape(stem) + r'(\d)', name)
            if asset.startswith(f'ui/regions/{group}/') and match:
                position = positions[int(match[1])]
                add(asset, f'{group}/{stem}', slice_style(position, fill, border, radius))

    for group in (44, 77):
        panel(group, 'tanchukuang', 'rgb(13 0 76 / .733)', '#57e9ff', outer)
        panel(group, 'lt', 'rgb(8 0 54 / .8)', None)
        # The minimap border has a transparent centre.
        panel(group, 'ditukuang', 'transparent', '#c88f78',
              {1: 'TopLeft', 2: 'TopRight', 3: 'BottomLeft', 4: 'BottomRight',
               5: 'Left', 6: 'Right', 7: 'Top', 8: 'Bottom'}, radius=0)
    panel(60, 'tanchukuang', '#3869b0', '#57e9ff')
    panel(60, 'lt', 'rgb(8 0 54 / .8)', None)
    panel(60, 'lvseditu', '#d3f5c8', '#f4ffd6', radius=9)
    panel(60, 'liangditu', 'linear-gradient(#ffd7ad, #ffcea5)', '#ffe6bd', radius=5)
    panel(60, 'xuantingshuomingkuang', '#ff9c32', '#ffce7d', radius=5)
    panel(60, 'ruanjianpanditu', '#c6c5bf', '#fff', radius=1)
    panel(68, 'tanchukuang', 'rgb(13 0 76 / .733)', '#57e9ff', outer)
    panel(68, 'luditu', '#a1c482', '#435b35', radius=6)
    panel(71, 'jianpandi', '#a7d4e1', '#202b2c', radius=15)

    def strip(group, stem, fill, edge):
        positions = {1: 'Left', 2: 'Right', 3: 'Middle'}
        for asset, image in images.items():
            name = image['Name'].split('\\')[-1].removesuffix('.tga')
            if asset.startswith(f'ui/regions/{group}/') and re.fullmatch(stem + r'[123]', name):
                position = positions[int(name[-1])]
                style = slice_style(position, fill, edge, 0)
                style.update({'border-top': f'1px solid {edge}', 'border-bottom': f'1px solid {edge}'})
                if position == 'Left':
                    style['border-radius'] = '5px 0 0 5px'
                if position == 'Right':
                    style['border-radius'] = '0 5px 5px 0'
                add(asset, f'{group}/{stem}', style)

    strip(60, 'huangtiao', '#fffcd0', '#ffffe6')
    strip(74, 'hengtiao', 'linear-gradient(#ffe097 0 20%, #ef8252 35% 80%, #ffdc94 90%)', '#ce7946')
    strip(74, 'hongtiaoditu', 'linear-gradient(#982618, #721308)', '#4d2112')

    def arrow(asset, direction, fill, outline='#071027'):
        polygon = {'up': '50% 0, 100% 100%, 0 100%', 'down': '0 0, 100% 0, 50% 100%',
                   'left': '0 50%, 100% 0, 100% 100%', 'right': '0 0, 100% 50%, 0 100%'}[direction]
        box = bounds(asset)
        shape = f'polygon({polygon})'
        add(asset, 'arrows', {**box, 'background': outline, 'clip-path': shape},
            {**box, 'background': fill, 'clip-path': shape, 'transform': 'scale(.7)'})

    palette = {'blue': 'linear-gradient(135deg, #dcf9ff, #40b7ee 55%, #468ed7)',
               'orange': 'linear-gradient(135deg, #ffe6a8, #ffa67a 55%, #ffbf61)',
               'yellow': 'linear-gradient(135deg, #fffed1, #fff16b 55%, #e6dc56)',
               'grey': 'linear-gradient(135deg, #d5d5cc, #99978b)'}
    for asset, image in images.items():
        group = int(asset.split('/')[2])
        name = image['Name'].split('\\')[-1].removesuffix('.tga')
        if group in (44, 60, 77) and name.startswith('hdtan'):
            direction = 'down' if name in ('hdtan3b', 'hdtan2b', 'hdtan1b') or name.startswith('hdtan02') else 'up'
            key = 'blue' if name.endswith('_2') or name in ('hdtan3', 'hdtan3b') else \
                'yellow' if name.endswith('_1') or name in ('hdtan1', 'hdtan1b') else 'orange'
            arrow(asset, direction, palette[key])
        elif group == 60 and re.fullmatch(r'(zuo|you)ann?iu\d\d', name):
            key = {'01': 'yellow', '02': 'orange', '03': 'blue', '04': 'grey'}[name[-2:]]
            arrow(asset, 'left' if name.startswith('zuo') else 'right', palette[key])
        elif group == 66 and name.startswith('jiantou'):
            key = {'1': 'yellow', '2': 'blue', '3': 'orange', '4': 'grey'}[name[7]]
            arrow(asset, 'left' if name in ('jiantou1', 'jiantou2', 'jiantou3', 'jiantou4') else 'right', palette[key], '#333')
        elif group in (44, 60, 77) and name.startswith('liantian_miyuduixiang'):
            arrow(asset, 'right', palette['orange' if name.endswith('2') else 'yellow' if name.endswith('1') else 'blue'], '#333')
        elif group in (44, 60, 77) and name.startswith('hdtd'):
            blue = name in ('hdtd04',)
            stops = '#d8fbff, #4be8ff 25%, #378ddd 55%, #283ec3' if blue else \
                '#fff4ac, #ffc569 25%, #bc6034 60%, #713420'
            flat(asset, 'scrollbar-tracks', f'linear-gradient(90deg, {stops})', **bounds(asset))

    for group in (44, 77):
        for index, fill in [(70, '#333'), (127, '#000'), (128, '#fff'), (149, 'rgb(0 0 0 / .5)')]:
            asset = f'ui/regions/{group}/{index}.png'
            if asset in images:
                flat(asset, 'fills', fill)
        for index, fill in [(46, '#f00000'), (47, '#b0b0a5'), (48, '#ffff00')]:
            asset = f'ui/regions/{group}/{index}.png'
            add(asset, 'reticles', {**bounds(asset), 'background': fill,
                'clip-path': 'polygon(0 100%, 30% 0, 42% 0, 17% 100%, 83% 100%, 58% 0, 70% 0, 100% 100%)'})
        for index, fill in [(21, '#fff')]:
            asset = f'ui/regions/{group}/{index}.png'
            flat(asset, 'progress-fills', fill, **bounds(asset), **{'border-radius': '2px'})
        # White and red life outlines are simple arcs.
        for index in (105, 106, 107, 108):
            asset = f'ui/regions/{group}/{index}.png'
            side = 'right' if index in (105, 106) else 'left'
            add(asset, 'life-arcs', {**bounds(asset), f'border-{side}':
                f'2px solid {"#ff1010" if index in (105, 107) else "#151515"}', 'border-radius': '50%'})

    for asset, fill, family, style in [
        ('59/13', '#111', 'progress-tracks', {}),
        ('59/14', 'linear-gradient(90deg, #f37777, #f69558 50%, #ffe600)', 'progress-fills', {}),
        ('59/74', '#487fbb', 'fills', {}), ('59/75', '#347fb7', 'fills', {}),
        ('60/47', '#173665', 'input-boxes', {'border': '1px solid #172b3d', 'box-shadow': 'inset 0 1px 2px #0c213b'}),
        ('60/128', 'rgb(29 57 89 / .65)', 'fills', {}),
        ('60/166', '#00bceb', 'fills', {}), ('60/207', '#967c4d', 'fills', {}),
        ('60/236', '#2786ff', 'carets', {}), ('60/237', '#fff', 'carets', {}),
        ('67/50', '#31639e', 'fills', {}),
        ('69/25', '#d3f5c8', 'fills', {}),
        ('69/36', '#fffcd0', 'fills', {'border-radius': '8px'}),
        ('69/184', 'transparent', 'item-borders', {'border': '1px solid #ffed40'}),
        ('74/67', '#f99779', 'slider-tracks', {'border': '1px solid #fffad5', 'border-radius': '2px'}),
    ]:
        flat('ui/regions/' + asset + '.png', family, fill, **bounds('ui/regions/' + asset + '.png'), **style)

    # Keyboard artwork consists of a key surface and ordinary live characters.
    key_names = {'dunhao': '\\', 'juhao': '.', 'wenhao': '/', 'caps': 'Caps',
                 'shift': 'Shift', 'enter': '↵', 'backspace': '←', 'tab': '⇥', 'ins': 'Ins'}
    for asset, image in images.items():
        group = int(asset.split('/')[2])
        name = image['Name'].split('\\')[-1].removesuffix('.tga')
        if group == 71 and not name.startswith('jianpandi'):
            pushed = name.endswith('_2') or name == '_2'
            key = name.removesuffix('_2') if name != '_2' else '_'
            label = key_names.get(key, key.upper())
            add(asset, 'keyboard-keys', {'inset': '1px 1px 2px', 'background': '#88c2d7' if pushed else '#d2ecf2',
                'border': '1px solid #456677', 'border-radius': '3px',
                'box-shadow': 'inset 0 1px 0 #fff, 0 1px 0 #365161'},
                {'content': json.dumps(label, ensure_ascii=False), 'display': 'grid', 'place-items': 'center',
                 'color': '#172833', 'font': 'bold 12px Arial, sans-serif', 'font-style': 'normal'})
        elif group == 74 and re.fullmatch(r'f\d+', name):
            add(asset, 'function-keys', {'inset': '1px 2px', 'background': '#d8ebef',
                'border': '1px solid #51717b', 'border-radius': '3px'},
                {'content': json.dumps(name.upper()), 'display': 'grid', 'place-items': 'center',
                 'font': 'bold 13px Arial, sans-serif', 'color': '#142d36', 'font-style': 'normal'})

    # Basic stock widgets use the source palettes and edge positions.
    for asset, image in images.items():
        group = int(asset.split('/')[2])
        if group not in (72, 75):
            continue
        name = image['Name'].split('\\')[-1].removesuffix('.tga')
        if name.startswith('Mouse'):
            fill = '#fff' if group == 75 else '#bad2dc'
            if name == 'MouseTextBar':
                shape = 'polygon(0 0, 100% 0, 100% 10%, 60% 10%, 60% 90%, 100% 90%, 100% 100%, 0 100%, 0 90%, 40% 90%, 40% 10%, 0 10%)'
            elif name == 'MouseArrow':
                shape = 'polygon(0 0, 90% 65%, 57% 65%, 78% 95%, 62% 100%, 42% 69%, 16% 90%)'
            elif name == 'MouseTarget':
                add(asset, 'mouse-symbols', {**bounds(asset), 'border': f'1px solid {fill}', 'border-radius': '50%'},
                    {'background': f'linear-gradient({fill}, {fill}) center / 8% 100% no-repeat, '
                     f'linear-gradient({fill}, {fill}) center / 100% 8% no-repeat'})
                continue
            else:
                vertical = 'NoSo' in name
                diagonal = 'NeSw' in name or 'NwSe' in name
                shape = 'polygon(0 50%, 28% 0, 28% 40%, 72% 40%, 72% 0, 100% 50%, 72% 100%, 72% 60%, 28% 60%, 28% 100%)'
                transform = 'rotate(90deg)' if vertical else 'rotate(-45deg)' if 'NeSw' in name else 'rotate(45deg)' if diagonal else 'none'
                style = {**bounds(asset), 'background': fill, 'clip-path': shape, 'transform': transform}
                if vertical:
                    width, height = int(image['Width']), int(image['Height'])
                    style.update({'inset': f'{(1 - width / height) * 50:.3f}% {(1 - height / width) * 50:.3f}%'})
                elif diagonal:
                    style.update({'inset': '30% 0'})
                if name == 'MouseMoveCursor':
                    add(asset, 'mouse-symbols', {**style, 'inset': '35% 0'},
                        {**style, 'inset': '35% 0', 'transform': 'rotate(90deg)'})
                else:
                    add(asset, 'mouse-symbols', style)
                continue
            add(asset, 'mouse-symbols', {**bounds(asset), 'background': fill, 'clip-path': shape})
            continue
        if name == 'ClientBrush' or re.fullmatch(r'AltProgressLight\d+', name):
            continue
        fill = '#edf0e7' if group == 75 else '#070c0e'
        edge = '#8c9388' if group == 75 else '#668697'
        if 'Tooltip' in name or name.startswith(('Menu', 'PopupMenu')):
            fill, edge = '#fffbd9', '#7d7651'
        elif 'Titlebar' in name:
            fill, edge = ('linear-gradient(#f4f5eb, #c9d5c1)', '#868d7a') if group == 75 else ('#30434e', '#7693a1')
        elif 'Hover' in name or 'Highlight' in name or 'Selected' in name:
            fill = '#d7ebc4' if group == 75 else '#294553'
        if 'Arrow' in name or re.search(r'(Up|Down|Left|Right)(Normal|Hover)$', name) and ('Scroll' in name or 'Spinner' in name):
            direction = next((direction for direction in ('up', 'down', 'left', 'right') if direction.capitalize() in name), 'down')
            arrow(asset, direction, dominant(asset), dominant(asset))
        elif 'SortUp' in name or 'SortDown' in name:
            arrow(asset, 'up' if 'Up' in name else 'down', edge, edge)
        elif 'CloseButton' in name:
            add(asset, 'close-buttons', {**bounds(asset), 'background': '#f03a37' if group == 75 else fill,
                'border': f'1px solid {edge}', 'border-radius': '3px'},
                {'inset': '25%', 'background': 'linear-gradient(45deg, transparent 43%, #fff 44% 56%, transparent 57%), '
                 'linear-gradient(-45deg, transparent 43%, #fff 44% 56%, transparent 57%)'})
        elif 'RadioButton' in name:
            style = {**bounds(asset), 'background': '#172b37' if group == 72 else '#fff',
                     'border': f'1px solid {edge}', 'border-radius': '50%'}
            if 'Mark' in name:
                style.update(background='#111', border='0')
            add(asset, 'radio-buttons', style)
        elif 'Checkbox' in name:
            if 'Mark' in name:
                add(asset, 'checkbox-marks', {'background': 'transparent'},
                    {'content': '"✓"', 'font': 'bold 13px Arial, sans-serif', 'color': '#111',
                     'display': 'grid', 'place-items': 'center', 'font-style': 'normal'})
            else:
                add(asset, 'checkboxes', {**bounds(asset), 'background': '#fff', 'border': f'1px solid {edge}'})
        elif 'Carat' in name:
            flat(asset, 'carets', dominant(asset), **bounds(asset))
        elif 'Grip' in name:
            vertical = 'Vert' in name
            flat(asset, 'scrollbar-grips', f'repeating-linear-gradient({"0deg" if vertical else "90deg"}, #777 0 1px, transparent 1px 3px)', **bounds(asset))
        elif 'Selection' in name:
            flat(asset, 'selection-fills', dominant(asset))
        elif 'Thumb' in name or name.startswith('VertSlider'):
            style = {**bounds(asset), 'background': 'linear-gradient(#eef5ed, #b7c6b0)' if group == 75 else 'linear-gradient(#a8c8d5, #52717e)',
                     'border': f'1px solid {edge}', 'border-radius': '3px'}
            if any(position in name for position in ('Middle', 'Top', 'Bottom', 'Left', 'Right')):
                position = ''.join(position for position in ('Top', 'Bottom', 'Left', 'Right') if position in name)
                style = slice_style(position, fill, edge, 3)
            add(asset, 'slider-thumbs', style)
        elif 'ComboboxListButton' in name:
            add(asset, 'combobox-buttons', {'background': fill, 'border': f'1px solid {edge}'},
                {'inset': '30%', 'background': edge, 'clip-path': 'polygon(0 0, 100% 0, 50% 100%)'})
        elif 'Segment' in name or name.startswith('AltProgress'):
            flat(asset, 'progress-segments', dominant(asset), **bounds(asset))
        elif 'Divider' in name or 'Splitter' in name or 'Tick' in name or 'Edge' in name:
            flat(asset, 'dividers', dominant(asset), **bounds(asset))
        else:
            position = ''.join(position for position in ('Top', 'Bottom', 'Left', 'Right', 'Upper', 'Lower') if position in name)
            position = position.replace('Upper', 'Top').replace('Lower', 'Bottom')
            add(asset, 'stock-widget-frames', slice_style(position, fill, edge, 3))

    # Store explicit source membership; runtime rendering never classifies by filename.
    grouped = {}
    assets = {}
    recipes = {}
    for asset, drawing in sorted(drawings.items()):
        key = json.dumps(drawing, sort_keys=True)
        if key not in grouped:
            grouped[key] = f'drawing-{len(grouped):03}'
            recipes[grouped[key]] = drawing
        assets[asset] = grouped[key]
    (OUTPUT / 'simple-ui-artwork.json').write_text(json.dumps({'assets': assets}, indent=2) + '\n')
    rules = [':where([data-source-asset]:not(.source-static-image):not(.source-state-button)) {\n  position: relative;\n}']
    for drawing_id, drawing in recipes.items():
        members = [asset for asset, identifier in assets.items() if identifier == drawing_id]
        for pseudo, style in drawing.items():
            selectors = ',\n'.join(f'[data-source-asset="{asset}"]:not(.source-static-image):not(.source-state-button)::{pseudo}'
                                   for asset in members)
            declarations = {'content': "''", 'position': 'absolute', 'inset': '0',
                            'box-sizing': 'border-box', 'pointer-events': 'none', **style}
            rules.append(selectors + ' {\n' + '\n'.join(f'  {key}: {value};' for key, value in declarations.items()) + '\n}')
    (OUTPUT / 'simple-ui-artwork.css').write_text('\n\n'.join(rules) + '\n')
    report = {'rendering': 'HTML/CSS', 'sources': len(assets),
              'families': {name: sorted(set(sources)) for name, sources in sorted(families.items())},
              'originals': 'art/hd-assets/original', 'catalogue': 'apps/web/src/assets/simple-ui-artwork.json'}
    (ART / 'simple-ui-classification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(assets)} simple UI assets in {len(families)} families; {len(recipes)} shared CSS recipes')


if __name__ == '__main__':
    main()
