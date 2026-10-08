"""Prepare, redraw and install the battle minimap artwork."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

from PIL import Image, ImageChops, ImageDraw
from PIL.PngImagePlugin import PngInfo


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/minimap-cartoon'
ORIGINALS = ROOT / 'art/hd-assets/sprite-originals/apps/web/src/assets/maps/minimaps'
SAMPLES = ROOT / 'output/minimap-cartoon-samples/colored-pencil-v1'
MAP_IDS = [f'{value:04d}' for value in range(1, 26)] + ['1001', '1002']
ENDPOINT = 'http://192.168.10.140:13999/v1/images/edits'
MODEL = 'gpt-image-2.5-sunburst'

SCENES = {
    '0003': '绿色河岛，两条斜向蓝色水道、米黄色环形石路及四座木桥。保留岛屿倾斜朝向、树群、木屋和左右基地；外围蓝灰空白区域仍为原范围的空白。',
    '0004': '方形庭院，中央圆形深井、灰蓝石砖地、四边围墙、绿树和橙色或蓝色屋顶。保留中央井的直径、外围通道、矩形矮墙与两座基地。',
    '0005': '横向狭长绿色岛屿，外围水域、上下两条长围墙、土路环线、木屋、树群和中央橙色物件。保持左右延伸的横向构图及右侧两座基地。',
    '0006': '绿色对称场地，上下两块矩形场地，中间一条横向米黄色通路和木桥。保留灰色网格线、青色小障碍、左右物件及上下基地。',
    '0007': '暖棕色石砖广场，中央蓝色八角喷泉、周围木板、梯子、绿色树丛、蓝色小水池及彩色圆形装饰。保留原图疏密分布和地砖图案。',
    '0008': '夜色工业街区，灰紫色石砖地、横竖灰色公路和虚线标记、三排厂房与杂物。用紫灰彩铅、深色轮廓和暖色木砖细节表现，保留街区布局与左右基地。',
    '0009': '悬空灰蓝石砖通道，七个平台由窄桥连接，中间蓝白棋盘平台和两侧深色平台。保留每条窄路的连接及所有蓝灰空白区域，棋盘是此地图自身地面图案。',
    '0010': '绿色草地上呈向右开口的弯曲米黄色石路，外围弯曲低墙、中心橙色物件、左上和左下基地。完整保留路线转弯和空地比例。',
    '0011': '深蓝紫色夜间草地，中央有多次左右折返的紫色石路，路边少量红色装饰、枯树及上下基地。保持S形折返路线、暗色背景和地图边界。',
    '0012': '绿色岛屿、横向中央通路，上下两部分有弯曲低墙、木屋、木桥和橙色装饰。保留上边中央的方形缺口、外部蓝灰空白和左右基地。',
    '0013': '夜色工业城市，灰紫公路形成交错街区，厂房和物件集中在几个矩形区块，中央小广场有圆形设施。保留路网、上下基地和所有建筑位置。',
    '0014': '四块规则排列的金黄色田地，中央十字交叉土路、周边环形土路与低围墙，绿色草地和圆树。保留田垄、橙色作物、道路交叉及四块田地的边界。',
    '0015': '悬空灰蓝平台，中间深色方形平台，外周窄路连接四个浅色方台和上下蓝白棋盘台。保留桥路连接、平台大小与蓝灰空白；棋盘是此地图自身地面图案。',
    '0016': '浅绿色草地、多条蜿蜒分叉蓝色河流，散布棕色木桥，中央橙色基地和浅色短墙。保留所有河流分叉、桥的数量与位置、右下斜向通道和青色小物件。',
    '0017': '绿色竞技场，中央大块白色圆角区域、对称白色短墙、外周边界及零散红色和浅色物件。保留中央区域轮廓和每段墙的朝向、位置及长度。',
    '0018': '深蓝夜间悬空平台，外围四角平台和四条连接通道围绕中央蓝灰正方形空白。深色砖地与少量亮色小物件，保留平台连通和中央空白大小。',
    '0019': '绿色横向岛屿，四块区域由中央十字土路分隔，外围低墙与弯曲内墙、木屋、木桥、树群和橙色装饰。保留上、下方水域的范围。',
    '0020': '夜间工业地图，灰紫道路形成不规则环路和分支，四周厂房、中央通道及左右基地。保留每段公路、建筑区、圆形设施和条纹路障。',
    '0021': '暖棕色宽广石砖广场，偏下蓝色八角喷泉，上方小建筑、两座蓝色水池、少量绿树、木梯与彩色圆形物件。保留外围窄绿色和蓝色边带。',
    '0022': '绿色场地中规则排列的白色云团或雪堆，交替出现青绿树丛与零散红色小物件。保留规则排列、每个白色区域和树丛的数量及位置。',
    '0023': '浅绿色上下对称场地，中央横向通路和两座红色梯形设施，灰色格线、白色云团、青色障碍及上下基地。保留全部原图线条和物件，不新增图例。',
    '0024': '绿色竞技场、中央白色圆角区域和小绿岛，对称白色短墙、红色及浅色小物件。保持中央绿岛与全部墙段数量、长度和朝向。',
    '0025': '灰蓝方形庭院，中央圆井、四条粉色通道、外周彩色小符号、绿树和橙蓝屋顶。保留地图固有彩色符号的位置，作为图案绘制，保持道路与中央圆井完整。',
    '1001': '金黄色田地上的灰蓝方块与狭窄通道，四处橙红木桥或台阶、中央深棕物件。保留方块数量、连接关系及上下深色空白带，田垄使用彩铅短线。',
    '1002': '田野路，绿色草地、外周低石墙、左右纵向和上下横向米黄色鹅卵石路、六座周边木屋、两座桥、中央蓝湖和橙色障碍、上下基地。树群与草花细节保持已确认田野路样图的密度，所有位置以本图为准。',
}


def prepare():
    for directory in ('originals', 'references', 'prompts', 'responses', 'images'):
        (ART / directory).mkdir(parents=True, exist_ok=True)
    for map_id in MAP_IDS:
        shutil.copy2(ORIGINALS / f'{map_id}.png', ART / 'originals' / f'{map_id}.png')
    shutil.copy2(SAMPLES / 'style-reference.png', ART / 'references/style-reference.png')
    for map_id in ('0001', '0002'):
        shutil.copy2(SAMPLES / f'{map_id}-cartoon.png', ART / 'images' / f'{map_id}.png')
        shutil.copy2(SAMPLES / f'{map_id}-cartoon.png', ART / 'references' / f'{map_id}.png')
        shutil.copy2(SAMPLES / f'{map_id}-prompt.txt', ART / 'prompts' / f'{map_id}.txt')
        shutil.copy2(SAMPLES / f'{map_id}-response.json', ART / 'responses' / f'{map_id}.json')
    base = (SAMPLES / '0001-prompt.txt').read_text().split('\n本图是')[0]
    base = base.replace('细节量介于原图与极简图之间', '细节密度与第三、第四张已确认地图一致')
    base += '\n第三张和第四张是已确认的地图画风与细节密度参考，只参考彩铅笔触、轮廓、配色与材质表达，不能复制其地图布局或物件。直接重绘完整第一张原地图，保留丰富的原有地形细节。所有道路、河流、平台、空白区域和主要物件的边界必须对齐第一张，不能移动、合并、删除、简化或重排；不旋转、不镜像、不裁切，保持原画布比例与覆盖范围。\n'
    (ART / 'prompts/style.txt').write_text(base)
    for map_id, scene in SCENES.items():
        (ART / 'prompts' / f'{map_id}.txt').write_text(base + '\n本图地形：' + scene + '\n')
    print(f'Prepared {len(MAP_IDS)} maps and the approved prompts.', flush=True)


def request(map_id, key):
    prompt = (ART / 'prompts' / f'{map_id}.txt').read_text()
    images = [ART / 'originals' / f'{map_id}.png', ART / 'references/style-reference.png',
              ART / 'references/0001.png', ART / 'references/0002.png']
    command = ['curl', '--max-time', '1300', '--silent', '--show-error', ENDPOINT,
               '--header', '@-', '--form-string', 'model=' + MODEL,
               '--form-string', 'prompt=' + prompt, '--form-string', 'n=1',
               '--form-string', 'response_format=url', '--write-out', '\n%{http_code}']
    for image in images:
        command.extend(['--form', 'image=@' + str(image)])
    result = subprocess.run(command, input=('Authorization: Bearer ' + key + '\n').encode(),
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(f'curl exited {result.returncode}: ' + result.stderr.decode(errors='replace'))
    body, status = result.stdout.rsplit(b'\n', 1)
    if not 200 <= int(status) < 300:
        raise RuntimeError(f'HTTP {status.decode()}: ' + body[:500].decode(errors='replace'))
    payload = json.loads(body)
    if not payload.get('data') or not payload['data'][0].get('url'):
        raise RuntimeError('Image API returned no data[0].url')
    (ART / 'responses' / f'{map_id}.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    return payload


def generate_one(map_id, key):
    target = ART / 'images' / f'{map_id}.png'
    if target.exists():
        return map_id + ': saved image reused'
    response = ART / 'responses' / f'{map_id}.json'
    for attempt in range(3):
        try:
            payload = json.loads(response.read_text()) if response.exists() else request(map_id, key)
            with urllib.request.urlopen(payload['data'][0]['url'], timeout=180) as downloaded:
                data = downloaded.read()
            temporary = target.with_suffix('.tmp')
            temporary.write_bytes(data)
            with Image.open(temporary) as image:
                image.load()
                image.save(target, format='PNG')
                size = image.size
            temporary.unlink()
            return f'{map_id}: saved {size[0]}x{size[1]}'
        except Exception as error:
            message = str(error).replace(key, '[redacted]')
            print(f'{map_id}: {message}', flush=True)
            if attempt == 2:
                return map_id + ': failed'
            print(f'{map_id}: waiting 300 seconds before retry', flush=True)
            time.sleep(300)


def generate(ids, workers):
    key = os.environ['CHATGPT2API_KEY']
    pending = [map_id for map_id in ids if not (ART / 'images' / f'{map_id}.png').exists()]
    print(f'Generating {len(pending)} maps with {workers} curl requests at a time.', flush=True)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(generate_one, map_id, key) for map_id in pending]
        for future in as_completed(futures):
            print(future.result(), flush=True)
    missing = [map_id for map_id in ids if not (ART / 'images' / f'{map_id}.png').exists()]
    if missing:
        raise SystemExit('Missing maps: ' + ', '.join(missing))


def clean_old():
    assets = ROOT / os.environ.get('CDTANK_WEB_ASSETS', 'recovery/output/web-assets')
    keys = {f'/local-images/assets/maps/minimaps/{map_id}.png' for map_id in MAP_IDS}
    for map_id in MAP_IDS:
        with Image.open(ORIGINALS / f'{map_id}.png') as backup:
            backup.load()
        if not (assets / 'cartoon-minimaps' / f'{map_id}.webp').is_file():
            raise SystemExit(f'Missing replacement minimap: {map_id}')
    path = assets / 'sprite-images.json'
    directory = json.loads(path.read_text())
    old = {key: cell for key, cell in directory['images'].items() if key in keys}
    retained = {key: cell for key, cell in directory['images'].items() if key not in keys}
    removed_atlases = set()
    for atlas in sorted({cell['atlas'] for cell in old.values()}):
        target = assets / atlas.lstrip('/')
        keep = [cell for cell in retained.values() if cell['atlas'] == atlas]
        if not keep:
            removed_atlases.add(atlas)
            continue
        with Image.open(target) as source:
            original = source.convert('RGBA')
            info = source.info.copy()
        image = original.copy()
        cells = {tuple(cell[name] for name in ('x', 'y', 'width', 'height'))
                 for cell in old.values() if cell['atlas'] == atlas}
        for x, y, width, height in cells:
            image.paste((0, 0, 0, 0), (x, y, x + width, y + height))
        metadata = PngInfo()
        for name, value in info.items():
            if isinstance(value, str):
                metadata.add_text(name, value)
        temporary = target.with_suffix('.tmp')
        image.save(temporary, format='PNG', compress_level=6, pnginfo=metadata,
                   **({'icc_profile': info['icc_profile']} if 'icc_profile' in info else {}))
        with Image.open(temporary) as stored:
            stored = stored.convert('RGBA')
            for cell in keep:
                x, y = cell['x'], cell['y']
                box = (x, y, x + cell['width'], y + cell['height'])
                difference = ImageChops.difference(original.crop(box), stored.crop(box))
                if any(channel.getbbox() for channel in difference.split()):
                    raise ValueError(f'Retained sprite changed: {atlas} {box}')
        temporary.replace(target)
    directory['images'] = retained
    directory['sheets'] = [sheet for sheet in directory.get('sheets', [])
                           if '/' + sheet['path'] not in removed_atlases]
    for sheet in directory['sheets']:
        atlas = '/' + sheet['path']
        if atlas not in {cell['atlas'] for cell in old.values()}:
            continue
        cells = [cell for cell in retained.values() if cell['atlas'] == atlas]
        sheet['references'] = len(cells)
        sheet['cells'] = len({tuple(cell[name] for name in ('x', 'y', 'width', 'height'))
                              for cell in cells})
        sheet['bytes'] = (assets / sheet['path']).stat().st_size
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(directory, separators=(',', ':')) + '\n')
    temporary.replace(path)
    for atlas in removed_atlases:
        (assets / atlas.lstrip('/')).unlink()
    for map_id in MAP_IDS:
        for standalone in (ROOT / 'apps/web/src/assets/maps/minimaps' / f'{map_id}.png',
                           assets / 'local-images/assets/maps/minimaps' / f'{map_id}.png'):
            if standalone.exists():
                standalone.unlink()
    print(f'Removed {len(old)} old minimap entries and {len(removed_atlases)} unused atlas; '
          f'{len(MAP_IDS)} original backups retained.', flush=True)


def install():
    missing = [map_id for map_id in MAP_IDS if not (ART / 'images' / f'{map_id}.png').exists()]
    if missing:
        raise SystemExit('Missing maps: ' + ', '.join(missing))
    assets = ROOT / os.environ.get('CDTANK_WEB_ASSETS', 'recovery/output/web-assets')
    runtime = assets / 'cartoon-minimaps'
    runtime.mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGB', (6 * 240, 5 * 266), '#eeeeee')
    draw = ImageDraw.Draw(sheet)
    entries = []
    for index, map_id in enumerate(MAP_IDS):
        with Image.open(ART / 'images' / f'{map_id}.png') as source:
            image = source.convert('RGB')
            image.resize((1024, 1024), Image.Resampling.LANCZOS).save(
                runtime / f'{map_id}.webp', quality=92, method=6)
            image.thumbnail((232, 232), Image.Resampling.LANCZOS)
            x, y = index % 6 * 240 + 4, index // 6 * 266 + 26
            sheet.paste(image, (x, y))
            draw.text((x, y - 20), map_id, fill='black')
        entries.append(f"  {int(map_id)}: '/cartoon-minimaps/{map_id}.webp',")
    mapping = ROOT / 'apps/web/src/assets/maps/minimaps/index.ts'
    mapping.write_text('export const mapMinimaps: Readonly<Record<number, string>> = {\n'
                       + '\n'.join(entries) + '\n};\n')
    sheet.save(ART / 'preview.jpg', quality=94)
    clean_old()
    print(f'Installed {len(MAP_IDS)} minimaps in {runtime}', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('prepare', 'generate', 'install', 'clean-old'))
    parser.add_argument('--ids', nargs='+', choices=MAP_IDS, default=MAP_IDS)
    parser.add_argument('--workers', type=int, default=2)
    args = parser.parse_args()
    if args.action == 'prepare':
        prepare()
    elif args.action == 'generate':
        generate(args.ids, args.workers)
    elif args.action == 'clean-old':
        clean_old()
    else:
        install()


if __name__ == '__main__':
    main()
