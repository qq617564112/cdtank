"""Convert original MV3 vertex animations to glTF 2.0 binary models."""

import argparse
import json
import math
from pathlib import Path
import struct

from mv3 import read_mv3
from mv3_normals import decode_frame_normals


def make_glb(model, texture_paths):
    binary = bytearray()
    document = dict(asset=dict(version='2.0'), buffers=[dict(byteLength=0)],
                    bufferViews=[], accessors=[], meshes=[], nodes=[],
                    scenes=[dict(nodes=[])], scene=0, materials=[],
                    images=[], textures=[], animations=[])

    def accessor(values, kind, component=5126, vertex=False):
        while len(binary) % 4:
            binary.append(0)
        size = dict(SCALAR=1, VEC2=2, VEC3=3, VEC4=4)[kind]
        raw = struct.pack('<' + ('f' if component == 5126 else 'I') * len(values), *values)
        view = len(document['bufferViews'])
        view_entry = dict(buffer=0, byteOffset=len(binary), byteLength=len(raw))
        if vertex:
            view_entry['target'] = 34962
        document['bufferViews'].append(view_entry)
        binary.extend(raw)
        entry = dict(bufferView=view, componentType=component, count=len(values) // size, type=kind)
        if values:
            entry['min'] = [min(values[j::size]) for j in range(size)]
            entry['max'] = [max(values[j::size]) for j in range(size)]
        index = len(document['accessors'])
        document['accessors'].append(entry)
        return index

    for material in model['materials']:
        props = material['properties']
        pbr = dict(baseColorFactor=list(props[4:8]), metallicFactor=0, roughnessFactor=1)
        texture = material['textures'][0]
        if texture and texture.lower() in texture_paths:
            image_path = texture_paths[texture.lower()]
            image_bytes = image_path.read_bytes()
            while len(binary) % 4:
                binary.append(0)
            view = len(document['bufferViews'])
            document['bufferViews'].append(dict(buffer=0, byteOffset=len(binary), byteLength=len(image_bytes)))
            binary.extend(image_bytes)
            image_index = len(document['images'])
            document['images'].append(dict(bufferView=view, mimeType='image/png'))
            document['textures'].append(dict(source=image_index))
            pbr['baseColorTexture'] = dict(index=len(document['textures']) - 1)
        entry = dict(name=texture, pbrMetallicRoughness=pbr,
                     doubleSided=True, alphaMode='MASK', alphaCutoff=0.1)
        if model.get('originalFormat') == 'MV3':
            entry['extras'] = dict(originalMV3=dict(properties=list(props), textures=material['textures']))
        document['materials'].append(entry)

    for mesh in model['meshes']:
        if not mesh['frames']:
            continue
        for part_number, part in enumerate(mesh['parts']):
            if not part['faces']:
                continue
            references = [(face[i], face[i + 3]) for face in part['faces'] for i in range(3)]
            for vertex, uv_index in references:
                if vertex >= mesh['verticesCount'] or uv_index * 2 + 1 >= len(mesh['uv']):
                    raise ValueError('MV3 face references nonexistent vertex or UV')
            positions = []
            for frame in mesh['frames']:
                positions.append([value / 64 for vertex, _ in references
                                  for value in frame['vertices'][vertex][:3]])
            uv = [mesh['uv'][uv_index * 2 + axis] for _, uv_index in references for axis in range(2)]
            base = positions[0]
            normals = []
            for i in range(0, len(base), 9):
                a, b, c = base[i:i + 3], base[i + 3:i + 6], base[i + 6:i + 9]
                u, v = [b[j] - a[j] for j in range(3)], [c[j] - a[j] for j in range(3)]
                normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
                length = math.sqrt(sum(x * x for x in normal))
                unit = [x / length for x in normal] if length else [0, 1, 0]
                normals.extend(unit * 3)
            if mesh.get('normals'):
                normals = [value for vertex, _ in references for value in mesh['normals'][vertex]]
            colors = [value for vertex, _ in references for value in mesh.get('colors', [])[vertex]] if mesh.get('colors') else []
            primitive = dict(attributes=dict(POSITION=accessor(base, 'VEC3', vertex=True),
                                             NORMAL=accessor(normals, 'VEC3', vertex=True),
                                             TEXCOORD_0=accessor(uv, 'VEC2', vertex=True)),
                             material=part['material'])
            if colors:
                primitive['attributes']['COLOR_0'] = accessor(colors, 'VEC4', vertex=True)
            weights_count = len(positions) - 1
            if weights_count:
                primitive['targets'] = [dict(POSITION=accessor([p - b for p, b in zip(position, base)], 'VEC3', vertex=True))
                                        for position in positions[1:]]
            if weights_count and mesh.get('frameNormals'):
                for target, frame_normals in zip(primitive['targets'], mesh['frameNormals'][1:]):
                    expanded = [value for vertex, _ in references for value in frame_normals[vertex]]
                    target['NORMAL'] = accessor([value - base_normal for value, base_normal in zip(expanded, normals)], 'VEC3', vertex=True)
            mesh_index, node_index = len(document['meshes']), len(document['nodes'])
            entry = dict(name=f'{mesh["name"]}/{part_number}', primitives=[primitive])
            if weights_count:
                entry['weights'] = [0] * weights_count
            document['meshes'].append(entry)
            document['nodes'].append(dict(mesh=mesh_index, name=entry['name']))
            document['scenes'][0]['nodes'].append(node_index)
            if weights_count:
                times = [frame['time'] / 1000 for frame in mesh['frames']]
                weights = [float(column == frame - 1) for frame in range(len(times)) for column in range(weights_count)]
                document['animations'].append(dict(name=entry['name'],
                    samplers=[dict(input=accessor(times, 'SCALAR'), output=accessor(weights, 'SCALAR'), interpolation='LINEAR')],
                    channels=[dict(sampler=0, target=dict(node=node_index, path='weights'))]))
    # Preserve attachment matrices and source timing for subsequent effects integration.
    document['extras'] = dict(mv3Duration=model['duration'], attachmentTracks=model['tracks'], tags=model['tags'])
    for key in ('images', 'textures', 'animations', 'materials'):
        if not document[key]:
            del document[key]
    document['buffers'][0]['byteLength'] = len(binary)
    text = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    total = 12 + 8 + len(text) + 8 + len(binary)
    return struct.pack('<III', 0x46546c67, 2, total) + struct.pack('<I4s', len(text), b'JSON') + text + struct.pack('<I4s', len(binary), b'BIN\0') + binary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', type=Path, default=Path('recovery/output/verified/assets/data'))
    parser.add_argument('--out', type=Path, default=Path('recovery/output/web-assets'))
    parser.add_argument('--models-only', action='store_true', help='Reuse previously converted PNG files')
    args = parser.parse_args()
    from PIL import Image
    args.out.mkdir(parents=True, exist_ok=True)
    textures = {}
    for path in args.assets.rglob('*'):
        if path.suffix.lower() not in ('.dds', '.tga', '.bmp', '.jpg'):
            continue
        dest = args.out / path.relative_to(args.assets).with_suffix('.png')
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not args.models_only:
            with Image.open(path) as image:
                image.convert('RGBA').save(dest)
        elif not dest.exists():
            raise ValueError(f'Missing converted texture: {dest}')
        textures.setdefault(path.parent, {})[path.stem.lower() + '.tga'] = dest
        textures[path.parent][path.name.lower()] = dest
    results = []
    for path in args.assets.rglob('*'):
        if path.suffix.lower() != '.mv3':
            continue
        model = read_mv3(path)
        model['originalFormat'] = 'MV3'
        for mesh in model['meshes']:
            mesh['frameNormals'] = decode_frame_normals(mesh)
            if mesh['frameNormals']:
                mesh['normals'] = mesh['frameNormals'][0]
        local_textures = textures.get(path.parent, {})
        missing_textures = sorted({material['textures'][0] for material in model['materials']
                                   if material['textures'][0] and material['textures'][0].lower() not in local_textures})
        if model['consumed'] != model['size']:
            raise ValueError(f'Trailing MV3 data: {path}')
        dest = args.out / path.relative_to(args.assets).with_suffix('.glb')
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(make_glb(model, local_textures))
        results.append(dict(path=path.relative_to(args.assets).as_posix(), output=dest.relative_to(args.out).as_posix(),
                            meshes=len(model['meshes']), tracks=len(model['tracks']),
                            frames=sum(len(mesh['frames']) for mesh in model['meshes']),
                            missingTextures=missing_textures))
    (args.out / 'mv3-conversion.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f'Converted {len(results)} MV3 models with vertex-animation morph targets')


if __name__ == '__main__':
    main()
