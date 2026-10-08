"""Assemble original frame slices into complete image-edit references."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'


def main():
    ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
    inventory = {entry['source']: entry for entry in
                 json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())['textures']}
    jobs = []
    panels = [('green', 'gy_0', 'lvseditu', '柔和浅绿色面板，白绿色细亮边'),
              ('yellow-bar', 'gy_0', 'huangtiao', '淡黄色横条，细白亮边'),
              ('orange', 'gy_0', 'liangditu', '浅橙色面板，柔和细亮边和右侧原浅棕阴影'),
              ('purple', 'zhandou0_0', 'tanchukuang', '灰紫色面板，原青白蓝色细亮边'),
              ('purple-inner', 'zhandou0_0', 'lt', '暗灰紫色内面板，没有鲜艳青色边框')]
    for name, imageset, prefix, subject in panels:
        selected = next(s for s in ui['imagesets'] if s['path'] ==
                        f'ui/imagesets_dds/{imageset}.imageset')
        regions = {int(r['Name'].split('\\')[-1][len(prefix):-4]): r['asset']
                   for r in selected['images'] if r['Name'].split('\\')[-1].startswith(prefix)
                   and r['Name'].split('\\')[-1][len(prefix):-4].isdigit()}
        images = {number: Image.open(ROOT / inventory[source]['original']).convert('RGBA')
                  for number, source in regions.items()}
        translucent = False
        for part in images.values():
            opacity = part.getchannel('A').getextrema()[1]
            if opacity < 255:
                translucent = True
                part.putalpha(part.getchannel('A').point(lambda value: round(value * 255 / opacity)))
        if prefix == 'huangtiao':
            height = images[2].height
            width = images[1].width + images[2].width + images[3].width * 4
            boxes = {1: (0, 0, images[1].width, height),
                     2: (width - images[2].width, 0, width, height),
                     3: (images[1].width, 0, width - images[2].width, height)}
        else:
            cap = images[1].width
            width, height = cap * 6, cap * 4
            boxes = {1: (0, 0, cap, cap), 2: (width - cap, 0, width, cap),
                     3: (0, height - cap, cap, height),
                     4: (width - cap, height - cap, width, height),
                     9: (cap, cap, width - cap, height - cap)}
            sides = [7, 8, 6, 5] if prefix in ('lvseditu', 'liangditu') else [5, 6, 7, 8]
            boxes.update(dict(zip(sides, [(0, cap, cap, height - cap),
                                         (width - cap, cap, width, height - cap),
                                         (cap, height - cap, width - cap, height),
                                         (cap, 0, width - cap, cap)])))
        panel = Image.new('RGBA', (width, height))
        for number, box in boxes.items():
            panel.paste(images[number].resize((box[2] - box[0], box[3] - box[1]),
                                              Image.Resampling.LANCZOS), box[:2])
        folder = ART / 'jobs' / ('sunburst-panel-' + name + ('-opaque' if translucent else ''))
        folder.mkdir(parents=True, exist_ok=True)
        panel.save(folder / 'original-panel.png')
        canvas = Image.new('RGB', (1024, 768), '#ff00ff')
        ImageDraw.Draw(canvas).rectangle((40, 40, 983, 727), outline=(32, 144, 255), width=6)
        factor = min(836 / width, 580 / height)
        reference = panel.resize((round(width * factor), round(height * factor)), Image.Resampling.LANCZOS)
        left, top = (1024 - reference.width) // 2, (768 - reference.height) // 2
        canvas.paste(reference, (left, top), reference)
        canvas.save(folder / 'input.png')
        prompt = ('这是原始复古二维卡通游戏中的' + subject + '。参考图已经按真实界面方式拼接原图切片。'
                  '保持原始风格进行高清重绘：整体布局、边线位置、角部半径、底色和原明暗层次保持原样。'
                  '原材质柔和平淡，不加粗棕黑外框，不增强立体感，不添加反光水滴、折页或新的装饰。'
                  '将低分辨率采样轮廓恢复为平滑连续的原卡通线条。保持面板完整占位和外部留白。'
                  '定位用蓝框RGB(32,144,255)必须保持完整、颜色和位置不变，框外及素材外保持纯洋红RGB(255,0,255)。'
                  '原面板边线和颜色以参考图为准，不改变成其它按钮。')
        if translucent:
            prompt += '面板保留参考中深暗的原始色值，不提亮，不增加鲜紫渐变。'
        (folder / 'prompt.txt').write_text(prompt + '\n')
        cells = [dict(source=regions[number], frame=[40, 40, 984, 728], panelBox=list(box))
                 for number, box in boxes.items()]
        jobs.append(dict(id=folder.name, source=cells[0]['source'],
                         sources=[cell['source'] for cell in cells], framed=True, prompt=prompt,
                         folder=folder.relative_to(ROOT).as_posix(), cells=cells,
                         canvas=[1024, 768], frameColor=[32, 144, 255], gap=64,
                         panelSize=[width, height]))
    (ART / 'panel-jobs.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(jobs)} original panels assembled for image editing')


if __name__ == '__main__':
    main()
