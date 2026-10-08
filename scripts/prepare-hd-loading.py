"""Redraw complete original loading illustrations and publish both aspect ratios."""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from io import BytesIO
import json
from pathlib import Path
import shutil
import time
import urllib.request

from PIL import Image, ImageDraw

import hd_image_api

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-assets'
LAYOUT = ROOT / 'art/hd-ui/loading'
JOBS = LAYOUT / 'whole-backgrounds'
DELIVERY = ROOT / 'art/hd-ui/png/loading'
RUNTIME = ROOT / 'recovery/output/web-assets'
WIDTH = 1067
LEFT = (WIDTH - 800) // 2
DENSITY = 4
COMPOSITIONS = {
    1: 'Orange surround; four blue rectangular panels in a 2 by 2 grid with straight thin dark frames and orange cross-shaped gaps; round original pet portraits, white stencil illustrations, and the game logo at their intersection. Keep every portrait and panel in place.',
    2: 'Yellow-orange backdrop with repeated winged barrels; six overlapping tilted photo cards with blue outer edges, black or white frames, their original tank-and-pet pictures, a central winged barrel, and the game logo at the lower right. Preserve every card rotation and overlap.',
    3: 'Flat teal-blue field with the game logo in the upper left; a white windmill silhouette and its shadow behind an orange-roofed timber house and green tree in the lower right; all tiny original characters, tanks, notes, white ground shapes and railings remain in place.',
    4: 'Orange radial field, straight central dark teal-blue vertical band, original red and yellow explosion silhouettes, game logo near the top, and the entire overlapping tank-and-pet sticker group below. Keep the white sticker contours and every original overlap, including the big yellow tank at the bottom.',
    5: 'Blue top and bottom bands; left framed panel of overlapping sepia photo cards and paw prints; original stacked green tanks and muzzle flash in front of the red-yellow explosion; green right panel with the game logo; original No.1 caption at the bottom. Preserve the pin, frame lines, card rotations and every existing pet.',
}


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def prepare():
    jobs = []
    for page in range(1, 6):
        folder = JOBS / str(page)
        folder.mkdir(parents=True, exist_ok=True)
        original = Image.open(ART / f'original/Data/ui/loading/{page}.png').convert('RGB')
        original = original.crop((0, 0, 800, 600))
        original.save(folder / 'original.png')
        reference = Image.new('RGB', (WIDTH, 600))
        reference.paste(original, (LEFT, 0))
        reference.paste(original.crop((0, 0, 1, 600)).resize((LEFT, 600)), (0, 0))
        reference.paste(original.crop((799, 0, 800, 600)).resize((WIDTH - LEFT - 800, 600)),
                        (LEFT + 800, 0))
        reference.save(folder / 'input.png')
        prompt = f'''Use case: precise-object-edit.
Asset type: one complete original game loading-screen illustration.
Input image: the original complete composition, with ALL original pets, tanks, objects, logo and background already together. Restore this WHOLE illustration coherently at high resolution. Keep the exact original cartoon rendering, original restrained cel shading, original printed linework and palette consistent across characters, vehicles and backdrop.
Composition: {COMPOSITIONS[page]}
The original 800x600 composition occupies x={LEFT / WIDTH * 100:.6f}% to {(LEFT + 800) / WIDTH * 100:.6f}% of this 1067x600 reference. Keep EVERY original motif, character, face, costume, tank, contour, outline, occlusion and logo at its exact normalized coordinate and original size in that central area. Keep the complete central composition suitable for a 4:3 crop. The narrow side extensions are stretched edge placeholders: repaint them as a seamless natural continuation of the original quiet backdrop in the same style. Do not add characters, photo cards, logos or other main objects to the sides.
Remove ALL original LOADING lettering and its three progress dots. Repair the underlying background or illustration, including any tank or sticker contour hidden by those letters. Do not print LOADING, Loading, loading, progress dots, progress bars or new captions anywhere. Preserve every OTHER original letter, original game logo and No.1 caption exactly, including their irregular shapes, colors, outlines and shadows.
Repaint crisp, smooth, anti-aliased contours and legible original markings. Preserve original small facial expressions and recognizability. No pixel blocks, stair-step edges, blur, photoreal fur, glossy 3D redesign, new lighting, new shadows, extra decoration, added borders, extra characters, missing subjects, rearrangement or collage of inconsistent styles. Keep original white sticker borders where they already exist.
Return one complete edge-to-edge 16:9 PNG illustration, ideally 4096x2304 or larger. No margins or watermark.'''
        (folder / 'prompt.txt').write_text(prompt + '\n')
        jobs.append({'page': page, 'input': str((folder / 'input.png').relative_to(ROOT)),
                     'original': str((folder / 'original.png').relative_to(ROOT)),
                     'prompt': str((folder / 'prompt.txt').relative_to(ROOT)),
                     'output': str((folder / 'output-1.png').relative_to(ROOT)),
                     'composition': 'complete-original', 'removeLoading': True})
    write_json(JOBS / 'jobs.json', jobs)
    inventory_path = ART / 'inventory.json'
    inventory = json.loads(inventory_path.read_text())
    inventory['textures'] = [entry for entry in inventory['textures']
                             if not entry['source'].startswith(('hd-ui/loading/parts/', 'hd-ui/loading/whole/'))]
    plan_path = ART / 'plan.json'
    plan = json.loads(plan_path.read_text())
    plan['batches'] = [batch for batch in plan['batches'] if batch['group'] != 'loading']
    for job in jobs:
        source = f"hd-ui/loading/whole/{job['page']}/background.png"
        inventory['textures'].append({'source': source, 'canonical': source,
                                      'original': job['input'],
                                      'png': f'art/hd-assets/png/{source}',
                                      'size': [WIDTH, 600], 'groups': ['loading'],
                                      'intermediate': True})
        plan['batches'].append({'id': f"loading-whole-{job['page']}", 'group': 'loading',
                                'input': job['input'], 'inputSize': [WIDTH, 600],
                                'prompt': job['prompt'], 'output': job['output'], 'ratio': '16:9',
                                'cells': [{'source': source, 'box': [0, 0, WIDTH, 600]}]})
    if 'loading' not in plan['groups']:
        plan['groups'].insert(plan['groups'].index('art'), 'loading')
    write_json(inventory_path, inventory)
    write_json(plan_path, plan)
    print('Prepared five complete original loading illustrations', flush=True)
    return jobs


def generate(workers, pages):
    jobs = json.loads((JOBS / 'jobs.json').read_text())
    jobs = [job for job in jobs if not pages or job['page'] in pages]
    key = hd_image_api.auth_key()

    def request(job):
        folder = ROOT / job['output']
        state_path = folder.with_name('request.json')
        if folder.exists():
            print(f"Loading {job['page']}: saved output available", flush=True)
            return
        while True:
            state = json.loads(state_path.read_text()) if state_path.exists() else {}
            retry_at = state.get('retryAt', 0)
            while time.time() < retry_at:
                time.sleep(min(30, retry_at - time.time()))
            print(f"Loading {job['page']}: requesting complete illustration", flush=True)
            state = {'page': job['page'], 'started': datetime.now(timezone.utc).isoformat(),
                     'status': 'submitted'}
            write_json(state_path, state)
            try:
                status, payload = hd_image_api.edit(hd_image_api.DEFAULT_BASE_URL, key,
                                                   (ROOT / job['prompt']).read_text(),
                                                   ROOT / job['input'])
                url = payload['data'][0]['url']
                temporary = folder.with_suffix('.download')
                with urllib.request.urlopen(url, timeout=1300) as response, temporary.open('wb') as target:
                    shutil.copyfileobj(response, target)
                with Image.open(temporary) as image:
                    state['nativeSize'] = list(image.size)
                    image.convert('RGB').save(folder, format='PNG')
                temporary.unlink()
                state.update(status='complete', http=status,
                             finished=datetime.now(timezone.utc).isoformat())
                write_json(state_path, state)
                print(f"Loading {job['page']}: received {state['nativeSize']}", flush=True)
                return
            except Exception as error:
                state.update(status='failed', error=str(error), retryAt=time.time() + 300)
                write_json(state_path, state)
                print(f"Loading {job['page']}: {error}; retry in five minutes", flush=True)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        list(executor.map(request, jobs))


def assemble():
    jobs = json.loads((JOBS / 'jobs.json').read_text())
    entries = {row['source']: row for row in json.loads((ART / 'inventory.json').read_text())['textures']}
    DELIVERY.mkdir(parents=True, exist_ok=True)
    previous = JOBS / 'previous'
    records = []
    for job in jobs:
        output = ROOT / job['output']
        with Image.open(output) as generated:
            native_size = list(generated.size)
            wide = generated.convert('RGB').resize((WIDTH * DENSITY, 600 * DENSITY),
                                                   Image.Resampling.LANCZOS)
        classic = wide.crop((LEFT * DENSITY, 0, (LEFT + 800) * DENSITY, 600 * DENSITY))
        entry = entries[f"Data/ui/loading/{job['page']}.png"]
        with Image.open(ROOT / entry['original']) as atlas:
            atlas = atlas.convert('RGBA').resize(tuple(value * DENSITY for value in atlas.size),
                                                Image.Resampling.LANCZOS)
        atlas.paste(classic, (0, 0))
        targets = [(ART / f"png/hd-ui/loading/whole/{job['page']}/background.png", wide),
                   (DELIVERY / f"{job['page']}-16-9.png", wide),
                   (DELIVERY / f"{job['page']}-4-3.png", classic),
                   (ROOT / entry['png'], atlas)]
        targets += [(RUNTIME / 'hd-ui/loading' / path.name, image) for path, image in targets[1:3]]
        # The original atlas is retained outside the published image directory.
        atlas_runtime = RUNTIME / entry['source']
        if atlas_runtime.exists():
            targets.append((atlas_runtime, atlas))
        for target, image in targets:
            backup = previous / target.relative_to(ROOT)
            if target.exists() and not backup.exists():
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(target, backup)
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix('.tmp')
            image.save(temporary, format='PNG')
            temporary.replace(target)
        records.append({'page': job['page'], 'nativeSize': native_size,
                        'wide': list(wide.size), 'classic': list(classic.size),
                        'composition': 'complete-original', 'removeLoading': True,
                        'classicCrop': [LEFT * DENSITY, 0, (LEFT + 800) * DENSITY, 600 * DENSITY]})
    write_json(LAYOUT / 'installation.json', records)
    preview_outputs(DELIVERY)
    print('Installed five whole illustrations in 4:3 and 16:9', flush=True)


def preview_outputs(destination):
    pages = [page for page in range(1, 6)
             if all((destination / f'{page}-{ratio}.png').exists() for ratio in ['4-3', '16-9'])]
    if not pages:
        return
    sheet = Image.new('RGB', (1152, len(pages) * 392), '#17222a')
    draw = ImageDraw.Draw(sheet)
    rows = []
    for row, page in enumerate(pages):
        pictures = []
        for ratio, width, left in [('4-3', 480, 8), ('16-9', 640, 504)]:
            artwork = Image.open(destination / f'{page}-{ratio}.png').convert('RGB')
            small = artwork.resize((width, 360), Image.Resampling.LANCZOS)
            top = row * 392
            draw.text((left, top + 6), f"Loading {page} / {ratio.replace('-', ':')}", fill='white')
            sheet.paste(small, (left, top + 24))
            preview = artwork.resize((round(width * 2), 720), Image.Resampling.LANCZOS)
            preview.save(LAYOUT / f'page-{page}-{ratio}-preview.png')
            buffer = BytesIO()
            preview.save(buffer, format='PNG')
            encoded = base64.b64encode(buffer.getvalue()).decode('ascii')
            pictures.append(f'<figure><figcaption>{ratio.replace("-", ":")}</figcaption>'
                            f'<img src="data:image/png;base64,{encoded}" alt="加载背景 {page}，{ratio.replace("-", ":")}"/></figure>')
        rows.append(f'<section><h2>加载背景 {page}</h2><div class="pair">{"".join(pictures)}</div></section>')
    sheet.save(LAYOUT / 'clean-loading-layouts-preview.png')
    (LAYOUT / 'preview.html').write_text('''<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>加载背景</title><style>
body {
  max-width: 1500px;
  margin: 0 auto;
  padding: 24px;
  background: #17222a;
  color: #fff;
  font-family: sans-serif;
}
h1 { font-size: 24px; }
h2 {
  margin-top: 28px;
  font-size: 18px;
}
.pair {
  display: grid;
  grid-template-columns: 3fr 4fr;
  gap: 16px;
}
figure { margin: 0; }
figcaption {
  margin-bottom: 8px;
  color: #bacbd7;
}
img {
  display: block;
  width: 100%;
  height: auto;
}
@media (max-width: 750px) {
  .pair { grid-template-columns: 1fr; }
}
</style><h1>加载背景</h1><p>4:3 与 16:9 使用相同图案，背景不包含固定进度文字。</p>'''
                                       + ''.join(rows) + '</html>\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'generate', 'assemble'])
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--pages', type=int, nargs='+')
    args = parser.parse_args()
    if args.action == 'prepare':
        prepare()
    elif args.action == 'generate':
        generate(args.workers, args.pages)
    else:
        assemble()


if __name__ == '__main__':
    main()
