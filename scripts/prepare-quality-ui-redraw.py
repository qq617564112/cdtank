"""Prepare faithful raster redraws of battle icons, smileys and level notices."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'
CANVAS = (2048, 1536)
FRAME_COLOUR = (32, 144, 255)
MATTE_COLOUR = (255, 0, 255)


def source(region):
    return f'ui/regions/{region}.png'


def original(asset):
    with Image.open(ROOT / 'art/hd-assets/original' / asset) as image:
        return image.convert('RGBA')


def copies(group, indices):
    return [source(f'{group}/{index}') for index in indices]


def prepare(identifier, subject, references):
    folder = ART / 'jobs' / identifier
    folder.mkdir(parents=True, exist_ok=True)
    canvas = Image.new('RGB', CANVAS, MATTE_COLOUR)
    draw = ImageDraw.Draw(canvas)
    columns = len(references)
    outer, gap, stroke, padding = 80, 128, 12, 96
    width = (CANVAS[0] - 2 * outer - gap * (columns - 1)) // columns
    height = CANVAS[1] - 2 * outer
    images = []
    for reference in references:
        if reference.get('panel'):
            image = Image.new('RGBA', reference['panelSize'])
            for asset, box in reference['panel']:
                image.alpha_composite(original(asset), (box[0], box[1]))
        else:
            image = original(reference['sources'][0])
        images.append(image)
    scale = min(min((width - 2 * padding) / image.width,
                    (height - 2 * padding) / image.height) for image in images)
    cells, descriptions = [], []
    for index, (reference, image) in enumerate(zip(references, images)):
        frame = [outer + index * (width + gap), outer,
                 outer + index * (width + gap) + width, outer + height]
        draw.rectangle((frame[0], frame[1], frame[2] - 1, frame[3] - 1),
                       outline=(*FRAME_COLOUR, 255), width=stroke)
        enlarged = image.resize((round(image.width * scale), round(image.height * scale)),
                                Image.Resampling.NEAREST)
        x, y = frame[0] + (width - enlarged.width) // 2, frame[1] + (height - enlarged.height) // 2
        canvas.paste(enlarged, (x, y), enlarged)
        common = dict(box=[x, y, x + enlarged.width, y + enlarged.height], frame=frame,
                      slot=[frame[0] + stroke, frame[1] + stroke,
                            frame[2] - stroke, frame[3] - stroke])
        for asset in reference['sources']:
            cell = dict(common, source=asset, size=list(original(asset).size))
            if asset in reference.get('solidColours', {}):
                cell['solidColour'] = reference['solidColours'][asset]
            if reference.get('panel'):
                cell.update(panelBox=reference['panelBoxes'][asset], panelSize=reference['panelSize'],
                            panelInkBounds=list(image.getchannel('A').getbbox()))
            if reference.get('buttonBackground'):
                cell['buttonBackground'] = reference['buttonBackground']
            cells.append(cell)
        descriptions.append(f'第{index + 1}格：{reference["description"]}。原图占位{common["box"]}，定位框{frame}。')
    unlettered = any(reference.get('buttonBackground') for reference in references)
    lettering = '原有字样全部去除，将文字遮挡区补成干净连续的无字牌面，非文字插画保持原样。' if unlettered else \
        '保留原文字造型；文字是完整原画的一部分，保持不规则字形、倾斜和阴影。'
    prompt = (
        f'用途：原版二维卡通游戏的{subject}高清图片资产。严格依据参考图重新绘制完整原画，'
        '保留原始构图、造型、色块、细描边及透明留白。' + lettering +
        '参考图是低分辨率像素采样，方块和台阶不是美术设计：必须还原为连续、清楚、'
        '抗锯齿的曲线和斜线，绝不能描摹像素方块、放大马赛克、平滑模糊旧图或制造模糊毛边。'
        '保持原平面卡通风格，不换成现代emoji、写实材质或新造型；不要擅自加边框、'
        '阴影、反光、装饰和额外文字。原有背景和原有黑色边框属于图案时须保留。'
        '同一格只出现一份完整对应图案，相邻格不能串色、借用图案或改变比例。'
        '请求输出2048×1536高清PNG。所有原图透明区域、格间和框外统一保持纯洋红RGB(255,0,255)，'
        '该颜色仅用于后续透明提取，不属于图案。背景不画成黑色、白色、渐变或棋盘格；'
        '图案主体和描边保持原色，不添加紫色光晕、投影和毛边。'
        '蓝色RGB(32,144,255)定位框保持原数量、位置和闭合边，定位框与主体之间保留空白，'
        '仅作为后续裁切定位标记，不加到图案自身。\n' + '\n'.join(descriptions)
    )
    canvas.save(folder / 'input.png')
    (folder / 'prompt.txt').write_text(prompt + '\n')
    return dict(id=identifier, source=cells[0]['source'], sources=[cell['source'] for cell in cells],
                subject=subject, folder=folder.relative_to(ROOT).as_posix(),
                framed=True, matteColor=list(MATTE_COLOUR), canvas=list(CANVAS), gap=gap,
                frameColor=list(FRAME_COLOUR), cells=cells, prompt=prompt, **({'unlettered': True} if unlettered else {}))


def main():
    pairs = lambda indices: copies(44, indices) + copies(77, indices)
    references = [
        ('quality-bullet-capacity', '坦克弹药容量的六枚子弹条', [
            dict(sources=copies(69, [125, 126]), solidColours={source('69/126'): [145, 122, 79]},
                 description='横向一排严格六枚竖直铜红色子弹，尖头朝上；保持原来六枚的等距位置、长短比例、铜红色弹壳、浅桃色高光与深棕黑细外沿。整条没有文字、底板或外框，不能多画、漏画或切掉边缘子弹，不能添加弹匣、标记或额外投影'),
        ]),
        ('quality-result-draw', 'DRAW平局结算提示', [
            dict(sources=copies(59, [4]), description='严格保留大写DRAW四个原版不规则粗字，D/R/A/W各自的宽度、倾斜和轮廓保持；青蓝填色、白色描边、深色阴影、整幅占位与透明留白保持；禁止替换成规整字体'),
        ]),
        ('quality-result-lose', 'LOSE失败结算提示', [
            dict(sources=copies(59, [5]), description='严格保留大写LOSE四个原版不规则粗字，L/O/S/E各自的宽度、倾斜和轮廓保持；亮黄填色、白色描边、深色阴影、整幅占位与透明留白保持；禁止替换成规整字体'),
        ]),
        ('quality-result-win', 'WIN胜利结算提示', [
            dict(sources=copies(59, [10]), description='严格保留大写WIN三个原版不规则粗字，W/I/N各自的宽度、倾斜和轮廓保持；鲜红填色、白色描边、深色阴影、整幅占位与透明留白保持；禁止替换成规整字体'),
        ]),
        ('quality-rule-team-damage', '敌我不分模式的无字插画底板', [
            dict(sources=copies(65, [18]), buttonBackground='rule-duiyoushanghai', description='蓝色坦克和白色坦克相对的插画，米黄和深蓝分区底板，原黑色描边；原字敌我不分全部去除，字下补原底色。坦克数量、姿态、原图位置和面积保持；禁止添加吊绳、吊环、木框、新图标或新的高光'),
        ]),
        ('quality-tanks', '蓝红双方的坦克图标', [
            dict(sources=pairs([71]), description='蓝色卡通坦克，向右伸出的炮管、白色斜闪电与白色雪花图案；蓝底与原黑框保留；不含文字'),
            dict(sources=pairs([74]), description='红色卡通坦克，向右伸出的炮管、白色斜闪电与白色雪花图案；粉红底与原黑框保留；不含文字'),
        ]),
        ('quality-tanks-vip', '蓝红双方的VIP坦克图标', [
            dict(sources=pairs([69]), description='蓝色坦克图标，左下原位置叠黄色黑描边VIP三个大写字母；保留蓝底与原黑框，恢复圆滑坦克及清楚字形'),
            dict(sources=pairs([75]), description='红色坦克图标，左下原位置叠黄色黑描边VIP三个大写字母；保留粉红底与原黑框，恢复圆滑坦克及清楚字形'),
        ]),
        ('quality-castles', '蓝红旗城堡图标', [
            dict(sources=pairs([72]), description='浅黄色砖墙城堡、深色描边、上方蓝黄旗帜；保留浅蓝底及原黑框，砖块为自然完整砖块而非像素台阶'),
            dict(sources=pairs([73]), description='浅黄色砖墙城堡、深色描边、上方红黄旗帜；保留粉红底及原黑框，砖块为自然完整砖块而非像素台阶'),
        ]),
        ('quality-destroy-icon', '黄色爆炸及受损城墙图标', [
            dict(sources=pairs([76]), description='上方黄色橙色尖角爆炸，下面米黄色受损城墙与蓝色横带；浅蓝底、原黑框、各色块和占位不变'),
        ]),
        ('quality-smiles-warm', '暖色小笑脸图标', [
            dict(sources=pairs([133]), description='白色圆脸、棕黄色外圈、棕色两只小眼与向上弯的笑嘴，原黑色外沿及原留白保持'),
            dict(sources=pairs([134]), description='浅粉白色圆脸、红色外圈、深红两只小眼与向上弯的笑嘴，原黑色外沿及原留白保持'),
        ]),
        ('quality-smile-yellow', '黄色小笑脸图标', [
            dict(sources=pairs([135]), description='明黄色外圈、浅黄白圆脸、橄榄色两只小眼与向上弯的笑嘴；保持原黑色外沿与留白，不添加新表情'),
        ]),
        ('quality-smiles-large', '黄色和青色笑脸图标', [
            dict(sources=copies(60, [139]), description='黄色外圈、浅黄白圆脸、金黄两只小眼与圆弧笑嘴；保留原轮廓、黑色细外沿与留白'),
            dict(sources=copies(60, [140]), description='青蓝色外圈、浅青圆脸、青蓝两只小眼与圆弧笑嘴；保留原轮廓、黑色细外沿与留白'),
        ]),
        ('quality-smile-red-large', '红色笑脸图标', [
            dict(sources=copies(60, [141]), description='暗红外圈、浅粉白圆脸、暗红两只小眼与圆弧笑嘴；保留原轮廓、黑色细外沿与留白'),
        ]),
        ('quality-level-down', 'LevelDown!降级结算提示图案', [
            dict(sources=copies(59, [11]), description='原文严格为LevelDown!，无空格、一个感叹号；绿色粗圆润字形及白色描边，后方黄色斜长底条与深蓝色下沿；恢复原字形曲线，保持整幅比例、位置和留白'),
        ]),
        ('quality-level-up', 'LevelUp!升级结算提示图案', [
            dict(sources=copies(59, [12]), description='原文严格为LevelUp!，无空格、一个感叹号；红色粗圆润字形及白色描边，后方黄色斜长底条与深蓝色下沿；恢复原字形曲线，保持整幅比例、位置和留白'),
        ]),
    ]
    head = pairs([77]) + copies(60, [134])
    body = pairs([104]) + copies(60, [165])
    references.append(('quality-dog-panel', '上下拼接的完整小狗图标', [dict(
        sources=head + body, panel=[(head[0], [0, 0, 28, 29]), (body[0], [0, 29, 28, 46])],
        panelSize=[28, 46], panelBoxes={**{asset: [0, 0, 28, 29] for asset in head},
                                      **{asset: [0, 29, 28, 46] for asset in body}},
        description='参考是上下碎片拼成的一只完整站立小狗：向左突出的长鼻、棕色细外轮廓、米黄身体、橙色右耳、两只前爪与底部小脚；按整只狗恢复连续线条，不给上半身或下半身单独加边框')]))
    references.sort(key=lambda reference: not reference[0].startswith(('quality-smile', 'quality-level')))
    jobs = [prepare(*reference) for reference in references]
    path = ART / 'quality-ui-jobs.json'
    path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')
    print(f'{sum(len(job["sources"]) for job in jobs)} source paths in {len(jobs)} raster redraw requests: {path}')


if __name__ == '__main__':
    main()
