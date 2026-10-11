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
    return ROOT / 'art/original/Data/scnobj' / model


def texture_files(model):
    return sorted(model_folder(model).glob('*.png'))


def uv_triangles(model, filename):
    rows = []
    for path in sorted(model_folder(model).glob('*.glb')):
        document, binary = glb(path)
        for mesh in document.get('meshes', []):
            for primitive in mesh['primitives']:
                material = document.get('materials', [])[primitive.get('material', 0)]
                if texture_name(material).lower() != filename.lower():
                    continue
                if primitive.get('mode', 4) != 4 or 'TEXCOORD_0' not in primitive['attributes']:
                    continue
                uv = accessor(document, binary, primitive['attributes']['TEXCOORD_0'])
                if 'indices' in primitive:
                    uv = uv[accessor(document, binary, primitive['indices']).ravel()]
                rows.extend(uv.reshape(-1, 3, 2))
    if not rows:
        # Animated screen/waterfall frames and the alternate car skin share UVs.
        primary = next(iter(sorted(model_folder(model).glob('*.glb'))), None)
        if primary:
            document, _ = glb(primary)
            material = next(iter(document.get('materials', [])), None)
            if material and texture_name(material).lower() != filename.lower():
                return uv_triangles(model, texture_name(material))
    return np.asarray(rows, dtype=np.float32).reshape(-1, 3, 2)


def inventory():
    entries = json.loads((ROOT / 'apps/web/public/scene-placements.json').read_text())
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
        for path in texture_files(model):
            with Image.open(path) as image:
                row['textures'].append({'filename': path.name,
                    'reference': str(path.relative_to(ROOT)), 'sourceSize': list(image.size),
                    'alphaRange': list(image.convert('RGBA').getchannel('A').getextrema())})
        rows.append(row)
    return {'mapCount': len(entries), 'objectCount': len(rows),
            'textureCount': sum(len(row['textures']) for row in rows), 'objects': rows}


if __name__ == '__main__':
    import sys
    result = inventory()
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ('mapCount', 'objectCount', 'textureCount')}))
