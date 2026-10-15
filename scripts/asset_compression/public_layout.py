"""Publish runtime assets under assets, data and manifests."""

from collections import Counter
import json
import os
from pathlib import Path
import posixpath
import re
import shutil
import struct
from urllib.parse import unquote

from .package import glb_chunks


REPOSITORY = Path(__file__).resolve().parents[2]
IMAGE_SUFFIXES = {'.png', '.webp', '.svg', '.ico', '.jpg', '.jpeg', '.gif', '.avif', '.bmp'}
AUTHORING_FILES = {
    'manifest.json', 'mv3-conversion.json', 'pol-conversion.json', 'cvd-conversion.json',
    'ui-font-raster.json', 'five-page-font-raster.json',
    'ui/battle/summary/image-prompts.json', 'ui/cards/texture-source.json',
    'assets/ui/images/battle/summary/image-prompts.json', 'assets/ui/images/cards/texture-source.json',
}


def authoring_file(relative):
    return relative in AUTHORING_FILES or relative.removeprefix('manifests/') in AUTHORING_FILES \
        or Path(relative).suffix == '.txt' or relative.startswith('effect-hd-preview/')


def ui_image_path(relative):
    if relative.startswith('ui/'):
        relative = relative[3:]
    elif relative.startswith('Data/ui/'):
        relative = 'source/' + relative[8:]
    elif relative.startswith('bundled-ui/'):
        relative = 'bundled/' + relative[11:]
    elif relative.startswith('local-images/assets/ui/'):
        relative = 'cursors/' + relative[23:]
    elif relative.startswith('Data/effect/'):
        relative = 'battle/status/' + relative[12:]
    return 'assets/ui/images/' + relative


def public_path(relative):
    if relative.startswith(('assets/', 'data/', 'manifests/')):
        return relative
    if relative.startswith('sprites/standalone/'):
        return ui_image_path(relative[19:])
    if relative.startswith('sprites/'):
        return 'assets/ui/atlases/' + relative[8:]
    if relative.startswith('ui/fonts/'):
        return 'assets/ui/fonts/' + relative[9:]
    if relative.startswith(('ui/', 'Data/ui/', 'bundled-ui/')):
        return ui_image_path(relative)
    if relative.startswith('local-images/assets/tanks/minimap-icons/'):
        return 'assets/minimaps/markers/' + Path(relative).name
    if relative.startswith('local-images/'):
        return ui_image_path(relative)
    if relative.startswith('cartoon-minimaps/'):
        return 'assets/minimaps/backgrounds/' + relative[17:]
    if relative.startswith('movement/'):
        return f'data/maps/{Path(relative).stem}/movement.json'
    if relative.startswith('audio/'):
        group, name = relative[6:].split('/', 1)
        return 'assets/audio/' + ('sfx' if group == 'sound' else group) + '/' + name
    if relative.startswith('reconstructed/') and Path(relative).suffix in ('.wav', '.mp3'):
        group = 'music' if Path(relative).stem.startswith('BG') else 'sfx'
        return f'assets/audio/{group}/reconstructed/{Path(relative).name}'
    if Path(relative).suffix == '.json':
        if relative.startswith('effect-'):
            return 'data/effects/' + relative[7:]
        match = re.fullmatch(r'scene-(.+)-(\d{4})(-.*)?\.json', relative)
        if match and int(match[2]) <= 1001:
            return f'data/maps/{match[2]}/{match[1]}{match[3] or ""}.json'
        if relative.startswith('scene-'):
            return 'data/maps/shared/' + relative[6:]
        if relative.startswith(('tank-', 'tanks.')):
            return 'data/tanks/' + relative
        if relative == 'battlefields.json':
            return 'data/maps/battlefields.json'
        if relative == 'combat-catalog.json':
            return 'data/combat/catalog.json'
        if relative == 'validation.json':
            return 'data/validation.json'
        return 'manifests/' + relative
    quality = 'hd'
    if relative.startswith('battle-artwork/'):
        _, quality, relative = relative.split('/', 2)
    elif relative.startswith('scene/'):
        return 'assets/textures/shared/' + relative[6:]
    kind = 'models' if Path(relative).suffix == '.glb' else 'textures'
    if relative.startswith('Data/'):
        _, group, name = relative.split('/', 2)
        group = {'role': 'tanks', 'Pet': 'pets', 'scnobj': 'props',
            'map': 'maps', 'effect': 'effects', 'accessory': 'accessories'}.get(group, group.lower())
        relative = group + '/' + name
    elif relative.startswith('tank-textures/'):
        relative = 'tanks/skins/' + relative[14:].removeprefix('role/')
    elif relative.startswith('custom-maps/'):
        relative = 'maps/custom/' + relative[12:]
    elif relative.startswith('reconstructed/'):
        relative = 'effects/' + relative
    return f'assets/{kind}/{quality}/{relative}'


def rewrite_paths(value, mapping, image_ids):
    if isinstance(value, dict):
        return {key: rewrite_paths(item, mapping, image_ids) for key, item in value.items()}
    if isinstance(value, list):
        return [rewrite_paths(item, mapping, image_ids) for item in value]
    if isinstance(value, str):
        name, separator, fragment = value.partition('#')
        relative = name.lstrip('/')
        if relative in image_ids:
            return value
        target = mapping.get(relative)
        if target:
            return ('/' if name.startswith('/') else '') + target + separator + fragment
    return value


def relocate_glb(path, original, mapping, parent_relative):
    chunks = glb_chunks(path.read_bytes())
    document = json.loads(chunks[0][1])
    changed = False
    for image in document.get('images', []):
        uri = image.get('uri')
        if not uri or uri.startswith('data:'):
            continue
        image_path = posixpath.normpath(posixpath.join(posixpath.dirname(original), unquote(uri)))
        target = mapping.get(image_path, image_path)
        updated = posixpath.relpath(target, parent_relative)
        if updated != uri:
            image['uri'] = updated
            changed = True
    if not changed:
        return
    payload = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    payload += b' ' * (-len(payload) % 4)
    chunks[0] = (chunks[0][0], payload)
    data = b''.join(struct.pack('<II', len(payload), kind) + payload for kind, payload in chunks)
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, len(data) + 12) + data)


def prune_empty_directories(root):
    for directory in sorted((path for path in root.rglob('*') if path.is_dir()),
        key=lambda path: len(path.parts), reverse=True):
        if not any(directory.iterdir()):
            directory.rmdir()


def organize_public(root):
    root = Path(root).resolve()
    paths = sorted(path for path in root.rglob('*') if path.is_file())
    mapping = {path.relative_to(root).as_posix(): public_path(path.relative_to(root).as_posix())
        for path in paths if not authoring_file(path.relative_to(root).as_posix())}
    sprite_path = root / 'manifests/sprite-images.json'
    if (root / 'sprite-images.json').is_file():
        sprite_path = root / 'sprite-images.json'
    sprites = json.loads(sprite_path.read_text()) if sprite_path.is_file() else None
    image_ids = set()
    if sprites:
        image_ids.update(key.lstrip('/') for key in sprites['images'])
        image_ids.update(key.lstrip('/') for key in sprites['aliases'])
    moved = 0
    duplicates = 0
    model_origins = {}
    for path in paths:
        relative = path.relative_to(root).as_posix()
        if authoring_file(relative):
            target = REPOSITORY / 'output/public-authoring' / relative
        else:
            target = root / mapping[relative]
        if target == path:
            if path.suffix == '.glb': model_origins.setdefault(target, relative)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.is_file() and path.read_bytes() == target.read_bytes():
            path.unlink()
            duplicates += 1
            continue
        path.replace(target)
        if target.suffix == '.glb': model_origins[target] = relative
        moved += 1
    for path, original in model_origins.items():
        relocate_glb(path, original, mapping, path.parent.relative_to(root).as_posix())
    for path in root.rglob('*.json'):
        if path.name == 'sprite-images.json':
            continue
        previous = path.read_text()
        document = json.loads(previous)
        document = rewrite_paths(document, mapping, image_ids)
        if path.name == 'battle-artwork.json':
            variants = document['variants']
            for asset, high in list(variants['hd'].items()):
                for quality, variant in variants.items():
                    selected = variant.get(asset)
                    if selected is not None:
                        variant[high] = selected
        content = json.dumps(document, ensure_ascii=False, separators=(',', ':')) + '\n'
        if content != previous:
            path.write_text(content)
    if sprites:
        sprite_path = root / 'manifests/sprite-images.json'
        previous = sprite_path.read_text()
        sprites = rewrite_paths(json.loads(previous), mapping, image_ids)
        from PIL import Image
        for original, published in mapping.items():
            if original.startswith(('sprites/', 'assets/')) or not published.startswith('assets/ui/images/') \
                or '/' + original in sprites['images']:
                continue
            target = root / published
            if target.is_file() and target.suffix in IMAGE_SUFFIXES:
                entry = {'url': '/' + published}
                if target.suffix != '.svg':
                    with Image.open(target) as image:
                        entry.update(width=image.width, height=image.height)
                sprites['images']['/' + original] = entry
        content = json.dumps(sprites, ensure_ascii=False, indent=2) + '\n'
        if content != previous:
            sprite_path.write_text(content)
    prune_empty_directories(root)
    return {'moved_files': moved, 'duplicate_files_removed': duplicates, 'mapping': mapping,
        'directories': dict(Counter(path.relative_to(root).parts[0]
            for path in root.rglob('*') if path.is_file()))}


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path,
        default=REPOSITORY / os.environ.get('CDTANK_WEB_ASSETS', 'apps/web/public'))
    parser.add_argument('--source', type=Path, default=REPOSITORY / 'art/compressed')
    parser.add_argument('--image', action='append', default=[],
        help='Publish an independent image by its path relative to compressed; repeat for multiple images.')
    args = parser.parse_args()
    for relative in args.image:
        source = args.source / relative
        target = args.output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    report = organize_public(args.output)
    destination = REPOSITORY / 'tmp/public-layout.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'mapping'}, indent=2))
