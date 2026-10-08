"""Publish outline-font styles and source image bounds for ordinary UI lettering."""
import json
from collections import Counter
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'recovery/output/web-assets'
SOURCE = ROOT / 'art/hd-assets/font-sources'
OUTPUT = ROOT / 'apps/web/src/interface/resources/source-text-artwork.json'

LABELS = {
    'gy0': {
        'huofeichuangyidianshu': '花费创意点数', 'huofeidaibi': '花 费 代 币',
        'daibi2': '赠 点', 'jinqian': '金 钱', 'xingbi': '星 币',
        'chuangyidianshu': '创意点', 'daibi': 'Q 点', 'jinengdianshu': '技能点',
        'huofeichuangyi': '花费创意点', 'xianyoujineng': '现有技能点',
        'xianyouchuangyi': '现有创意点', 'huafeijineng': '花费技能点',
        'huafeidaibidian': '花费代币',
    },
    'lobby_ditu20': {
        'huolidengji': '火力 (Lv     )', 'zhuangjiadengji': '装甲 (Lv     )',
        'dituguize2': '地图规则', 'mima': '密 码', 'fangming': '房 名',
        'renshu': '人 数', 'dituguize': '地图规则', 'huafeidaibi2': '花费代币',
        'beimianzhuangjia': '背面装甲', 'cemianzhuangjia': '侧面装甲',
        'lingjiantanwei': '零件栏位', 'huixuansudu': '回旋速度',
        'yidongsudu': '移动速度', 'zhuangdanxiuzheng': '装弹修正',
        'fashejiange': '发射间隔', 'diaobaoshengming': '碉堡生命',
        'qingtanke': '轻坦克', 'shuliandu': '熟练度', 'tujipao': '突击炮',
        'shumingzhi': '生命值', 'zhongtanke': '重坦克', 'zhongtanke2': '中坦克',
        'tankecunliang': '坦克存量', 'fangjian': '人 数', 'naijiudu': '耐久度',
        'meijushijian': '每局时间', 'baifenbi': '% +', 'jineng': '技能',
        'haoyun': '好运', 'sudu': '速度', 'xiongmeng': '凶猛',
        'sec3': '/sec', 'baifenbi2': '%', 'sec2': 'sec', 'km': 'km/h',
        'daos': '～', 'dao_s': '～',
    },
    'mycabin00': {
        'yongyouchenghao3': '拥有称号', 'zhandoutongji3': '战斗统计',
        'huojiangtongji3': '获奖统计', 'zhuangjiadengji': '装 甲 [Lv     ]',
        'huoli': '火 力 [Lv     ]', 'xuanzhuansudu': '回旋速度',
        'shengyutianshu': '剩余天数', 'yidongsudu': '移动速度',
        'fashejiange': '发射间隔', 'cemianzhuangjia': '侧面装甲',
        'beimianzhuangjia': '背面装甲', 'zhuangdanxiuzheng': '炮弹容量',
        'shuliandu': '熟 练 度', 'shengmiangzhi': '生命值', 'jineng': '技 能',
        'xiongmeng': '凶猛', 'haoyun': '好运', 'xiegang_sec': '°/sec',
        'sec': 'sec', 'baifenbijiahao': '% +', 'baifenbi': '%', 'km': 'km/h',
    },
}
DIGIT_SETS = {
    'baiseheitizi0': 'ScoreHT', 'cheapfont0': 'Cheap', 'daheitizi0': 'BigHT',
    'fangjianbianhao0': 'MediumHT', 'hongseheitizi0': 'RedHT',
    'xiaoheitizi0': 'SmallHT',
}
SYMBOLS = {'wuxian': '∞', 'wenxian': '∞', 'maohao': ':', 'x': '×'}


def export_fonts(characters):
    paths = {}
    for face, name in [('sans', 'NotoSansSC'), ('latin', 'Arimo'), ('digits', 'ArchivoBlack')]:
        filename = f'{name}-variable.ttf' if face != 'digits' else 'ArchivoBlack-Regular.ttf'
        font = TTFont(SOURCE / filename)
        if 'fvar' in font:
            font = instantiateVariableFont(font, {'wght': 700}, inplace=True)
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


def style(image, text, family, face, font_path):
    colors = Counter((r, g, b) for r, g, b, a in image.getdata() if a >= 128)
    if family in ('lobby_ditu20', 'mycabin00'):
        brown = [c for c in colors if sum(abs(a - b) for a, b in zip(c, (116, 38, 0))) < 40]
        fill = max(brown, key=colors.get) if brown else (89, 89, 1)
        outline = (255, 200, 137) if (255, 200, 137) in colors else (
            (255, 255, 255) if brown else (237, 255, 218))
        thickness = 2
    else:
        fill = next(c for c, _ in colors.most_common() if sum(c) > 50)
        outline = (0, 0, 0)
        thickness = 4 if family == 'gy0' and image.height > 15 or family == 'cheapfont0' else (
            2 if family in ('daheitizi0', 'xiaoheitizi0') else 0)
    mask = Image.new('L', image.size)
    mask.putdata([a if sum(abs(c - target) for c, target in zip((r, g, b), fill)) < 40 else 0
                  for r, g, b, a in image.getdata()])
    left, top, right, bottom = mask.getbbox()
    reference = ImageFont.truetype(str(font_path), 1000)
    ref_box = reference.getbbox(text, anchor='ls')
    size = (bottom - top) * 1000 / (ref_box[3] - ref_box[1])
    ascent, descent = reference.getmetrics()
    line_height = (ascent + descent) * size / 1000
    scale_x = (right - left) * 1000 / ((ref_box[2] - ref_box[0]) * size)
    return dict(text=text, width=image.width, height=image.height, face=face,
                size=round(size, 4), lineHeight=round(line_height, 4),
                x=round(left - ref_box[0] * size / 1000 * scale_x, 4),
                y=round(top - (ascent + ref_box[1]) * size / 1000, 4),
                scaleX=round(scale_x, 6), colour='#%02x%02x%02x' % fill,
                outline='#%02x%02x%02x' % outline, stroke=thickness)


def main():
    ui = json.loads((RUNTIME / 'ui.json').read_text())
    inventory = json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())
    deferred = {row['source']: row for row in inventory['textures']
                if row.get('deferred') == 'font-rendering'}
    selections = []
    for imageset in ui['imagesets']:
        family = imageset['attributes']['Name']
        for region in imageset['images']:
            if region['asset'] not in deferred:
                continue
            name = Path(region['Name'].replace('\\', '/')).stem
            if family in DIGIT_SETS:
                text = SYMBOLS.get(name, name.upper())
                face = 'digits'
            else:
                text = LABELS[family][name]
                face = 'latin' if text.strip() in ('sec', '/sec', '°/sec', 'km/h', '%', '% +') else 'sans'
            selections.append((family, region, text, face))
    characters = set('0123456789+-=×∞:%/kmhBENS .～—')
    characters.update(''.join(text for _, _, text, _ in selections))
    fonts = export_fonts(characters)
    assets, numeric, source_styles = {}, {}, {}
    for family, region, text, face in selections:
        reference = (family, region['Name'])
        if reference in source_styles:
            assets[region['asset']] = source_styles[reference]
            continue
        with Image.open(ROOT / deferred[region['asset']]['original']) as image:
            image = image.convert('RGBA')
            result = style(image, text, family, face, fonts[face])
            if family == 'fangjianbianhao0':
                result.update(shadow='#555214', shadowX=1, shadowY=1)
            words = text.split()
            if len(words) > 1:
                spans, start = [], None
                alpha = image.getchannel('A')
                for x in range(image.width + 1):
                    occupied = x < image.width and alpha.crop((x, 0, x + 1, image.height)).getbbox()
                    if occupied and start is None:
                        start = x
                    if not occupied and start is not None:
                        spans.append((start, x))
                        start = None
                if len(spans) == len(words):
                    result['runs'] = []
                    for word, (left, right) in zip(words, spans):
                        run_face = face if any(ord(c) > 127 for c in word) else 'latin'
                        run = style(image.crop((left, 0, right, image.height)), word,
                                    family, run_face, fonts[run_face])
                        run['x'] += left
                        result['runs'].append(run)
            assets[region['asset']] = result
            source_styles[reference] = result
        if family in DIGIT_SETS:
            numeric.setdefault(DIGIT_SETS[family], {})[text] = region['asset']
    OUTPUT.write_text(json.dumps(dict(assets=assets, numeric=numeric,
                                     replacedImages=sorted(deferred)), ensure_ascii=False, indent=2) + '\n')
    print(f'Published {len(assets)} text regions, {len(numeric)} numeric styles and three outline fonts')


if __name__ == '__main__':
    main()
