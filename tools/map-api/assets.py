"""Original scene object geometry, material references and published placements."""

import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def glb(path):
    raw = Path(path).read_bytes()
    chunks, offset = {}, 12
    while offset < len(raw):
        length, kind = struct.unpack_from('<II', raw, offset)
        chunks[kind] = raw[offset + 8:offset + 8 + length]
        offset += length + 8
    return json.loads(chunks[0x4E4F534A]), chunks.get(0x004E4942, b'')


def accessor(document, binary, index):
    row = document['accessors'][index]
    view = document['bufferViews'][row['bufferView']]
    components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[row['type']]
    dtype = np.dtype({5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2',
                      5125: '<u4', 5126: '<f4'}[row['componentType']])
    result = np.ndarray((row['count'], components), dtype=dtype, buffer=binary,
                        offset=view.get('byteOffset', 0) + row.get('byteOffset', 0),
                        strides=(view.get('byteStride', dtype.itemsize * components), dtype.itemsize))
    if row.get('normalized') and dtype.kind in 'iu':
        result = result.astype(np.float32) / np.iinfo(dtype).max
    return result


def texture_name(material):
    original = material.get('extras', {}).get('originalMV3', {}).get('textures', [])
    name = original[0] if original and original[0] else material.get('name', '')
    return Path(name.replace('\\', '/')).stem + '.png'


def model_folder(model):
    if model.startswith('map-'):
        return ROOT / 'art/original/Data/map' / model[4:]
    return ROOT / 'art/original/Data/scnobj' / model


def texture_files(model):
    row = object_entry(model)
    return [ROOT / item['reference'] for item in row['textures']]


def object_entry(model):
    value = json.loads((ROOT / 'tools/map-api/inventory.json').read_text())
    return next(row for row in value['objects'] if row['model'] == model)


def uv_triangles(model, filename):
    rows = []
    entry = object_entry(model)
    filename = next((row.get('uvReference', filename) for row in entry['textures']
                     if row['filename'].lower() == filename.lower()), filename)
    used_names = set()
    for relative in entry['models']:
        path = ROOT / 'art/original' / relative
        document, binary = glb(path)
        for mesh in document.get('meshes', []):
            if entry.get('meshNames') is not None and mesh['name'] not in entry['meshNames']:
                continue
            for primitive in mesh['primitives']:
                material = document.get('materials', [])[primitive.get('material', 0)]
                name = entry.get('textureAliases', {}).get(material.get('name'), texture_name(material))
                used_names.add(name)
                if name.lower() != filename.lower():
                    continue
                if primitive.get('mode', 4) != 4 or 'TEXCOORD_0' not in primitive['attributes']:
                    continue
                uv = accessor(document, binary, primitive['attributes']['TEXCOORD_0'])
                if 'indices' in primitive:
                    uv = uv[accessor(document, binary, primitive['indices']).ravel()]
                rows.extend(uv.reshape(-1, 3, 2))
    if not rows and len(used_names) == 1:
        # One-texture animation and alternate skins share the named material UVs.
        primary = next(iter(used_names))
        if primary.lower() != filename.lower():
            return uv_triangles(model, primary)
    return np.asarray(rows, dtype=np.float32).reshape(-1, 3, 2)


def inventory():
    entries = json.loads((ROOT / 'apps/web/public/scene-placements.json').read_text())
    sequence = json.loads((ROOT / 'apps/web/public/scene-sequence05023.json').read_text())
    screen, _ = glb(ROOT / 'art/original' / sequence['screen']['asset'])
    screen_texture = texture_name(screen['materials'][0])
    frames = {Path(row['asset']).name for row in sequence['frames']}
    groups = {}
    for entry in entries:
        for placement in entry['records'] + entry['castles']:
            model = placement['model'].split('/')[0]
            if not model.startswith('obj') or not model_folder(model).is_dir():
                continue
            row = groups.setdefault(model, {'model': model, 'maps': set(), 'classes': set(),
                                            'publishedAssets': set()})
            row['maps'].add(entry['id'])
            row['classes'].add(placement.get('className') or 'SYcCastle')
            if placement.get('asset'):
                row['publishedAssets'].add(placement['asset'])
    rows = []
    for model, row in sorted(groups.items()):
        for key in ('maps', 'classes', 'publishedAssets'):
            row[key] = sorted(row[key])
        row['models'] = [str(p.relative_to(ROOT / 'art/original'))
                         for p in sorted(model_folder(model).glob('*.glb'))]
        row['textures'] = []
        for path in sorted(model_folder(model).glob('*.png')):
            with Image.open(path) as image:
                row['textures'].append({'filename': path.name,
                    'reference': str(path.relative_to(ROOT)), 'sourceSize': list(image.size),
                    'alphaRange': list(image.convert('RGBA').getchannel('A').getextrema())})
                if model == sequence['model'] and path.name in frames and path.name != screen_texture:
                    row['textures'][-1]['uvReference'] = screen_texture
        if model == sequence['model']:
            row['modelTextures'] = {
                sequence['base']['asset']: [Path(sequence['base']['texture']).name],
                sequence['screen']['asset']: [Path(frame['asset']).name for frame in sequence['frames']]}
        rows.append(row)
    for kind, source in [('brick', 'Data/scnobj/obj05443/obj05443.png'),
                         ('steel', 'Data/map/0018/dimian01.png')]:
        path = ROOT / 'art/original' / source
        with Image.open(path) as image:
            texture = {'filename': path.name, 'reference': str(path.relative_to(ROOT)),
                       'originalSource': str(path.relative_to(ROOT)),
                       'sourceSize': list(image.size),
                       'alphaRange': list(image.convert('RGBA').getchannel('A').getextrema())}
        relative = 'custom-maps/1001/' + kind + '.glb'
        rows.append({'model': 'test-map-' + kind, 'kind': 'placed-custom-object',
                     'sourceFolder': 'custom-maps/1001',
                     'runtimeFolder': 'custom-maps/1001/' + kind,
                     'maps': ['1001'], 'classes': ['SYcScnObj'],
                     'publishedAssets': [relative], 'models': [relative],
                     'textureAliases': {kind: path.name}, 'textures': [texture]})
    return {'mapCount': len(entries), 'objectCount': len(rows),
            'textureCount': sum(len(row['textures']) for row in rows), 'objects': rows}


if __name__ == '__main__':
    import sys
    result = inventory()
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ('mapCount', 'objectCount', 'textureCount')}))
