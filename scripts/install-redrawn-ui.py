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


def place_artwork(artwork, original, target):
    native_box = original.getchannel('A').getbbox()
    generated_box = artwork.getchannel('A').getbbox()
    if generated_box is None:
        raise ValueError('The generated cell has no artwork')
    left, top, right, bottom = [value * 4 for value in native_box]
    artwork = artwork.crop(generated_box)
    factor = min((right - left) / artwork.width, (bottom - top) / artwork.height)
    artwork = artwork.resize((max(1, round(artwork.width * factor)),
                              max(1, round(artwork.height * factor))), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', target)
    result.paste(artwork, (left + (right - left - artwork.width) // 2,
                          top + (bottom - top - artwork.height) // 2))
    return result


def publish_sprites(records, inventory, originals):
    runtime = ROOT / 'recovery/output/web-assets'
    directory_path = runtime / 'sprite-images.json'
    directory = json.loads(directory_path.read_text())
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
        artwork = transparent_artwork(generated.crop(frame_interior(generated, cell, job)), remove_fringes=True)
        artwork = artwork.crop(artwork.getchannel('A').getbbox()).resize(
            tuple(size * 4 for size in cell.get('panelSize', job.get('panelSize'))), Image.Resampling.LANCZOS)
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
        artwork = transparent_artwork(generated.crop(frame_interior(generated, cell, job)))
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
