"""Compose original scrollbar and slider parts before image editing."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'


def main():
    ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
    inventory = {entry['source']: entry for entry in
                 json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())['textures']}

    def image(source):
        return Image.open(ROOT / inventory[source]['original']).convert('RGBA')

    def region(imageset, name):
        selected = next(s for s in ui['imagesets'] if s['path'] == imageset)
        return next(r['asset'] for r in selected['images'] if r['Name'].split('\\')[-1] == name)

    controls = []
    for family, track, top, bottom, thumb_top, thumb_middle, thumb_bottom in [
        ('battle-blue', '44/84', '44/82', '44/78', '44/77', '44/145', '44/104'),
        ('battle-orange', '44/85', '44/81', '44/79', '44/77', '44/145', '44/104'),
        ('shared-orange', '60/162', '60/144', '60/136', '60/134', '60/223', '60/165'),
        ('battle-dds-blue', '77/84', '77/82', '77/78', '77/77', '77/145', '77/104'),
        ('battle-dds-orange', '77/85', '77/81', '77/79', '77/77', '77/145', '77/104'),
        ('shared-small', '60/171', None, None, '60/163', '60/226', '60/193')]:
        paths = ['ui/regions/' + value + '.png' if value else None
                 for value in [track, top, bottom, thumb_top, thumb_middle, thumb_bottom]]
        if top is None:
            paths[1] = region('ui/imagesets_dds/gy_0.imageset', 'hdtan2.tga')
            paths[2] = region('ui/imagesets_dds/gy_0.imageset', 'hdtan2b.tga')
        track_image, up, down, cap_top, middle, cap_bottom = [image(path) for path in paths]
        width, height = track_image.width, 190
        control = track_image.resize((width, height), Image.Resampling.LANCZOS)
        control.alpha_composite(up, (0, 0))
        control.alpha_composite(down, (0, height - down.height))
        thumb_y = 80
        for part, y in [(cap_top, thumb_y), (middle, thumb_y + cap_top.height),
                        (cap_bottom, thumb_y + cap_top.height + middle.height)]:
            control.alpha_composite(part, (0, y))
        controls.append(dict(name=family, image=control, cells=[dict(source=paths[0],
                             panelBox=[0, up.height + 10, width, up.height + 10 + track_image.height])]))

    slider_sources = ['ui/regions/74/' + str(number) + '.png' for number in [132, 133, 131]]
    parts = [image(source) for source in slider_sources]
    slider = Image.new('RGBA', (100, 10))
    boxes = [(0, 0, 10, 10), (10, 0, 90, 10), (90, 0, 100, 10)]
    for part, box in zip(parts, boxes):
        slider.paste(part.resize((box[2] - box[0], 10), Image.Resampling.LANCZOS), box[:2])
    controls.append(dict(name='orange-slider', image=slider,
                         cells=[dict(source=source, panelBox=list(box))
                                for source, box in zip(slider_sources, boxes)]))
    jobs = []
    groups = [controls[:3], controls[3:6], controls[6:]]
    for group_index, group in enumerate(groups):
        folder = ART / 'jobs' / f'sunburst-whole-controls-{group_index}'
        folder.mkdir(parents=True, exist_ok=True)
        canvas = Image.new('RGB', (1024, 768), '#ff00ff')
        draw = ImageDraw.Draw(canvas)
        cell_width = (1024 - 80 - (len(group) - 1) * 64) // len(group)
        factor = min(min((cell_width - 96) / control['image'].width,
                         580 / control['image'].height) for control in group)
        cells = []
        for index, control in enumerate(group):
            left = 40 + index * (cell_width + 64)
            frame = [left, 40, left + cell_width, 728]
            draw.rectangle((left, 40, left + cell_width - 1, 727), outline=(32, 144, 255), width=6)
            original = control['image']
            original.save(folder / f'original-control-{index}.png')
            reference = original.resize((round(original.width * factor), round(original.height * factor)),
                                        Image.Resampling.LANCZOS)
            canvas.paste(reference, (left + (cell_width - reference.width) // 2,
                                    (768 - reference.height) // 2), reference)
            cells.extend(dict(**cell, frame=frame, panelSize=list(original.size))
                         for cell in control['cells'])
        canvas.save(folder / 'input.png')
        subject = '带上下箭头和滑块的完整竖向滚动条' if group_index < 2 else '左右端帽和中段拼接的完整橙色滑槽'
        prompt = ('这是原始复古卡通游戏中的' + subject + '，已用原始切片按实际控件布局拼成完整图。'
                  '保持原始风格进行高清化，原颜色、材质、线条厚度、边缘形状和部件位置都按参考图保留。'
                  '只恢复连续高清曲线和柔和渐变，不新增额外边框、封口、立体阴影或装饰。'
                  '滚动条的轨道在上下箭头之间连续贯通，不能把中段画成带上下边框的独立柱子；'
                  '滑槽中段左右贯通，只有原端部有端帽。各格保持自己的原图配色，不混用。'
                  '蓝色定位框RGB(32,144,255)保持原数量、位置和四边闭合。'
                  '所有素材完整保留在各自框内，间距64像素，素材以外保持纯洋红RGB(255,0,255)。')
        (folder / 'prompt.txt').write_text(prompt + '\n')
        jobs.append(dict(id=folder.name, source=cells[0]['source'],
                         sources=[cell['source'] for cell in cells], framed=True, prompt=prompt,
                         folder=folder.relative_to(ROOT).as_posix(), cells=cells,
                         canvas=[1024, 768], frameColor=[32, 144, 255], gap=64))
    (ART / 'whole-control-jobs.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(controls)} original controls assembled into {len(jobs)} image requests')


if __name__ == '__main__':
    main()
