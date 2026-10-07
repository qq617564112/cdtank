#!/usr/bin/env python3
"""Install completed HD PNGs and repack matching GLB images in runtime assets."""

import argparse
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import struct
import subprocess
import sys


JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(data):
    magic, version, length = struct.unpack_from('<III', data)
    if magic != 0x46546C67 or version != 2 or length != len(data):
        raise ValueError('Invalid GLB header')
    chunks = []
    offset = 12
    while offset < length:
        size, kind = struct.unpack_from('<II', data, offset)
        end = offset + 8 + size
        if end > length:
            raise ValueError('Invalid GLB chunk length')
        chunks.append((kind, data[offset + 8:end]))
        offset = end
    model = json.loads(next(payload for kind, payload in chunks if kind == JSON_CHUNK))
    binary = next((payload for kind, payload in chunks if kind == BIN_CHUNK), b'')
    return model, binary, chunks


def image_matches(model, source, textures):
    directory = PurePosixPath(source).parent
    matches = {}

    def lookup(name):
        if not name or str(name).startswith('data:'):
            return None
        name = str(name).replace('\\', '/')
        path = PurePosixPath(name).with_suffix('.png')
        for candidate in (str(path), str(directory / path),
                          str(directory / path.name)):
            entry = textures.get(candidate.lower())
            if entry:
                return entry
        return None

    for index, image in enumerate(model.get('images', [])):
        entry = lookup(image.get('uri')) or lookup(image.get('name'))
        if entry:
            matches[index] = entry
    for material in model.get('materials', []):
        entry = lookup(material.get('name'))
        if not entry:
            continue
        color = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if color is None:
            color = material.get('extensions', {}).get(
                'KHR_materials_pbrSpecularGlossiness', {}).get('diffuseTexture')
        if color is not None:
            texture = model['textures'][color['index']]
            if 'source' in texture:
                matches[texture['source']] = entry
    return matches


def repack(data, source, textures, root):
    model, binary, chunks = read_glb(data)
    matches = image_matches(model, source, textures)
    if not matches:
        return None
    # Keep every original buffer byte and view; replacement images get new views.
    payload = bytearray(binary)
    views = model.setdefault('bufferViews', [])
    shared = {}
    for index, entry in matches.items():
        key = entry['source'].lower()
        if key not in shared:
            image_bytes = (root / entry['png']).read_bytes()
            if not image_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError(f"Not a PNG: {entry['png']}")
            payload.extend(b'\0' * (-len(payload) % 4))
            shared[key] = len(views)
            views.append({'buffer': 0, 'byteOffset': len(payload),
                          'byteLength': len(image_bytes)})
            payload.extend(image_bytes)
        image = model['images'][index]
        image.pop('uri', None)
        image['bufferView'] = shared[key]
        image['mimeType'] = 'image/png'
    buffers = model.setdefault('buffers', [{'byteLength': 0}])
    buffers[0]['byteLength'] = len(payload)
    metadata = json.dumps(model, separators=(',', ':'), ensure_ascii=False).encode()
    metadata += b' ' * (-len(metadata) % 4)
    payload.extend(b'\0' * (-len(payload) % 4))
    output_chunks = []
    has_binary = False
    for kind, original in chunks:
        value = metadata if kind == JSON_CHUNK else bytes(payload) if kind == BIN_CHUNK else original
        has_binary |= kind == BIN_CHUNK
        output_chunks.append(struct.pack('<II', len(value), kind) + value)
    if not has_binary:
        output_chunks.append(struct.pack('<II', len(payload), BIN_CHUNK) + payload)
    body = b''.join(output_chunks)
    return struct.pack('<III', 0x46546C67, 2, 12 + len(body)) + body


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--group', help='Install textures belonging to this inventory group')
    args = parser.parse_args()
    root = args.root.resolve()
    runtime = Path(os.environ.get('WEB_ASSETS', 'recovery/output/web-assets'))
    if not runtime.is_absolute():
        runtime = root / runtime
    inventory = json.loads((root / 'art/hd-assets/inventory.json').read_text())
    selected = [entry for entry in inventory['textures']
                if args.group is None or args.group in entry.get('groups', [])]
    completed = [entry for entry in selected if (root / entry['png']).is_file()]
    replacements = {entry['source'].lower(): entry for entry in completed}
    # A group install retains artwork installed by earlier groups in shared models.
    if args.group is not None:
        for entry in inventory['textures']:
            delivered = root / entry['png']
            installed = root / entry['installPath'] if entry.get('installPath') else runtime / entry['source']
            if (entry['source'].lower() not in replacements and delivered.is_file()
                    and installed.is_file() and installed.read_bytes() == delivered.read_bytes()):
                replacements[entry['source'].lower()] = entry
    selected_paths = {entry['source'].lower() for entry in completed}
    selected_directories = {str(PurePosixPath(path).parent) for path in selected_paths}
    model_count = 0
    for source in inventory.get('models', []):
        if str(PurePosixPath(source.lower()).parent) not in selected_directories:
            continue
        target = runtime / source
        snapshot = root / 'art/hd-assets/original-models' / source
        original = snapshot.read_bytes() if snapshot.exists() else target.read_bytes()
        model, _, _ = read_glb(original)
        matches = image_matches(model, source, replacements)
        if not any(entry['source'].lower() in selected_paths for entry in matches.values()):
            continue
        packed = repack(original, source, replacements, root)
        if not snapshot.exists():
            snapshot.parent.mkdir(parents=True, exist_ok=True)
            snapshot.write_bytes(original)
        temporary = target.with_name(target.name + '.tmp')
        temporary.write_bytes(packed)
        temporary.replace(target)
        model_count += 1
    for entry in completed:
        target = root / entry['installPath'] if entry.get('installPath') else runtime / entry['source']
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / entry['png'], target)
    # Shared UI parts and locally composed backgrounds are consumed directly.
    for source in (root / 'art/hd-ui/png').rglob('*.png'):
        target = runtime / 'hd-ui' / source.relative_to(root / 'art/hd-ui/png')
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    local_ui = root / 'art/hd-local-ui/png'
    for name in ('lobby-logo.png', 'normal-cursor-hd.png', 'client-icon.ico'):
        source = local_ui / name
        if source.is_file():
            shutil.copyfile(source, root / 'apps/web/src/assets/ui' / name)
    print(f'Installed {len(completed)} PNGs, {model_count} models; '
          f'skipped {len(selected) - len(completed)} incomplete PNGs')
    subprocess.run([sys.executable, str(root / 'scripts/render-hd-asset-gallery.py'),
                    '--root', str(root)], check=True)


if __name__ == '__main__':
    main()
