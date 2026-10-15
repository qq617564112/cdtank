import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import json
import os
from pathlib import Path
import shutil
import tempfile

from PIL import Image

from .encoding import WebpEncoder
from .public_layout import organize_public, public_path, prune_empty_directories
from .sprite_scopes import SCOPES, deferred_image, image_scopes


REPOSITORY = Path(__file__).resolve().parents[2]
RECIPE = Path(__file__).with_name('recipe.json')
PADDING = 4
EXTRUSION = 2


@dataclass(frozen=True)
class Rectangle:
    x: int
    y: int
    width: int
    height: int

    def contains(self, other):
        return (self.x <= other.x and self.y <= other.y
            and self.x + self.width >= other.x + other.width
            and self.y + self.height >= other.y + other.height)


class Page:
    def __init__(self, size):
        self.free = [Rectangle(0, 0, size, size)]
        self.items = []

    def fit(self, width, height):
        choices = [(min(rect.width - width, rect.height - height),
            max(rect.width - width, rect.height - height), rect.y, rect.x)
            for rect in self.free if width <= rect.width and height <= rect.height]
        return min(choices) if choices else None

    def insert(self, row, fit):
        width, height = row['size']
        used = Rectangle(fit[3], fit[2], width + 2 * PADDING, height + 2 * PADDING)
        free = []
        for rect in self.free:
            right, bottom = rect.x + rect.width, rect.y + rect.height
            used_right, used_bottom = used.x + used.width, used.y + used.height
            if used.x >= right or used_right <= rect.x or used.y >= bottom or used_bottom <= rect.y:
                free.append(rect)
                continue
            if used.x > rect.x:
                free.append(Rectangle(rect.x, rect.y, used.x - rect.x, rect.height))
            if used_right < right:
                free.append(Rectangle(used_right, rect.y, right - used_right, rect.height))
            if used.y > rect.y:
                free.append(Rectangle(rect.x, rect.y, rect.width, used.y - rect.y))
            if used_bottom < bottom:
                free.append(Rectangle(rect.x, used_bottom, rect.width, bottom - used_bottom))
        unique = list(dict.fromkeys(free))
        self.free = [rect for i, rect in enumerate(unique)
            if not any(i != j and other.contains(rect) for j, other in enumerate(unique))]
        self.items.append((row, used))


def group_name(relative):
    parts = relative.split('/')
    if parts[:2] == ['ui', 'regions']:
        return '/'.join(parts[:3])
    if parts[:3] == ['ui', 'battle', 'digits-v2']:
        return '/'.join(parts[:3])
    if parts[:2] == ['Data', 'effect']:
        return 'battle-status'
    return '/'.join(parts[:2])


def collect(source, recipe, page_size):
    groups = defaultdict(list)
    standalone = []
    for item in recipe['images']:
        if not item['category'].startswith('ui_') and not item['output_relative'].startswith('ui/') \
            and item.get('ui_group') != '共享战斗状态图标':
            continue
        relative = item['output_relative']
        path = source / relative
        size = None
        if path.suffix != '.svg':
            with Image.open(path) as image:
                size = image.size
        row = {'relative': relative, 'source_relative': item['source_relative'],
            'size': size, 'bytes': path.stat().st_size}
        if (path.suffix != '.webp' or item['category'] == 'ui_fullscreen'
            or max(size) + 2 * PADDING > page_size):
            standalone.append(row)
        else:
            groups[group_name(relative)].append(row)
    return groups, standalone


def pack(groups, standalone, page_size):
    jobs = []
    for group, rows in sorted(groups.items()):
        if len(rows) == 1:
            standalone.extend(rows)
            continue
        pages = []
        rows.sort(key=lambda row: (-max(row['size']), -row['size'][0] * row['size'][1], row['relative']))
        for row in rows:
            width, height = (side + 2 * PADDING for side in row['size'])
            choices = [(fit, index) for index, page in enumerate(pages)
                if (fit := page.fit(width, height)) is not None]
            if choices:
                fit, index = min(choices)
            else:
                index = len(pages)
                pages.append(Page(page_size))
                fit = pages[index].fit(width, height)
            pages[index].insert(row, fit)
        for index, page in enumerate(pages, 1):
            if len(page.items) == 1:
                standalone.append(page.items[0][0])
                continue
            name = f'{group.replace("/", "-")}-{index:03d}.webp'
            jobs.append((name, page))
    return jobs


def paste_sprite(canvas, image, x, y):
    width, height = image.size
    canvas.paste(image, (x, y))
    canvas.paste(image.crop((0, 0, 1, height)).resize((EXTRUSION, height), Image.Resampling.NEAREST), (x - EXTRUSION, y))
    canvas.paste(image.crop((width - 1, 0, width, height)).resize((EXTRUSION, height), Image.Resampling.NEAREST), (x + width, y))
    canvas.paste(image.crop((0, 0, width, 1)).resize((width, EXTRUSION), Image.Resampling.NEAREST), (x, y - EXTRUSION))
    canvas.paste(image.crop((0, height - 1, width, height)).resize((width, EXTRUSION), Image.Resampling.NEAREST), (x, y + height))
    for source_x, target_x in ((0, x - EXTRUSION), (width - 1, x + width)):
        for source_y, target_y in ((0, y - EXTRUSION), (height - 1, y + height)):
            canvas.paste(image.getpixel((source_x, source_y)),
                (target_x, target_y, target_x + EXTRUSION, target_y + EXTRUSION))


def render_page(name, page, source, destination, encoder, work):
    width = max(rect.x + rect.width for _, rect in page.items)
    height = max(rect.y + rect.height for _, rect in page.items)
    canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    url = '/sprites/' + name
    images = {}
    for row, rect in page.items:
        x, y = rect.x + PADDING, rect.y + PADDING
        with Image.open(source / row['relative']) as original:
            image = original.convert('RGBA')
        paste_sprite(canvas, image, x, y)
        images['/' + row['relative']] = {'atlas': url, 'x': x, 'y': y,
            'width': image.width, 'height': image.height}
    temporary = work / (name + '.png')
    temporary.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(temporary)
    output = destination / name
    output.parent.mkdir(parents=True, exist_ok=True)
    encoder.encode(temporary, output, 'atlas')
    encoder.verify(output, canvas, {}, exact=True)
    temporary.unlink()
    atlas = {'url': url, 'width': width, 'height': height,
        'bytes': output.stat().st_size, 'images': len(page.items)}
    return atlas, images


def published_files(manifest):
    files = {item['url'] for item in manifest.get('atlases', [])}
    directories = [manifest.get('images', {}),
        *(scope['images'] for scope in manifest.get('scopes', {}).values())]
    files.update(item['url'] for images in directories for item in images.values() if 'url' in item)
    return files


def generate(source, output, recipe_path, page_size, cwebp, workers):
    recipe = json.loads(recipe_path.read_text())
    original_groups, original_standalone = collect(source, recipe, page_size)
    rows = {row['relative']: row for group in original_groups.values() for row in group}
    rows.update({row['relative']: row for row in original_standalone})
    selected = image_scopes(rows, recipe, source)
    font_assets = {glyph['asset'] for font in json.loads((source / 'ui-fonts.json').read_text())['fonts']
        for glyph in font.get('glyphs', [])}
    source_aliases = {item['source_relative']: item['output_relative'] for item in recipe['images']}
    font_assets = {source_aliases.get(name, name) for name in font_assets}
    jobs = []
    standalone = {}
    scoped_images = {scope: {} for scope in SCOPES}
    for scope in SCOPES:
        groups = defaultdict(list)
        singles = []
        for relative in sorted(selected[scope]):
            row = rows[relative]
            if row in original_standalone or deferred_image(relative):
                singles.append(row)
            else:
                group = 'fonts' if relative in font_assets else 'portraits' \
                    if relative.startswith('ui/battle/portraits/framed/') else 'ui'
                groups[group].append(row)
        scope_jobs = pack(groups, singles, page_size)
        jobs.extend((scope + '/' + name, page) for name, page in scope_jobs)
        standalone[scope] = singles
    atlases = []
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.sprites-', dir=output) as directory:
        work = Path(directory)
        staged = work / 'sprites'
        staged.mkdir()
        encoder = WebpEncoder(cwebp, {'atlas': ['-lossless', '-q', '100', '-m', '6', '-exact']}, work)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(render_page, name, page, source, staged, encoder, work): name.split('/')[0]
                for name, page in jobs}
            for index, future in enumerate(as_completed(futures), 1):
                atlas, regions = future.result()
                atlas['scope'] = futures[future]
                atlases.append(atlas)
                scoped_images[futures[future]].update(regions)
                print(f'Atlas {index}/{len(jobs)}: {atlas["url"]} ({atlas["images"]} images)', flush=True)
        for scope in SCOPES:
            for row in standalone[scope]:
                relative = 'standalone/' + scope + '/' + row['relative']
                target = staged / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source / row['relative'], target)
                entry = {'url': '/sprites/' + relative}
                if row['size']:
                    entry.update(zip(('width', 'height'), row['size']))
                scoped_images[scope]['/' + row['relative']] = entry
        # Installation icons retain the fixed paths referenced by the web app manifest.
        images = {}
        for row in original_standalone:
            if not row['relative'].startswith('ui/app-icons/'):
                continue
            target = staged / 'standalone' / row['relative']
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source / row['relative'], target)
            images['/' + row['relative']] = {'url': '/sprites/standalone/' + row['relative'],
                'width': row['size'][0], 'height': row['size'][1]}
        for scope in SCOPES:
            for name, entry in scoped_images[scope].items():
                images.setdefault(name, entry)
        aliases = {'/' + row['source_relative']: '/' + row['output_relative']
            for row in recipe['images'] if '/' + row['output_relative'] in images
            and row['source_relative'] != row['output_relative']}
        for row in recipe['ui_replacements']:
            if '/' + row['replacement'] in images:
                for name in (row['texture'], row['output_relative']):
                    aliases['/' + name] = '/' + row['replacement']
        for asset in [*images, *aliases]:
            aliases['/' + public_path('sprites/standalone/' + asset.lstrip('/'))] = aliases.get(asset, asset)
        scopes = {}
        for scope in SCOPES:
            scope_atlases = [atlas for atlas in atlases if atlas['scope'] == scope]
            scope_images = dict(sorted(scoped_images[scope].items()))
            preload = {entry.get('atlas', entry.get('url')) for name, entry in scope_images.items()
                if not deferred_image(name.lstrip('/'))}
            pixel_bytes = sum(atlas['width'] * atlas['height'] * 4 for atlas in scope_atlases)
            pixel_bytes += sum(row['size'][0] * row['size'][1] * 4 for row in standalone[scope]
                if row['size'] and not deferred_image(row['relative']))
            scopes[scope] = {'images': scope_images, 'preload': sorted(preload), 'summary': {
                'images': len(scope_images), 'atlas_pages': len(scope_atlases),
                'atlas_bytes': sum(atlas['bytes'] for atlas in scope_atlases),
                'standalone_bytes': sum(row['bytes'] for row in standalone[scope]),
                'preload_rgba_bytes': pixel_bytes}}
        summary = {'images': len(images), 'image_copies': sum(len(value) for value in scoped_images.values()),
            'packed_images': sum(len(page.items) for _, page in jobs), 'atlas_pages': len(atlases),
            'standalone_images': sum(len(value) for value in standalone.values()),
            'packed_source_bytes': sum(row['bytes'] for _, page in jobs for row, _ in page.items),
            'atlas_bytes': sum(atlas['bytes'] for atlas in atlases),
            'standalone_bytes': sum(row['bytes'] for values in standalone.values() for row in values),
            'pixels_equal': True}
        manifest = {'version': 2, 'page_size': page_size, 'padding': PADDING, 'extrusion': EXTRUSION,
            'encoder_version': encoder.version, 'atlases': sorted(atlases, key=lambda item: item['url']),
            'images': dict(sorted(images.items())), 'aliases': dict(sorted(aliases.items())),
            'scopes': scopes, 'summary': summary}
        previous_path = output / 'manifests/sprite-images.json'
        previous_path.parent.mkdir(parents=True, exist_ok=True)
        previous = json.loads(previous_path.read_text()) if previous_path.exists() else {}
        for alias, asset in previous.get('aliases', {}).items():
            if asset in images:
                manifest['aliases'].setdefault(alias, asset)
        for path in sorted(staged.rglob('*')):
            if path.is_file():
                target = output / 'sprites' / path.relative_to(staged)
                target.parent.mkdir(parents=True, exist_ok=True)
                path.replace(target)
        previous_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        current_files = {'/' + public_path(url.lstrip('/')) for url in published_files(manifest)}
        for url in published_files(previous) - current_files:
            if url.startswith(('/sprites/', '/assets/ui/')):
                (output / url.lstrip('/')).unlink(missing_ok=True)
    organize_public(output)
    manifest = json.loads(previous_path.read_text())
    for asset in [*manifest['images'], *manifest['aliases']]:
        entry = manifest['images'].get(manifest['aliases'].get(asset, asset))
        if not entry:
            continue
        published = asset if asset.startswith('/assets/') \
            else '/' + public_path('sprites/standalone/' + asset.lstrip('/'))
        if published != entry.get('url') and Path(published).suffix in ('.png', '.webp', '.svg', '.ico'):
            (output / published.lstrip('/')).unlink(missing_ok=True)
    prune_empty_directories(output)
    print(json.dumps({**summary, 'scopes': {name: value['summary'] for name, value in scopes.items()}},
        ensure_ascii=False, indent=2), flush=True)
    return summary


def main():
    parser = argparse.ArgumentParser(description='Pack compressed UI images into lossless WebP sprite atlases.')
    parser.add_argument('--source', type=Path, default=REPOSITORY / 'art/compressed')
    parser.add_argument('--output', type=Path, default=REPOSITORY / os.environ.get('CDTANK_WEB_ASSETS', 'apps/web/public'))
    parser.add_argument('--recipe', type=Path, default=RECIPE)
    parser.add_argument('--page-size', type=int, default=2048)
    parser.add_argument('--cwebp', default='cwebp')
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    if source.is_relative_to(output) or output.is_relative_to(source):
        parser.error('Source and output directories must not overlap.')
    if args.page_size <= 2 * PADDING or args.page_size > 16383 or args.workers < 1:
        parser.error('Page size must be between 9 and 16383; workers must be positive.')
    generate(source, output, args.recipe.resolve(), args.page_size, args.cwebp, args.workers)
