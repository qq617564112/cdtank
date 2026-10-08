"""Pack runtime image files into lossless sprite sheets and update local references."""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import struct

from PIL import Image, ImageChops
from PIL.PngImagePlugin import PngInfo
from image_asset_usage import image_usage

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'recovery/output/web-assets'
BACKUP = ROOT / 'art/hd-assets/sprite-originals'
PAGE = 4096


def size(path):
    with path.open('rb') as stream:
        return struct.unpack('>II', stream.read(24)[16:24])


def group(path):
    parts = path.split('/')
    if parts[:2] == ['Data', 'map']:
        return 'map-' + parts[2]
    if parts[:2] == ['Data', 'role']:
        return 'tank-' + parts[2]
    if parts[:2] == ['tank-textures', 'role']:
        return 'tank-' + parts[2]
    if parts[:2] == ['custom-maps', '1002']:
        return 'map-1002'
    if parts[:2] == ['ui', 'regions']:
        return 'ui'
    if path.startswith('local-images/'):
        return 'local-ui'
    return '-'.join(parts[:2]).lower().replace('_', '-')


def contains(outer, inner):
    x, y, w, h = outer
    a, b, c, d = inner
    return a >= x and b >= y and a + c <= x + w and b + d <= y + h


class Sheet:
    def __init__(self):
        self.free = [(0, 0, PAGE, PAGE)]
        self.cells = []

    def fit(self, item):
        w, h = item['size']
        return min(((min(fw - w, fh - h), max(fw - w, fh - h), x, y)
                    for x, y, fw, fh in self.free if w <= fw and h <= fh), default=None)

    def add(self, item, fit):
        _, _, x, y = fit
        w, h = item['size']
        updated = []
        for a, b, c, d in self.free:
            if x >= a + c or x + w <= a or y >= b + d or y + h <= b:
                updated.append((a, b, c, d))
                continue
            if x > a:
                updated.append((a, b, x - a, d))
            if x + w < a + c:
                updated.append((x + w, b, a + c - x - w, d))
            if y > b:
                updated.append((a, b, c, y - b))
            if y + h < b + d:
                updated.append((a, y + h, c, b + d - y - h))
        updated = list(dict.fromkeys(updated))
        self.free = [rect for i, rect in enumerate(updated)
                     if not any(i != j and contains(other, rect) for j, other in enumerate(updated))]
        self.cells.append(dict(item=item, x=x, y=y))


def plan(items):
    sheets = []
    for item in sorted(items, key=lambda row: (-max(row['size']), -math.prod(row['size']), row['path'])):
        choices = [(fit, i) for i, sheet in enumerate(sheets) if (fit := sheet.fit(item))]
        if choices:
            fit, i = min(choices)
        else:
            sheets.append(Sheet())
            i = len(sheets) - 1
            fit = sheets[i].fit(item)
        sheets[i].add(item, fit)
    return sheets


def source_paths():
    previous = BACKUP / 'manifest.json'
    rows = json.loads(previous.read_text())['files'] if previous.exists() else []
    sources = {}
    for row in rows:
        original = ROOT / row['source']
        sources[row['path']] = original if original.exists() else BACKUP / row['source']
    for path in RUNTIME.rglob('*.png'):
        if path.is_relative_to(RUNTIME / 'sprites'):
            continue
        sources[path.relative_to(RUNTIME).as_posix()] = path
    for path in (ROOT / 'apps/web/src').rglob('*.png'):
        sources['local-images/' + path.relative_to(ROOT / 'apps/web/src').as_posix()] = path
    return sources


def publish_sheet(name, index, sheet):
    width = max(cell['x'] + cell['item']['size'][0] for cell in sheet.cells)
    height = max(cell['y'] + cell['item']['size'][1] for cell in sheet.cells)
    image = Image.new('RGBA', (width, height))
    mappings = {}
    profile = None
    for cell in sheet.cells:
        item = cell['item']
        with Image.open(item['source']) as source:
            rgba = source.convert('RGBA')
            if profile is None:
                profile = {key: source.info[key] for key in ('icc_profile', 'gamma', 'srgb') if key in source.info}
            image.paste(rgba, (cell['x'], cell['y']))
        for path in item['aliases']:
            mappings['/' + path] = dict(atlas=f'/sprites/{name}-{index:03}.png', x=cell['x'], y=cell['y'],
                                         width=item['size'][0], height=item['size'][1])
    target = RUNTIME / f'sprites/{name}-{index:03}.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    metadata = PngInfo()
    if 'gamma' in profile:
        metadata.add(b'gAMA', struct.pack('>I', round(profile['gamma'] * 100000)))
    if 'srgb' in profile:
        metadata.add(b'sRGB', bytes([profile['srgb']]))
    image.save(target, compress_level=6, pnginfo=metadata,
               **({'icc_profile': profile['icc_profile']} if 'icc_profile' in profile else {}))
    with Image.open(target) as stored:
        stored = stored.convert('RGBA')
        for cell in sheet.cells:
            item = cell['item']
            x, y = cell['x'], cell['y']
            w, h = item['size']
            with Image.open(item['source']) as source:
                # Exact channel comparisons include RGB under full transparency.
                difference = ImageChops.difference(stored.crop((x, y, x + w, y + h)), source.convert('RGBA'))
                if any(channel.getbbox() for channel in difference.split()):
                    raise ValueError(f'Sprite pixels differ: {item["path"]}')
    return mappings, dict(path=target.relative_to(RUNTIME).as_posix(), width=width, height=height,
                          cells=len(sheet.cells), references=len(mappings), bytes=target.stat().st_size)


def rewrite_local_references(packed):
    changed = []
    replacements = 0
    for path in (ROOT / 'apps/web/src').rglob('*'):
        if path.suffix not in ('.ts', '.tsx', '.css'):
            continue
        before = path.read_text()

        def virtual(relative):
            source = (path.parent / relative).resolve()
            if not source.is_relative_to(ROOT / 'apps/web/src'):
                return None
            key = '/local-images/' + source.relative_to(ROOT / 'apps/web/src').as_posix()
            return key if key in packed else None

        def url(match):
            nonlocal replacements
            key = virtual(match[2])
            if not key:
                return match[0]
            replacements += 1
            return "'" + key + "'"

        after = re.sub(r'new URL\(([\'\"])([^\'\"]+\.png)\1, import\.meta\.url\)\.href', url, before)

        def imported(match):
            nonlocal replacements
            key = virtual(match[2])
            if not key:
                return match[0]
            replacements += 1
            return f"const {match[1]} = '{key}';"

        after = re.sub(r'import (\w+) from [\'\"]([^\'\"]+\.png)[\'\"];', imported, after)
        if after != before:
            path.write_text(after)
            changed.append(path.relative_to(ROOT).as_posix())
    return changed, replacements


def restore():
    manifest = BACKUP / 'manifest.json'
    if not manifest.exists():
        return
    for row in json.loads(manifest.read_text())['files']:
        target = ROOT / row['source']
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(BACKUP / row['source'], target)
    print('Restored original image files; sprite references remain available')


def main():
    global ROOT, RUNTIME, BACKUP
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--restore', action='store_true')
    parser.add_argument('--plan-only', action='store_true')
    args = parser.parse_args()
    ROOT = args.root.resolve()
    RUNTIME = Path(os.environ.get('WEB_ASSETS', 'recovery/output/web-assets'))
    if not RUNTIME.is_absolute():
        RUNTIME = ROOT / RUNTIME
    BACKUP = ROOT / 'art/hd-assets/sprite-originals'
    if args.restore:
        restore()
        return
    sources = source_paths()
    usage = image_usage(ROOT, RUNTIME, sources)
    sources = {name: path for name, path in sources.items() if name in usage['images']}
    groups, unique, records = defaultdict(list), {}, []
    profiles = {}
    original_bytes = 0
    for name, source in sorted(sources.items()):
        w, h = size(source)
        if max(w, h) > PAGE or w * h > 2048 ** 2:
            continue
        original_bytes += source.stat().st_size
        actual = ('apps/web/src/' + name.removeprefix('local-images/')) if name.startswith('local-images/') else 'recovery/output/web-assets/' + name
        records.append(dict(path=name, source=actual, bytes=source.stat().st_size))
        with Image.open(source) as image:
            profile = tuple(image.info.get(key) for key in ('icc_profile', 'gamma', 'srgb'))
            # Bucket decoded pixels once instead of comparing every same-size pair.
            identity = ((w, h), profile, hashlib.sha256(image.convert('RGBA').tobytes()).digest())
        if identity in unique:
            unique[identity]['aliases'].append(name)
            continue
        item = dict(path=name, source=source, size=(w, h), aliases=[name], profile=profile)
        unique[identity] = item
        if profile not in profiles:
            profiles[profile] = len(profiles)
        groups[f'{group(name)}-p{profiles[profile]}'].append(item)
    jobs = [(name, i, sheet) for name, items in sorted(groups.items())
            for i, sheet in enumerate(plan(items))]
    summary = dict(originalImages=len(sources), packedImages=len(records), uniqueCells=len(unique), sheets=len(jobs),
                   standaloneImages=len(sources) - len(records), originalPackedBytes=original_bytes,
                   duplicateImages=len(records) - len(unique), retainedChatGlyphs=len(usage['chatGlyphImages']))
    print(json.dumps(summary), flush=True)
    if args.plan_only:
        return
    mappings, sheets = {}, []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        pending = [executor.submit(publish_sheet, *job) for job in jobs]
        for i, future in enumerate(as_completed(pending), 1):
            cells, sheet = future.result()
            mappings.update(cells)
            sheets.append(sheet)
            if i % 20 == 0 or i == len(jobs):
                print(f'Packed and compared {i}/{len(jobs)} sheets', flush=True)
    directory = dict(images=dict(sorted(mappings.items())), sheets=sorted(sheets, key=lambda row: row['path']))
    temporary = RUNTIME / 'sprite-images.tmp'
    temporary.write_text(json.dumps(directory, separators=(',', ':')) + '\n')
    temporary.replace(RUNTIME / 'sprite-images.json')
    changed, replaced = rewrite_local_references(mappings)
    BACKUP.mkdir(parents=True, exist_ok=True)
    for row in records:
        original = ROOT / row['source']
        backup = BACKUP / row['source']
        if original.exists():
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(original, backup)
            original.unlink()
    (BACKUP / 'manifest.json').write_text(json.dumps(dict(files=records), indent=2) + '\n')
    used = {RUNTIME / sheet['path'] for sheet in sheets}
    for file in (RUNTIME / 'sprites').glob('*.png'):
        if file not in used:
            file.unlink()
    summary.update(publishedImages=len(sources) - len(records) + len(sheets),
                   imageReductionPercent=round((len(records) - len(sheets)) / len(sources) * 100, 2),
                   spriteBytes=sum(sheet['bytes'] for sheet in sheets), changedSources=changed,
                   rewrittenReferences=replaced, pixelComparisons=len(unique), pixelDifferences=0)
    (ROOT / 'art/hd-assets/sprite-packing.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
