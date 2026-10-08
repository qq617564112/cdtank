"""Generate shared lobby parts and assemble both layouts from the same artwork."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import getpass
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import threading
import time

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui'
ASSETS = ROOT / 'recovery/output/web-assets'
SKILL = Path(os.environ.get('CHATGPT2API_SKILL', '/workspace/self-skills/chatgpt2api-image-api'))
LOCK = threading.Lock()
DENSITY = 4
WIDE_WIDTH = 1067
HEADER_HEIGHT = 200
HEADER_CUT = 240
EXTENSION = WIDE_WIDTH - 800


def prepare():
    ui = json.loads((ASSETS / 'ui.json').read_text())
    sets = sorted(ui['imagesets'], key=lambda s: 'imagesets_dds/' not in s['path'])

    def region(name):
        match = next(r for s in sets for r in s['images'] if r['Name'].lower().endswith(name.lower()))
        original = ROOT / 'art/hd-assets/original' / match['asset']
        return Image.open(original if original.exists() else ASSETS / match['asset']).convert('RGBA')

    original = region('datingditu.tga').resize((800, 600), Image.Resampling.NEAREST)
    header = Image.new('RGBA', (WIDE_WIDTH, HEADER_HEIGHT))
    header.paste(original.crop((0, 0, HEADER_CUT, HEADER_HEIGHT)), (0, 0))
    header.paste(original.crop((HEADER_CUT - 1, 0, HEADER_CUT, HEADER_HEIGHT)).resize((EXTENSION, HEADER_HEIGHT)), (HEADER_CUT, 0))
    header.paste(original.crop((HEADER_CUT, 0, 800, HEADER_HEIGHT)), (HEADER_CUT + EXTENSION, 0))
    lower = Image.new('RGBA', (WIDE_WIDTH, 400))
    left = EXTENSION // 2
    lower.paste(original.crop((0, HEADER_HEIGHT, 1, 600)).resize((left, 400)), (0, 0))
    lower.paste(original.crop((0, HEADER_HEIGHT, 800, 600)), (left, 0))
    lower.paste(original.crop((799, HEADER_HEIGHT, 800, 600)).resize((EXTENSION - left, 400)), (left + 800, 0))
    board = region('daditu.tga')
    jobs = [
        ('header', header, '1067:200', (WIDE_WIDTH, HEADER_HEIGHT), '''Restore ONLY the upper blue decorative band of the original cartoon game lobby. Keep the paw outlines at the left and the moon with animal silhouettes and jagged ornament at the right in their exact input positions and sizes. Remove the abrupt dark-blue rectangular hole in the upper left and middle; continue the surrounding painted blue field naturally. The central vertical band x=22.493% through x=47.516% is removable layout extension: keep it a smooth quiet blue field, with no clouds, animals, symbols or distinctive motifs. Its left and right boundaries must have matching row-by-row blue colors so this band can be removed without a seam. Preserve the original shapes and blue palette faithfully; refine edges at high resolution. Add no new motifs, text, logo, board, controls or panels. Keep the bottom edge of this band the original flat bright blue of the reference. Return only this wide horizontal header band, edge to edge.'''),
        ('lower', lower, '1067:400', (WIDE_WIDTH, 400), '''Restore ONLY the lower blue background of the original cartoon game lobby. The exact original artwork occupies the central 800 pixels, x=12.465% through x=87.442%. Keep every existing pyramid, palm, sunburst, cat, dog, floating paw and curved foreground shape at its exact position and size in that central area. Do not reinterpret the characters, move the skyline, or change the palette. The narrow left and right extensions contain stretched edge placeholders: replace those placeholders with a natural continuation of the same quiet blue sky and simple low blue ground silhouette. Keep all main motifs in the original central area. The upper edge remains flat bright blue to join the separately generated header. Refine curves and contours at high resolution, retaining the flat cartoon silhouette style. No header, moon, board, text, logos, buttons or UI panels. Return just this lower horizontal background strip, edge to edge.'''),
        ('room-board', board, '615:317', (615, 317), '''Restore ONLY this original room-directory board as sharp high-resolution artwork, with every contour in exactly the same normalized position. Preserve the orange parchment, narrow green and brown decorative rim, four original corners, bottom pink title plaque, painted shading and silhouette. Do not add extra decorations or change the frame pattern. Keep the parchment texture subtle enough for overlaid room controls. No text, room cards, rows, tabs, buttons, icons, labels or logos. Preserve the transparent outer silhouette; the application overlays live controls separately. Return this board alone in the original 615:317 ratio.'''),
    ]
    result = []
    for name, source, ratio, size, prompt in jobs:
        folder = ART / 'lobby/parts' / name
        folder.mkdir(parents=True, exist_ok=True)
        source.save(folder / 'input.png')
        (folder / 'prompt.txt').write_text('Use case: precise-object-edit.\n' + prompt + '\n')
        result.append({'id': 'lobby-part-' + name, 'folder': folder, 'ratio': ratio, 'size': size, 'alpha': name == 'room-board'})
    return result


def prepare_entry():
    source = ROOT / 'art/hd-assets/original/ui/regions/55/0.png'
    original = Image.open(source).convert('RGBA')
    jobs = []
    for name, top, bottom in [('header', 0, 250), ('lower', 250, 600)]:
        strip = original.crop((0, top, 800, bottom))
        wide = Image.new('RGBA', (WIDE_WIDTH, bottom - top))
        left = EXTENSION // 2
        wide.paste(strip.crop((0, 0, 1, strip.height)).resize((left, strip.height)), (0, 0))
        wide.paste(strip, (left, 0))
        wide.paste(strip.crop((799, 0, 800, strip.height)).resize((EXTENSION - left, strip.height)), (left + 800, 0))
        folder = ART / 'entry/parts' / name
        folder.mkdir(parents=True, exist_ok=True)
        wide.save(folder / 'input.png')
        prompt = f'''Use case: precise-object-edit.
Faithfully restore ONLY this {name} strip of the original cartoon game login artwork at high resolution. This is one shared artwork used for both 4:3 and 16:9 by local composition, not a new screen design.
The exact original 800-pixel-wide artwork occupies x=12.465% through x=87.442% of this extended input canvas. Keep every Chinese character, Latin letter, digit, logo contour, parchment edge, signboard, animal, gear, silhouette, painted line and shape at its exact normalized input position. Preserve wording and all original letter strokes exactly. Never replace the logo lettering, invent characters, move controls, simplify decoration or redraw a different character. Retain the same colors, proportions, object count and cartoon art style. Make the existing painted contours, lettering and shading sharper and more detailed.
The narrow strips outside the original central area are edge placeholders for widescreen extension: replace them with a natural continuation of the existing blue/orange scene, simple background colors and silhouettes. Keep all major motifs and signboards in the original central area. Continue cut contours at the top and bottom edges exactly, as the other half is a separate component. Do not add panels, fields, controls, words, labels, borders or white margins. Return only this exact horizontal artwork strip from edge to edge.'''
        (folder / 'prompt.txt').write_text(prompt + '\n')
        jobs.append({'id': 'entry-part-' + name, 'folder': folder, 'ratio': f'{WIDE_WIDTH}:{bottom-top}',
                     'size': (WIDE_WIDTH, bottom - top), 'alpha': False})
    return jobs


def assemble(jobs, group='lobby'):
    destination = ART / 'png' / group
    destination.mkdir(parents=True, exist_ok=True)
    parts = {}
    for job in jobs:
        artwork = Image.open(job['folder'] / 'output-1.png').convert('RGBA')
        if not job['alpha']:
            red, green, blue, alpha = artwork.split()
            blue_field = ImageChops.subtract(blue, red).point(lambda value: 255 if value > 30 else 0)
            left, top, right, bottom = blue_field.getbbox()
            if bottom - top < artwork.height:
                top += 3
                bottom -= 3
            artwork = artwork.crop((left, top, right, bottom))
        else:
            red, green, blue, alpha = artwork.split()
            brightest = ImageChops.lighter(ImageChops.lighter(red, green), blue)
            darkest = ImageChops.darker(ImageChops.darker(red, green), blue)
            grey = ImageChops.subtract(brightest, darkest).point(lambda value: 255 if value < 40 else 0)
            light = darkest.point(lambda value: 255 if value > 170 else 0)
            outside = ImageChops.multiply(grey, light)
            for corner in [(0, 0), (artwork.width - 1, 0), (0, artwork.height - 1), (artwork.width - 1, artwork.height - 1)]:
                if outside.getpixel(corner) == 255:
                    ImageDraw.floodfill(outside, corner, 128)
            artwork.putalpha(ImageChops.multiply(alpha, outside.point(lambda value: 0 if value == 128 else 255)))
        artwork = artwork.resize(tuple(n * DENSITY for n in job['size']), Image.Resampling.LANCZOS)
        if group == 'entry':
            spec = importlib.util.spec_from_file_location('hd_asset_restore', ROOT / 'scripts/generate-hd-assets.py')
            restoration = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(restoration)
            artwork = restoration.restore(job['folder'] / 'input.png', artwork, False).convert('RGBA')
        if job['alpha']:
            alpha = Image.open(job['folder'] / 'input.png').getchannel('A').resize(artwork.size, Image.Resampling.LANCZOS)
            artwork.putalpha(ImageChops.multiply(artwork.getchannel('A'), alpha))
        name = job['folder'].name
        artwork.save(destination / (name + '.png'))
        parts[name] = artwork
    header, lower = parts['header'], parts['lower']
    seam = Image.blend(header.crop((0, header.height - 1, header.width, header.height)),
                       lower.crop((0, 0, lower.width, 1)), .5)
    blend_height = 12 * DENSITY
    for row in range(blend_height):
        top = header.height - blend_height + row
        header.paste(Image.blend(header.crop((0, top, header.width, top + 1)), seam,
                                (row + 1) / blend_height), (0, top))
        lower.paste(Image.blend(seam, lower.crop((0, row, lower.width, row + 1)),
                               row / blend_height), (0, row))
    header.save(destination / 'header.png')
    lower.save(destination / 'lower.png')
    previews = []
    header_height = jobs[0]['size'][1]
    for width, suffix in [(800, '4-3'), (WIDE_WIDTH, '16-9')]:
        canvas = Image.new('RGBA', (width * DENSITY, 600 * DENSITY))
        header = parts['header']
        lower = parts['lower']
        if width == 800:
            left = EXTENSION // 2 * DENSITY
            if group == 'entry':
                header = header.crop((left, 0, left + 800 * DENSITY, header.height))
            else:
                h = Image.new('RGBA', (800 * DENSITY, header_height * DENSITY))
                h.paste(header.crop((0, 0, HEADER_CUT * DENSITY, header.height)), (0, 0))
                h.paste(header.crop(((HEADER_CUT + EXTENSION) * DENSITY, 0, header.width, header.height)), (HEADER_CUT * DENSITY, 0))
                join_left = (HEADER_CUT - 64) * DENSITY
                join_right = (HEADER_CUT + 64) * DENSITY
                join = Image.new('RGBA', (2, h.height))
                join.paste(h.crop((join_left, 0, join_left + 1, h.height)), (0, 0))
                join.paste(h.crop((join_right - 1, 0, join_right, h.height)), (1, 0))
                h.paste(join.resize((join_right - join_left, h.height), Image.Resampling.BILINEAR), (join_left, 0))
                header = h
            lower = lower.crop((left, 0, left + 800 * DENSITY, lower.height))
        canvas.paste(header, (0, 0))
        canvas.paste(lower, (0, header_height * DENSITY))
        if group == 'entry':
            reference = Image.new('RGBA', canvas.size)
            for job in jobs:
                source = Image.open(job['folder'] / 'input.png').convert('RGBA').resize(tuple(n * DENSITY for n in job['size']), Image.Resampling.LANCZOS)
                if width == 800:
                    left = EXTENSION // 2 * DENSITY
                    source = source.crop((left, 0, left + 800 * DENSITY, source.height))
                reference.paste(source, (0, 0 if job['folder'].name == 'header' else header_height * DENSITY))
            seam_y = header_height * DENSITY
            radius = 24 * DENSITY
            for y in range(seam_y - radius, seam_y + radius):
                weight = max(0, 1 - abs(y - seam_y) / radius)
                weight = weight * weight * (3 - 2 * weight)
                canvas.paste(Image.blend(canvas.crop((0, y, canvas.width, y + 1)),
                                        reference.crop((0, y, reference.width, y + 1)), weight), (0, y))
        prefix = 'login-' if group == 'entry' else ''
        canvas.save(destination / (prefix + 'background-' + suffix + '.png'))
        preview = canvas.copy()
        if group == 'lobby':
            main_left = (width - 800) * DENSITY // 2
            preview.alpha_composite(parts['room-board'], (main_left, 84 * DENSITY))
            panel = Image.open(destination / 'player-panel.png').convert('RGBA').resize((190 * DENSITY, 503 * DENSITY), Image.Resampling.LANCZOS)
            preview.alpha_composite(panel, ((width - 190) * DENSITY, 97 * DENSITY))
        preview.save(destination / ('layout-' + suffix + '.png'))
        previews.append(preview)
    runtime = ASSETS / 'hd-ui' / group
    runtime.mkdir(parents=True, exist_ok=True)
    for path in destination.glob('*.png'):
        shutil.copyfile(path, runtime / path.name)
    inventory_path = ROOT / 'art/hd-assets/inventory.json'
    if inventory_path.exists():
        textures = {entry['source']: entry for entry in json.loads(inventory_path.read_text())['textures']}
        ui = json.loads((ASSETS / 'ui.json').read_text())
        aliases = {'dengluditu.tga': 'login-background-4-3.png'} if group == 'entry' else {
            'datingditu.tga': 'background-4-3.png', 'daditu.tga': 'room-board.png'}
        for imageset in ui['imagesets']:
            for image in imageset['images']:
                name = image['Name'].lower().split('\\')[-1]
                if name not in aliases:
                    continue
                entry = textures.get(image['asset'])
                if entry is None:
                    continue
                delivered = ROOT / entry['png']
                delivered.parent.mkdir(parents=True, exist_ok=True)
                Image.open(destination / aliases[name]).resize(tuple(n * DENSITY for n in entry['size']), Image.Resampling.LANCZOS).save(delivered)
                shutil.copyfile(delivered, ASSETS / image['asset'])
    sheet = Image.new('RGB', (1120, 1050), '#182d4b')
    draw = ImageDraw.Draw(sheet)
    for preview, position, label, maxsize in zip(previews, [(20, 40), (20, 560)], ['4:3', '16:9'], [(800, 480), (1067, 480)]):
        display = preview.copy()
        display.thumbnail(maxsize, Image.Resampling.LANCZOS)
        sheet.paste(display.convert('RGB'), position)
        draw.text((position[0], position[1] - 22), label, fill='white')
    preview_path = ART / group / 'shared-parts-preview.jpg'
    sheet.save(preview_path, quality=95)
    print('Installed shared', group, 'parts and both layouts:', preview_path, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', nargs='?', choices=['prepare', 'run', 'assemble'], default='run')
    parser.add_argument('--group', choices=['lobby', 'entry'], default='lobby')
    args = parser.parse_args()
    jobs = prepare_entry() if args.group == 'entry' else prepare()
    if args.action == 'prepare':
        return
    if args.action == 'assemble':
        assemble(jobs, args.group)
        return
    sys.path.insert(0, str(SKILL / 'scripts'))
    import common
    key = os.environ.get('CHATGPT2API_AUTH_KEY') or getpass.getpass('API key: ')
    base_url = common.resolve_base_url(os.environ.get('CHATGPT2API_BASE_URL', 'https://gptimg.cloyd.fun/'))
    ledger_path = ART / 'calls.json'
    ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else []

    def record_save():
        ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n')

    def cooldown():
        while True:
            with LOCK:
                records = list(ledger)
            failed = [datetime.fromisoformat(r['finished']).timestamp() for r in records if r['status'] == 'failed' and 'finished' in r]
            remaining = max(failed, default=0) + 300 - time.time()
            if remaining <= 0:
                return
            time.sleep(min(30, remaining))

    def call(job):
        output = job['folder'] / 'output-1.png'
        while not output.exists():
            cooldown()
            with LOCK:
                record = {'call': len(ledger) + 1, 'asset': job['id'], 'status': 'submitted', 'started': datetime.now(timezone.utc).isoformat()}
                ledger.append(record)
                record_save()
            print('UI call', record['call'], job['id'], flush=True)
            try:
                status, payload = common.request_multipart('POST', base_url + '/v1/images/edits', headers=common.auth_headers(key),
                    fields=[('model', common.DEFAULT_MODEL), ('prompt', (job['folder'] / 'prompt.txt').read_text()),
                            ('n', '1'), ('size', job['ratio']), ('response_format', 'b64_json')],
                    files=[('image', job['folder'] / 'input.png')])
                saved = common.save_image_results(payload, output_dir=job['folder'], prefix='output', download_url_results=True)
                if not saved:
                    raise ValueError('API returned no image')
                record['status'] = 'complete'
                record['actualSize'] = list(Image.open(saved[0]).size)
            except Exception as error:
                output.unlink(missing_ok=True)
                record['status'] = 'failed'
                record['error'] = str(error).replace(key, '<REDACTED>')[:800]
                print(job['id'], 'failed; waiting 300 seconds before retry', flush=True)
            finally:
                record['finished'] = datetime.now(timezone.utc).isoformat()
                with LOCK:
                    record_save()
        print('Completed shared UI part', job['id'], flush=True)

    with ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(call, jobs))
    assemble(jobs, args.group)


if __name__ == '__main__':
    main()
