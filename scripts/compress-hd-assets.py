#!/usr/bin/env python3
"""Losslessly optimize HD PNGs, retain the original release, and reinstall assets."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image


def save(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def image_pixels(path):
    with Image.open(path) as image:
        color = {key: image.info.get(key) for key in
                 ('icc_profile', 'gamma', 'srgb', 'chromaticity')}
        return image.size, image.convert('RGBA').tobytes(), color


def collect(root, runtime, inventory):
    sources = set()
    for directory in (
        'art/hd-assets/png', 'art/hd-ui/png', 'art/hd-local-ui/png',
        'art/field-road-hd/png', 'apps/web/src/assets/tanks/thumbnails',
        'apps/web/src/assets/tanks/minimap-icons', 'apps/web/src/assets/pets/thumbnails',
    ):
        sources.update((root / directory).rglob('*.png'))
    sources.add(root / 'art/field-road-hd/map-preview.png')
    files = {path: 'sourcePng' for path in sources if path.is_file()}
    for path in runtime.rglob('*'):
        if path.is_file() and path.suffix.lower() in ('.png', '.glb', '.svg'):
            files[path] = 'runtime' + path.suffix[1:].upper()
    for entry in inventory['textures']:
        if entry.get('installPath'):
            files[root / entry['installPath']] = 'runtimePNG'
    for name in ('lobby-logo.png', 'normal-cursor.png', 'normal-cursor-hd.png', 'client-icon.ico'):
        files[root / 'apps/web/src/assets/ui' / name] = 'runtimeLocalUi'
    for path in (root / 'art/hd-local-ui/png').glob('*.ico'):
        files[path] = 'sourceIcon'
    files[root / 'art/hd-assets/png/custom-maps/1001/preview.svg'] = 'sourceSvg'
    return sorted(path for path in sources if path.is_file()), [
        {'path': path.relative_to(root).as_posix(), 'kind': kind,
         'beforeBytes': path.stat().st_size}
        for path, kind in sorted(files.items()) if path.is_file()
    ]


def backup_files(root, backup, records):
    for index, record in enumerate(records, 1):
        source, target = root / record['path'], backup / record['path']
        if not target.is_file():
            if source.stat().st_size != record['beforeBytes']:
                raise ValueError(f"Original version is missing: {record['path']}")
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix(target.suffix + '.tmp')
            shutil.copy2(source, temporary)
            temporary.replace(target)
        if index % 500 == 0 or index == len(records):
            print(f'Original backups: {index}/{len(records)}', flush=True)


def optimize_png(source, backup, root, oxipng):
    relative = source.relative_to(root).as_posix()
    original = backup / relative
    before = original.stat().st_size
    temporary = source.with_suffix('.lossless.tmp')
    try:
        result = subprocess.run(
            [oxipng, '-o', '2', '--threads', '1', '--out', str(temporary), str(source)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr.strip())
        candidate = temporary if temporary.is_file() else source
        if image_pixels(original) != image_pixels(candidate):
            raise ValueError(f'Pixels or color profile differ: {relative}')
        if temporary.is_file() and temporary.stat().st_size < source.stat().st_size:
            temporary.replace(source)
        return {'path': relative, 'beforeBytes': before,
                'afterBytes': source.stat().st_size, 'pixelsVerified': True}
    finally:
        temporary.unlink(missing_ok=True)


def embedded_image(model, binary, index):
    view = model['bufferViews'][model['images'][index]['bufferView']]
    offset = view.get('byteOffset', 0)
    return binary[offset:offset + view['byteLength']]


def inspect_runtime_sources(root, runtime, backup, inventory):
    pairs = {}
    for entry in inventory['textures']:
        if entry.get('intermediate') or entry.get('deferred'):
            continue
        target = root / entry['installPath'] if entry.get('installPath') else runtime / entry['source']
        pairs[target] = root / entry['png']
    for source in (root / 'art/hd-ui/png').rglob('*.png'):
        pairs[runtime / 'hd-ui' / source.relative_to(root / 'art/hd-ui/png')] = source
    for name in ('lobby-logo.png', 'normal-cursor.png', 'normal-cursor-hd.png'):
        pairs[root / 'apps/web/src/assets/ui' / name] = root / 'art/hd-local-ui/png' / name
    for target, source in pairs.items():
        before = backup / target.relative_to(root)
        reference = backup / source.relative_to(root)
        if before.read_bytes() != reference.read_bytes():
            raise ValueError(f'Runtime PNG differs from its uncompressed source: {target}')
    return len(pairs)


def inspect_models(root, runtime, backup, inventory):
    spec = importlib.util.spec_from_file_location('hd_install', root / 'scripts/install-hd-assets.py')
    installer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(installer)
    records = []
    for source in inventory['models']:
        target = runtime / source
        relative = target.relative_to(root).as_posix()
        old_path = backup / relative
        old, old_binary, _ = installer.read_glb(old_path.read_bytes())
        new, new_binary, _ = installer.read_glb(target.read_bytes())
        ignored = {'images', 'bufferViews', 'buffers'}
        if ({k: v for k, v in old.items() if k not in ignored}
                != {k: v for k, v in new.items() if k not in ignored}):
            raise ValueError(f'Model metadata differs: {source}')
        geometry_views = set()

        def visit(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    if key == 'bufferView':
                        geometry_views.add(child)
                    else:
                        visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        visit({key: value for key, value in old.items() if key not in ignored})
        for index in geometry_views:
            before, after = old['bufferViews'][index], new['bufferViews'][index]
            if ({k: v for k, v in before.items() if k != 'byteOffset'}
                    != {k: v for k, v in after.items() if k != 'byteOffset'}):
                raise ValueError(f'Geometry view metadata differs: {source}/{index}')
            a, b = before.get('byteOffset', 0), after.get('byteOffset', 0)
            if (old_binary[a:a + before['byteLength']]
                    != new_binary[b:b + after['byteLength']]):
                raise ValueError(f'Geometry or animation bytes differ: {source}/{index}')
        if len(old.get('images', [])) != len(new.get('images', [])):
            raise ValueError(f'Image count differs: {source}')
        for index, before in enumerate(old.get('images', [])):
            after = new['images'][index]
            if ({k: v for k, v in before.items() if k != 'bufferView'}
                    != {k: v for k, v in after.items() if k != 'bufferView'}):
                raise ValueError(f'Image metadata differs: {source}/{index}')
            old_image = embedded_image(old, old_binary, index)
            new_image = embedded_image(new, new_binary, index)
            if old_image != new_image and image_pixels(io.BytesIO(old_image)) != image_pixels(io.BytesIO(new_image)):
                raise ValueError(f'Embedded pixels differ: {source}/{index}')
        records.append({'path': relative, 'beforeBytes': old_path.stat().st_size,
                        'afterBytes': target.stat().st_size,
                        'imagesVerified': len(old.get('images', [])),
                        'geometryViewsVerified': len(geometry_views)})
        if len(records) % 100 == 0:
            print(f'Model pixel/data comparison: {len(records)}/{len(inventory["models"])}', flush=True)
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--oxipng', default=shutil.which('oxipng'))
    parser.add_argument('--workers', type=int, default=min(6, os.cpu_count() or 1))
    parser.add_argument('--restore', action='store_true', help='restore the saved uncompressed HD release')
    args = parser.parse_args()
    root = args.root.resolve()
    art = root / 'art/hd-assets'
    backup = art / 'uncompressed'
    snapshot_path = backup / 'manifest.json'
    report_path = art / 'lossless-compression.json'
    if args.restore:
        snapshot = json.loads(snapshot_path.read_text())
        for record in snapshot['files']:
            source, target = backup / record['path'], root / record['path']
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix(target.suffix + '.tmp')
            shutil.copy2(source, temporary)
            temporary.replace(target)
        if report_path.is_file():
            report = json.loads(report_path.read_text())
            report['status'] = 'restored'
            save(report_path, report)
        print(f'Restored {len(snapshot["files"])} uncompressed HD files; backup retained', flush=True)
        return
    if not args.oxipng:
        parser.error('--oxipng is required when oxipng is not on PATH')
    if args.workers < 1:
        parser.error('--workers must be positive')
    runtime = Path(os.environ.get('WEB_ASSETS', 'recovery/output/web-assets'))
    if not runtime.is_absolute():
        runtime = root / runtime
    inventory = json.loads((art / 'inventory.json').read_text())
    sources, current_files = collect(root, runtime, inventory)
    backup.mkdir(parents=True, exist_ok=True)
    if snapshot_path.is_file():
        snapshot = json.loads(snapshot_path.read_text())
    else:
        snapshot = {'created': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                    'files': current_files}
        save(snapshot_path, snapshot)
    backup_files(root, backup, snapshot['files'])
    report = json.loads(report_path.read_text()) if report_path.is_file() else {
        'backup': backup.relative_to(root).as_posix(), 'pngs': []}
    if report.get('status') == 'restored':
        report['pngs'] = []
    report['status'] = 'compressing'
    report['tool'] = subprocess.check_output([args.oxipng, '--version'], text=True).strip()
    report['options'] = ['-o', '2', '--threads', '1']
    report['runtimeImageBaselinesVerified'] = inspect_runtime_sources(root, runtime, backup, inventory)
    completed = {record['path'] for record in report['pngs']}
    pending = [path for path in sources if path.relative_to(root).as_posix() not in completed]
    save(report_path, report)
    try:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(optimize_png, path, backup, root, args.oxipng) for path in pending]
            for future in as_completed(futures):
                report['pngs'].append(future.result())
                count = len(report['pngs'])
                if count % 50 == 0 or count == len(sources):
                    save(report_path, report)
                    saved = sum(row['beforeBytes'] - row['afterBytes'] for row in report['pngs'])
                    print(f'PNG optimization: {count}/{len(sources)}; saved {saved / 1024**2:.1f} MiB', flush=True)
    except Exception:
        save(report_path, report)
        raise
    subprocess.run([sys.executable, str(root / 'scripts/install-hd-assets.py'), '--root', str(root)], check=True)
    report['models'] = inspect_models(root, runtime, backup, inventory)
    subprocess.run([sys.executable, str(root / 'scripts/inspect-hd-asset-installation.py'), '--root', str(root)], check=True)
    inspection = json.loads((art / 'installation-inspection.json').read_text())
    issues = {key: inspection[key] for key in (
        'pendingPaths', 'uninstalledPaths', 'issues', 'changedDeferredTextPaths',
        'uninstalledUiLayouts', 'uninstalledLocalUi', 'uninstalledMapPreviews') if inspection[key]}
    if issues:
        raise ValueError(f'Installation comparison failed: {issues}')
    totals = {}
    for record in snapshot['files']:
        group = totals.setdefault(record['kind'], {'count': 0, 'beforeBytes': 0, 'afterBytes': 0})
        group['count'] += 1
        group['beforeBytes'] += record['beforeBytes']
        group['afterBytes'] += (root / record['path']).stat().st_size
    report.update(status='complete', updated=datetime.now(timezone.utc).isoformat(timespec='seconds'),
                  totals=totals, installedPngPaths=inspection['installed'], installedModels=inspection['models'])
    save(report_path, report)
    print(json.dumps(totals, indent=2), flush=True)
    print(report_path, flush=True)


if __name__ == '__main__':
    main()
