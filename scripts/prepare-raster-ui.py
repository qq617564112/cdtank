"""Prepare faithful raster redraw jobs for published non-button UI sources.

Run this script from the repository root:

    python3 scripts/prepare-raster-ui.py

Complete UI references and their source slices share one image request.
"""
from collections import Counter, defaultdict
import json
from pathlib import Path
import re

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'
CATALOGUE_DIR = ART / 'raster-source-catalogues'
INVENTORY_PATH = ROOT / 'art/hd-assets/inventory.json'
UI_PATH = ROOT / 'recovery/output/web-assets/ui.json'
RESTORE_SOURCES_PATH = ART / 'raster-restore-sources.json'

CANVAS = (2048, 1536)
FRAME_COLOUR = (32, 144, 255)
MATTE_COLOUR = (255, 0, 255)

FRAME_PROPERTIES = (
    'TopLeftFrameImage',
    'TopRightFrameImage',
    'BottomLeftFrameImage',
    'BottomRightFrameImage',
    'LeftFrameImage',
    'RightFrameImage',
    'TopFrameImage',
    'BottomFrameImage',
)
IMAGE_PROPERTY = 'Image'
FRAME_ORDER = (*FRAME_PROPERTIES, IMAGE_PROPERTY)

# The battle critical/money images still use the original TGA imageset
# explicitly.  The same assets also exist in the DDS duplicate, but this code
# path is the reason both names are retained.
CODE_CONSUMED_ASSETS = {
    'ui/regions/44/11.png',
}

EXISTING_REDRAW_FILES = (
    'accepted-quality-ui-sources.json',
    'accepted-current-emotes.json',
)

PANEL_PRIORITY = {
    ('lobby_select.xml', 'picLevelBkg'): 0,
    ('chat.xml', 'lt'): 1,
    ('chat.xml', 'liaotiankuangditu'): 2,
    ('lobby_select.xml', 'ditu3'): 3,
    ('lobby_select.xml', 'ditu4'): 4,
    ('default.xml', None): 5,
    ('createroom.xml', 'daditu'): 6,
    ('settings.xml', None): 7,
}

PANEL_SUBJECTS = {
    ('lobby_select.xml', 'picLevelBkg'): '大厅等级板九片边框',
    ('chat.xml', 'lt'): '聊天主窗口九片边框',
    ('chat.xml', 'liaotiankuangditu'): '聊天条三片横向边框',
    ('lobby_select.xml', 'ditu3'): '大厅选择窗口九片边框',
    ('lobby_select.xml', 'ditu4'): '橙色内容窗口九片边框',
    ('createroom.xml', 'daditu'): '创建房间大窗口九片边框',
    ('createroom.xml', 'ditu2'): '创建房间绿色窗口九片边框',
    ('createroom.xml', 'xiaoditu'): '创建房间小型横向面板',
    ('settings.xml', 'dikuang'): '设置页横向内容框',
    ('settings.xml', 'changtiaoditu'): '设置页长横条',
    ('room_main.xml', 'zhongjianditu'): '房间主界面中央九片面板',
    ('playerlist.xml', 'haoyou'): '好友窗口九片边框',
    ('history.xml', 'ditu2'): '历史记录窗口九片边框',
    ('myhome.xml', 'zkb'): '个人房间九片边框',
    ('playerlist_playerinfo.xml', 'shangditu'): '玩家资料窗口九片边框',
    ('settings.xml', 'zuobianditu'): '设置页左侧九片边框',
    ('settings.xml', 'youxiaditu'): '设置页右侧九片边框',
    ('room_main.xml', 'ditu'): '房间主界面九片边框',
    ('room_main.xml', 'maogouditu'): '房间主界面猫咪面板九片边框',
    ('selectgamemode.xml', 'xiamianfenhongtiao'): '模式选择粉色横条',
}

SCROLLBAR_SOURCES = {
    'ui/regions/60/136.png',
    'ui/regions/60/137.png',
    'ui/regions/60/138.png',
    'ui/regions/60/142.png',
    'ui/regions/60/143.png',
    'ui/regions/60/144.png',
}

SPECIAL_SINGLE_SOURCES = {
    'ui/regions/74/41.png',
    'ui/regions/74/42.png',
}

OBSERVATIONS = [
    '大厅选择截图里中央出现大块 ONLINE 纹理，左上还有不规则纸片状残块；这与房间列表截图中的正常木框面板不一致，符合旧 PNG 或错误纹理串入。',
    '登录截图中账号和密码输入框当前呈平面色块，需要恢复为原始橙金木牌输入框。',
    '房间列表截图中橙色内容板和木纹边框显示正常，可作为完整面板拼接的视觉参考。',
]


def load_json(path):
    return json.loads(Path(path).read_text())


def save_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def clean_asset_name(value):
    return str(value).replace('\\', '/').lstrip('/').casefold()


def source_sort_key(source):
    match = re.search(r'/regions/(\d+)/(\d+)\.png$', source)
    if match:
        return (0, int(match.group(1)), int(match.group(2)), source)
    return (1, 0, 0, source)


def path_stem(path):
    return Path(path).stem


def job_slug(value):
    slug = re.sub(r'[^a-z0-9]+', '-', value.casefold()).strip('-')
    return slug or 'item'


def source_family(source):
    match = re.search(r'/regions/(\d+)/', source)
    return int(match.group(1)) if match else 0


def source_index(source):
    match = re.search(r'/regions/(\d+)/(\d+)\.png$', source)
    return int(match.group(2)) if match else 0


def open_original(entry):
    return Image.open(ROOT / entry['original']).convert('RGBA')


def normalized_alpha(image):
    maximum = image.getchannel('A').getextrema()[1]
    if maximum and maximum < 255:
        image.putalpha(image.getchannel('A').point(lambda value: round(value * 255 / maximum)))
    return image


def alpha_bounds(image):
    bounds = image.getchannel('A').getbbox()
    return list(bounds) if bounds else [0, 0, image.width, image.height]


def panel_priority(layout_path, control_name):
    name = Path(layout_path).name
    exact = PANEL_PRIORITY.get((name, control_name))
    if exact is not None:
        return exact
    if name == 'default.xml':
        return PANEL_PRIORITY[('default.xml', None)]
    if name == 'settings.xml':
        return PANEL_PRIORITY[('settings.xml', None)]
    return 30


def panel_subject(layout_path, control_name):
    name = Path(layout_path).name
    subject = PANEL_SUBJECTS.get((name, control_name))
    if subject:
        return subject
    return f'{path_stem(layout_path)} 的 {control_name} 完整原始界面边框'


class RuntimeUiIndex:
    def __init__(self, ui):
        by_name = defaultdict(list)
        for imageset in ui['imagesets']:
            by_name[imageset['attributes']['Name'].casefold()].append(imageset)

        self.selected_sets = {}
        self.superseded_paths = {}
        all_selected = []
        for name, rows in by_name.items():
            selected = next((row for row in rows if 'imagesets_dds/' in row['path']), rows[0])
            self.selected_sets[name] = selected
            all_selected.append(selected)
            for row in rows:
                if row['path'] != selected['path']:
                    for image in row['images']:
                        if image.get('asset'):
                            self.superseded_paths[image['asset']] = row['path']

        self.image_index = defaultdict(lambda: defaultdict(list))
        self.runtime_assets = set()
        self.keyboard_assets = set()
        self.set_image_assets = defaultdict(list)
        self.source_set = {}
        for imageset in all_selected:
            name = imageset['attributes']['Name'].casefold()
            for image in imageset['images']:
                asset = image.get('asset')
                if not asset:
                    continue
                self.set_image_assets[name].append((clean_asset_name(image['Name']), asset))
                self.runtime_assets.add(asset)
                self.source_set.setdefault(asset, imageset['path'])
                if asset.startswith('ui/regions/71/'):
                    self.keyboard_assets.add(asset)

        for name, rows in self.set_image_assets.items():
            for image_name, asset in rows:
                self.image_index[name][image_name].append(asset)

        self.usage = defaultdict(list)
        self.unresolved = []
        self.families = {}
        for layout in ui['layouts']:
            if layout['path'].endswith('keyboard.xml'):
                continue
            for window in layout.get('windows', []):
                properties = window.get('properties', {})
                resolved = {}
                for property_name in FRAME_ORDER:
                    value = properties.get(property_name)
                    asset = self.resolve(value)
                    if asset:
                        resolved[property_name] = asset
                        self.usage[asset].append(dict(
                            layout=layout['path'],
                            control=window.get('name'),
                            property=property_name,
                            reference=value,
                        ))
                    elif value:
                        self.unresolved.append(dict(
                            layout=layout['path'],
                            control=window.get('name'),
                            property=property_name,
                            reference=value,
                        ))
                unique_assets = {asset for asset in resolved.values()}
                if len(unique_assets) < 2:
                    continue
                key = tuple((property_name, resolved[property_name])
                            for property_name in FRAME_ORDER if property_name in resolved)
                self.families.setdefault(key, []).append(dict(
                    layout=layout['path'],
                    control=window.get('name'),
                ))

    def resolve(self, reference):
        if not reference:
            return None
        match = re.match(r'^set:(\S+)\s+image:(.+)$', reference, re.IGNORECASE)
        if match:
            set_name = match.group(1).casefold()
            image_name = clean_asset_name(match.group(2))
            assets = self.image_index.get(set_name, {}).get(image_name, [])
            return assets[0] if len(assets) >= 1 else None
        match = re.match(r'^image:(.+)$', reference, re.IGNORECASE)
        if match:
            image_name = clean_asset_name(match.group(1))
            assets = []
            for per_set in self.image_index.values():
                assets.extend(per_set.get(image_name, []))
            assets = list(dict.fromkeys(assets))
            return assets[0] if len(assets) == 1 else None
        return None


def assemble_panel(family, inventory):
    """Assemble a frame family using the named UI properties, never suffixes."""
    property_assets = dict(family)
    images = {}
    for property_name, source in property_assets.items():
        entry = inventory.get(source)
        if entry:
            images[property_name] = normalized_alpha(open_original(entry))

    def image_size(property_name):
        image = images.get(property_name)
        return image.size if image else None

    def add(panel, property_name, box):
        image = images.get(property_name)
        if image is None:
            return
        left, top, right, bottom = box
        width, height = right - left, bottom - top
        if width <= 0 or height <= 0:
            return
        resized = image.resize((width, height), Image.Resampling.LANCZOS)
        panel.alpha_composite(resized, (left, top))

    def positive(values, fallback=1):
        values = [value for value in values if value]
        return max(values) if values else fallback

    center = images.get(IMAGE_PROPERTY)
    has_left = 'LeftFrameImage' in images or 'TopLeftFrameImage' in images or 'BottomLeftFrameImage' in images
    has_right = 'RightFrameImage' in images or 'TopRightFrameImage' in images or 'BottomRightFrameImage' in images
    has_top = 'TopFrameImage' in images or 'TopLeftFrameImage' in images or 'TopRightFrameImage' in images
    has_bottom = 'BottomFrameImage' in images or 'BottomLeftFrameImage' in images or 'BottomRightFrameImage' in images

    # Full nine-slice/edge panel.  The edge dimensions come from the actual
    # corner/side images referenced by ui.json, not from filenames.  A frame
    # that has no centre image keeps a transparent interior, which the minimap
    # boundary control relies on.
    if (has_left or has_right) and (has_top or has_bottom):
        left_width = positive([
            image_size('LeftFrameImage')[0] if image_size('LeftFrameImage') else 0,
            image_size('TopLeftFrameImage')[0] if image_size('TopLeftFrameImage') else 0,
            image_size('BottomLeftFrameImage')[0] if image_size('BottomLeftFrameImage') else 0,
        ])
        right_width = positive([
            image_size('RightFrameImage')[0] if image_size('RightFrameImage') else 0,
            image_size('TopRightFrameImage')[0] if image_size('TopRightFrameImage') else 0,
            image_size('BottomRightFrameImage')[0] if image_size('BottomRightFrameImage') else 0,
        ])
        top_height = positive([
            image_size('TopFrameImage')[1] if image_size('TopFrameImage') else 0,
            image_size('TopLeftFrameImage')[1] if image_size('TopLeftFrameImage') else 0,
            image_size('TopRightFrameImage')[1] if image_size('TopRightFrameImage') else 0,
        ])
        bottom_height = positive([
            image_size('BottomFrameImage')[1] if image_size('BottomFrameImage') else 0,
            image_size('BottomLeftFrameImage')[1] if image_size('BottomLeftFrameImage') else 0,
            image_size('BottomRightFrameImage')[1] if image_size('BottomRightFrameImage') else 0,
        ])
        if center is not None:
            center_width, center_height = center.width, center.height
        else:
            unit = positive([left_width, right_width, top_height, bottom_height])
            center_width = center_height = unit
        width = left_width + center_width * 4 + right_width
        height = top_height + center_height * 4 + bottom_height
        panel = Image.new('RGBA', (width, height))
        boxes = {
            'TopLeftFrameImage': (0, 0, left_width, top_height),
            'TopFrameImage': (left_width, 0, width - right_width, top_height),
            'TopRightFrameImage': (width - right_width, 0, width, top_height),
            'LeftFrameImage': (0, top_height, left_width, height - bottom_height),
            IMAGE_PROPERTY: (left_width, top_height, width - right_width, height - bottom_height),
            'RightFrameImage': (width - right_width, top_height, width, height - bottom_height),
            'BottomLeftFrameImage': (0, height - bottom_height, left_width, height),
            'BottomFrameImage': (left_width, height - bottom_height, width - right_width, height),
            'BottomRightFrameImage': (width - right_width, height - bottom_height, width, height),
        }
        for property_name, box in boxes.items():
            add(panel, property_name, box)
        return panel, boxes

    # Horizontal three-slice family used by chat bars and section headers.
    if center is not None and (has_left or has_right) and not (has_top or has_bottom):
        left_image = images.get('LeftFrameImage') or images.get('TopLeftFrameImage') or images.get('BottomLeftFrameImage')
        right_image = images.get('RightFrameImage') or images.get('TopRightFrameImage') or images.get('BottomRightFrameImage')
        left_width = left_image.width if left_image else 0
        right_width = right_image.width if right_image else 0
        center_width = center.width
        height = max(
            [image.height for image in (left_image, center, right_image) if image is not None]
        )
        width = left_width + center_width * 4 + right_width
        panel = Image.new('RGBA', (width, height))
        boxes = {
            'LeftFrameImage': (0, 0, left_width, height),
            IMAGE_PROPERTY: (left_width, 0, left_width + center_width * 4, height),
            'RightFrameImage': (width - right_width, 0, width, height),
        }
        if left_image is None:
            boxes.pop('LeftFrameImage')
        if right_image is None:
            boxes.pop('RightFrameImage')
        for property_name, box in boxes.items():
            add(panel, property_name, box)
        return panel, boxes

    # Vertical three-slice family.  This is kept symmetric with the horizontal
    # case so a future TGA panel does not need a second ad-hoc script.
    if center is not None and (has_top or has_bottom) and not (has_left or has_right):
        top_image = images.get('TopFrameImage') or images.get('TopLeftFrameImage') or images.get('TopRightFrameImage')
        bottom_image = images.get('BottomFrameImage') or images.get('BottomLeftFrameImage') or images.get('BottomRightFrameImage')
        top_height = top_image.height if top_image else 0
        bottom_height = bottom_image.height if bottom_image else 0
        center_height = center.height
        width = max([image.width for image in (top_image, center, bottom_image) if image is not None])
        height = top_height + center_height * 4 + bottom_height
        panel = Image.new('RGBA', (width, height))
        boxes = {
            'TopFrameImage': (0, 0, width, top_height),
            IMAGE_PROPERTY: (0, top_height, width, top_height + center_height * 4),
            'BottomFrameImage': (0, height - bottom_height, width, height),
        }
        if top_image is None:
            boxes.pop('TopFrameImage')
        if bottom_image is None:
            boxes.pop('BottomFrameImage')
        for property_name, box in boxes.items():
            add(panel, property_name, box)
        return panel, boxes

    # Some old controls expose only a pair of edge images.  Keep the source
    # order supplied by ui.json and repeat the center only when one exists.
    if center is not None and (has_left or has_right or has_top or has_bottom):
        horizontal = has_left or has_right
        ordered = []
        if horizontal:
            for property_name in ('LeftFrameImage', 'TopLeftFrameImage', 'BottomLeftFrameImage',
                                  IMAGE_PROPERTY,
                                  'RightFrameImage', 'TopRightFrameImage', 'BottomRightFrameImage'):
                if property_name in images and property_name not in ordered:
                    ordered.append(property_name)
            width = sum(images[property_name].width for property_name in ordered)
            height = max(images[property_name].height for property_name in ordered)
            panel = Image.new('RGBA', (width, height))
            boxes = {}
            x = 0
            for property_name in ordered:
                image = images[property_name]
                boxes[property_name] = (x, 0, x + image.width, height)
                x += image.width
        else:
            for property_name in ('TopFrameImage', 'TopLeftFrameImage', 'TopRightFrameImage',
                                  IMAGE_PROPERTY,
                                  'BottomFrameImage', 'BottomLeftFrameImage', 'BottomRightFrameImage'):
                if property_name in images and property_name not in ordered:
                    ordered.append(property_name)
            width = max(images[property_name].width for property_name in ordered)
            height = sum(images[property_name].height for property_name in ordered)
            panel = Image.new('RGBA', (width, height))
            boxes = {}
            y = 0
            for property_name in ordered:
                image = images[property_name]
                boxes[property_name] = (0, y, width, y + image.height)
                y += image.height
        for property_name, box in boxes.items():
            add(panel, property_name, box)
        return panel, boxes

    return None, None


def canonical_groups(active_sources, inventory, text_sources):
    groups = defaultdict(list)
    for source in sorted(active_sources, key=source_sort_key):
        groups[inventory[source]['canonical']].append(source)

    representative = {}
    members_by_representative = {}
    for canonical, members in sorted(groups.items()):
        text_members = [source for source in members if source in text_sources]
        if text_members:
            chosen = text_members[0]
        elif canonical in members:
            chosen = canonical
        else:
            chosen = members[0]
        representative.update({source: chosen for source in members})
        members_by_representative[chosen] = members
    return representative, members_by_representative


def solid_description(entry):
    with open_original(entry) as image:
        pixels = np.asarray(image)
    alpha_extrema = [int(pixels[:, :, 3].min()), int(pixels[:, :, 3].max())]
    alpha_shape = dict(alphaExtrema=alpha_extrema,
                       alphaUniform=alpha_extrema[0] == alpha_extrema[1])
    visible = pixels[pixels[:, :, 3] > 0]
    if not len(visible):
        return dict(kind='transparent', colour=None, rgba=[0, 0, 0, 0], **alpha_shape)

    unique_colours = np.unique(visible[:, :3].reshape(-1, 3), axis=0)
    unique_rgba = np.unique(pixels.reshape(-1, 4), axis=0)
    if len(unique_rgba) == 1:
        return dict(kind='constant_rgba', colour=unique_rgba[0, :3].tolist(),
                    rgba=unique_rgba[0].tolist(), **alpha_shape)
    if len(unique_colours) == 1 and alpha_shape['alphaUniform']:
        return dict(kind='constant_rgb', colour=unique_colours[0].tolist(), rgba=None,
                    **alpha_shape)
    if entry.get('solidColor') and alpha_shape['alphaUniform']:
        return dict(kind='inventory_solid_colour', colour=list(entry['solidColor']),
                    rgba=None, **alpha_shape)
    return None


def draw_reference_cell(canvas, draw, image, outer, gap, stroke, padding, column, row, cell_width, cell_height, scale):
    left = outer + column * (cell_width + gap)
    top = outer + row * (cell_height + gap)
    frame = [left, top, left + cell_width, top + cell_height]
    draw.rectangle((left, top, left + cell_width - 1, top + cell_height - 1),
                   outline=(*FRAME_COLOUR, 255), width=stroke)
    enlarged = image.resize((max(1, round(image.width * scale)),
                             max(1, round(image.height * scale))),
                            Image.Resampling.NEAREST)
    x = left + (cell_width - enlarged.width) // 2
    y = top + (cell_height - enlarged.height) // 2
    canvas.paste(enlarged, (x, y), enlarged)
    return dict(
        box=[x, y, x + enlarged.width, y + enlarged.height],
        frame=frame,
        slot=[left + stroke, top + stroke, left + cell_width - stroke, top + cell_height - stroke],
    )


def grid_shape(count):
    if count <= 1:
        return 1, 1
    if count == 2:
        return 2, 1
    if count <= 4:
        return 2, 2
    return 4, 2


def build_reference_job(job_id, references, prompt, cell_groups, folder=None):
    """Render one bounded reference sheet and retain installer cell metadata."""
    count = len(references)
    columns, rows = grid_shape(count)
    outer, gap, stroke, padding = 80, 128, 12, 96
    cell_width = (CANVAS[0] - outer * 2 - gap * (columns - 1)) // columns
    cell_height = (CANVAS[1] - outer * 2 - gap * (rows - 1)) // rows
    reference_images = images_for_references(references)
    scale = min(
        min((cell_width - padding * 2) / image.width,
            (cell_height - padding * 2) / image.height)
        for image in reference_images
    )
    canvas = Image.new('RGB', CANVAS, MATTE_COLOUR)
    draw = ImageDraw.Draw(canvas)
    common_cells = []
    for index, image in enumerate(reference_images):
        common = draw_reference_cell(
            canvas, draw, image, outer, gap, stroke, padding,
            index % columns, index // columns, cell_width, cell_height, scale,
        )
        common_cells.append(common)

    cells = []
    for position, group in enumerate(cell_groups):
        common = common_cells[group.get('reference_index', position)]
        for source in group['sources']:
            cell = dict(source=source, size=list(group['size']), **common)
            cell.update(group.get('cell_extra', {}))
            cells.append(cell)

    folder = ART / 'jobs' / job_id if folder is None else folder
    folder.mkdir(parents=True, exist_ok=True)
    canvas.save(folder / 'input.png')
    (folder / 'prompt.txt').write_text(prompt + '\n')
    job = dict(
        id=job_id,
        source=cell_groups[0]['sources'][0],
        sources=[source for group in cell_groups for source in group['sources']],
        kind=cell_groups[0].get('kind', 'symbol'),
        priority=cell_groups[0].get('priority', 400),
        prompt=prompt,
        folder=folder.relative_to(ROOT).as_posix(),
        framed=True,
        matteColor=list(MATTE_COLOUR),
        canvas=list(CANVAS),
        gap=gap,
        frameColor=list(FRAME_COLOUR),
        cells=cells,
        unlettered=True,
    )
    if cell_groups[0].get('panelSize'):
        job['panelSize'] = cell_groups[0]['panelSize']
    return job, common_cells


def images_for_references(references):
    return [reference['image'] for reference in references]


def reference_footer():
    return (
        '参考图的低分辨率方块和锯齿不是设计：恢复为清楚连续、抗锯齿的原始卡通轮廓，'
        '不能描摹像素方块、放大马赛克或模糊旧图。每格只画自己的完整原图，不能跨框借图案。'
        f'请求输出 {CANVAS[0]}×{CANVAS[1]} PNG。蓝色 RGB{FRAME_COLOUR} 定位框保持原数量、'
        '位置和闭合边，仅作后续裁切标记，不能加进素材本体。'
        f'框内透明留白、格间和框外统一保持纯洋红 RGB{MATTE_COLOUR}，不能改成白底、黑底或棋盘格。'
    )


def panel_prompt(subject, panel_size, cell_groups):
    lines = []
    lines.append(
        f'用途：原版二维卡通游戏的{subject}高清图片资产。'
        '参考图已经严格按 ui.json 控件的 Image 与八个 FrameImage 属性方向，'
        '把原始切片拼成一个完整面板；边框必须跨切片连续，不能把每个碎片分开加封边。'
        '保持整块面板的底色、边角半径、明暗层次、花纹连续性和原比例；'
        '只恢复低分辨率采样丢失的线条与材质细节，不重新设计组件。'
    )
    lines.append(f'完整面板逻辑尺寸为 {panel_size[0]}×{panel_size[1]}。')
    lines.append(
        '原低透明度切片已在参考图中按同一面板归一显示；返回结果仍保持参考图的相对透明度，'
        '不要让整块面板变成全不透明，也不要给边缘加新的紫色光晕或黑色外框。'
    )
    lines.append(reference_footer())
    lines.append(
        '本请求只有一个完整拼接面板。返回后程序会按 panelBox 把同一张结果切回各原始切片，'
        '因此必须保证四角、四边和中央区域彼此衔接，尤其不能让中央区或某条边单独改色。'
    )
    for group in cell_groups:
        lines.append(f'该面板包含原始切片：{", ".join(group["sources"])}。')
    return '\n'.join(lines)


def text_prompt(cell_groups):
    descriptions = []
    for index, group in enumerate(cell_groups, 1):
        metadata = group['metadata']
        text = metadata.get('text')
        if text is None:
            text = ''.join(run.get('text', '') for run in metadata.get('runs', []))
        descriptions.append(
            f'第{index}格原文字准确内容为 {json.dumps(text, ensure_ascii=False)}；'
            f'保持原字体骨架、字距、倾斜、轮廓和原图占位，不改成现代字体。'
        )
    return (
        '用途：原版二维卡通游戏中已烘焙进图片的静态文字高清资产。'
        '参考图每一格是一份完整原文字，不是单个字母裁片；必须保留原文字形状和笔画关系。'
        '严格按每格给出的准确原词重绘，不要增加、删减、替换或补充文字，也不要把字面重新居中放大。'
        '保留原颜色、描边、阴影、透明留白和低分辨率图片占位。'
        + reference_footer() + '\n' + '\n'.join(descriptions)
    )


def symbol_prompt(cell_groups):
    return (
        '用途：原版二维卡通游戏 UI 的独立图案、符号与小部件高清资产。'
        '参考图每一格是一份独立完整原图，按原图比例、朝向、色块、线条、透明留白和边缘形状重绘。'
        '不能把一格拆成多份，也不能把相邻格内容拼进当前格；没有文字不要补字。'
        '保留原图的简单二维平面风格、原有黑色描边和原有小尺寸高光，不添加新装饰、投影、立体厚度或写实材质。'
        + reference_footer()
    )


def nonduplicate_chunks(items, max_size):
    chunks = []
    for start in range(0, len(items), max_size):
        chunks.append(list(items[start:start + max_size]))
    if len(chunks) > 1 and len(chunks[-1]) == 1 and len(chunks[-2]) > 1:
        chunks[-1].insert(0, chunks[-2].pop())
    return chunks


def link_cells_to_coverage(cell_actions, job_id, cells):
    for cell in cells:
        cell_actions[cell['source']] = dict(
            job=job_id,
            cell=cell['source'],
            box=cell.get('box'),
            frame=cell.get('frame'),
            panelBox=cell.get('panelBox'),
            panelSize=cell.get('panelSize'),
        )


def prepare():
    simple_sources = set(load_json(CATALOGUE_DIR / 'simple-ui-artwork.json')['assets'])
    text_metadata = load_json(CATALOGUE_DIR / 'source-text-artwork.json')['assets']
    old_buttons = load_json(CATALOGUE_DIR / 'button-artwork.json')['assets']
    import importlib.util
    spec = importlib.util.spec_from_file_location('raster_buttons', ROOT / 'scripts/prepare-raster-button-backgrounds.py')
    buttons = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(buttons)
    button_sources = set(buttons.build_records(ROOT)[0])
    for source, entry in old_buttons.items():
        if source not in button_sources:
            text_metadata.setdefault(source, entry['text'])
    text_sources = set(text_metadata)
    catalog_sources = simple_sources | text_sources | button_sources

    restore_sources = None
    if RESTORE_SOURCES_PATH.is_file():
        restore_sources = set(load_json(RESTORE_SOURCES_PATH))
    inventory_list = load_json(INVENTORY_PATH)['textures']
    inventory = {entry['source']: entry for entry in inventory_list}
    ui = load_json(UI_PATH)
    runtime = RuntimeUiIndex(ui)

    installed = set()
    for filename in EXISTING_REDRAW_FILES:
        path = ART / filename
        if path.is_file():
            installed.update(load_json(path))

    missing = sorted(
        source for source in catalog_sources
        if source not in inventory or not (ROOT / inventory[source]['original']).is_file()
    )
    if missing:
        missing_records = [dict(
            source=source,
            status='missing',
            reason='catalogue source has no inventory entry or original PNG',
        ) for source in missing]
        save_json(ART / 'raster-ui-coverage.json', dict(
            inputs=dict(simple=len(simple_sources), text=len(text_sources),
                        button=len(button_sources), catalogueTotal=len(catalog_sources)),
            coverageCounts={'missing': len(missing)},
            sources=missing_records,
        ))
        for source in missing:
            print(f'missing inventory/original: {source}')
        raise RuntimeError(f'{len(missing)} catalogue sources lack original PNG data')

    runtime_assets = set(runtime.runtime_assets)
    runtime_assets.update(CODE_CONSUMED_ASSETS)
    runtime_assets.update(glyph['asset'] for font in load_json(ROOT / 'recovery/output/web-assets/ui-fonts.json')['fonts']
                          for glyph in font.get('glyphs', []))
    active = {
        source for source in (simple_sources | text_sources) - button_sources
        if source in runtime_assets
        and source not in installed
        and not source.startswith('ui/regions/71/')
        and 'reference-hero' not in source.casefold()
    }

    representative, members_by_representative = canonical_groups(active, inventory, text_sources)
    representatives = sorted(members_by_representative)
    solid_cache = {}
    for source in representatives:
        entry = inventory[source]
        if source not in text_sources:
            solid_cache[source] = solid_description(entry)

    text_representatives = [
        source for source in representatives
        if source in text_sources
    ]
    solid_representatives = [
        source for source in representatives
        if source in solid_cache and solid_cache[source] is not None
    ]
    panel_representatives = set()
    symbol_representatives = [
        source for source in representatives
        if source not in text_representatives and source not in solid_representatives
    ]

    jobs = []
    solid_records = []
    cell_actions = {}
    action_kind = {}
    action_job = {}

    # Panel jobs are assembled first so the visual continuity wins over generic
    # symbol grouping.
    panel_families = []
    for family, usages in runtime.families.items():
        assets = {asset for _, asset in family}
        family_representatives = {
            representative[asset] for asset in assets
            if asset in representative
            and representative[asset] not in solid_representatives
            and representative[asset] not in text_representatives
        }
        if not family_representatives:
            continue
        best_usage = min(usages, key=lambda usage: (
            panel_priority(usage['layout'], usage['control']),
            usage['layout'],
            usage['control'] or '',
        ))
        panel_families.append((best_usage, family, family_representatives, usages))
    panel_families.sort(key=lambda item: (
        panel_priority(item[0]['layout'], item[0]['control']),
        item[0]['layout'],
        item[0]['control'] or '',
        tuple(source for _, source in item[1]),
    ))

    used_job_ids = set()

    def next_job_id(prefix, base):
        base = job_slug(base)
        candidate = f'raster-ui-{prefix}-{base}'
        suffix = 2
        while candidate in used_job_ids:
            candidate = f'raster-ui-{prefix}-{base}-{suffix}'
            suffix += 1
        used_job_ids.add(candidate)
        return candidate

    for usage, family, candidate_representatives, usages in panel_families:
        unassigned = {
            rep for rep in candidate_representatives
            if rep not in panel_representatives
        }
        if not unassigned:
            continue
        panel, boxes = assemble_panel(family, inventory)
        if panel is None:
            runtime.unresolved.append(dict(
                layout=usage['layout'],
                control=usage['control'],
                property='panel',
                reference='assemble_panel',
                reason='unsupported frame family',
            ))
            continue
        panel_bounds = alpha_bounds(panel)
        family_assets = dict(family)
        cell_groups = []
        for rep in sorted(unassigned, key=source_sort_key):
            members = members_by_representative[rep]
            for property_name, box in boxes.items():
                asset = family_assets.get(property_name)
                if asset and representative.get(asset) == rep:
                    panel_representatives.add(rep)
                    cell_groups.append(dict(
                        sources=members,
                        size=inventory[rep]['size'],
                        kind='panel',
                        priority=panel_priority(usage['layout'], usage['control']),
                        reference_index=0,
                        panelSize=[panel.width, panel.height],
                        cell_extra=dict(
                            panelBox=list(box),
                            panelSize=[panel.width, panel.height],
                            panelInkBounds=panel_bounds,
                        ),
                    ))
                    break

        if not cell_groups:
            continue
        subject = panel_subject(usage['layout'], usage['control'])
        job_id = next_job_id(
            'panel',
            f'{path_stem(usage["layout"])}-{usage["control"]}-{len(jobs):03d}',
        )
        prompt = panel_prompt(subject, panel.size, cell_groups)
        references = [dict(image=panel)]
        job, _ = build_reference_job(job_id, references, prompt, cell_groups)
        folder = ROOT / job['folder']
        panel.save(folder / 'original-panel.png')
        jobs.append(job)
        link_cells_to_coverage(cell_actions, job_id, job['cells'])
        action_kind.update({source: 'panel' for source in job['sources']})
        action_job.update({source: job_id for source in job['sources']})

    # Text groups are packed by original imageset and face, with complete words
    # kept together in one cell.
    text_groups = defaultdict(list)
    for rep in sorted(text_representatives, key=source_sort_key):
        key = (
            runtime.source_set.get(rep, 'ui/fonts/static-text'),
            text_metadata[rep].get('face', ''),
        )
        text_groups[key].append(rep)
    for key in sorted(text_groups):
        items = text_groups[key]
        for chunk in nonduplicate_chunks(items, 6):
            references = [dict(image=open_original(inventory[rep])) for rep in chunk]
            cell_groups = [dict(
                sources=members_by_representative[rep],
                size=inventory[rep]['size'],
                metadata=text_metadata[rep],
                kind='text',
                priority=200,
            ) for rep in chunk]
            job_id = next_job_id('text', f'{key[1]}-{len(jobs):03d}')
            job, _ = build_reference_job(job_id, references, text_prompt(cell_groups), cell_groups)
            jobs.append(job)
            link_cells_to_coverage(cell_actions, job_id, job['cells'])
            action_kind.update({source: 'text' for source in job['sources']})
            action_job.update({source: job_id for source in job['sources']})

    # Remaining symbols are grouped by source parents and size classes.  Login
    # input images are kept as single requests because the installer has a
    # dedicated wood-box extraction path for those exact paths.
    symbol_representatives.sort(key=source_sort_key)
    symbol_by_key = defaultdict(list)
    for rep in symbol_representatives:
        if rep in panel_representatives:
            continue
        if rep in SPECIAL_SINGLE_SOURCES:
            symbol_by_key[('special-single', rep)].append(rep)
            continue
        longest = max(inventory[rep]['size'])
        size_class = 'tiny' if longest <= 16 else 'small' if longest <= 64 \
            else 'medium' if longest <= 160 else 'large'
        symbol_by_key[(source_family(rep), size_class)].append(rep)

    for key in sorted(symbol_by_key, key=lambda item: (str(item[0]), item[1])):
        items = symbol_by_key[key]
        if key[0] == 'special-single':
            chunk_size = 1
        else:
            longest = max(max(inventory[rep]['size']) for rep in items)
            chunk_size = 8 if longest <= 32 else 6 if longest <= 96 else 4 if longest <= 192 else 2
        for chunk in nonduplicate_chunks(items, chunk_size):
            references = [dict(image=open_original(inventory[rep])) for rep in chunk]
            cell_groups = []
            for rep in chunk:
                priority = 9 if rep in SCROLLBAR_SOURCES else 8 if rep in SPECIAL_SINGLE_SOURCES else 400
                cell_groups.append(dict(
                    sources=members_by_representative[rep],
                    size=inventory[rep]['size'],
                    kind='symbol',
                    priority=priority,
                ))
            job_id = next_job_id('symbol', f'{key[0]}-{key[1]}-{len(jobs):03d}')
            job, _ = build_reference_job(job_id, references, symbol_prompt(cell_groups), cell_groups)
            jobs.append(job)
            link_cells_to_coverage(cell_actions, job_id, job['cells'])
            action_kind.update({source: 'symbol' for source in job['sources']})
            action_job.update({source: job_id for source in job['sources']})

    # Solid sources never enter the image API.  The root worker can restore
    # them at 4x while preserving the original alpha silhouette/colour.
    for rep in sorted(solid_representatives, key=source_sort_key):
        members = members_by_representative[rep]
        info = solid_cache[rep]
        entry = inventory[rep]
        solid_records.append(dict(
            source=rep,
            sources=members,
            canonical=entry['canonical'],
            original=entry['original'],
            png=entry['png'],
            size=entry['size'],
            targetSize=[entry['size'][0] * 4, entry['size'][1] * 4],
            kind=info['kind'],
            colour=info['colour'],
            rgba=info['rgba'],
            solidColour=info['colour'],
            alphaExtrema=info['alphaExtrema'],
            alphaUniform=info['alphaUniform'],
            aliases=[source for source in members if source != rep],
            reason='pure constant source; upscale the original PNG to targetSize so the '
                   'alpha silhouette is preserved, using solidColour for the flat colour',
        ))
        action_kind.update({source: 'solid' for source in members})
        action_job.update({source: f'solid-sources:{rep}' for source in members})

    unqueued = sorted(
        source for source in active
        if action_kind.get(source) not in ('panel', 'text', 'symbol', 'solid')
    )
    if unqueued:
        raise RuntimeError(f'{len(unqueued)} active sources have no queue/solid action: {unqueued[:20]}')

    jobs.sort(key=lambda job: (job.get('priority', 400), job['id']))

    # Build a source-complete coverage record.  A source is never silently
    # dropped: it is either queued, aliased to a queued source, solid, or
    # explicitly excluded with a reason.
    coverage = {}
    for source in sorted(catalog_sources, key=source_sort_key):
        entry = inventory.get(source)
        record = dict(
            source=source,
            canonical=entry.get('canonical') if entry else None,
            original=entry.get('original') if entry else None,
            png=entry.get('png') if entry else None,
            size=entry.get('size') if entry else None,
            status='unknown',
            reason=None,
        )
        if source in button_sources:
            record.update(status='excluded', reason='owned by the separate button-text worker')
        elif source in installed:
            record.update(status='excluded', reason='already installed raster redraw')
        elif source.startswith('ui/regions/71/'):
            record.update(status='excluded', reason='removed keyboard source')
        elif 'reference-hero' in source.casefold():
            record.update(status='excluded', reason='removed reference-hero source')
        elif source not in runtime_assets:
            if source in runtime.superseded_paths:
                record.update(status='excluded', reason='superseded non-DDS duplicate directory')
            else:
                record.update(status='excluded', reason='not consumed by current ui.json or explicit code paths')
            record['layout'] = runtime.superseded_paths.get(source)
        elif source not in active:
            record.update(status='excluded', reason='not active after runtime/install filtering')
        else:
            rep = representative[source]
            if source != rep:
                record.update(status='alias', aliasOf=rep, resolvedKind=action_kind.get(rep))
            else:
                record.update(status='queued', resolvedKind=action_kind.get(rep))
            record['job'] = action_job.get(source)
            if source in cell_actions:
                record.update(cellActions=cell_actions[source])
        if restore_sources is not None and source not in restore_sources:
            record['restoreManifest'] = 'not listed'
        coverage[source] = record

    for source in sorted(set(restore_sources or ()) - catalog_sources):
        coverage[source] = dict(
            source=source,
            status='unresolved',
            reason='listed for restore but absent from the three read-only catalogues',
        )

    if runtime.unresolved:
        for unresolved in runtime.unresolved:
            key = unresolved.get('reference', '')
            if key and key not in coverage:
                coverage[key] = dict(
                    source=key,
                    status='unresolved',
                    reason='ui reference could not be resolved to a published asset',
                    reference=unresolved,
                )

    jobs_path = ART / 'raster-ui-jobs.json'
    solid_path = ART / 'raster-ui-solid-sources.json'
    coverage_path = ART / 'raster-ui-coverage.json'
    save_json(jobs_path, jobs)
    save_json(solid_path, solid_records)

    counts = Counter(record['status'] for record in coverage.values())
    report = dict(
        inputs=dict(
            simple=len(simple_sources),
            text=len(text_sources),
            button=len(button_sources),
            catalogueTotal=len(catalog_sources),
            restoreManifest=len(restore_sources) if restore_sources is not None else None,
        ),
        runtime=dict(
            selectedImagesets=len(runtime.selected_sets),
            runtimeAssets=len(runtime.runtime_assets),
            supersededAssets=len(runtime.superseded_paths),
            explicitCodeAssets=sorted(CODE_CONSUMED_ASSETS),
            unresolvedReferences=runtime.unresolved,
        ),
        actions=dict(
            jobs=len(jobs),
            apiSources=sum(len(job['sources']) for job in jobs),
            panelSources=sum(len(job['sources']) for job in jobs if job['kind'] == 'panel'),
            textSources=sum(len(job['sources']) for job in jobs if job['kind'] == 'text'),
            symbolSources=sum(len(job['sources']) for job in jobs if job['kind'] == 'symbol'),
            solidSources=sum(len(record['sources']) for record in solid_records),
        ),
        coverageCounts=dict(sorted(counts.items())),
        observations=OBSERVATIONS,
        limitations=[
            'This script prepares references, prompts, queues, and a solid-source list only; it deliberately does not call the image API.',
            'The worktree lacks ignored runtime and original assets; run it only after integrating into the repository that contains recovery/output/web-assets, art/hd-assets, and the read-only catalogues.',
            'Button artwork is intentionally excluded and remains owned by the separate unlettered-button worker.',
        ],
        sources=[coverage[source] for source in sorted(coverage, key=source_sort_key)],
    )
    save_json(coverage_path, report)

    print(f'{len(jobs)} raster UI jobs -> {jobs_path.relative_to(ROOT)}')
    print(f'{len(solid_records)} solid canonical source groups -> {solid_path.relative_to(ROOT)}')
    print(f'{len(coverage)} source records -> {coverage_path.relative_to(ROOT)}')
    return jobs, solid_records, report


def main():
    prepare()


if __name__ == '__main__':
    main()
