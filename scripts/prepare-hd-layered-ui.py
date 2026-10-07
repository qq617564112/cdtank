"""Split illustrated UI banners into single-character requests and reassemble them."""

import argparse
from collections import Counter
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
DENSITY = 4


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.layering.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def prepare(root):
    art = root / 'art/hd-assets'
    config = json.loads((root / 'scripts/hd-banner-layers.json').read_text())
    inventory_path = art / 'inventory.json'
    inventory = json.loads(inventory_path.read_text())
    entries = {entry['source']: entry for entry in inventory['textures']}
    plan_path = art / 'plan.json'
    plan = json.loads(plan_path.read_text())
    batches = {batch['id']: batch for batch in plan['batches']}
    originals = {f'Data/ui/banner/{name}.png' for name in config}
    plan['batches'] = [batch for batch in plan['batches']
                       if not batch['id'].startswith('ui-banner-')
                       and not any(cell['source'] in originals for cell in batch['cells'])]
    pages = []

    def add(page, name, image, position, kind):
        source = f'ui-parts/banner/{page}/{name}.png'
        original = art / 'original' / source
        original.parent.mkdir(parents=True, exist_ok=True)
        image.save(original)
        entry = {'source': source, 'canonical': source,
                 'original': str(original.relative_to(root)),
                 'png': str((art / 'png' / source).relative_to(root)),
                 'size': list(image.size), 'groups': ['ui'],
                 'intermediate': True, 'derived': 'separate-layer'}
        entries[source] = entry
        batch_id = f'ui-banner-{page}-{name}'
        saved = batches.get(batch_id)
        if saved and ((root / saved['output']).exists() or (root / entry['png']).exists()):
            plan['batches'].append(saved)
            return {'source': source, 'png': entry['png'], 'position': position, 'kind': kind}
        folder = art / 'batches' / batch_id
        folder.mkdir(parents=True, exist_ok=True)
        if kind == 'background':
            canvas = image.convert('RGB')
            box = [0, 0, image.width, image.height]
            ratio = '4:1'
            prompt = '''Use case: precise-object-edit.
Restore ONLY this exact original game advertising banner background. All individual characters, tanks and pets have been removed and will be restored as independent layers. Do not draw any character, tank, pet or face in the erased areas. Continue the existing local backdrop naturally through them. Preserve the exact Chinese characters, English lettering, logos, wording, composition, borders, colors and blank lower strip. Sharpen the existing original artwork without moving or resizing any motif. No new objects, labels, text or watermark. Return the same full 4:1 banner edge to edge.'''
        else:
            canvas = Image.new('RGB', (528, 528), '#ff00ff')
            scale = 512 / max(image.size)
            size = tuple(max(1, round(value * scale)) for value in image.size)
            patch = image.convert('RGB').resize(size, Image.Resampling.NEAREST)
            x, y = (528 - patch.width) // 2, (528 - patch.height) // 2
            canvas.paste(patch, (x, y))
            box = [x, y, x + patch.width, y + patch.height]
            ratio = '1:1'
            prompt = f'''Use case: precise-object-edit.
Restore this precise cropped illustration of ONLY ONE {kind}. Neighboring characters have been excluded in solid RGB 255,0,255 magenta. Keep every excluded magenta pixel unchanged. Never fill masked or occluded parts, complete the body, create another character or assemble a scene. Preserve the exact original pose, silhouette, face markings, eyes, paint, fur, mechanical parts, visible costume, palette and normalized coordinates. Refine this single original subject meticulously with crisp painted contours. Keep the original crop, background fragments inside the crop and padding. No redesign, re-centering, resizing, new text, border or watermark. Return the same one-character sheet.'''
        canvas.save(folder / 'input.png')
        (folder / 'prompt.txt').write_text(prompt + '\n')
        plan['batches'].append({'id': batch_id, 'group': 'ui',
                               'input': str((folder / 'input.png').relative_to(root)),
                               'inputSize': list(canvas.size),
                               'cells': [{'source': source, 'box': box}],
                               'prompt': str((folder / 'prompt.txt').relative_to(root)),
                               'output': str((folder / 'output-1.png').relative_to(root)),
                               'ratio': ratio})
        return {'source': source, 'png': entry['png'], 'position': position, 'kind': kind}

    for page, regions in config.items():
        source = f'Data/ui/banner/{page}.png'
        entry = entries[source]
        original = Image.open(root / entry['original']).convert('RGB')
        if not regions:
            entry.pop('derived', None)
            batch_id = f'ui-banner-{page}-whole'
            saved = batches.get(batch_id)
            if saved and ((root / saved['output']).exists() or (root / entry['png']).exists()):
                plan['batches'].append(saved)
                continue
            folder = art / 'batches' / batch_id
            folder.mkdir(parents=True, exist_ok=True)
            original.save(folder / 'input.png')
            text = '''Use case: precise-object-edit.
Restore this exact original game advertising banner at high resolution. Preserve the exact original human figures, faces, poses, silhouettes, Chinese characters, English letters, logos, colors, scene, blank lower strip and normalized coordinates. Do not redesign, move, resize or add any motif, change wording or lettering, reflow text or add a watermark. Return the same precise 4:1 banner edge to edge.'''
            (folder / 'prompt.txt').write_text(text + '\n')
            plan['batches'].append({'id': batch_id, 'group': 'ui',
                                   'input': str((folder / 'input.png').relative_to(root)),
                                   'inputSize': list(original.size),
                                   'cells': [{'source': source, 'box': [0, 0, *original.size]}],
                                   'prompt': str((folder / 'prompt.txt').relative_to(root)),
                                   'output': str((folder / 'output-1.png').relative_to(root)),
                                   'ratio': '4:1'})
            continue
        entry['derived'] = 'layered-banner'
        claimed = Image.new('L', original.size)
        layers = []
        counts = Counter()
        for region in regions:
            mask = Image.new('L', original.size)
            ImageDraw.Draw(mask).polygon([tuple(point) for point in region['polygon']], fill=255)
            mask = ImageChops.subtract(mask, claimed)
            claimed = ImageChops.lighter(mask, claimed)
            box = mask.getbbox()
            alpha = mask.crop(box)
            patch = Image.new('RGBA', alpha.size, '#ff00ff')
            patch.paste(original.crop(box), (0, 0), alpha)
            patch.putalpha(alpha)
            kind = region['kind']
            counts[kind] += 1
            layers.append(add(page, f'{kind}-{counts[kind]:02}', patch, list(box[:2]), kind))
        holes = cv2.dilate(np.asarray(claimed), np.ones((3, 3), dtype=np.uint8))
        background = Image.fromarray(cv2.inpaint(np.asarray(original), holes, 3, cv2.INPAINT_TELEA))
        layers.insert(0, add(page, 'background', background, [0, 0], 'background'))
        pages.append({'source': source, 'layers': layers})
    layer_sources = {layer['source'] for page in pages for layer in page['layers']}
    inventory['textures'] = [entry for entry in entries.values()
                             if not entry['source'].startswith('ui-parts/banner/')
                             or entry['source'] in layer_sources]
    write_json(inventory_path, inventory)
    write_json(plan_path, plan)
    write_json(root / 'art/hd-ui/banners/layers.json', pages)
    preview(root, pages)
    print(f'Prepared {sum(len(page["layers"]) for page in pages)} independent banner layers; '
          'human-only banners retain whole-image requests', flush=True)


def preview(root, pages):
    layers = [(page['source'], layer) for page in pages for layer in page['layers']]
    sheet = Image.new('RGB', (1024, ((len(layers) + 7) // 8) * 150), '#29333d')
    draw = ImageDraw.Draw(sheet)
    for index, (page, layer) in enumerate(layers):
        image = Image.open(root / 'art/hd-assets/original' / layer['source']).convert('RGBA')
        image.thumbnail((120, 120), Image.Resampling.NEAREST)
        x, y = index % 8 * 128, index // 8 * 150
        sheet.paste(image, (x + (128 - image.width) // 2, y + 22), image.getchannel('A'))
        draw.text((x + 4, y + 4), f'{Path(page).stem}/{Path(layer["source"]).stem}', fill='white')
    sheet.save(root / 'art/hd-ui/banners/single-character-inputs.png')


def assemble(root):
    manifest = root / 'art/hd-ui/banners/layers.json'
    if not manifest.exists():
        return
    pages = json.loads(manifest.read_text())
    inventory = json.loads((root / 'art/hd-assets/inventory.json').read_text())
    entries = {entry['source']: entry for entry in inventory['textures']}
    completed = 0
    for page in pages:
        if any(not (root / layer['png']).is_file() for layer in page['layers']):
            continue
        canvas = Image.open(root / page['layers'][0]['png']).convert('RGBA')
        # Earlier masks own overlapping pixels in the original illustration.
        for layer in page['layers'][1:]:
            patch = Image.open(root / layer['png']).convert('RGBA')
            x, y = layer['position']
            canvas.alpha_composite(patch, (x * DENSITY, y * DENSITY))
        destination = root / entries[page['source']]['png']
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix('.assembling.tmp')
        canvas.save(temporary, format='PNG')
        temporary.replace(destination)
        completed += 1
    print(f'Assembled {completed}/{len(pages)} banners from independent layers', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'assemble'])
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    (prepare if args.action == 'prepare' else assemble)(args.root.resolve())


if __name__ == '__main__':
    main()
