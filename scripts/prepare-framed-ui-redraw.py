"""Group original UI frames into spaced, bordered image-edit references."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'


def job(family, sources, group, index):
    prompt = (f"这是复古二维卡通游戏里的{family['subject']}。以原始低分辨率图为唯一美术参考，"
              '保持原始风格进行高清化，恢复自然清楚的手绘线条。不是新设计，也不是现代emoji。\n'
              + family['prompt'] + '\n'
              '严格复刻参考中各帧的五官、眉毛方向、嘴的形状、脸形、细描边及文字。'
              '原图上的大像素阶梯是低分辨率采样损失，需要恢复成清楚连续的曲线和斜线，'
              '不要输出放大的马赛克台阶，不要沿每个像素方块描边。'
              '保持原平面卡通色块与复古字形骨架，细线的位置和粗细按原画的归一化比例恢复。'
              '不要新增立体字厚度、描边厚度、体积、反光、装饰、碎屑或阴影。'
              '原文字是鲜红色的就保持鲜红色，不改成橙字；原薄金边保持薄金边。'
              '每格是一帧独立原图，从左到右、从上到下逐帧对应，不能合并或替换。')
    return dict(id=f'framed-emote-{group}-{index:02}', source=sources[0], sources=sources,
                subject=family['subject'], framed=True, prompt=prompt)


def main():
    families = json.loads((ART / 'emote-family-prompts.json').read_text())
    inventory = {entry['source']: entry for entry in
                 json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())['textures']}
    issues = {entry['source'] for entry in json.loads((ART / 'issues.json').read_text())}
    jobs = []
    for name, family in families.items():
        groups = {}
        for source in family['sources']:
            if source not in issues:
                continue
            height = inventory[source]['size'][1]
            groups.setdefault('small' if height <= 20 else 'large', []).append(source)
        for size, sources in groups.items():
            for index, start in enumerate(range(0, len(sources), 4)):
                jobs.append(job(family, sources[start:start + 4], f'{name}-{size}', index))
    pilot = []
    selections = {
        '026b': ['ui/regions/56/101.png', 'ui/regions/56/102.png'],
        '027b': ['ui/regions/56/103.png', 'ui/regions/56/104.png'],
        '028b': ['ui/regions/56/107.png', 'ui/regions/56/108.png'],
        '024b': ['ui/regions/56/109.png', 'ui/regions/56/110.png'],
        '029': ['ui/regions/56/10.png', 'ui/regions/56/11.png'],
    }
    for name, sources in selections.items():
        pilot.append(job(families[name], sources, name + '-pilot', 0))
    pilot.append(dict(id='framed-emote-heart-pilot', source='ui/regions/56/100.png',
                      sources=['ui/regions/56/100.png'], framed=True,
                      subject='红心金边气泡',
                      prompt='这是复古二维卡通游戏聊天表情的红心：原白色底是金黄色薄边、底部尖角的气泡，'
                      '气泡内部为鲜红色不对称爱心，左上有原来的白色弯曲反光。'
                      '保持原始轮廓、原图心形左右比例、金边粗细与尖角长度进行高清重绘，'
                      '不换成橙环，不改变心形、不新增字母或感叹号，不添加3D体积或装饰。'))
    previous_path = ART / 'framed-pilot-jobs.json'
    previous = {entry['id']: entry for entry in json.loads(previous_path.read_text())} \
        if previous_path.exists() else {}
    pilot = [previous.get(entry['id'], entry) for entry in pilot]
    reusable = {tuple(entry['sources']): entry for entry in pilot}
    replacements = []
    for entry in jobs:
        if tuple(entry['sources']) in reusable:
            replacements.append(reusable[tuple(entry['sources'])])
        elif 'ui/regions/56/100.png' in entry['sources']:
            entry['sources'].remove('ui/regions/56/100.png')
            if entry['sources']:
                entry['source'] = entry['sources'][0]
                replacements.append(entry)
            replacements.append(pilot[-1])
        else:
            replacements.append(entry)
    jobs = replacements
    for name, data in [('framed-emote-jobs.json', jobs), ('framed-pilot-jobs.json', pilot)]:
        (ART / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'{sum(len(row["sources"]) for row in jobs)} emote assets in {len(jobs)} framed jobs; '
          f'{len(pilot)} pilot requests')


if __name__ == '__main__':
    main()
