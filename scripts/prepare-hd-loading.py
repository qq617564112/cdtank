"""Prepare single-character loading layers and compose shared screen layouts."""

import argparse
import base64
from collections import Counter
from io import BytesIO
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
BACKGROUND_COMPOSITIONS = {
    '1': 'Keep the four separate blue rectangular pictures in a 2 by 2 grid, their thin straight dark frames and the brown horizontal and vertical cross-shaped gaps. Keep their exact positions. Do not merge the four pictures into one panel, round or skew their frames, or remove the cross-shaped gaps. Preserve the white stencil illustrations and the central game logo.',
    '2': 'Keep all six overlapping tilted photo cards, their white borders, original rotations and positions on the green backdrop. Keep the central logo and the paper collage. Do not merge or rearrange the cards.',
    '3': 'Keep the original windmill, pink house, blue sky, green hills and white railings at their exact positions and sizes. Preserve the central logo. Extend only the landscape into the side strips.',
    '4': 'Keep the original orange radial backdrop, straight central blue vertical band, orange explosion shapes and game logo near the top. Preserve the band width and the direction of the orange rays.',
    '5': 'Keep the original overlapping photo collage, individual photo borders, rotations and positions, blue and white background marks, and game logo. Do not rearrange the photographs.',
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
            prompt += '\nPage-specific composition: ' + BACKGROUND_COMPOSITIONS[page]
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
            if page == '4' and name == 'tank-07':
                prompt += '\nRemove the black and yellow letter L embedded at the lower right of this tank. Repaint ONLY that letter as a continuation of the existing tank tread, white sticker outline and blue background. Keep every mechanical part, tank marking and all other pixels in place. Do not draw any LOADING lettering or dots.'
            if page == '1' and name == 'pet-08':
                prompt += '\nThe cap and scarf are deep raspberry pink, magenta-red and burgundy with white spots, and the irises are teal blue. Preserve these exact original colors. The exclusion key is bright RGB 255,0,255 outside the circular portrait only. Do not turn the cap blue, teal, purple or orange; do not exclude the pink painted cap or scarf.'
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
        reference = LAYOUT / f'page-{page}-background-reference.png'
        if reference.exists():
            wide = Image.open(reference).convert('RGB').resize((WIDTH, 600), Image.Resampling.LANCZOS)
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
    preview_outputs(destination)
    print(f'Assembled and installed {completed}/5 loading screens from shared layers', flush=True)


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
    parser.add_argument('action', choices=['prepare', 'assemble'])
    args = parser.parse_args()
    if args.action == 'prepare':
        prepare()
    else:
        assemble()


if __name__ == '__main__':
    main()
