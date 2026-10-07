#!/usr/bin/env python3
"""Prepare, generate and install the local logo, HD cursor and multi-size icon."""

import argparse
from datetime import datetime, timezone
import getpass
import json
import os
from pathlib import Path
import shutil
import sys
import time

from PIL import Image


ASSET_DIR = Path('apps/web/src/assets/ui')
SOURCES = ['lobby-logo.png', 'normal-cursor.png', 'client-icon.ico']
ICON_SIZES = [(size, size) for size in (16, 24, 32, 48, 64, 128, 256)]


def source_image(path):
    with Image.open(path) as image:
        if image.format == 'ICO':
            return image.ico.getimage(max(image.ico.sizes(), key=lambda size: size[0])).convert('RGBA')
        return image.convert('RGBA')


def prepare(root):
    art = root / 'art/hd-local-ui'
    original = art / 'original'
    original.mkdir(parents=True, exist_ok=True)
    for name in SOURCES:
        backup = original / name
        if not backup.exists():
            shutil.copyfile(root / ASSET_DIR / name, backup)
    logo = source_image(original / 'lobby-logo.png')
    logo_folder = art / 'jobs/logo'
    logo_folder.mkdir(parents=True, exist_ok=True)
    logo.save(logo_folder / 'input.png')
    logo_prompt = '''Use case: precise-object-edit. Restore this exact original cartoon game logo as detailed, sharp high-resolution artwork. Preserve every existing Chinese character and all lettering exactly: no substitutions, invented text or spelling changes. Keep each contour, decoration, color, spacing and silhouette at the identical normalized position. Preserve the original visual identity and transparent background. Draw crisp high-resolution details from the reference rather than a blurred or filtered enlargement. Return only the logo on its unchanged canvas, with no added border, shadow, labels or background.'''
    (logo_folder / 'prompt.txt').write_text(logo_prompt + '\n')
    icons_folder = art / 'jobs/cursor-icon'
    icons_folder.mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGBA', (1024, 512))
    for index, name in enumerate(SOURCES[1:]):
        reference = source_image(original / name)
        # Nearest-neighbor reference scaling establishes cell layout, not final artwork.
        sheet.paste(reference.resize((512, 512), Image.Resampling.NEAREST), (index * 512, 0))
    sheet.save(icons_folder / 'input.png')
    icon_prompt = '''Use case: precise-object-edit. Restore this exact two-cell UI reference sheet as crisp high-resolution artwork. The canvas has two equal square cells in a single row, with no gap: left half is the original mouse cursor, right half is the original application icon. Keep both cells, each object's original normalized position, full shape, colors and transparent padding exactly unchanged. Keep the cursor hotspot at its original position, with no translation or recentering. Faithfully redraw the original icon without adding characters, text or decoration. Preserve transparency; do not add a solid background or grid separators. Draw true sharp detailed artwork, not a blur or filtered enlargement. Return only the complete two-cell sheet in a 2:1 ratio.'''
    (icons_folder / 'prompt.txt').write_text(icon_prompt + '\n')
    jobs = [
        {'id': 'logo', 'folder': logo_folder, 'ratio': f'{logo.width}:{logo.height}'},
        {'id': 'cursor-icon', 'folder': icons_folder, 'ratio': '2:1'},
    ]
    (art / 'png').mkdir(exist_ok=True)
    return art, jobs


def restore_alpha(artwork, original, size):
    result = artwork.convert('RGBA').resize(size, Image.Resampling.LANCZOS)
    result.putalpha(original.getchannel('A').resize(size, Image.Resampling.NEAREST))
    return result


def deliver(art, jobs):
    logo_source = source_image(art / 'original/lobby-logo.png')
    with Image.open(jobs[0]['folder'] / 'output-1.png') as generated:
        logo = restore_alpha(generated, logo_source, (logo_source.width * 4, logo_source.height * 4))
    logo.save(art / 'png/lobby-logo.png')
    with Image.open(jobs[1]['folder'] / 'output-1.png') as generated:
        sheet = generated.convert('RGBA')
    if sheet.width % 2 or abs(sheet.width / sheet.height - 2) > 0.05:
        raise ValueError('Cursor/icon output must be an equal two-cell 2:1 sheet')
    half = sheet.width // 2
    cursor = restore_alpha(sheet.crop((0, 0, half, sheet.height)),
                           source_image(art / 'original/normal-cursor.png'), (128, 128))
    icon = restore_alpha(sheet.crop((half, 0, sheet.width, sheet.height)),
                         source_image(art / 'original/client-icon.ico'), (256, 256))
    cursor.save(art / 'png/normal-cursor-hd.png')
    icon.save(art / 'png/client-icon.png')
    icon.save(art / 'png/client-icon.ico', format='ICO', sizes=ICON_SIZES)


def install(root, art):
    for name in ('lobby-logo.png', 'normal-cursor-hd.png', 'client-icon.ico'):
        shutil.copyfile(art / 'png' / name, root / ASSET_DIR / name)
    print('Installed logo, 128px HD cursor and 7-size application icon', flush=True)


def run(art, jobs, base_url):
    skill = Path(os.environ.get('CHATGPT2API_SKILL', '/workspace/self-skills/chatgpt2api-image-api'))
    sys.path.insert(0, str(skill / 'scripts'))
    import common
    pending = [job for job in jobs if not (job['folder'] / 'output-1.png').exists()]
    if not pending:
        return
    key = os.environ.get('CHATGPT2API_AUTH_KEY') or getpass.getpass('API key: ')
    if not key:
        raise ValueError('API key is required')
    base_url = common.normalize_base_url(base_url)
    ledger_path = art / 'calls.json'
    ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else []

    def save():
        ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n')

    for job in pending:
        output = job['folder'] / 'output-1.png'
        while not output.exists():
            failures = [datetime.fromisoformat(record['finished']).timestamp()
                        for record in ledger if record['status'] == 'failed' and 'finished' in record]
            remaining = max(failures, default=0) + 300 - time.time()
            while remaining > 0:
                time.sleep(min(30, remaining))
                remaining = max(failures, default=0) + 300 - time.time()
            record = {'call': len(ledger) + 1, 'asset': job['id'], 'status': 'submitted',
                      'started': datetime.now(timezone.utc).isoformat()}
            ledger.append(record)
            save()
            print('Local UI call', record['call'], job['id'], flush=True)
            try:
                status, payload = common.request_multipart(
                    'POST', base_url + '/v1/images/edits', headers=common.auth_headers(key),
                    fields=[('model', 'gpt-image-2'), ('prompt', (job['folder'] / 'prompt.txt').read_text()),
                            ('n', '1'), ('size', job['ratio']), ('response_format', 'b64_json')],
                    files=[('image', job['folder'] / 'input.png')])
                saved = common.save_image_results(payload, output_dir=job['folder'],
                                                  prefix='output', download_url_results=True)
                if not saved or saved[0] != output:
                    raise ValueError('API returned no image')
                with Image.open(output) as image:
                    image.load()
                    if job['id'] == 'cursor-icon' and (image.width % 2 or abs(image.width / image.height - 2) > 0.05):
                        raise ValueError('Cursor/icon output must be a 2:1 sheet')
                    record['actualSize'] = list(image.size)
                record['status'] = 'complete'
                record['httpStatus'] = status
            except Exception as error:
                output.unlink(missing_ok=True)
                record['status'] = 'failed'
                record['error'] = str(error).replace(key, '<REDACTED>')[:800]
                print(job['id'], 'failed; retrying after 300 seconds', flush=True)
            finally:
                record['finished'] = datetime.now(timezone.utc).isoformat()
                save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('prepare', 'run', 'install'))
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--base-url', default=os.environ.get('CHATGPT2API_BASE_URL', 'https://gptimg.cloyd.fun/'))
    args = parser.parse_args()
    root = args.root.resolve()
    art, jobs = prepare(root)
    if args.action == 'prepare':
        print('Prepared 2 local UI requests: logo and cursor/icon sheet', flush=True)
        return
    if args.action == 'run':
        run(art, jobs, args.base_url)
    deliver(art, jobs)
    install(root, art)


if __name__ == '__main__':
    main()
