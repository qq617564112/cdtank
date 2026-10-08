"""Prepare shared unlettered button backgrounds and live font labels."""
from collections import defaultdict
import json
from pathlib import Path
import re

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'
OUTPUT = ROOT / 'apps/web/src/assets'

LABELS = {
    59: {'jixuanniu': '继续'},
    60: {'btnback': '回上页', 'xtsz': '系统设定', 'jxsm': '教学说明',
         'haoyou_wanjia': '玩家', 'haoyou_haoyou': '好友', 'haoyou_haoyoua': '好友'},
    64: {'jiarugoudui': '加入狗队', 'jiarumaodui': '加入猫队', 'chuangyidianshu': '创意点',
         'jinengdianshu': '技能点', 'jinqiananniu': '金钱', 'kaixinfangjian': '开新房间',
         'kuaisujinru': '快速进入', 'bianhaopaixu': '编号排序', 'kongfangjian': '空房间',
         'fenshupaihang': '分数排行', 'guangjiegouwuanniu': '商店', 'myhomeanniu': '玩家信息',
         'jiejianniu': '阶级', 'qinmianniu': '亲密', 'xingbieanniu': '性别'},
    65: {'pohuaimoshi': '破坏模式', 'hunzhanmoshi': '混战模式', 'zhanlingmoshi': '占领模式',
         'qinwangmoshi': '擒王模式', 'tuanduimoshi': '团队模式', 'maogouyouhao': '猫狗混编',
         'maogouduikang': '猫狗对抗', 'duiyoushanghai': '敌我不分', 'yizhiduiwai': '不伤友军',
         'xiugainicheng': '修改昵称'},
    66: {'zhunebianniu': '准备', 'quxiaoanniu': '取消', 'baocunxiugai': '保存修改',
         'jiahaoyou': '加好友', 'zhunbei': '准备', 'jiaoyi': '交易', 'kuaisuyaoqing': '快速邀请',
         'pingbi': '屏蔽', 'queding': '确定', 'quxiao': '取消', 'shanhaoyou': '删好友',
         'xiugaijieshao': '修改介绍', 'xuexi': '学习', 'yaoqinganniu': '邀请', 'yaoqing': '邀请',
         'yunxu': '允许', 'zhanshi': '展示'},
    69: {'chushou': '出售', 'chuji': '出击！', 'goumai': '购买', 'genghuan': '更换',
         'weixiuzhongxin': '维修中心', 'zhuangbeilingjian': '装备零件', 'guanyuwo': '关于我',
         'guizhongpin': '贵重品', 'huoli': '火力  [LV ]', 'jinenganniu': 'LV', 'zhuangjia': '装甲  [LV ]',
         'huantietu': '换涂装', 'maitanke': '买坦克', 'selltanke': '卖坦克', 'goumaimaogou': '买猫狗',
         'chushoumaogou': '卖猫狗', 'daoju': '辅助', 'gaizhuang': '改装', 'lingjian': '零件',
         'maozi': '饰品', 'biaozhi': '标志', 'maogou': '猫狗', 'tanke': '坦克', 'yiban': '一般',
         'wuqi': '武器', 'yongyouchenghao': '拥有称号', 'zhandoutongji': '战斗统计', 'huojiangtongji': '获奖统计',
         'mingming': '命名', 'zidan': '弹药', 'xiaowuqi': '武器', 'xiaobiaozhi': '标志', 'xiaoyiban': '一般',
         'xiaodaoju': '辅助', 'xiaoguizhongpin': '贵重品', 'xiaomaozi': '饰品'},
    74: {'likaiyouxi': '离开游戏', 'denglu': '登录', 'baocunmima': '保存账号', 'xitongshezhi': '系统设置',
         'goumaidaibi': '取得Q点', 'goumaixindian': '取得星币', 'yushezhi': '预设值', 'zhuce': '注册',
         'chongzhi': '主页', 'katongxuanran': '卡通渲染', 'tongzhitongbu': '垂直同步',
         'ruanjianguangbiao': '软件光标', 'zhandoubiaoqing': '战斗表情', '32weise': '32位色',
         '16weise': '16位色', 'gaohuazhi': '高画质', 'dihuazhi': '低画质', 'quanping': '全屏', 'chuangkou': '窗口'},
}
CHANNELS = {'jiazu': '家族', 'liaotian': '聊天', 'miyu': '密语', 'haoyou': '好友', 'duiwu': '队伍', 'gm': 'GM'}
BASES = {
    'small': '66/10', 'invite': '66/21', 'wide': '66/1', 'round': '66/59',
    'enamel': '69/34', 'board': '69/35', 'hanging': '60/20', 'banner': '74/47',
    'dog-team': '64/2', 'cat-team': '64/6',
    'mode-pohuaimoshi': '65/5', 'mode-hunzhanmoshi': '65/1', 'mode-tuanduimoshi': '65/10',
    'mode-zhanlingmoshi': '65/13', 'mode-qinwangmoshi': '65/7',
    'rule-maogouyouhao': '65/28', 'rule-maogouduikang': '65/22',
    'rule-duiyoushanghai': '65/18', 'rule-yizhiduiwai': '65/30',
}
FILTERS = {'gold': 'none', 'blue': 'hue-rotate(165deg) saturate(1.1)',
           'cyan': 'hue-rotate(125deg) saturate(.9)', 'green': 'hue-rotate(55deg)',
           'orange': 'hue-rotate(-25deg) saturate(1.15)', 'pink': 'hue-rotate(285deg) saturate(1.25)',
           'purple': 'hue-rotate(210deg) saturate(1.25)', 'grey': 'grayscale(1) brightness(.8)'}


def main():
    ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
    images = {i['asset']: i for sheet in ui['imagesets'] for i in sheet['images']
              if i.get('asset', '').startswith('ui/regions/')}
    assets, used = {}, set()
    for asset, image in images.items():
        group = int(asset.split('/')[2])
        name = image['Name'].split('\\')[-1].removesuffix('.tga')
        stem, label = None, None
        for key in sorted(LABELS.get(group, {}), key=len, reverse=True):
            if re.fullmatch(re.escape(key) + r'(?:_?\d+)?f?', name):
                stem, label = key, LABELS[group][key]
                break
        channel = re.fullmatch(r'(?:liantian_)?(jiazu|liaotian|miyu|haoyou|duiwu|gm)\d', name)
        if channel and group in (44, 60, 65, 77):
            stem, label = channel[1], CHANNELS[channel[1]]
        if label is None:
            continue
        suffix = re.search(r'(\d)(?:f)?$', name)
        state = int(suffix[1]) if suffix else 0
        background, body, colour = None, 'pill', 'gold'
        plain = bool(channel and not name.startswith('liantian_'))
        if group == 66 or group in (65, 69) and stem in ('xiugainicheng', 'gaizhuang') or group == 74 and stem in ('yushezhi', 'zhuce'):
            background = 'wide' if stem in ('zhunebianniu', 'quxiaoanniu') else \
                'round' if stem == 'yaoqinganniu' else 'invite' if stem == 'kuaisuyaoqing' else 'small'
            colour = {1: 'gold', 2: 'blue', 3: 'orange', 4: 'grey', 0: 'blue'}.get(state, 'gold')
            if background in ('wide', 'round'):
                colour = {1: 'gold', 2: 'purple', 3: 'pink', 4: 'grey'}.get(state, 'gold')
        elif group == 69 and stem in ('chushou', 'chuji', 'goumai', 'genghuan', 'huoli', 'jinenganniu', 'zhuangjia'):
            body = 'rectangle'
            colour = {1: 'gold', 2: 'pink', 3: 'blue'}.get(state, 'gold')
        elif group == 69 and stem.startswith('xiao') or group == 69 and stem in ('yongyouchenghao', 'zhandoutongji', 'huojiangtongji', 'zidan'):
            body = 'rectangle'
            colour = {1: 'gold', 2: 'cyan', 3: 'purple'}.get(state, 'gold')
        elif group == 69:
            background = 'board' if state == 3 or stem in ('daoju',) and state in (22, 33) else 'enamel'
            if stem == 'daoju' and name in ('daoju22', 'daoju33', 'daoju11'):
                label = '道具'
                background = 'board' if name == 'daoju33' else 'enamel'
            colour = 'gold' if state == 1 else 'green'
            if background == 'board':
                colour = 'gold'
        elif group == 65 and stem.endswith('moshi'):
            background = 'board' if state == 3 else 'mode-' + stem
            colour = 'green' if state == 2 else 'gold'
        elif group == 65 and stem in ('maogouyouhao', 'maogouduikang', 'duiyoushanghai', 'yizhiduiwai'):
            background = 'rule-' + stem
            colour = {1: 'gold', 2: 'blue', 3: 'orange', 4: 'grey'}[state]
        elif group == 60 and stem in ('xtsz', 'jxsm'):
            background = 'hanging'
            colour = {0: 'gold', 1: 'gold', 2: 'cyan'}.get(state, 'gold')
        elif group == 74 and stem in ('xitongshezhi', 'goumaidaibi', 'chongzhi'):
            background = 'banner'
            colour = {1: 'gold', 2: 'blue', 3: 'gold'}.get(state, 'gold')
        elif group == 74 and stem == 'goumaixindian':
            plain = True
        elif group == 74 and stem in ('likaiyouxi', 'denglu'):
            body = 'pill'
            colour = {1: 'gold', 2: 'orange', 3: 'blue'}[state]
        elif group == 74:
            body = 'option'
            colour = 'orange'
        elif group == 64 and stem in ('jiarugoudui', 'jiarumaodui'):
            body = 'rectangle'
            colour = {1: 'gold', 2: 'pink' if stem == 'jiarugoudui' else 'green', 3: 'grey', 4: 'grey'}[state]
            if state == 3:
                background = 'dog-team' if stem == 'jiarugoudui' else 'cat-team'
        elif group == 64:
            body = 'rectangle' if stem in ('chuangyidianshu', 'jinengdianshu', 'jinqiananniu') else 'pill'
            colour = {1: 'gold', 2: 'purple' if body == 'pill' else 'cyan', 3: 'orange' if body == 'pill' else 'pink'}.get(state, 'gold')
        elif group in (59, 60):
            body = 'rectangle' if stem == 'btnback' or group == 59 else 'pill'
            colour = {0: 'blue', 1: 'gold', 2: 'orange', 3: 'blue'}.get(state, 'gold')
        elif channel:
            colour = {0: 'orange', 1: 'gold', 2: 'orange', 3: 'cyan'}.get(state, 'gold')
        width, height = int(image['Width']), int(image['Height'])
        units = sum(.6 if ord(character) < 128 else 1 for character in label)
        size = min(22, height * .48, width * .76 / max(1, units))
        if channel or body == 'option':
            size = min(size, 12)
        if background in ('board', 'enamel'):
            size = min(size, 18)
        ink = '#fff' if background in ('small', 'invite', 'hanging') or colour in ('pink', 'purple') else '#111'
        if background == 'board':
            ink = '#ffed48'
        text = {'text': label, 'width': width, 'height': height, 'face': 'brush', 'size': round(size, 3),
                'lineHeight': round(size * 1.2, 3), 'x': round((width - units * size) / 2, 3),
                'y': round(height * .44 - size * .6, 3), 'scaleX': 1, 'colour': ink,
                'outline': '#d51f16' if background == 'board' else '#111' if ink == '#fff' else '#fff4b0',
                'stroke': 1.5 if background else .6}
        if background == 'hanging':
            text['y'] = round(height * .63 - size * .6, 3)
        if body == 'option':
            text['x'], text['y'] = round(width * .2, 3), round((height - size * 1.2) / 2, 3)
        assets[asset] = {'background': f'/hd-ui/buttons/{background}.png' if background else None,
                         'family': background or ('text' if plain else body),
                         'filter': FILTERS[colour], 'text': text}
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
                     'background-size': '100% 100%', 'background-repeat': 'no-repeat', 'filter': entry['filter']}
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
            style = {'inset': '8% 3% 16%', 'background': 'linear-gradient(#fff4ba 0 12%, #ffc934 35%, #ffad13 80%)',
                     'border': '1px solid #12142b', 'border-radius': '3px' if entry['family'] == 'rectangle' else '45% / 35%',
                     'box-shadow': 'inset 0 1px 0 #fff, 0 2px 0 #36303c'}
            # Colour belongs to the body layer, independent of the live label.
            style['filter'] = entry['filter']
        base = {'content': "''", 'position': 'absolute', 'inset': '0', 'box-sizing': 'border-box', 'pointer-events': 'none', **style}
        rules.append(selector + '::before {\n' + '\n'.join(f'  {key}: {value};' for key, value in base.items()) + '\n}')
        text = entry['text']
        # Direct picture consumers use the same font caption as React controls.
        after = {'content': json.dumps(text['text'], ensure_ascii=False), 'position': 'absolute', 'inset': '0',
                 'display': 'grid', 'place-items': 'center', 'font-family': "'CDTank-Xiangjiao', sans-serif",
                 'font-size': f"{text['size']}px", 'font-style': 'normal', 'font-weight': '700',
                 'color': text['colour'], '-webkit-text-stroke': f"{text['stroke']}px {text['outline']}",
                 'paint-order': 'stroke fill', 'pointer-events': 'none'}
        if entry['family'] == 'option':
            after.update({'place-items': 'center start', 'padding-left': '20%'})
        rules.append(selector + ':not([data-source-button-label="external"]):not(:has(> .source-text-artwork))::after {\n' +
                     '\n'.join(f'  {key}: {value};' for key, value in after.items()) + '\n}')
    (OUTPUT / 'button-artwork.css').write_text('\n\n'.join(rules) + '\n')
    (ART / 'button-text-classification.json').write_text(json.dumps({'sources': len(assets), 'backgrounds': sorted(used),
        'rendering': 'unlettered shared backgrounds, CSS colour filters and live HTML fonts'}, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(assets)} live button labels; {len(used)} shared backgrounds in {len(jobs)} image requests')


if __name__ == '__main__':
    main()
