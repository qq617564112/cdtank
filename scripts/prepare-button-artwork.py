"""Prepare shared unlettered button backgrounds and live font labels."""
import json
from pathlib import Path
import re

from PIL import Image, ImageDraw
import cv2
import numpy as np
from source_ui_metrics import manual_catalogue, manual_style, polygon

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'
OUTPUT = ROOT / 'apps/web/src/assets'

STEMS = {
    59: ('jixuanniu',),
    60: ('btnback', 'xtsz', 'jxsm', 'haoyou_wanjia', 'haoyou_haoyou', 'haoyou_haoyoua',),
    64: ('jiarugoudui', 'jiarumaodui', 'chuangyidianshu', 'jinengdianshu', 'jinqiananniu', 'kaixinfangjian',
         'kuaisujinru', 'bianhaopaixu', 'kongfangjian', 'fenshupaihang', 'guangjiegouwuanniu', 'myhomeanniu',
         'jiejianniu', 'qinmianniu', 'xingbieanniu',),
    65: ('pohuaimoshi', 'hunzhanmoshi', 'zhanlingmoshi', 'qinwangmoshi', 'tuanduimoshi', 'maogouyouhao',
         'maogouduikang', 'duiyoushanghai', 'yizhiduiwai', 'xiugainicheng',),
    66: ('zhunebianniu', 'quxiaoanniu', 'baocunxiugai', 'jiahaoyou', 'zhunbei', 'jiaoyi', 'kuaisuyaoqing',
         'pingbi', 'queding', 'quxiao', 'shanhaoyou', 'xiugaijieshao', 'xuexi', 'yaoqinganniu', 'yaoqing',
         'yunxu', 'zhanshi',),
    69: ('chushou', 'chuji', 'goumai', 'genghuan', 'weixiuzhongxin', 'zhuangbeilingjian', 'guanyuwo',
         'guizhongpin', 'huoli', 'jinenganniu', 'zhuangjia', 'huantietu', 'maitanke', 'selltanke',
         'goumaimaogou', 'chushoumaogou', 'daoju', 'gaizhuang', 'lingjian', 'maozi', 'biaozhi', 'maogou',
         'tanke', 'yiban', 'wuqi', 'yongyouchenghao', 'zhandoutongji', 'huojiangtongji', 'mingming', 'zidan',
         'xiaowuqi', 'xiaobiaozhi', 'xiaoyiban', 'xiaodaoju', 'xiaoguizhongpin', 'xiaomaozi',),
    74: ('likaiyouxi', 'denglu', 'baocunmima', 'xitongshezhi', 'goumaidaibi', 'goumaixindian', 'yushezhi',
         'zhuce', 'chongzhi', 'katongxuanran', 'tongzhitongbu', 'ruanjianguangbiao', 'zhandoubiaoqing',
         '32weise', '16weise', 'gaohuazhi', 'dihuazhi', 'quanping', 'chuangkou',),
}
BASES = {
    'small': '66/10', 'invite': '66/21', 'wide': '66/1', 'round': '66/59',
    'enamel': '69/34', 'board': '69/35', 'hanging': '60/20', 'banner': '74/47',
    'dog-team': '64/2', 'cat-team': '64/6',
    'mode-pohuaimoshi': '65/5', 'mode-hunzhanmoshi': '65/1', 'mode-tuanduimoshi': '65/10',
    'mode-zhanlingmoshi': '65/13', 'mode-qinwangmoshi': '65/7',
    'rule-maogouyouhao': '65/28', 'rule-maogouduikang': '65/22',
    'rule-duiyoushanghai': '65/18', 'rule-yizhiduiwai': '65/30',
}


def body_colour(image):
    rgba = np.asarray(image)
    rgb = rgba[:, :, :3]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    mask = (rgba[:, :, 3] > 128) & (hsv[:, :, 1] > 70) & (hsv[:, :, 2] > 70)
    pixels = rgb[mask]
    if not len(pixels):
        pixels = rgb[(rgba[:, :, 3] > 128) & (hsv[:, :, 2] > 50)]
    bins = (pixels // 32).astype(int)
    values, counts = np.unique(bins, axis=0, return_counts=True)
    chosen = values[counts.argmax()]
    return np.median(pixels[np.all(bins == chosen, axis=1)], axis=0)


def colour_filter(base, target):
    # Fit the CSS colour operations to the source button's measured surface.
    luminance = np.array([.213, .715, .072])
    grey = np.tile(luminance, (3, 1))
    cosine = np.eye(3) - grey
    sine = np.array([[-.213, -.715, .928], [.143, .140, -.283], [-.787, .715, .072]])
    rotations = np.arange(-180, 181)
    matrices = grey + np.cos(np.deg2rad(rotations))[:, None, None] * cosine + np.sin(np.deg2rad(rotations))[:, None, None] * sine
    rotated = matrices @ base
    best = None
    for saturation in np.arange(0, 2.51, .025):
        saturated = (grey @ rotated.T).T + saturation * (rotated - (grey @ rotated.T).T)
        brightness = np.clip((saturated * target).sum(axis=1) / np.maximum((saturated ** 2).sum(axis=1), 1), .25, 2)
        error = ((np.clip(saturated * brightness[:, None], 0, 255) - target) ** 2).sum(axis=1)
        index = error.argmin()
        candidate = (error[index], rotations[index], saturation, brightness[index])
        if best is None or candidate[0] < best[0]:
            best = candidate
    _, rotation, saturation, brightness = best
    return f'hue-rotate({rotation}deg) saturate({saturation:.3f}) brightness({brightness:.5f})'



def main():
    ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
    images = {i['asset']: i for sheet in ui['imagesets'] for i in sheet['images']
              if i.get('asset', '').startswith('ui/regions/')}
    standalone = json.loads((ROOT / 'apps/web/src/interface/resources/source-text-artwork.json').read_text())['assets']
    reviewed = manual_catalogue()
    assets, used = {}, set()
    for asset, image in images.items():
        if asset in standalone:
            continue
        manual = reviewed['assets'].get(asset)
        if manual is None:
            continue
        group = int(asset.split('/')[2])
        name = image['Name'].split('\\')[-1].removesuffix('.tga')
        stem = None
        for key in sorted(STEMS.get(group, ()), key=len, reverse=True):
            if re.fullmatch(re.escape(key) + r'(?:_?\d+)?f?', name):
                stem = key
                break
        channel = re.fullmatch(r'(?:liantian_)?(jiazu|liaotian|miyu|haoyou|duiwu|gm)\d', name)
        if channel and group in (44, 60, 65, 77):
            stem = channel[1]
        stem = stem or name
        suffix = re.search(r'(\d)(?:f)?$', name)
        state = int(suffix[1]) if suffix else 0
        background, body = None, 'pill'
        plain = manual.get('plain', False)
        if group == 66 or group in (65, 69) and stem in ('xiugainicheng', 'gaizhuang') or group == 74 and stem in ('yushezhi', 'zhuce'):
            background = 'wide' if stem in ('zhunebianniu', 'quxiaoanniu') else \
                'round' if stem == 'yaoqinganniu' else 'invite' if stem == 'kuaisuyaoqing' else 'small'
        elif group == 69 and stem in ('chushou', 'chuji', 'goumai', 'genghuan', 'huoli', 'jinenganniu', 'zhuangjia'):
            body = 'rectangle'
        elif group == 69 and stem.startswith('xiao') or group == 69 and stem in ('yongyouchenghao', 'zhandoutongji', 'huojiangtongji', 'zidan'):
            body = 'rectangle'
        elif group == 69:
            background = 'board' if state == 3 or stem in ('daoju',) and state in (22, 33) else 'enamel'
            if stem == 'daoju' and name in ('daoju22', 'daoju33', 'daoju11'):
                background = 'board' if name == 'daoju33' else 'enamel'
        elif group == 65 and stem.endswith('moshi'):
            background = 'board' if state == 3 else 'mode-' + stem
        elif group == 65 and stem in ('maogouyouhao', 'maogouduikang', 'duiyoushanghai', 'yizhiduiwai'):
            background = 'rule-' + stem
        elif group == 60 and stem in ('xtsz', 'jxsm'):
            background = 'hanging'
        elif group == 74 and stem in ('xitongshezhi', 'goumaidaibi', 'chongzhi'):
            background = 'banner'
        elif group == 74 and stem == 'goumaixindian':
            plain = True
        elif group == 74 and stem in ('likaiyouxi', 'denglu'):
            body = 'pill'
        elif group == 74:
            body = 'option'
        elif group == 64 and stem in ('jiarugoudui', 'jiarumaodui'):
            body = 'rectangle'
            if state == 3:
                background = 'dog-team' if stem == 'jiarugoudui' else 'cat-team'
        elif group == 64:
            body = 'rectangle' if stem in ('chuangyidianshu', 'jinengdianshu', 'jinqiananniu') else 'pill'
        elif group in (59, 60):
            body = 'rectangle' if stem == 'btnback' or group == 59 else 'pill'
        if plain:
            background = None
        with Image.open(ROOT / 'art/hd-assets/original' / asset) as original:
            original = original.convert('RGBA')
        family = background or ('text' if plain else body)
        text = manual_style(original, manual)
        body_bounds = manual.get('bodyBounds', original.getchannel('A').getbbox())
        left, top, right, bottom = body_bounds
        geometry = {'inset': f'{top / original.height * 100:.6f}% {(original.width - right) / original.width * 100:.6f}% '
                    f'{(original.height - bottom) / original.height * 100:.6f}% {left / original.width * 100:.6f}%'}
        if manual.get('bodyClip'):
            geometry['clip-path'] = manual['bodyClip']
        elif background in ('small', 'invite') or not background and not plain and family != 'option':
            mask = np.asarray(original.crop(tuple(body_bounds)).getchannel('A')) > 128
            geometry['clip-path'] = polygon(mask)
        if background:
            with Image.open(ART / 'button-backgrounds' / f'{background}.png') as shared:
                shared = shared.convert('RGBA')
                target = np.array(tuple(bytes.fromhex(manual['bodyColour'].lstrip('#')))) if manual.get('bodyColour') else body_colour(original)
                filter_value = colour_filter(body_colour(shared), target)
                left, top, right, bottom = shared.getchannel('A').getbbox()
                geometry.update({'background-size': f'{shared.width / (right - left) * 100:.6f}% {shared.height / (bottom - top) * 100:.6f}%',
                                 'background-position': f'{left / max(1, shared.width - (right - left)) * 100:.6f}% {top / max(1, shared.height - (bottom - top)) * 100:.6f}%'})
        else:
            filter_value = 'none'
        surface_colour = manual.get('bodyColour') or ('#000000' if plain else
                         '#%02x%02x%02x' % tuple(body_colour(original).astype(int)))
        assets[asset] = {'background': f'/hd-ui/buttons/{background}.png' if background else None,
                         'family': family, 'filter': filter_value, 'text': text,
                         'bodyColour': surface_colour,
                         'bodyStyle': manual.get('bodyStyle', {}),
                         'geometry': geometry}
        if body == 'option':
            assets[asset]['checked'] = state == 1
            assets[asset]['optionKind'] = 'checkbox' if stem in (
                'baocunmima', 'katongxuanran', 'tongzhitongbu', 'ruanjianguangbiao', 'zhandoubiaoqing') else 'radio'
        if background:
            used.add(background)

    # One source image per shape; each state shares its unlettered background.
    jobs = []
    base_rows = [(name, 'ui/regions/' + BASES[name] + '.png') for name in sorted(used)]
    for start in range(0, len(base_rows), 2):
        selected = base_rows[start:start + 2]
        identifier = f'blank-buttons-{start // 2:02}'
        folder = ART / 'jobs' / identifier
        folder.mkdir(parents=True, exist_ok=True)
        canvas = Image.new('RGB', (1024, 768), '#ff00ff')
        draw = ImageDraw.Draw(canvas)
        cells, descriptions = [], []
        for index, (name, source) in enumerate(selected):
            x, y, w, h = 40 + index * 504, 40, 440, 688
            draw.rectangle((x, y, x + w - 1, y + h - 1), outline=(32, 144, 255), width=6)
            reference = ART / 'sunburst-ui-candidates' / source if name in ('invite', 'board') else ROOT / 'art/hd-assets/original' / source
            with Image.open(reference) as image:
                original = image.convert('RGBA')
            factor = min((w - 80) / original.width, (h - 100) / original.height)
            original = original.resize((round(original.width * factor), round(original.height * factor)), Image.Resampling.LANCZOS)
            left, top = x + (w - original.width) // 2, y + (h - original.height) // 2
            canvas.paste(original, (left, top), original)
            cells.append({'source': source, 'size': [int(images[source]['Width']), int(images[source]['Height'])],
                          'box': [left, top, left + original.width, top + original.height],
                          'frame': [x, y, x + w, y + h], 'slot': [x + 6, y + 6, x + w - 6, y + h - 6],
                          'buttonBackground': name})
            descriptions.append(f'第{index + 1}格为{name}，蓝框外沿{x},{y},{x+w},{y+h}。')
        if not (folder / 'input.png').exists():
            canvas.save(folder / 'input.png')
        prompt = ('将参考里的游戏按钮重绘为高清无字底图，原有全部汉字、拉丁字母、数字及标点必须完全移除，'
                  '将字原来遮挡的区域补成连续干净的按钮牌面，不保留文字轮廓、阴影、凹痕、符号或假字。'
                  '精确保留原按钮的外轮廓、厚度、原始配色、白色反光、边缘描线、底部阴影和非文字插画。'
                  '吊牌保留吊绳，木牌保留木框，猫狗坦克插画保留，文字区留空。'
                  '不设计新按钮，不加边框或图标。按输入同样的格数及位置输出，每格仅一个对应按钮。'
                  '两格共用同一放大比例，保留每格素材的比例、尺寸和留白。'
                  '蓝色RGB(32,144,255)定位框必须保持数量、位置、颜色、粗细和四条闭合边。'
                  '框外及按钮透明区域保持纯洋红RGB(255,0,255)，不要棋盘格或灰色背景。'
                  '只输出无文字的高清按钮素材拼图。\n' + '\n'.join(descriptions))
        (folder / 'prompt.txt').write_text(prompt + '\n')
        jobs.append({'id': identifier, 'source': selected[0][1], 'sources': [source for _, source in selected],
                     'folder': folder.relative_to(ROOT).as_posix(), 'framed': True, 'cells': cells,
                     'canvas': [1024, 768], 'frameColor': [32, 144, 255], 'gap': 64,
                     'subject': '无字按钮底图', 'unlettered': True, 'prompt': prompt})
    (ART / 'blank-button-jobs.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    (OUTPUT / 'button-artwork.json').write_text(json.dumps({'assets': assets}, ensure_ascii=False, indent=2) + '\n')
    rules = []
    for asset, entry in assets.items():
        selector = f'[data-source-asset="{asset}"]:not(.source-static-image):not(.source-state-button)'
        if entry['background']:
            name = Path(entry['background']).stem
            style = {'background-image': f"var(--source-button-{name}, url('{entry['background']}'))",
                     'background-size': '100% 100%', 'background-repeat': 'no-repeat', 'filter': entry['filter'], **entry['geometry']}
        elif entry['family'] == 'text':
            style = {'background': 'transparent'}
        elif entry['family'] == 'option':
            width, height = entry['text']['width'], entry['text']['height']
            diameter = height * .78
            marker = f'{diameter / width * 100:.3f}% 78%'
            position = f'{height * .06 / (width - diameter) * 100:.3f}% 50%'
            saved_account = images[asset]['Name'].split('\\')[-1].startswith('baocunmima')
            radio = entry['optionKind'] == 'radio'
            checked = entry['checked']
            face = '#ffe940' if checked or saved_account else '#902318'
            circle = f'radial-gradient(circle, {face} 0 45%, #b27528 53%, #4e211b 62%, transparent 68%)'
            layers, sizes, positions = [circle], [marker], [position]
            if checked and not radio:
                ink = '#174cc4' if saved_account else '#ffe82c'
                layers[:0] = [f'linear-gradient(55deg, transparent 34%, {ink} 36% 64%, transparent 66%)',
                              f'linear-gradient(115deg, transparent 37%, {ink} 39% 59%, transparent 61%)']
                sizes[:0] = [f'{height * .27 / width * 100:.3f}% 40%',
                             f'{height * .45 / width * 100:.3f}% 72%']
                positions[:0] = [f'{height * .15 / (width - height * .27) * 100:.3f}% 68%',
                                 f'{height * .3 / (width - height * .45) * 100:.3f}% 42%']
            style = {'background-image': ', '.join(layers), 'background-size': ', '.join(sizes),
                     'background-position': ', '.join(positions), 'background-repeat': 'no-repeat',
                     'background-color': 'transparent' if saved_account else '#f78d74'}
        else:
            style = {**entry['geometry'], 'background': f"linear-gradient(color-mix(in srgb, {entry['bodyColour']} 65%, white) 0 12%, {entry['bodyColour']} 35% 65%, color-mix(in srgb, {entry['bodyColour']} 75%, black) 80%)",
                     'border': '1px solid #12142b', 'border-radius': '3px' if entry['family'] == 'rectangle' else '24% / 40%',
                     'box-shadow': 'inset 0 1px 0 #fff, 0 2px 0 #36303c'}
            # Colour belongs to the body layer, independent of the live label.
            style.update(entry['bodyStyle'])
        base = {'content': "''", 'position': 'absolute', 'inset': '0', 'box-sizing': 'border-box', 'pointer-events': 'none', **style}
        rules.append(selector + '::before {\n' + '\n'.join(f'  {key}: {value};' for key, value in base.items()) + '\n}')
        text = entry['text']
        # Direct picture consumers use the same font caption as React controls.
        rules.append(selector + ' {\n  container-type: size;\n  overflow: hidden;\n}')
        face = {'brush': 'CDTank-Xiangjiao', 'sans': 'CDTank-SourceSans', 'latin': 'CDTank-SourceLatin',
                'digits': 'CDTank-SourceDigits', 'serif': 'CDTank-SourceSerif'}[text['face']]
        after = {'content': json.dumps(text['text'], ensure_ascii=False), 'position': 'absolute',
                 'left': f"{text['x'] / text['width'] * 100:.6f}%", 'top': f"{text['y'] / text['height'] * 100:.6f}%",
                 'width': 'max-content', 'white-space': 'pre', 'transform-origin': 'left top',
                 'transform': f"scaleX({text['scaleX']})", 'font-family': f"'{face}', sans-serif",
                 'font-size': f"{text['size'] / text['width'] * 100:.6f}cqw", 'line-height': f"{text['lineHeight'] / text['width'] * 100:.6f}cqw",
                 'font-style': 'normal', 'font-weight': '700', 'letter-spacing': '0', 'text-transform': 'none',
                 'color': text['colour'], '-webkit-text-stroke': f"{text['stroke'] / text['width'] * 100:.6f}cqw {text['outline']}",
                 'paint-order': 'stroke fill', 'pointer-events': 'none'}
        rules.append(selector + ':not([data-source-button-label="external"]):not(:has(> .source-text-artwork))::after {\n' +
                     '\n'.join(f'  {key}: {value};' for key, value in after.items()) + '\n}')
    (OUTPUT / 'button-artwork.css').write_text('\n\n'.join(rules) + '\n')
    (ART / 'button-text-classification.json').write_text(json.dumps({'sources': len(assets), 'backgrounds': sorted(used),
        'rendering': 'unlettered shared backgrounds, CSS colour filters and live HTML fonts'}, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(assets)} live button labels; {len(used)} shared backgrounds in {len(jobs)} image requests')


if __name__ == '__main__':
    main()
