"""Prepare single-character loading layers and compose shared screen layouts."""

import argparse
from collections import Counter
import json
from pathlib import Path
import shutil

import cv2
import numpy as np
from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-assets'
LAYOUT = ROOT / 'art/hd-ui/loading'
ASSETS = ROOT / 'recovery/output/web-assets'
WIDTH = 1067
LEFT = (WIDTH - 800) // 2
DENSITY = 4
LOADING_WORDS = {
    '1': (425, 537, 342, 39), '2': (24, 533, 342, 39),
    '3': (8, 523, 342, 39), '4': (439, 530, 342, 39),
    '5': (11, 554, 302, 36),
}


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def component_mask(region):
    mask = Image.new('L', (800, 600))
    draw = ImageDraw.Draw(mask)
    if 'ellipse' in region:
        draw.ellipse(tuple(region['ellipse']), fill=255)
    else:
        draw.polygon([tuple(point) for point in region['polygon']], fill=255)
    return mask


def prepare():
    shapes = json.loads((ROOT / 'scripts/hd-loading-layers.json').read_text())
    inventory_path = ART / 'inventory.json'
    inventory = json.loads(inventory_path.read_text())
    entries = {entry['source']: entry for entry in inventory['textures']}
    plan_path = ART / 'plan.json'
    plan = json.loads(plan_path.read_text())
    existing = {batch['id']: batch for batch in plan['batches']}
    pages = []
    batches = []

    def add(page, name, original, location, kind):
        source = f'hd-ui/loading/parts/{page}/{name}.png'
        original_path = ART / 'original' / source
        original_path.parent.mkdir(parents=True, exist_ok=True)
        original.save(original_path)
        entry = {'source': source, 'canonical': source,
                 'original': str(original_path.relative_to(ROOT)),
                 'png': str((ART / 'png' / source).relative_to(ROOT)),
                 'size': list(original.size), 'groups': ['loading'], 'intermediate': True}
        entries[source] = entry
        batch_id = f'loading-{page}-{name}'
        folder = ART / 'batches' / batch_id
        folder.mkdir(parents=True, exist_ok=True)
        if kind == 'background':
            canvas = original.convert('RGB')
            box = [0, 0, original.width, original.height]
            prompt = '''Use case: precise-object-edit.
Restore ONLY this existing game loading-screen backdrop at high resolution. Characters have already been removed and will be restored individually as separate layers. Do not draw any tank, pet, character, face or new object in the erased areas. Continue the local painted background, paper, frame, skyline or flat color naturally through those areas.
The fixed LOADING lettering and dots have also been erased. Repaint that area as a clean continuation of the underlying background. Do not draw LOADING, loading text, progress dots, numbers or a progress bar: the application adds its own dynamic progress lettering.
The central original artwork spans x=12.465% through x=87.442% of this extended canvas. Preserve its exact composition, silhouettes, photograph borders, existing logo lettering, Chinese characters, other English words, digits, colors, linework and perspective. Do not move or resize any existing motif. Expand this artwork naturally into a full 16:9 widescreen background. The side strips are placeholders, not finished artwork: extend the existing painted background, colors, texture and simple decorative lines through them with no vertical seams or stretched edge bands. Add no main motifs in those side strips. Make the original painted contours and lettering sharper without changing the design.
Return exactly this 16:9 horizontal backdrop edge to edge, with no margins, new panels, extra lettering or watermark. The same result will be cropped locally for 4:3 and used whole for 16:9.'''
            ratio = '16:9'
        else:
            canvas = Image.new('RGB', (528, 528), '#ff00ff')
            image = original.convert('RGB')
            scale = 512 / max(image.size)
            size = tuple(max(1, round(value * scale)) for value in image.size)
            image = image.resize(size, Image.Resampling.NEAREST)
            x, y = (528 - image.width) // 2, (528 - image.height) // 2
            canvas.paste(image, (x, y))
            box = [x, y, x + image.width, y + image.height]
            prompt = f'''Use case: precise-object-edit.
Restore this precise cropped illustration of ONLY ONE {kind}. This request contains one individual {kind}; the other characters and neighboring objects have been masked out in solid magenta. Treat every magenta pixel as excluded space and keep it solid RGB 255,0,255. Never fill the excluded areas, complete occluded parts, assemble a scene, or add another character.
Preserve the visible original pose, contour, tiny face markings, eyes, fur or mechanical parts, paint, shading, color palette and exact normalized coordinates. Sharpen and refine the existing illustration with meticulous detail. Keep existing occlusion boundaries and small background fragments inside the crop unchanged. Do not move, recenter, redesign or enlarge the subject. No extra text, labels, objects, borders or watermark. Return the same one-character reference sheet with all original padding.'''
            ratio = '1:1'
        canvas.save(folder / 'input.png')
        (folder / 'prompt.txt').write_text(prompt + '\n')
        batch = {'id': batch_id, 'group': 'loading', 'input': str((folder / 'input.png').relative_to(ROOT)),
                 'inputSize': list(canvas.size), 'cells': [{'source': source, 'box': box}],
                 'prompt': str((folder / 'prompt.txt').relative_to(ROOT)),
                 'output': str((folder / 'output-1.png').relative_to(ROOT)), 'ratio': ratio}
        saved = existing.get(batch_id)
        batches.append(saved if saved and ((ROOT / saved['output']).exists() or (ROOT / entry['png']).exists()) else batch)
        return {'source': source, 'png': entry['png'], 'position': location, 'kind': kind}

    for page, regions in shapes.items():
        original = Image.open(ART / f'original/Data/ui/loading/{page}.png').convert('RGB').crop((0, 0, 800, 600))
        claimed = Image.new('L', original.size)
        layers = []
        count = Counter()
        for region in regions:
            mask = ImageChops.subtract(component_mask(region), claimed)
            claimed = ImageChops.lighter(claimed, mask)
            box = mask.getbbox()
            crop = original.crop(box)
            alpha = mask.crop(box)
            patch = Image.new('RGBA', crop.size, '#ff00ff')
            patch.paste(crop, (0, 0), alpha)
            patch.putalpha(alpha)
            count[region['kind']] += 1
            name = f"{region['kind']}-{count[region['kind']]:02}"
            layers.append(add(page, name, patch, list(box[:2]), region['kind']))
        pixels = np.asarray(original)
        holes = cv2.dilate(np.asarray(claimed), np.ones((5, 5), dtype=np.uint8))
        left, top, width, height = LOADING_WORDS[page]
        holes[max(0, top - 10):min(600, top + height + 10),
              max(0, left - 10):min(800, left + width + 10)] = 255
        background = Image.fromarray(cv2.inpaint(pixels, holes, 5, cv2.INPAINT_TELEA))
        wide = Image.new('RGB', (WIDTH, 600))
        wide.paste(background.crop((0, 0, 1, 600)).resize((LEFT, 600)), (0, 0))
        wide.paste(background, (LEFT, 0))
        wide.paste(background.crop((799, 0, 800, 600)).resize((WIDTH - LEFT - 800, 600)), (LEFT + 800, 0))
        layers.insert(0, add(page, 'background', wide, [0, 0], 'background'))
        pages.append({'page': page, 'layers': layers})
    sources = {layer['source'] for page in pages for layer in page['layers']}
    inventory['textures'] = [entry for entry in entries.values()
                             if not entry['source'].startswith('hd-ui/loading/parts/') or entry['source'] in sources]
    write_json(inventory_path, inventory)
    plan['batches'] = [batch for batch in plan['batches'] if batch['group'] != 'loading'] + batches
    if 'loading' not in plan['groups']:
        plan['groups'].insert(plan['groups'].index('art'), 'loading')
    write_json(plan_path, plan)
    write_json(LAYOUT / 'layers.json', pages)
    preview_inputs(pages)
    counts = Counter(layer['kind'] for page in pages for layer in page['layers'])
    print(f'Prepared {len(batches)} independent loading requests: {dict(counts)}', flush=True)


def preview_inputs(pages):
    layers = [(page['page'], layer) for page in pages for layer in page['layers'] if layer['kind'] != 'background']
    sheet = Image.new('RGB', (1024, ((len(layers) + 7) // 8) * 150), '#29333d')
    draw = ImageDraw.Draw(sheet)
    for index, (page, layer) in enumerate(layers):
        entry = Image.open(ART / 'original' / layer['source']).convert('RGBA')
        entry.thumbnail((120, 120), Image.Resampling.NEAREST)
        x, y = index % 8 * 128, index // 8 * 150
        sheet.paste(entry, (x + (128 - entry.width) // 2, y + 22), entry.getchannel('A'))
        draw.text((x + 4, y + 4), f"{page}/{Path(layer['source']).stem}", fill='white')
    sheet.save(LAYOUT / 'single-character-inputs.png')


def assemble():
    pages = json.loads((LAYOUT / 'layers.json').read_text())
    inventory = json.loads((ART / 'inventory.json').read_text())
    textures = {entry['source']: entry for entry in inventory['textures']}
    destination = ROOT / 'art/hd-ui/png/loading'
    destination.mkdir(parents=True, exist_ok=True)
    completed = 0
    for page in pages:
        if any(not (ROOT / layer['png']).exists() for layer in page['layers']):
            continue
        canvas = Image.open(ROOT / page['layers'][0]['png']).convert('RGBA')
        for layer in page['layers'][1:]:
            patch = Image.open(ROOT / layer['png']).convert('RGBA')
            x, y = layer['position']
            canvas.alpha_composite(patch, ((LEFT + x) * DENSITY, y * DENSITY))
        wide = destination / f"{page['page']}-16-9.png"
        canvas.save(wide)
        classic = canvas.crop((LEFT * DENSITY, 0, (LEFT + 800) * DENSITY, 600 * DENSITY))
        classic.save(destination / f"{page['page']}-4-3.png")
        entry = textures[f"Data/ui/loading/{page['page']}.png"]
        full_atlas = Image.open(ROOT / entry['original']).convert('RGBA')
        full_atlas = full_atlas.resize(tuple(value * DENSITY for value in full_atlas.size), Image.Resampling.LANCZOS)
        full_atlas.paste(classic, (0, 0))
        delivered = ROOT / entry['png']
        delivered.parent.mkdir(parents=True, exist_ok=True)
        full_atlas.save(delivered)
        shutil.copyfile(delivered, ASSETS / entry['source'])
        completed += 1
    runtime = ASSETS / 'hd-ui/loading'
    runtime.mkdir(parents=True, exist_ok=True)
    for path in destination.glob('*.png'):
        shutil.copyfile(path, runtime / path.name)
    print(f'Assembled and installed {completed}/5 loading screens from shared layers', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'assemble'])
    args = parser.parse_args()
    if args.action == 'prepare':
        prepare()
    else:
        assemble()


if __name__ == '__main__':
    main()
