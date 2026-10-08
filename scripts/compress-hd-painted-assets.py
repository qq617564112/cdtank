#!/usr/bin/env python3
"""Reduce painted texture color precision while retaining alpha and HD dimensions."""

import argparse
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, PngImagePlugin


def save(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def selected_textures(root, inventory):
    by_png = {}
    for entry in inventory['textures']:
        by_png.setdefault(entry['png'], []).append(entry)
    selected = []
    for path, entries in by_png.items():
        if any(entry.get('deferred') or 'ui' in entry['groups'] for entry in entries):
            continue
        eligible = [entry for entry in entries if not entry.get('intermediate')
                    and min(entry['size']) >= 64
                    and any(group in ('tanks', 'pets', 'art') or group.startswith('map-')
                            for group in entry['groups'])]
        if eligible and (root / path).is_file() and (root / path).stat().st_size >= 131072:
            selected.append(path)
    return sorted(selected)


def compress(path, root, backup, oxipng):
    target = root / path
    original = backup / path
    if not original.is_file():
        raise ValueError(f'HD original backup is missing: {path}')
    with Image.open(original) as image:
        image.load()
        reference = np.asarray(image.convert('RGBA'))
        info = image.info.copy()
        small_palette = image.convert('RGBA').getcolors(256) is not None
    pixels = reference.copy()
    if not small_palette:
        colors = reference[..., :3].astype(np.uint16)
        colors = ((((colors * 63 + 127) // 255) * 255 + 31) // 63).astype(np.uint8)
        visible = reference[..., 3] > 0
        pixels[visible, :3] = colors[visible]
    temporary = target.with_suffix('.painted.tmp')
    optimized = target.with_suffix('.optimized.tmp')
    before = target.stat().st_size
    try:
        pnginfo = PngImagePlugin.PngInfo()
        # Preserve ancillary color chunks from the original PNG.
        data = original.read_bytes()
        offset = 8
        while offset < len(data):
            length = int.from_bytes(data[offset:offset + 4], 'big')
            kind = data[offset + 4:offset + 8]
            if kind in (b'gAMA', b'cHRM', b'sRGB', b'pHYs'):
                pnginfo.add(kind, data[offset + 8:offset + 8 + length])
            offset += length + 12
        Image.fromarray(pixels).save(temporary, format='PNG', compress_level=6,
                                    pnginfo=pnginfo, icc_profile=info.get('icc_profile'))
        result = subprocess.run([oxipng, '-o', '2', '--threads', '1', '--out', str(optimized), str(temporary)],
                                capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        candidate = optimized if optimized.is_file() else temporary
        with Image.open(candidate) as output:
            output.load()
            decoded = np.asarray(output.convert('RGBA'))
            color_keys = ('icc_profile', 'gamma', 'srgb', 'chromaticity')
            if any(output.info.get(key) != info.get(key) for key in color_keys):
                raise ValueError(f'Color configuration changed: {path}')
        if decoded.shape != reference.shape or not np.array_equal(decoded[..., 3], reference[..., 3]):
            raise ValueError(f'HD dimensions or alpha changed: {path}')
        error = np.abs(decoded[..., :3].astype(np.int16) - reference[..., :3].astype(np.int16))
        maximum = int(error.max())
        if maximum > 2:
            raise ValueError(f'RGB error exceeds two levels: {path}/{maximum}')
        applied = candidate.stat().st_size < before
        if applied:
            candidate.replace(target)
        return {'path': path, 'beforeBytes': before, 'afterBytes': target.stat().st_size,
                'originalBytes': original.stat().st_size, 'maxRgbError': maximum if applied else 0,
                'meanRgbError': float(error.mean()) if applied else 0, 'alphaExact': True,
                'dimensionsExact': True, 'colorConfigurationExact': True, 'applied': applied}
    finally:
        temporary.unlink(missing_ok=True)
        optimized.unlink(missing_ok=True)


def preview(root, inventory, backup, compressed):
    destination = root / 'art/hd-assets/previews/compression-comparison.png'
    samples = []
    for group in ('tanks', 'pets', 'map-0002'):
        entries = [entry for entry in inventory['textures'] if group in entry['groups']
                   and entry['png'] in compressed]
        if entries:
            samples.append(max(entries, key=lambda entry: (root / entry['png']).stat().st_size))
    sheet = Image.new('RGB', (1280, 720 * len(samples)), '#30373d')
    draw = ImageDraw.Draw(sheet)
    for row, entry in enumerate(samples):
        for column, source in enumerate((backup / entry['png'], root / entry['png'])):
            image = Image.open(source).convert('RGBA')
            image.thumbnail((624, 680), Image.Resampling.LANCZOS)
            left, top = column * 640 + (640 - image.width) // 2, row * 720 + 32
            sheet.paste(image, (left, top), image)
            draw.text((column * 640 + 12, row * 720 + 10),
                      'Original HD' if column == 0 else 'Compressed HD', fill='white')
    sheet.save(destination)
    return destination.relative_to(root).as_posix()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--oxipng', default=shutil.which('oxipng'))
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    if not args.oxipng:
        parser.error('--oxipng is required')
    root = args.root.resolve()
    art = root / 'art/hd-assets'
    backup = art / 'uncompressed'
    inventory = json.loads((art / 'inventory.json').read_text())
    path = art / 'painted-compression.json'
    report = json.loads(path.read_text()) if path.is_file() else {'images': []}
    if report.get('status') == 'restored':
        report = {'images': []}
        subprocess.run([sys.executable, str(root / 'scripts/install-hd-assets.py'), '--root', str(root)], check=True)
    report.update(status='compressing', maxRgbError=2, alphaExact=True,
                  backup=backup.relative_to(root).as_posix(), uiUnchanged=True)
    sources = selected_textures(root, inventory)
    finished = {record['path'] for record in report['images']}
    sources = sorted(set(sources) | finished, key=lambda source: (root / source).stat().st_size, reverse=True)
    manifest = json.loads((backup / 'manifest.json').read_text())
    runtime_files = [record for record in manifest['files'] if record['kind'].startswith('runtime')]
    before = sum(record['beforeBytes'] for record in runtime_files)
    report.setdefault('runtimeStartingBytes', sum((root / record['path']).stat().st_size for record in runtime_files))
    weights = {}
    for entry in inventory['textures']:
        if not entry.get('intermediate') and not entry.get('deferred'):
            weights[entry['png']] = weights.get(entry['png'], 0) + 1
    estimate = report['runtimeStartingBytes'] - sum(
        (record['beforeBytes'] - record['afterBytes']) * weights.get(record['path'], 0)
        for record in report['images'])
    target = before * .49
    pending = iter(source for source in sources if source not in finished)
    save(path, report)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        active = set()

        def submit():
            if estimate <= target:
                return
            source = next(pending, None)
            if source:
                active.add(pool.submit(compress, source, root, backup, args.oxipng))

        for _ in range(args.workers):
            submit()
        while active:
            done, _ = wait(active, return_when=FIRST_COMPLETED)
            for future in done:
                active.remove(future)
                record = future.result()
                report['images'].append(record)
                estimate -= (record['beforeBytes'] - record['afterBytes']) * weights.get(record['path'], 0)
                submit()
            if len(report['images']) % 20 == 0 or not active:
                save(path, report)
                saved = sum(record['beforeBytes'] - record['afterBytes'] for record in report['images'])
                print(f'Painted textures: {len(report["images"])} verified; saved {saved / 1024**2:.1f} MiB; runtime estimate {estimate / 1e9:.3f} GB', flush=True)
    subprocess.run([sys.executable, str(root / 'scripts/install-hd-assets.py'), '--root', str(root)], check=True)
    subprocess.run([sys.executable, str(root / 'scripts/inspect-hd-asset-installation.py'), '--root', str(root)], check=True)
    inspection = json.loads((art / 'installation-inspection.json').read_text())
    for name in ('issues', 'pendingPaths', 'uninstalledPaths', 'changedDeferredTextPaths',
                 'uninstalledUiLayouts', 'uninstalledLocalUi', 'uninstalledMapPreviews'):
        if inspection[name]:
            raise ValueError(f'Installation issue: {name}/{inspection[name]}')
    after = sum((root / record['path']).stat().st_size for record in runtime_files)
    report.update(status='complete', updated=datetime.now(timezone.utc).isoformat(timespec='seconds'),
                  runtimeBeforeBytes=before, runtimeAfterBytes=after,
                  reductionPercent=100 * (before - after) / before,
                  preview=preview(root, inventory, backup, {record['path'] for record in report['images']}), installation=inspection)
    save(path, report)
    subprocess.run([sys.executable, str(root / 'scripts/render-hd-asset-gallery.py'), '--root', str(root)], check=True)
    print(f'Runtime: {before / 1e9:.3f} GB -> {after / 1e9:.3f} GB; reduced {report["reductionPercent"]:.2f}%', flush=True)
    if after > before * .5:
        raise ValueError('The 50% size reduction target has not been reached')
    print(path, flush=True)


if __name__ == '__main__':
    main()
