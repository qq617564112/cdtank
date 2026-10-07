"""Restore game texture atlases through the chatgpt2api image-edit skill.

Requires Pillow, numpy and opencv-python-headless. Credentials are read from
CHATGPT2API_AUTH_KEY or hidden terminal input and never written to assets.
"""
import argparse
from collections import Counter
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timezone
import getpass
import heapq
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import threading
import time

import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-assets'
ASSETS = Path(os.environ.get('WEB_ASSETS', ROOT / 'recovery/output/web-assets'))
SKILL = Path(os.environ.get('CHATGPT2API_SKILL', '/workspace/self-skills/chatgpt2api-image-api'))
LOCK = threading.Lock()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def document(path):
    return json.loads(path.read_text())


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)
    elif isinstance(value, dict):
        for child in value.values():
            yield from strings(child)


def prepare():
    groups = {}
    models = set()
    existing = {str(p.relative_to(ASSETS)).lower(): str(p.relative_to(ASSETS))
                for p in ASSETS.rglob('*.png')}
    previous = document(ART / 'inventory.json') if (ART / 'inventory.json').exists() else {'textures': []}
    previous_entries = {entry['source']: entry for entry in previous['textures']}
    previous_plan = document(ART / 'plan.json') if (ART / 'plan.json').exists() else {'batches': []}

    def add(path, group):
        source = existing.get(path.replace('\\', '/').lower())
        if source:
            groups.setdefault(source, set()).add(group)

    def directory(path, group):
        for file in (ASSETS / path).rglob('*.png'):
            add(str(file.relative_to(ASSETS)), group)
        for file in (ASSETS / path).rglob('*.glb'):
            models.add(str(file.relative_to(ASSETS)))

    directory('Data/role', 'tanks')
    directory('tank-textures/role', 'tanks')
    directory('Data/Pet', 'pets')
    scenes = [e for e in document(ASSETS / 'scene-placements.json') if int(e['id']) <= 25]
    for scene in scenes:
        group = 'map-' + scene['id']
        directory('Data/map/' + scene['id'], group)
        for record in scene['records'] + scene.get('castles', []):
            if record.get('asset'):
                directory(str(Path(record['asset']).parent), group)
        for library in ASSETS.glob('scene-*' + scene['id'] + '*.json'):
            for path in strings(document(library)):
                if path.lower().endswith('.png'):
                    add(path, group)
                elif path.lower().endswith('.glb') and (ASSETS / path).exists():
                    models.add(path)
    directory('ui', 'ui')
    directory('Data/ui', 'ui')
    for path in existing.values():
        if path not in groups:
            add(path, 'art')
    for file in (ASSETS / 'Data').rglob('*.glb'):
        models.add(str(file.relative_to(ASSETS)))
    # Material image paths also cover frames and effects nested in scene libraries.
    directory_groups = {}
    for source, membership in groups.items():
        directory_groups.setdefault(str(Path(source).parent), set()).update(membership)
    for path in sorted(models):
        data = (ASSETS / path).read_bytes()
        length = struct.unpack_from('<I', data, 12)[0]
        meta = json.loads(data[20:20 + length])
        model_groups = directory_groups.get(str(Path(path).parent), set())
        for material in meta.get('materials', []):
            image = str(Path(path).parent / (Path(material.get('name', '')).stem + '.png'))
            for group in model_groups:
                add(image, group)

    textures, unique = [], {}
    reused = document(ROOT / 'art/field-road-hd/inventory.json')
    reused_paths = {entry['source'].lower(): ROOT / entry['png'] for entry in reused['textures']}
    # Existing canonical paths and saved batches remain stable when scope expands.
    ordered_sources = sorted(groups, key=lambda source: (source not in previous_entries, source))
    for source in ordered_sources:
        membership = groups[source]
        original = ART / 'original' / source
        if not original.exists():
            original.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ASSETS / source, original)
        image = Image.open(original).convert('RGBA')
        identity = (image.size, image.tobytes())
        canonical = unique.setdefault(identity, previous_entries.get(source, {}).get('canonical', source))
        destination = ART / 'png' / canonical
        approved = reused_paths.get(source.lower().removeprefix('custom-maps/1002/'))
        if source.lower() == 'custom-maps/1002/preview.png':
            approved = ROOT / 'art/field-road-hd/map-preview.png'
        if approved and approved.exists() and not destination.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(approved, destination)
        textures.append({'source': source, 'canonical': canonical,
                         'original': str(original.relative_to(ROOT)),
                         'png': str(destination.relative_to(ROOT)),
                         'size': list(image.size), 'groups': sorted(membership)})
    by_source = {entry['source'].lower(): entry for entry in textures}
    ui = document(ASSETS / 'ui.json')
    for imageset in ui['imagesets']:
        source = str(Path(imageset['attributes']['Imagefile'].replace('\\', '/')).with_suffix('.png')).lower()
        entry = by_source.get(source)
        if entry and len(imageset['images']) > 1:
            entry['derived'] = 'ui-atlas'
    save(ART / 'inventory.json', {'textures': textures, 'models': sorted(models)})
    batches = [b for b in previous_plan['batches'] if b['group'] not in ['tanks', 'pets']]
    ordered_groups = ['pets', 'tanks'] + ['map-' + e['id'] for e in scenes] + ['art', 'ui']
    assigned = {cell['source'] for batch in batches for cell in batch['cells']}
    for group in ordered_groups:
        entries = [entry for entry in textures if group in entry['groups']
                   and not entry.get('derived')
                   and entry['canonical'] not in assigned and not (ROOT / entry['png']).exists()]
        singles = {entry['canonical']: entry for entry in entries}
        categories = {}
        for entry in singles.values():
            # Large UV atlases occupy an entire request; small ones share 2x2 sheets.
            large = max(entry['size']) > 256
            owner = Path(entry['canonical']).parent.name if group in ['tanks', 'pets'] else ''
            categories.setdefault((large, owner), []).append(entry)
        count = sum(batch['group'] == group for batch in batches)
        for (large, owner), selection in categories.items():
            step = 1 if large or group == 'pets' else 4
            for start in range(0, len(selection), step):
                count += 1
                cells = selection[start:start + step]
                batch_id = f'{group}-{owner}-{count:03}' if owner else f'{group}-{count:03}'
                columns = 1 if len(cells) == 1 else 2
                rows = (len(cells) + columns - 1) // columns
                canvas = Image.new('RGB', (528 * columns, 528 * rows), 'black')
                records = []
                for i, entry in enumerate(cells):
                    image = Image.open(ROOT / entry['original']).convert('RGB')
                    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
                    if max(image.size) < 512:
                        image = image.resize((round(image.width * 512 / max(image.size)),
                                              round(image.height * 512 / max(image.size))), Image.Resampling.LANCZOS)
                    x = i % columns * 528 + 8 + (512 - image.width) // 2
                    y = i // columns * 528 + 8 + (512 - image.height) // 2
                    canvas.paste(image, (x, y))
                    records.append({'source': entry['canonical'], 'box': [x, y, x + image.width, y + image.height]})
                    assigned.add(entry['canonical'])
                folder = ART / 'batches' / batch_id
                folder.mkdir(parents=True, exist_ok=True)
                canvas.save(folder / 'input.png')
                prompt = f'''Use case: precise-object-edit.
Restore this exact existing game texture sheet at high resolution, ideally 2048 pixels on its longest edge. It contains EXACTLY {columns} columns by {rows} rows of independent texture UV atlases, with {len(cells)} occupied slots. Keep the black separators and all empty slots exactly in place.
This is a technical flat texture sheet. Do not draw assembled tanks, pets, buildings or scenery. Every source UV island, tiny eye, face marking, mechanical part, paving stone, road corner, plant, thin strip, colour boundary and empty background must stay in its EXACT original normalized position and proportions. Preserve the original road connections on every edge. Never remove a small road corner or fill it with grass. Keep the exact colour palette, lights, shadows and object count.
Repaint crisp natural contours and restrained fine material detail in the original painted cartoon style. Preserve each slot's independent content, aspect ratio and crop. No rearrangement, no redesign, no added objects, no grid changes, no extra rows, no perspective, no text, labels, watermark or borders beyond the existing black separators. Return only the restored texture sheet.'''
                if owner:
                    prompt += f'\nAll occupied slots belong to ONLY ONE {"pet" if group == "pets" else "tank"}, original ID {owner}. Restore this single character with meticulous fine detail. Keep all original tiny face markings, eyes, fur direction, mechanical edges and skin patterns crisp and faithful. No other tank or pet is present.'
                if group == 'ui' or any('/ui/' in entry['source'].lower() for entry in cells):
                    prompt += '\nPreserve EVERY original Chinese character, Latin letter, digit, punctuation mark and symbol exactly. Do not change wording, add lettering, simplify strokes or replace text with approximations. Restore sharp readable original letterforms and compact UI contours at high resolution.'
                (folder / 'prompt.txt').write_text(prompt + '\n')
                batches.append({'id': batch_id, 'group': group, 'input': str((folder / 'input.png').relative_to(ROOT)),
                                'inputSize': list(canvas.size), 'cells': records,
                                'prompt': str((folder / 'prompt.txt').relative_to(ROOT)),
                                'output': str((folder / 'output-1.png').relative_to(ROOT)),
                                'ratio': '1:1' if columns == rows else f'{columns}:{rows}'})
    save(ART / 'plan.json', {'baseUrl': 'https://gptimg.cloyd.fun/', 'model': 'gpt-image-2', 'groups': ordered_groups, 'batches': batches})
    print(f'{len(textures)} paths, {len(unique)} unique textures, {len(batches)} requests', flush=True)
    print(json.dumps(dict(Counter(b['group'] for b in batches)), ensure_ascii=False), flush=True)


def restore(original_path, generated, terrain, source_box=None):
    original = Image.open(original_path).convert('RGBA')
    if source_box:
        original = original.crop(source_box)
    reference = original.convert('RGB')
    if source_box:
        reference = Image.new('RGB', original.size, 'black')
        reference.paste(Image.new('RGB', original.size, 'white'), (0, 0), original.getchannel('A'))
    # Delivered texture dimensions retain the original atlas aspect ratio.
    target = tuple(value * 4 for value in original.size)
    generated = generated.convert('RGB').resize(target, Image.Resampling.LANCZOS)
    base = original.resize(target, Image.Resampling.LANCZOS)
    alignment = (512, max(64, round(512 * original.height / original.width)))
    old = np.asarray(reference.resize(alignment))
    new = np.asarray(generated.resize(alignment))
    old_gray = cv2.GaussianBlur(cv2.cvtColor(old, cv2.COLOR_RGB2GRAY), (0, 0), 1)
    new_gray = cv2.GaussianBlur(cv2.cvtColor(new, cv2.COLOR_RGB2GRAY), (0, 0), 1)
    flow = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM).calc(old_gray, new_gray, None)
    flow = cv2.resize(flow, target) * np.array(target, dtype=np.float32) / np.array(alignment, dtype=np.float32)
    yy, xx = np.mgrid[:target[1], :target[0]].astype(np.float32)
    pixels = cv2.remap(np.asarray(generated), xx + flow[:, :, 0], yy + flow[:, :, 1],
                       cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT_101)
    registered = Image.fromarray(pixels)
    if source_box:
        support = base.getchannel('A').filter(ImageFilter.MaxFilter(5)).point(lambda value: 255 if value else 0)
        alpha = np.minimum(np.asarray(registered.convert('L')), np.asarray(support))
        result = Image.new('RGBA', target, 'white')
        result.putalpha(Image.fromarray(alpha))
        return result
    radius = 12 if terrain else 24
    rgb = pixels.astype(np.float32)
    rgb += np.asarray(base.convert('RGB').filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)
    rgb -= np.asarray(registered.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32)
    edge = np.minimum(np.minimum(xx, target[0] - 1 - xx), np.minimum(yy, target[1] - 1 - yy))
    weight = np.clip(edge / (48 if terrain else 8), 0, 1)
    weight = (weight * weight * (3 - 2 * weight))[..., None]
    rgb = rgb * weight + np.asarray(base, dtype=np.float32)[:, :, :3] * (1 - weight)
    result = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))
    result.putalpha(base.getchannel('A'))
    return result


def tile_path(batch, index):
    return ART / 'tiles' / batch['id'] / f'{index:03}.png'


def batch_complete(batch, delivered):
    return all((tile_path(batch, index) if cell.get('sourceBox') else ROOT / delivered[cell['source']]).exists()
               for index, cell in enumerate(batch['cells']))


def extract(batch):
    inventory = document(ART / 'inventory.json')
    textures = {e['source']: e for e in inventory['textures']}
    image = Image.open(ROOT / batch['output']).convert('RGB')
    sx, sy = image.width / batch['inputSize'][0], image.height / batch['inputSize'][1]
    tiled = set()
    for index, cell in enumerate(batch['cells']):
        entry = textures[cell['source']]
        box = [round(v * (sx if i % 2 == 0 else sy)) for i, v in enumerate(cell['box'])]
        crop = image.crop(box)
        result = restore(ROOT / entry['original'], crop, any(g.startswith('map-') for g in entry['groups']), cell.get('sourceBox'))
        destination = tile_path(batch, index) if cell.get('sourceBox') else ROOT / entry['png']
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(destination.name + '.tmp')
        result.save(temporary, format='PNG')
        temporary.replace(destination)
        if cell.get('sourceBox'):
            tiled.add(cell['source'])
    for source in tiled:
        cells = [(other, index, cell) for other in document(ART / 'plan.json')['batches']
                 for index, cell in enumerate(other['cells']) if cell['source'] == source and cell.get('sourceBox')]
        with LOCK:
            if not all(tile_path(other, index).exists() for other, index, _ in cells):
                continue
            entry = textures[source]
            original = Image.open(ROOT / entry['original']).convert('RGBA')
            composite = original.resize(tuple(n * 4 for n in original.size), Image.Resampling.LANCZOS)
            for other, index, cell in cells:
                composite.paste(Image.open(tile_path(other, index)).convert('RGBA'),
                                (cell['sourceBox'][0] * 4, cell['sourceBox'][1] * 4))
            destination = ROOT / entry['png']
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_name(destination.name + '.tmp')
            composite.save(temporary, format='PNG')
            temporary.replace(destination)


def generate(groups, concurrency, limit, retry_delay=300):
    sys.path.insert(0, str(SKILL / 'scripts'))
    import common
    key = os.environ.get('CHATGPT2API_AUTH_KEY') or getpass.getpass('API key: ')
    base_url = common.resolve_base_url(os.environ.get('CHATGPT2API_BASE_URL', 'https://gptimg.cloyd.fun/'))
    ledger_path = ART / 'calls.json'
    ledger = document(ledger_path) if ledger_path.exists() else []
    batches = document(ART / 'plan.json')['batches']
    selected = [b for b in batches if not groups or b['group'] in groups]
    delivered = {e['source']: e['png'] for e in document(ART / 'inventory.json')['textures']}
    selected = [b for b in selected if not batch_complete(b, delivered)]

    def call(batch):
        if (ROOT / batch['output']).exists():
            extract(batch)
            return batch['id'] + ': restored saved result'
        with LOCK:
            if limit is not None and len(ledger) >= limit:
                return batch['id'] + ': request limit reached'
            record = {'call': len(ledger) + 1, 'batch': batch['id'], 'status': 'submitted',
                      'started': datetime.now(timezone.utc).isoformat()}
            ledger.append(record)
            save(ledger_path, ledger)
        print(f"Call {record['call']}: {batch['id']}", flush=True)
        try:
            status, payload = common.request_multipart('POST', base_url + '/v1/images/edits',
                headers=common.auth_headers(key), fields=[('prompt', (ROOT / batch['prompt']).read_text()),
                ('model', common.DEFAULT_MODEL), ('n', '1'), ('size', batch['ratio']), ('response_format', 'b64_json')],
                files=[('image', ROOT / batch['input'])])
            paths = common.save_image_results(payload, output_dir=(ROOT / batch['output']).parent,
                                              prefix='output', download_url_results=True)
            if not paths:
                raise ValueError('No image returned: ' + json.dumps(common._console_safe(payload), ensure_ascii=False)[:600])
            record['http'] = status
            record['actualSize'] = list(Image.open(paths[0]).size)
            extract(batch)
            record['status'] = 'complete'
            return batch['id'] + ': complete'
        except Exception as error:
            record['status'] = 'failed'
            record['error'] = str(error).replace(key, '<REDACTED>')[:800]
            if not record.get('actualSize'):
                (ROOT / batch['output']).unlink(missing_ok=True)
            return batch['id'] + ': ' + record['error']
        finally:
            record['finished'] = datetime.now(timezone.utc).isoformat()
            with LOCK:
                save(ledger_path, ledger)

    def eligible_at(batch_id):
        failures = [datetime.fromisoformat(r['finished']).timestamp()
                    for r in ledger if r.get('batch') == batch_id
                    and r['status'] == 'failed' and r.get('finished')]
        return max(failures, default=0) + retry_delay

    def quota_wait():
        failures = [datetime.fromisoformat(r['finished']).timestamp() for r in ledger
                    if r['status'] == 'failed' and r.get('finished') and 'insufficient_quota' in r.get('error', '')]
        if not failures:
            return 0, concurrency
        failed_at = max(failures)
        recovered = any(r['status'] == 'complete' and datetime.fromisoformat(r['started']).timestamp() > failed_at
                        for r in ledger)
        return (0, concurrency) if recovered else (failed_at + retry_delay, 1)

    # Finish priority groups before starting the next map. Calls within a group share sheets.
    for group in document(ART / 'plan.json')['groups']:
        work = [b for b in selected if b['group'] == group]
        if not work:
            continue
        sequence = len(work)
        queue = [(eligible_at(b['id']), index, b) for index, b in enumerate(work)]
        heapq.heapify(queue)
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            pending = {}
            while queue or pending:
                exhausted = limit is not None and len(ledger) >= limit
                quota_deadline, lanes = quota_wait()
                while queue and len(pending) < lanes and not exhausted and max(queue[0][0], quota_deadline) <= time.time():
                    _, _, batch = heapq.heappop(queue)
                    pending[executor.submit(call, batch)] = batch
                if not pending:
                    if exhausted:
                        print(f'{group}: request limit reached', flush=True)
                        return
                    remaining = max(0, max(queue[0][0], quota_deadline) - time.time())
                    print(f'{group}: {len(queue)} batches waiting; next retry in {round(remaining)} seconds', flush=True)
                    time.sleep(min(30, remaining))
                    continue
                timeout = 30
                if queue and len(pending) < lanes and not exhausted:
                    timeout = min(timeout, max(.1, max(queue[0][0], quota_deadline) - time.time()))
                completed, _ = wait(pending, timeout=timeout, return_when=FIRST_COMPLETED)
                for future in completed:
                    batch = pending.pop(future)
                    print(future.result(), flush=True)
                    if not batch_complete(batch, delivered):
                        sequence += 1
                        deadline = eligible_at(batch['id'])
                        heapq.heappush(queue, (deadline, sequence, batch))
                        print(f"{batch['id']}: retry after {round(max(0, deadline - time.time()))} seconds", flush=True)
        print(f'{group}: completed', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'generate', 'extract', 'run'])
    parser.add_argument('--groups', nargs='*')
    parser.add_argument('--concurrency', type=int, default=4)
    parser.add_argument('--limit', type=int)
    parser.add_argument('--retry-delay', type=int, default=300)
    args = parser.parse_args()
    if args.action == 'prepare':
        prepare()
    elif args.action == 'generate':
        generate(args.groups, args.concurrency, args.limit, args.retry_delay)
    elif args.action == 'run':
        os.environ['CHATGPT2API_AUTH_KEY'] = os.environ.get('CHATGPT2API_AUTH_KEY') or getpass.getpass('API key: ')
        for group in document(ART / 'plan.json')['groups']:
            if args.groups and group not in args.groups:
                continue
            generate([group], args.concurrency, args.limit, args.retry_delay)
            if group == 'ui':
                subprocess.run([sys.executable, str(ROOT / 'scripts/assemble-hd-ui-atlases.py')], check=True)
            inventory = document(ART / 'inventory.json')
            missing = [e for e in inventory['textures'] if group in e['groups'] and not (ROOT / e['png']).exists()]
            if missing:
                print(f'{group}: {len(missing)} PNG paths unfinished', flush=True)
                return
            subprocess.run([sys.executable, str(ROOT / 'scripts/install-hd-assets.py'), '--group', group], check=True)
            if group in ['pets', 'tanks']:
                preview = ['--group', group, '--size', '256']
            elif group.startswith('map-'):
                preview = ['--map', group[4:], '--size', '768']
            else:
                preview = None
            if preview:
                subprocess.run([sys.executable, str(ROOT / 'scripts/render-hd-asset-previews.py'), *preview, '--publish'], check=True)
            print(f'DELIVERED {group}', flush=True)
    else:
        for batch in document(ART / 'plan.json')['batches']:
            if (not args.groups or batch['group'] in args.groups) and (ROOT / batch['output']).exists():
                extract(batch)


if __name__ == '__main__':
    main()
