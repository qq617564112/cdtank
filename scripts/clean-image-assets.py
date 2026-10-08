"""Archive unreferenced published images and repack identical images into shared cells."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from PIL import Image

from image_asset_usage import IMAGE_EXTENSIONS, image_usage


def collect(root, runtime, packing):
    sources = packing.source_paths()
    for directory, prefix in ((runtime, ''), (root / 'apps/web/src', 'local-images/')):
        for path in directory.rglob('*'):
            if path.suffix.lower() in IMAGE_EXTENSIONS and not path.is_relative_to(runtime / 'sprites'):
                sources[prefix + path.relative_to(directory).as_posix()] = path
    return sources


def published(root, runtime):
    return [path for directory in (runtime, root / 'apps/web/src') for path in directory.rglob('*')
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS]


def deduplicate_catalog_images(root, runtime, archive, manifest, usage):
    images = []
    for path in published(root, runtime):
        if path.suffix != '.png' or not path.is_relative_to(runtime) or path.is_relative_to(runtime / 'sprites'):
            continue
        with Image.open(path) as image:
            if max(image.size) > 4096 or image.width * image.height > 2048 ** 2:
                images.append(path)
    unique, duplicates = {}, {}
    for path in sorted(images):
        name = path.relative_to(runtime).as_posix() if path.is_relative_to(runtime) else \
            'local-images/' + path.relative_to(root / 'apps/web/src').as_posix()
        with Image.open(path) as image:
            identity = (image.size, tuple(image.info.get(key) for key in ('icc_profile', 'gamma', 'srgb')),
                        hashlib.sha256(image.convert('RGBA').tobytes()).digest())
        if identity not in unique:
            unique[identity] = name
        elif all(reason == 'ui-catalog' or reason.startswith('catalog:') for reason in usage['reasons'][name]):
            duplicates[name] = unique[identity]
    if not duplicates:
        return []

    def replace(value):
        if isinstance(value, dict):
            return {key: replace(child) for key, child in value.items()}
        if isinstance(value, list):
            return [replace(child) for child in value]
        return duplicates.get(value, value) if isinstance(value, str) else value

    for relative in ['ui.json', *usage['catalogs']]:
        path = runtime / relative
        original = json.loads(path.read_text())
        updated = replace(original)
        if updated != original:
            backup = archive / 'metadata' / relative
            backup.parent.mkdir(parents=True, exist_ok=True)
            if not backup.exists():
                shutil.copyfile(path, backup)
            path.write_text(json.dumps(updated, ensure_ascii=False, separators=(',', ':')) + '\n')
    files = {row['source']: row for row in manifest['files']}
    for name, canonical in duplicates.items():
        path = root / 'apps/web/src' / name.removeprefix('local-images/') if name.startswith('local-images/') else runtime / name
        relative = path.relative_to(root).as_posix()
        backup = archive / relative
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            shutil.copyfile(path, backup)
        files[relative] = dict(source=relative, path=name, bytes=path.stat().st_size,
                               reason='duplicate', duplicateOf=canonical)
        path.unlink()
    manifest['files'] = list(files.values())
    (archive / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return [dict(path=path, duplicateOf=canonical) for path, canonical in duplicates.items()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--plan-only', action='store_true')
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    root = args.root.resolve()
    runtime = Path(os.environ.get('WEB_ASSETS', 'recovery/output/web-assets'))
    if not runtime.is_absolute():
        runtime = root / runtime
    archive = root / 'art/hd-assets/unused-images'
    manifest_path = archive / 'manifest.json'
    if args.restore:
        manifest = json.loads(manifest_path.read_text())
        for row in manifest['files']:
            destination = root / row['source']
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(archive / row['source'], destination)
        print('Restored archived images; the current sprite directory remains available')
        return
    spec = importlib.util.spec_from_file_location('packing', root / 'scripts/pack-image-sprites.py')
    packing = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(packing)
    packing.ROOT, packing.RUNTIME = root, runtime
    packing.BACKUP = root / 'art/hd-assets/sprite-originals'
    sources = collect(root, runtime, packing)
    usage = image_usage(root, runtime, sources)
    if usage['missingModelImages']:
        raise ValueError(f"Model image sources are missing: {usage['missingModelImages']}")
    retained = set(usage['images'])
    unused = sorted(set(sources) - retained)
    before = published(root, runtime)
    previous_path = runtime / 'sprite-images.json'
    previous_sprites = json.loads(previous_path.read_text())['images'] if previous_path.exists() else {}
    before_bytes = sum(path.stat().st_size for path in before)
    report = dict(publishedImagesBefore=len(before), publishedBytesBefore=before_bytes,
                  logicalImagesBefore=len(sources), referencedImages=len(retained), unusedImages=len(unused),
                  unusedPaths=unused, removedImagesets=usage['removedImagesets'],
                  retainedChatGlyphs=len(usage['chatGlyphImages']), models=usage['models'],
                  modelReferences=usage['modelReferences'], modules=len(usage['modules']), catalogs=usage['catalogs'])
    print(json.dumps({key: value for key, value in report.items() if key not in ('unusedPaths', 'catalogs')},
                     ensure_ascii=False), flush=True)
    if args.plan_only:
        return
    metadata = archive / 'metadata'
    metadata.mkdir(parents=True, exist_ok=True)
    for source, name in ((runtime / 'ui.json', 'ui.json'), (runtime / 'sprite-images.json', 'sprite-images.json'),
                         (packing.BACKUP / 'manifest.json', 'sprite-originals-manifest.json')):
        destination = metadata / name
        if source.is_file() and not destination.exists():
            shutil.copyfile(source, destination)
    prior = json.loads(manifest_path.read_text()) if manifest_path.exists() else dict(files=[], virtualImages=[])
    files = {row['source']: row for row in prior['files']}
    virtual = {row['path']: row for row in prior['virtualImages']}
    for name in unused:
        source = sources[name]
        if source.is_relative_to(packing.BACKUP):
            virtual[name] = dict(path=name, backup=source.relative_to(root).as_posix())
            continue
        relative = source.relative_to(root)
        destination = archive / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copyfile(source, destination)
        files[relative.as_posix()] = dict(source=relative.as_posix(), path=name, bytes=source.stat().st_size)
        source.unlink()
    manifest_path.write_text(json.dumps(dict(files=list(files.values()), virtualImages=list(virtual.values())),
                                        ensure_ascii=False, indent=2) + '\n')
    ui_path = runtime / 'ui.json'
    temporary = ui_path.with_suffix('.tmp')
    temporary.write_text(json.dumps(usage['ui'], ensure_ascii=False, separators=(',', ':')) + '\n')
    temporary.replace(ui_path)
    subprocess.run([sys.executable, str(root / 'scripts/pack-image-sprites.py'), '--root', str(root),
                    '--workers', str(args.workers)], check=True)
    manifest = json.loads(manifest_path.read_text())
    catalog_duplicates = deduplicate_catalog_images(root, runtime, archive, manifest, usage)
    usage = image_usage(root, runtime, sources)
    report['referencedImages'] = len(usage['images'])
    after = published(root, runtime)
    packing_report = json.loads((root / 'art/hd-assets/sprite-packing.json').read_text())
    sprite_images = json.loads((runtime / 'sprite-images.json').read_text())['images']
    previous_cells = set()
    for path in sprite_images:
        cell = previous_sprites.get(path)
        previous_cells.add(tuple(cell[key] for key in ('atlas', 'x', 'y', 'width', 'height'))
                           if cell else ('image', path))
    report.update(publishedImagesAfter=len(after), publishedBytesAfter=sum(path.stat().st_size for path in after),
                  archivedPhysicalImages=sum(1 for name in unused if not sources[name].is_relative_to(packing.BACKUP)),
                  duplicateImages=packing_report['duplicateImages'] + len(catalog_duplicates),
                  uniqueCells=packing_report['uniqueCells'], catalogDuplicates=catalog_duplicates,
                  newlyMergedDuplicateImages=len(previous_cells) - packing_report['uniqueCells'] + len(catalog_duplicates),
                  spriteSheets=packing_report['sheets'], pixelComparisons=packing_report['pixelComparisons'],
                  pixelDifferences=packing_report['pixelDifferences'])
    report['savedBytes'] = before_bytes - report['publishedBytesAfter']
    report['byteReductionPercent'] = round(report['savedBytes'] / before_bytes * 100, 2)
    report['imageReductionPercent'] = round((len(before) - len(after)) / len(before) * 100, 2)
    report['references'] = usage['reasons']
    path = root / 'art/hd-assets/image-cleanup.json'
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items()
                     if key not in ('unusedPaths', 'catalogs', 'references')}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
