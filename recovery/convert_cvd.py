"""Convert CVD local vertex animation, preserving node tracks for scene assembly."""
import json
import math
from pathlib import Path
import struct
from cvd import read_cvd
from convert_mv3 import make_glb


def convert(source):
    materials, meshes = [], []
    for index, node in enumerate(source['nodes']):
        if not node.get('frames'):
            continue
        frames = []
        origin = node['times'][0]
        for time, vertices in zip(node['times'], node['frames']):
            frames.append(dict(time=(time - origin) * 1000,
                vertices=[(*[value * 64 for value in vertex[5:8]], 0) for vertex in vertices]))
        frame_normals = []
        for vertices in node['frames']:
            normals = []
            for vertex in vertices:
                normal = vertex[2:5]
                length = math.sqrt(sum(value * value for value in normal))
                normals.append([value / length for value in normal] if length else [0, 1, 0])
            frame_normals.append(normals)
        parts = []
        for part in node['parts']:
            raw = bytes.fromhex(part['material'])
            colors = []
            for offset in range(0, 16, 4):
                b, g, r, a = raw[offset:offset + 4]
                colors.append([value / 255 for value in (r, g, b, a)])
            properties = colors[0] + colors[1] + colors[2] + colors[3] + [struct.unpack_from('<f', raw, 16)[0]]
            material = len(materials)
            materials.append(dict(properties=properties, textures=[part['texture'], '', '', '']))
            parts.append(dict(material=material, faces=[(*face, *face) for face in part['faces']], extra=[]))
        meshes.append(dict(name=f'node-{index}', verticesCount=len(node['frames'][0]),
            frames=frames, normals=frame_normals[0], frameNormals=frame_normals, uv=[value for vertex in node['frames'][0] for value in vertex[:2]], parts=parts))
    return dict(materials=materials, meshes=meshes, duration=0,
        tracks=[{key: value for key, value in node.items() if key not in ('frames', 'parts')} for node in source['nodes']], tags=[])


def main():
    root = Path('recovery/output/verified/assets/data')
    out = Path('recovery/output/web-assets')
    textures = {}
    for path in root.rglob('*'):
        if path.suffix.lower() in ('.dds', '.tga', '.bmp', '.jpg'):
            target = out / path.relative_to(root).with_suffix('.png')
            textures.setdefault(path.parent, {})[path.stem.lower() + '.tga'] = target
            textures[path.parent][path.name.lower()] = target
    results = []
    for path in sorted(root.rglob('*')):
        if path.suffix.lower() != '.cvd':
            continue
        source = read_cvd(path)
        model = convert(source)
        suffix = '.cvd.glb' if any(p.suffix.lower() == '.pol' and p.stem.lower() == path.stem.lower() for p in path.parent.iterdir()) else '.glb'
        dest = out / path.relative_to(root).with_suffix(suffix)
        dest.parent.mkdir(parents=True, exist_ok=True)
        local = textures.get(path.parent, {})
        dest.write_bytes(make_glb(model, local))
        results.append(dict(path=path.relative_to(root).as_posix(), output=dest.relative_to(out).as_posix(),
            meshes=len(model['meshes']), tracks=len(source['nodes']),
            frames=sum(len(mesh['frames']) for mesh in model['meshes']),
            triangles=sum(len(part['faces']) for mesh in model['meshes'] for part in mesh['parts']),
            missingTextures=sorted({m['textures'][0] for m in model['materials'] if m['textures'][0] and m['textures'][0].lower() not in local}),
            nodeTracks=[{key: value for key, value in node.items() if key != 'frames'} for node in source['nodes']]))
        # Retain node and material animation records for subsequent scene assembly.
    (out / 'cvd-conversion.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Converted {len(results)} CVD local vertex-animation models')


if __name__ == '__main__':
    main()
