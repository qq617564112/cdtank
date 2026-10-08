"""Prepare subject-specific image API jobs from the visual UI artwork audit."""
from collections import defaultdict
import json
from pathlib import Path
from ui_artwork_scope import html_ui_sources

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'


def main():
    issues = {}
    for name in ('first', 'second'):
        for issue in json.loads((ART / f'audit-{name}.json').read_text())['issues']:
            issues[issue['source']] = issue
    additional = [
        ('ui/regions/60/47.png', '深蓝色卡通输入框', '原来的深蓝色平整输入框变成了带裂纹的边框。',
         '这是二维卡通游戏里的深蓝色输入框。保持原本平整的蓝色牌面、细暗边与原轮廓进行高清化，不增加黑色裂缝、花纹或新的金属边框。'),
        ('ui/regions/68/15.png', '卡通风格化棕色木牌输入框', '木牌中间和边缘新增黑色线条，牌面轮廓改变。',
         '这是卡通风格化的棕色木牌输入框，保持原始风格进行高清化。保留平整棕色牌面、简洁的木边与原来的两端轮廓，不增加嵌套边框、裂纹或牌面上的线条。'),
        ('ui/regions/44/16.png', '浅米色卡通纸条输入框', '纸条两端轮廓偏离原图。',
         '这是浅米色卡通纸条输入框，保持原始美术风格高清重绘。完整保留原图两端小尖角、细浅色轮廓和干净平整的浅米色牌面，不增加阴影遮罩或改变轮廓。'),
        ('ui/regions/77/16.png', '浅米色卡通纸条输入框', '牌面发白，下部出现厚重灰色遮罩。',
         '这是浅米色卡通纸条输入框，保持原始美术风格高清重绘。保留原来的浅米色牌面、细浅色边线和两端轮廓，清除灰色遮罩，不增加投影、光晕或厚边。'),
    ]
    for source, subject, reason, prompt in additional:
        issues[source] = dict(source=source, subject=subject, reason=reason, prompt=prompt)
    buttons = html_ui_sources()
    issues = {source: issue for source, issue in issues.items() if source not in buttons}
    inventory = {entry['source']: entry for entry in
                 json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())['textures']}
    categories = defaultdict(list)
    for source, issue in sorted(issues.items()):
        if source in ('ui/regions/74/41.png', 'ui/regions/74/42.png'):
            continue
        if source.startswith('ui/regions/56/'):
            continue
        subject = issue['subject']
        family = source.split('/')[2] if source.startswith('ui/regions/') else str(Path(source).parent)
        kind = '聊天表情' if '表情' in subject else subject
        categories[(family, kind)].append(issue)
    jobs = []
    for (_, kind), members in categories.items():
        extent = max(max(inventory[issue['source']]['size']) for issue in members)
        count = 4
        if extent > 300 or '输入框' in kind:
            count = 1
        for start in range(0, len(members), count):
            group = members[start:start + count]
            descriptions = '\n'.join(f"第{index + 1}格：{issue['prompt']}"
                                     for index, issue in enumerate(group))
            prompt = f'''这是复古二维卡通游戏的原始低分辨率美术参考，包含{len(group)}个独立的{kind}素材。请根据素材的具体含义和原始风格重新绘制为高清图片，恢复采样前的干净连续轮廓，不能复制大像素块，也不能模糊放大。
{descriptions}
各格从左到右、从上到下排列。严格保持每一格的原主体、表情、字形、颜色、轮廓、尺寸比例、位置和留白；每个格子独立处理，不借用其他格子的图案，不改变格子数或排列，不把参考拼图画成新的界面。所有原汉字、拉丁字母、数字和符号都必须逐字正确。
纯洋红色RGB255,0,255的背景是用于切图的透明区，保持它纯洋红色，不画入内容，不加灰色遮罩、棋盘格、光晕、阴影背景或污染。原素材自带的白色牌面或白色脸必须保持干净的原白色，不能变灰或变绿。原来平整的色块保持平整；原来细的边线保持细，不增加裂纹、浮雕或写实材质。只返回原参考拼图对应的高清美术，不加标签、序号、装饰、额外文字或水印。'''
            identifier = 'framed-ui-' + group[0]['source'].removesuffix('.png').replace('/', '-')
            jobs.append(dict(id=identifier, source=group[0]['source'],
                             sources=[issue['source'] for issue in group], framed=True,
                             subject=kind, prompt=prompt))
    (ART / 'framed-ui-jobs.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    (ART / 'issues.json').write_text(json.dumps(list(issues.values()), ensure_ascii=False, indent=2) + '\n')
    print(f'{len(issues)} problem assets; {len(jobs)} framed UI requests; emotes grouped separately')


if __name__ == '__main__':
    main()
