#!/usr/bin/env python3
"""Install completed HD model textures and retain original non-model artwork."""

import argparse
import json
import importlib.util
import os
from pathlib import Path, PurePosixPath
import shutil
import struct


JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
TEST_MAP_TEXTURES = {
    'custom-maps/1001/brick.glb': (
        'custom-maps/1001/brick/obj05443.png', 'Data/scnobj/obj05443/obj05443.png'),
    'custom-maps/1001/ground.glb': ('Data/map/0014/tiandi.png',),
    'custom-maps/1001/steel.glb': (
        'custom-maps/1001/steel/dimian01.png', 'Data/map/0018/dimian01.png'),
}


def read_glb_metadata(path):
    with path.open('rb') as stream:
        header = stream.read(20)
        size, kind = struct.unpack_from('<II', header, 12)
        if kind != JSON_CHUNK:
            raise ValueError('GLB JSON chunk is missing')
        return json.loads(stream.read(size))


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
        adopted = material.get('extras', {}).get('terrainTextureAdoption', {}).get('asset')
        entry = lookup(adopted) or lookup(material.get('name'))
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
    # The test map embeds these existing textures under its own material names.
    asset = next((name for name in TEST_MAP_TEXTURES.get(source, ())
                  if name.lower() in textures), None)
    if asset and 0 not in matches:
        matches[0] = textures[asset.lower()]
    return matches


def referenced_images(model):
    indices = set()

    def visit(value):
        if isinstance(value, dict):
            for name, child in value.items():
                if name.endswith('Texture') and isinstance(child, dict) and 'index' in child:
                    indices.add(child['index'])
                else:
                    visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(model.get('materials', []))
    return {model['textures'][index]['source'] for index in indices}


def repack(data, source, textures, root):
    model, binary, chunks = read_glb(data)
    matches = image_matches(model, source, textures)
    if not matches:
        return None
    # Retain view indices and geometry bytes, replacing old image payloads in place.
    payload = bytearray()
    views = model.setdefault('bufferViews', [])
    replacements = {}
    external = {}
    directory = PurePosixPath(source).parent
    for index, entry in matches.items():
        view = model['images'][index].get('bufferView')
        if view is not None:
            replacements[view] = entry
        if PurePosixPath(entry['source']).is_relative_to(directory):
            external[index] = PurePosixPath(entry['source']).relative_to(directory).as_posix()
    external_views = {model['images'][index]['bufferView'] for index in external
                      if 'bufferView' in model['images'][index]}
    shared = {}
    for index, view in enumerate(views):
        entry = replacements.get(index)
        offset = view.get('byteOffset', 0)
        key = ('external',) if index in external_views else ('png', entry['png']) if entry else ('original', offset, view['byteLength'])
        if key not in shared:
            value = b'\0' * 4 if index in external_views else (root / entry['png']).read_bytes() if entry else binary[offset:offset + view['byteLength']]
            if entry and index not in external_views and not value.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError(f"Not a PNG: {entry['png']}")
            payload.extend(b'\0' * (-len(payload) % 4))
            shared[key] = (len(payload), len(value))
            payload.extend(value)
        view['byteOffset'], view['byteLength'] = shared[key]
    for index in matches:
        image = model['images'][index]
        if index in external:
            image.pop('bufferView', None)
            image['uri'] = external[index]
        else:
            image.pop('uri', None)
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
    runtime = Path(os.environ.get('CDTANK_WEB_ASSETS', 'apps/web/public'))
    if not runtime.is_absolute():
        runtime = root / runtime
    inventory = json.loads((root / 'art/hd/manifest.json').read_text())
    spec = importlib.util.spec_from_file_location('original_assets', root / 'scripts/restore-original-assets.py')
    original_assets = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original_assets)
    selected = [entry for entry in inventory['textures']
                if args.group is None or args.group in entry.get('groups', [])]
    completed = [entry for entry in selected if (root / entry['png']).is_file()]
    replacements = {entry['source'].lower(): entry for entry in completed}
    # A group install retains artwork installed by earlier groups in shared models.
    if args.group is not None:
        for entry in inventory['textures']:
            delivered = root / entry['png']
            installed = runtime / entry['source']
            if (entry['source'].lower() not in replacements and delivered.is_file()
                    and installed.is_file() and installed.read_bytes() == delivered.read_bytes()):
                replacements[entry['source'].lower()] = entry
    selected_paths = {entry['source'].lower() for entry in completed}
    model_count = 0
    for source in inventory.get('models', []):
        target = runtime / source
        snapshot = root / 'art/original' / source
        original_path = snapshot if snapshot.exists() else target
        model = read_glb_metadata(original_path)
        matches = image_matches(model, source, replacements)
        if not any(entry['source'].lower() in selected_paths for entry in matches.values()):
            continue
        original = original_path.read_bytes()
        packed = repack(original, source, replacements, root)
        temporary = target.with_name(target.name + '.tmp')
        temporary.write_bytes(packed)
        temporary.replace(target)
        model_count += 1
    for entry in completed:
        target = runtime / entry['source']
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / entry['png'], target)
    print(f'Installed {len(completed)} model PNGs and {model_count} models')
    original_assets.restore(root, runtime)


if __name__ == '__main__':
    main()
