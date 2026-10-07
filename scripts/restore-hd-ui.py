"""Faithfully enlarge UI lettering and simple controls without an image API.

Pillow and numpy are required. Existing glyph shapes, colors, logical metrics,
transparent margins and atlas coordinates are retained. This is filtered raster
restoration, not newly drawn lettering or recovered vector outlines. Illustrated
UI assets remain available to the image-edit generator.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import re

import numpy as np
from PIL import Image, ImageDraw


TEXT_NAMES = re.compile(r'(?:wenzi|wenz|biaoti|heitizi|wawatizi|cheapfont|fangjianbianhao|_sz|text|label|number|shuzi|daojishi)', re.I)
CONTROL_NAMES = re.compile(r'(?:frame|border|scroll|thumb|track|cursor|carat|selection|guangbiao|hdtd|hdtan|jindutiao|progress)', re.I)


def normal(value):
    return value.replace('\\', '/').lower()


def metadata(root):
    """Resolve opaque region filenames using original imageset names."""
    ui = json.loads((root / 'recovery/output/web-assets/ui.json').read_text())
    glyph_names = {normal(mapping['Image']) for font in ui.get('fonts', [])
                   for mapping in font.get('mappings', [])}
    names, glyphs = {}, set()
    for imageset in ui['imagesets']:
        atlas = normal(imageset['attributes'].get('Imagefile', ''))
        atlas = str(Path(atlas).with_suffix('.png'))
        atlas_names = []
        for region in imageset['images']:
            asset = region.get('asset')
            name = normal(region['Name'])
            atlas_names.append(name)
            if asset:
                names[asset] = name
                if name in glyph_names:
                    glyphs.add(asset)
        names[atlas] = ' '.join(atlas_names)
        if atlas_names and all(name in glyph_names for name in atlas_names):
            glyphs.add(atlas)
    return names, glyphs


def treatment(entry, names, glyphs, image):
    source = entry['source']
    name = names.get(source, names.get(normal(source), normal(source)))
    if source in glyphs or normal(source) in glyphs or '/fonts/' in normal(source):
        return 'glyph'
    if TEXT_NAMES.search(name):
        return 'lettering'
    # A named scrollbar may contain ornamentation. Only compact low-color
    # controls are handled here; portraits and illustrated buttons go to the API.
    if CONTROL_NAMES.search(name) and max(image.size) <= 256:
        colors = image.getcolors(maxcolors=256)
        if colors is not None:
            return 'control'
    if min(image.size) <= 4:
        return 'strip'
    if image.getcolors(maxcolors=8) is not None:
        return 'flat'
    return None


def enlarge(image, factor=4):
    """Interpolate premultiplied color so transparent edges have no dark fringe."""
    pixels = np.asarray(image, dtype=np.float32) / 255
    alpha = pixels[:, :, 3]
    target = (image.width * factor, image.height * factor)
    channels = []
    for channel in range(3):
        plane = Image.fromarray(pixels[:, :, channel] * alpha)
        channels.append(np.asarray(plane.resize(target, Image.Resampling.LANCZOS)))
    resized_alpha = np.clip(np.asarray(Image.fromarray(alpha).resize(
        target, Image.Resampling.LANCZOS)), 0, 1)
    rgb = np.stack(channels, axis=-1)
    np.divide(rgb, resized_alpha[:, :, None], out=rgb,
              where=resized_alpha[:, :, None] > 0)
    rgb[resized_alpha == 0] = 0
    output = np.concatenate((np.clip(rgb, 0, 1), resized_alpha[:, :, None]), axis=-1)
    return Image.fromarray(np.rint(output * 255).astype(np.uint8), 'RGBA')


def overview(path, samples):
    width, cell_width, cell_height = 960, 240, 160
    sheet = Image.new('RGB', (width, max(1, (len(samples) + 3) // 4) * cell_height), '#252735')
    draw = ImageDraw.Draw(sheet)
    for index, (source, result, kind) in enumerate(samples):
        x, y = index % 4 * cell_width, index // 4 * cell_height
        preview = result.copy()
        preview.thumbnail((cell_width - 16, cell_height - 42))
        sheet.paste(preview, (x + 8, y + 8), preview)
        draw.text((x + 8, y + cell_height - 30), source[-34:], fill='white')
        draw.text((x + 8, y + cell_height - 16), kind, fill='#b9c4dc')
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--group', default='ui', help='Inventory group; use art for original Data/ui atlases')
    parser.add_argument('--overview', type=Path, help='Optional contact sheet of up to 64 restored assets')
    args = parser.parse_args()
    root = args.root.resolve()
    inventory = json.loads((root / 'art/hd-assets/inventory.json').read_text())
    names, glyphs = metadata(root)
    counts, samples, seen = Counter(), [], set()
    for entry in inventory['textures']:
        if args.group not in entry['groups'] or entry['canonical'] in seen:
            continue
        seen.add(entry['canonical'])
        destination = root / entry['png']
        if destination.exists():
            counts['existing'] += 1
            continue
        original = root / entry['original']
        with Image.open(original) as loaded:
            image = loaded.convert('RGBA')
        # The art group also contains maps/models; only UI originals belong here.
        if args.group == 'art' and not normal(entry['source']).startswith('data/ui/'):
            continue
        kind = treatment(entry, names, glyphs, image)
        if kind is None:
            counts['illustrated_remaining'] += 1
            continue
        # Wide glyph strips need their full width: capping them to 4096 would
        # shrink glyphs and alter the atlas aspect ratio. Fourfold is uniform.
        result = enlarge(image)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix('.restoring.png')
        result.save(temporary)
        temporary.replace(destination)
        counts[kind] += 1
        if args.overview and len(samples) < 64:
            samples.append((entry['source'], result, kind))
        print(json.dumps({'source': entry['canonical'], 'png': entry['png'],
                          'size': list(result.size), 'treatment': kind,
                          'method': 'premultiplied-lanczos-4x'}, ensure_ascii=False), flush=True)
    if args.overview:
        overview(args.overview, samples)
    print(json.dumps({'summary': dict(counts)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
