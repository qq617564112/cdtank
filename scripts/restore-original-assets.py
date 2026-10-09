#!/usr/bin/env python3
"""Publish original artwork while retaining model textures and cartoon minimaps."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.parse import unquote

from PIL import Image
from image_asset_usage import IMAGE_EXTENSIONS, image_usage


def installer(root):
    spec = importlib.util.spec_from_file_location('hd_installer', root / 'scripts/install-hd-assets.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def image_paths(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from image_paths(child)
    elif isinstance(value, list):
        for child in value:
            yield from image_paths(child)
    elif isinstance(value, str) and Path(value).suffix.lower() in IMAGE_EXTENSIONS:
        yield value.replace('\\', '/').lstrip('/')


def model_texture_paths(root, runtime, inventory):
    metadata = installer(root)
    textures = {entry['source'].lower(): entry for entry in inventory['textures']}
    keep = set()
    for path in runtime.rglob('*.glb'):
        source = path.relative_to(runtime).as_posix()
        model = metadata.read_glb_metadata(path)
        used = metadata.referenced_images(model)
        for index, entry in metadata.image_matches(model, source, textures).items():
            if index in used:
                keep.add(entry['source'])
        for index in used:
            uri = model['images'][index].get('uri', '')
            if uri and not uri.startswith('data:'):
                keep.add((path.parent / unquote(uri)).resolve().relative_to(runtime).as_posix())
    # These renderers assign textures to model materials after the GLB is loaded.
    for path in (root / 'apps/shared/content/definitions').rglob('*.json'):
        resources = json.loads(path.read_text()).get('resources', {})
        for field in ('textures', 'textureVariants', 'texturePath'):
            keep.update(image_paths(resources.get(field)))
    for path in runtime.glob('scene-*.json'):
        keep.update(image_paths(json.loads(path.read_text())))
    for name in ('tank-textures.json', 'effect-models.json'):
        path = runtime / name
        if path.exists():
            keep.update(image_paths(json.loads(path.read_text())))
    for model, names in {
        'obj05006': ['obj05006A', 'obj05006B'],
        'obj05007': ['obj05007A', 'obj05007B'],
        'obj05008': ['obj05014A', 'obj05008B'],
    }.items():
        keep.update(f'Data/scnobj/{model}/{name}.png' for name in names)
    return keep


def materialize_sprites(root, runtime, names):
    directory = runtime / 'sprite-images.json'
    if not directory.exists():
        return
    mappings = json.loads(directory.read_text())['images']
    sheets = {}
    for name in names:
        cell = mappings.get('/' + name)
        target = root / 'apps/web/src' / name.removeprefix('local-images/') \
            if name.startswith('local-images/') else runtime / name
        if cell and not target.exists():
            sheets.setdefault(cell['atlas'], []).append((name, cell))
    for atlas, cells in sheets.items():
        with Image.open(runtime / atlas.lstrip('/')) as image:
            for name, cell in cells:
                target = root / 'apps/web/src' / name.removeprefix('local-images/') \
                    if name.startswith('local-images/') else runtime / name
                if target.exists():
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                x, y, w, h = (cell[key] for key in ('x', 'y', 'width', 'height'))
                region = image.crop((x, y, x + w, y + h))
                region.save(target, icc_profile=image.info.get('icc_profile'))


def restore(root, runtime):
    inventory = json.loads((root / 'art/hd-assets/inventory.json').read_text())
    keep = model_texture_paths(root, runtime, inventory)
    previous = json.loads((runtime / 'sprite-images.json').read_text()) \
        if (runtime / 'sprite-images.json').exists() else {'images': {}}
    available = {entry['source'] for entry in inventory['textures']}
    available.update(name.lstrip('/') for name in previous['images'])
    available.update(path.relative_to(runtime).as_posix() for path in runtime.rglob('*') if path.is_file())
    keep.intersection_update(available)
    minimap_icons = {name.lstrip('/') for name in previous['images']
                     if name.startswith('/local-images/assets/tanks/minimap-icons/')}
    # Source font rasters are direct exports of the original face.
    native_fonts = {name.lstrip('/') for name in previous['images'] if name.startswith('/ui/fonts/')}
    materialize_sprites(root, runtime, keep | native_fonts | minimap_icons)
    missing = [name for name in keep if not (runtime / name).exists()]
    backup = root / 'art/hd-assets/sprite-originals/recovery/output/web-assets'
    for name in missing:
        source = backup / name
        if source.exists():
            target = runtime / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
    print(f'Retaining {len(keep)} model textures and latest minimap artwork', flush=True)
    restored = []
    for entry in inventory['textures']:
        name = entry['source']
        if name in keep or entry.get('intermediate') or name.startswith(('hd-ui/', 'ui-parts/', 'tmp-')):
            continue
        original = root / entry['original']
        if not original.exists():
            raise FileNotFoundError(original)
        target = root / entry['installPath'] if entry.get('installPath') else runtime / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original, target)
        restored.append(name)
    for name in ('normal-cursor.png', 'lobby-logo.png', 'client-icon.ico'):
        source = root / 'art/hd-local-ui/original' / name
        target = root / 'apps/web/src/assets/ui' / name
        shutil.copyfile(source, target)
    preview = root / 'art/hd-assets/original/custom-maps/1001/preview.svg'
    if preview.exists():
        shutil.copyfile(preview, runtime / 'custom-maps/1001/preview.svg')
    print(f'Copied {len(restored)} original images', flush=True)
    export_python = root / 'recovery/.venv/bin/python'
    for script in ('recovery/export_ui.py', 'recovery/export_ui_fonts.py',
                   'recovery/export_chat_emote_sequences.py'):
        subprocess.run([str(export_python), str(root / script)], cwd=root, check=True)
    # Remove replacements that have no original client counterpart.
    shutil.rmtree(runtime / 'hd-ui', ignore_errors=True)
    font_dir = runtime / 'ui/fonts'
    for pattern in ('source-*.woff',):
        for path in font_dir.glob(pattern):
            path.unlink()
    for folder in ('assets/tanks/thumbnails', 'assets/pets/thumbnails'):
        for path in (root / 'apps/web/src' / folder).glob('*.png'):
            path.unlink()
    (root / 'apps/web/src/assets/ui/normal-cursor-hd.png').unlink(missing_ok=True)
    sources = {path.relative_to(runtime).as_posix(): path for path in runtime.rglob('*')
               if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
               and not path.is_relative_to(runtime / 'sprites')}
    sources.update({'local-images/' + path.relative_to(root / 'apps/web/src').as_posix(): path
                    for path in (root / 'apps/web/src').rglob('*')
                    if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS})
    usage = image_usage(root, runtime, sources)
    if usage['missingModelImages']:
        raise ValueError(usage['missingModelImages'])
    (runtime / 'ui.json').write_text(json.dumps(usage['ui'], ensure_ascii=False, separators=(',', ':')) + '\n')
    retained = set(usage['images'])
    for name, path in sources.items():
        if name not in retained:
            path.unlink()
    # Pack only the published physical files, so archived HD UI cannot return.
    manifest = root / 'art/hd-assets/sprite-originals/manifest.json'
    manifest.write_text('{"files":[]}\n')
    subprocess.run([sys.executable, str(root / 'scripts/pack-image-sprites.py'),
                    '--root', str(root)], cwd=root, check=True)
    report = {'restoredOriginals': len(restored), 'modelTextures': sorted(keep),
              'minimaps': 'cartoon-minimaps', 'removedLayouts': usage['removedLayouts'],
              'removedImagesets': usage['removedImagesets']}
    (root / 'art/hd-assets/original-runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'Restored {len(restored)} original images; retained {len(keep)} model textures and cartoon minimaps')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.root.resolve()
    runtime = Path(os.environ.get('WEB_ASSETS', 'recovery/output/web-assets'))
    if not runtime.is_absolute():
        runtime = root / runtime
    restore(root, runtime)


if __name__ == '__main__':
    main()
