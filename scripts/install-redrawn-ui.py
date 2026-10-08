"""Crop generated UI artwork and install accepted PNGs for sprite repacking."""
import argparse
import json
from pathlib import Path
import shutil
import struct

import cv2
import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/hd-ui-redraw'


def wood_box(image):
    rgb = np.asarray(image.convert('RGB')).astype(np.int16)
    mask = np.uint8((rgb[:, :, 0] - rgb[:, :, 1] > 20)
                   & (rgb[:, :, 1] - rgb[:, :, 2] > 20)) * 255
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return cv2.boundingRect(max(contours, key=cv2.contourArea))


def frame_interior(generated, cell, job):
    scale_x, scale_y = generated.width / job['canvas'][0], generated.height / job['canvas'][1]
    left, top, right, bottom = [round(value * (scale_x if index % 2 == 0 else scale_y))
                              for index, value in enumerate(cell['frame'])]
    margin_x, margin_y = round(job['gap'] * scale_x / 3), round(job['gap'] * scale_y / 3)
    search = (max(0, left - margin_x), max(0, top - margin_y),
              min(generated.width, right + margin_x), min(generated.height, bottom + margin_y))
    rgb = np.asarray(generated.crop(search).convert('RGB')).astype(np.int16)
    color = np.asarray(job['frameColor'], dtype=np.int16)
    mask = np.uint8(np.max(np.abs(rgb - color), axis=2) < 55) * 255
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    interiors = []
    for index, contour in enumerate(contours):
        if hierarchy[0][index][3] == -1:
            continue
        x, y, width, height = cv2.boundingRect(contour)
        if width > (right - left) * .7 and height > (bottom - top) * .7:
            interiors.append((x, y, width, height))
    if not interiors:
        raise ValueError(f"{cell['source']}: no closed blue positioning frame")
    x, y, width, height = max(interiors, key=lambda box: box[2] * box[3])
    inset = max(4, round(max(scale_x, scale_y) * 12))
    return (search[0] + x + inset, search[1] + y + inset,
            search[0] + x + width - inset, search[1] + y + height - inset)


def transparent_artwork(artwork, remove_fringes=False):
    rgb = np.asarray(artwork.convert('RGB')).astype(np.int16)
    keyed = (rgb[:, :, 0] > 140) & (rgb[:, :, 2] > 140) & (rgb[:, :, 1] < 120) \
        & (np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1] > 70)
    if remove_fringes:
        keyed |= (rgb[:, :, 0] > 200) & (rgb[:, :, 2] > 200) \
            & (np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1] > 35)
    alpha = np.asarray(artwork.getchannel('A')).copy()
    alpha[keyed] = 0
    _, labels, stats, _ = cv2.connectedComponentsWithStats(np.uint8(alpha > 16), connectivity=8)
    if len(stats) > 1:
        threshold = max(4, stats[1:, cv2.CC_STAT_AREA].max() * .001)
        keep = np.where(stats[:, cv2.CC_STAT_AREA] >= threshold)[0]
        keep = keep[keep != 0]
        coverage = cv2.dilate(np.uint8(np.isin(labels, keep)), np.ones((3, 3), dtype=np.uint8))
        alpha[coverage == 0] = 0
    artwork.putalpha(Image.fromarray(alpha))
    return artwork


def matte_artwork(artwork, colour):
    rgb = np.asarray(artwork.convert('RGB')).astype(np.float32) / 255
    matte = np.asarray(colour, dtype=np.float32) / 255
    coverage = np.max(np.where(matte >= .5,
                              (matte - rgb) / np.maximum(matte, .001),
                              (rgb - matte) / np.maximum(1 - matte, .001)), axis=2)
    coverage = np.clip(coverage, 0, 1)
    tinted = (np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1] > .06) \
        & (np.abs(rgb[:, :, 0] - rgb[:, :, 2]) < .5)
    _, labels = cv2.connectedComponents(np.uint8(tinted), connectivity=8)
    surrounding = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
    surrounding = surrounding[surrounding != 0]
    if not len(surrounding):
        raise ValueError('No colour-key background around the artwork')
    holes = np.unique(labels[coverage < .1])
    surrounding = np.union1d(surrounding, holes[holes != 0])
    background = np.isin(labels, surrounding)
    edge = cv2.dilate(np.uint8(background), np.ones((3, 3), dtype=np.uint8)).astype(bool)
    coverage[~edge] = 1
    coverage[background & (coverage < .1)] = 0
    clean_rgb = np.clip((rgb - (1 - coverage[:, :, None]) * matte)
                        / np.maximum(coverage[:, :, None], .001), 0, 1)
    alpha = np.minimum(np.asarray(artwork.getchannel('A')),
                       np.round(coverage * 255).astype(np.uint8))
    return Image.fromarray(np.dstack((np.round(clean_rgb * 255).astype(np.uint8), alpha)))


def framed_artwork(generated, cell, job):
    artwork = generated.crop(frame_interior(generated, cell, job))
    if job.get('matteColor'):
        return matte_artwork(artwork, job['matteColor'])
    return transparent_artwork(artwork, remove_fringes=bool(cell.get('panelBox')))


def place_artwork(artwork, original, target, native_box=None):
    native_box = native_box if native_box is not None else original.getchannel('A').getbbox()
    generated_box = artwork.getchannel('A').getbbox()
    if generated_box is None:
        raise ValueError('The generated cell has no artwork')
    left, top, right, bottom = [value * 4 for value in native_box]
    artwork = artwork.crop(generated_box).resize((right - left, bottom - top), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', target)
    result.paste(artwork, (left, top))
    return result


def match_level_colours(artwork, original):
    def regions(pixels):
        red, green, blue, alpha = pixels.transpose(2, 0, 1)
        return [(blue > red + 40) & (blue > green + 40) & (alpha > 0),
                (red > 120) & (green > 80) & (red > blue + 80) & (green > blue + 60) & (alpha > 0),
                (green > red + 60) & (green > blue + 60) & (alpha > 0),
                (red > green + 80) & (red > blue + 80) & (alpha > 0)]

    pixels = np.asarray(artwork).astype(np.float32)
    native = np.asarray(original).astype(np.float32)
    for source_region, region in zip(regions(native), regions(pixels)):
        source_pixels = native[source_region & (native[:, :, 3] > 128)]
        generated_pixels = pixels[region & (pixels[:, :, 3] > 128)]
        if not len(source_pixels) or not len(generated_pixels):
            continue
        source_colour, generated_colour = np.median(source_pixels, axis=0), np.median(generated_pixels, axis=0)
        pixels[region, :3] += source_colour[:3] - generated_colour[:3]
        pixels[region, 3] *= source_colour[3] / generated_colour[3]
    return Image.fromarray(np.round(np.clip(pixels, 0, 255)).astype(np.uint8))


def publish_sprites(records, inventory, originals):
    runtime = ROOT / 'recovery/output/web-assets'
    directory_path = runtime / 'sprite-images.json'
    directory = json.loads(directory_path.read_text())
    restored = [record for record in records if record['installed'] and
                '/' + record['source'] not in directory['images']]
    if restored:
        width = sum(record['size'][0] for record in restored)
        height = max(record['size'][1] for record in restored)
        atlas = f'/sprites/ui-restored-{len(directory["sheets"]):03}.png'
        target = runtime / atlas.lstrip('/')
        image = Image.new('RGBA', (width, height))
        x = 0
        for record in restored:
            previous = ART / 'previous' / inventory[record['source']]['png']
            with Image.open(previous) as original:
                image.paste(original.convert('RGBA'), (x, 0))
            w, h = record['size']
            directory['images']['/' + record['source']] = dict(atlas=atlas, x=x, y=0, width=w, height=h)
            x += w
        image.save(target, optimize=True)
        directory['sheets'].append(dict(path=atlas.lstrip('/'), width=width, height=height,
                                        cells=len(restored), references=len(restored),
                                        bytes=target.stat().st_size))
    updates = {}
    for record in records:
        if not record['installed']:
            continue
        cell = directory['images'].get('/' + record['source'])
        if cell is None:
            raise ValueError(f"No runtime sprite for {record['source']}")
        if record['size'] != [cell['width'], cell['height']]:
            raise ValueError(f"Runtime sprite size differs for {record['source']}")
        position = (cell['x'], cell['y'], cell['width'], cell['height'])
        updates.setdefault(cell['atlas'], {})[position] = record
    for atlas, cells in updates.items():
        target = runtime / atlas.lstrip('/')
        previous = ART / 'previous' / target.relative_to(ROOT)
        previous.parent.mkdir(parents=True, exist_ok=True)
        if not previous.exists():
            shutil.copyfile(target, previous)
        with Image.open(target) as image:
            info = image.info.copy()
            image = image.convert('RGBA')
        for (x, y, width, height), record in cells.items():
            with Image.open(ROOT / record['candidate']) as candidate:
                image.paste(candidate.convert('RGBA'), (x, y))
        metadata = PngInfo()
        if 'gamma' in info:
            metadata.add(b'gAMA', struct.pack('>I', round(info['gamma'] * 100000)))
        if 'srgb' in info:
            metadata.add(b'sRGB', bytes([info['srgb']]))
        temporary = target.with_suffix('.tmp')
        image.save(temporary, format='PNG', compress_level=6, pnginfo=metadata,
                   **({'icc_profile': info['icc_profile']} if 'icc_profile' in info else {}))
        temporary.replace(target)
        for path, cell in directory['images'].items():
            position = (cell['x'], cell['y'], cell['width'], cell['height'])
            if cell['atlas'] != atlas or position not in cells:
                continue
            candidate = ROOT / cells[position]['candidate']
            source = path.lstrip('/')
            if source in inventory:
                delivery = ROOT / inventory[source]['png']
                backup = ART / 'previous' / inventory[source]['png']
                backup.parent.mkdir(parents=True, exist_ok=True)
                if not backup.exists():
                    shutil.copyfile(delivery, backup)
                shutil.copyfile(candidate, delivery)
            if source in originals:
                original = originals[source]
                shutil.copyfile(candidate, ROOT / 'art/hd-assets/sprite-originals' / original['source'])
                original['bytes'] = candidate.stat().st_size
        for sheet in directory['sheets']:
            if sheet['path'] == atlas.lstrip('/'):
                sheet['bytes'] = target.stat().st_size
    if updates:
        directory_path.write_text(json.dumps(directory, separators=(',', ':')) + '\n')
    return list(updates)


def match_result_colours(result, original):
    """Keep result lettering and its translucent black shadow in the source palette."""
    pixels = np.asarray(result).astype(np.float64)
    reference = np.asarray(original).astype(np.float64)
    source_rgb, generated_rgb = reference[:, :, :3], pixels[:, :, :3]
    dark_source = (source_rgb.max(axis=2) < 100) & (reference[:, :, 3] > 0)
    dark_result = (generated_rgb.max(axis=2) < 100) & (pixels[:, :, 3] > 0)
    if dark_source.any() and dark_result.any():
        colour = np.median(reference[dark_source], axis=0)
        pixels[dark_result, :3] = colour[:3]
        pixels[dark_result, 3] *= colour[3] / 255
    source_ink = (reference[:, :, 3] > 128) & ((source_rgb.max(axis=2) - source_rgb.min(axis=2)) > 120)
    generated_ink = (pixels[:, :, 3] > 128) & ((generated_rgb.max(axis=2) - generated_rgb.min(axis=2)) > 120) & ~dark_result
    if source_ink.any() and generated_ink.any():
        pixels[generated_ink, :3] += np.median(reference[source_ink, :3], axis=0) - np.median(pixels[generated_ink, :3], axis=0)
    return Image.fromarray(np.round(np.clip(pixels, 0, 255)).astype(np.uint8))


def extract(job, cell, entry):
    with Image.open(ROOT / job['folder'] / 'output-1.png') as generated:
        generated = generated.convert('RGBA')
    with Image.open(ROOT / entry['original']) as original:
        original = original.convert('RGBA')
    target = tuple(size * 4 for size in original.size)
    if cell['source'] in ('ui/regions/74/41.png', 'ui/regions/74/42.png'):
        x, y, width, height = wood_box(generated)
        left, top, native_width, native_height = wood_box(original)
        artwork = generated.crop((x, y, x + width, y + height))
        artwork = artwork.resize((native_width * 4, native_height * 4), Image.Resampling.LANCZOS)
        result = Image.new('RGBA', target, 'white')
        result.paste(artwork, (left * 4, top * 4))
    elif cell.get('artworkBox'):
        artwork = transparent_artwork(generated.crop(tuple(cell['artworkBox'])))
        result = place_artwork(artwork, original, target)
    elif cell.get('panelBox'):
        artwork = framed_artwork(generated, cell, job)
        panel_target = tuple(size * 4 for size in cell.get('panelSize', job.get('panelSize')))
        if cell.get('panelInkBounds'):
            artwork = place_artwork(artwork, original, panel_target, cell['panelInkBounds'])
        else:
            artwork = artwork.crop(artwork.getchannel('A').getbbox()).resize(
                panel_target, Image.Resampling.LANCZOS)
        result = artwork.crop(tuple(value * 4 for value in cell['panelBox'])).resize(
            target, Image.Resampling.LANCZOS)
        opacity = original.getchannel('A').getextrema()[1]
        if opacity < 255:
            result.putalpha(result.getchannel('A').point(lambda value: round(value * opacity / 255)))
    elif cell.get('preserveCanvas'):
        box = [round(value * (generated.width / job['canvas'][0] if index % 2 == 0 else generated.height / job['canvas'][1]))
               for index, value in enumerate(cell['box'])]
        artwork = transparent_artwork(generated.crop(tuple(box)), remove_fringes=True)
        rgb = np.asarray(artwork.convert('RGB')).astype(np.int16)
        fringe = (np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1] > 25) \
            & (np.abs(rgb[:, :, 0] - rgb[:, :, 2]) < 60)
        alpha = np.asarray(artwork.getchannel('A')).copy()
        alpha[fringe] = 0
        artwork.putalpha(Image.fromarray(alpha))
        result = artwork.resize(target, Image.Resampling.LANCZOS)
    elif job.get('framed'):
        artwork = framed_artwork(generated, cell, job)
        result = place_artwork(artwork, original, target)
    else:
        slot = [round(value * (generated.width / 1024 if index % 2 == 0 else generated.height / 768))
                for index, value in enumerate(cell['slot'])]
        artwork = generated.crop(slot)
        rgb = np.asarray(artwork.convert('RGB')).astype(np.int16)
        keyed = (rgb[:, :, 0] > 140) & (rgb[:, :, 2] > 140) & (rgb[:, :, 1] < 120) \
            & (np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1] > 70)
        alpha = np.asarray(artwork.getchannel('A'))
        foreground = np.uint8((alpha > 128) & ~keyed)
        _, labels, stats, _ = cv2.connectedComponentsWithStats(foreground, connectivity=8)
        threshold = max(4, stats[1:, cv2.CC_STAT_AREA].max() * .01)
        keep = np.where(stats[:, cv2.CC_STAT_AREA] >= threshold)[0]
        keep = keep[keep != 0]
        clean = np.uint8(np.isin(labels, keep)) * 255
        # Retain antialiased image edges while excluding detached background specks.
        clean = cv2.dilate(clean, np.ones((3, 3), dtype=np.uint8))
        coverage = Image.fromarray(np.minimum(alpha, clean))
        # Background removal and placement preserve the API artwork itself.
        artwork.putalpha(coverage)
        result = place_artwork(artwork, original, target)
        if original.getchannel('A').getextrema()[0] == 255:
            background = Image.new('RGBA', target, original.getpixel((0, 0)))
            background.alpha_composite(result)
            result = background
    if cell['source'] in ('ui/regions/74/41.png', 'ui/regions/74/42.png'):
        result.putalpha(255)
    if cell['source'] in ('ui/regions/59/11.png', 'ui/regions/59/12.png'):
        result = match_level_colours(result, original)
    if cell['source'] in ('ui/regions/59/4.png', 'ui/regions/59/5.png', 'ui/regions/59/10.png'):
        result = match_result_colours(result, original)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jobs', type=Path, default=ART / 'jobs.json')
    publishing = parser.add_mutually_exclusive_group()
    publishing.add_argument('--publish', action='store_true')
    publishing.add_argument('--publish-backgrounds', action='store_true',
                            help='Publish shared unlettered backgrounds under /hd-ui/buttons/')
    parser.add_argument('--accepted', type=Path)
    parser.add_argument('--candidate-dir', type=Path, default=ART / 'candidates')
    args = parser.parse_args()
    args.candidate_dir = args.candidate_dir.resolve()
    jobs = json.loads(args.jobs.read_text())
    accepted = set(json.loads(args.accepted.read_text())) if args.accepted else None
    inventory = {entry['source']: entry for entry in
                 json.loads((ROOT / 'art/hd-assets/inventory.json').read_text())['textures']}
    manifest_path = ROOT / 'art/hd-assets/sprite-originals/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    originals = {entry['path']: entry for entry in manifest['files']}
    records = []
    failures = []
    for job in jobs:
        if not (ROOT / job['folder'] / 'output-1.png').is_file():
            continue
        cells = job.get('cells') or [dict(source=job['source'], box=job['box'])]
        for cell in cells:
            source = cell['source']
            if accepted is not None and source not in accepted:
                continue
            entry = inventory[source]
            try:
                result = extract(job, cell, entry)
            except ValueError as error:
                failures.append(dict(source=source, folder=job['folder'], error=str(error)))
                print(str(error))
                continue
            candidate = args.candidate_dir / source
            candidate.parent.mkdir(parents=True, exist_ok=True)
            result.save(candidate, optimize=True)
            if args.publish_backgrounds:
                background = cell['buttonBackground']
                for folder in (ART / 'button-backgrounds', ROOT / 'recovery/output/web-assets/hd-ui/buttons'):
                    folder.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(candidate, folder / f'{background}.png')
            publish = args.publish and (accepted is None or source in accepted)
            if publish:
                delivery = ROOT / entry['png']
                previous = ART / 'previous' / entry['png']
                previous.parent.mkdir(parents=True, exist_ok=True)
                if not previous.exists():
                    shutil.copyfile(delivery, previous)
                shutil.copyfile(candidate, delivery)
                if source in originals:
                    record = originals[source]
                    backup = ROOT / 'art/hd-assets/sprite-originals' / record['source']
                    shutil.copyfile(candidate, backup)
                    record['bytes'] = candidate.stat().st_size
            records.append(dict(source=source, size=list(result.size),
                                candidate=candidate.relative_to(ROOT).as_posix(), installed=publish or args.publish_backgrounds,
                                **({'background': f"hd-ui/buttons/{cell['buttonBackground']}.png"}
                                   if args.publish_backgrounds else {})))
    if args.publish:
        sheets = publish_sprites(records, inventory, originals)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    name = 'installed-' if args.publish or args.publish_backgrounds else 'candidates-'
    (ART / (name + args.jobs.stem + '.json')).write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    (ART / ('crop-failures-' + args.jobs.stem + '.json')).write_text(json.dumps(failures, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(records)} generated UI PNGs' +
          (f' installed in {len(sheets)} runtime sprite sheets' if args.publish else
           ' installed as shared button backgrounds' if args.publish_backgrounds else ' cropped for visual review'))


if __name__ == '__main__':
    main()
