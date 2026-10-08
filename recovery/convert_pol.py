"""Convert original POLY meshes to embedded-texture GLB."""
import json
import math
from pathlib import Path
import struct
from pol import read_pol
from convert_mv3 import make_glb


# Adopted terrain references; source POL material names remain unchanged.
TERRAIN_TEXTURE_ADOPTIONS = {
    'data/map/0009/0009.pol': {'00026.tga': 'Data/map/0015/00026.png'},
    'data/map/0016/0016.pol': {'ct-01-1.tga': 'Data/map/0016/di2.png'},
    'data/map/0023/0023.pol': {'qiao.tga': 'Data/map/0006/qiao.png'},
}


def convert(model):
    materials, meshes = [], []
    for mesh in model['meshes']:
        fvf = mesh['fvf']
        vertices, uv, normals, colors = [], [], [], []
        if fvf not in (19, 21):
            raise ValueError(f'Unsupported observed POL vertex layout {fvf}')
        for raw in mesh['vertices']:
            xyz = struct.unpack_from('<3f', raw)
            vertices.append((*[value * 64 for value in xyz], 0))
            offset = 12
            if fvf & 2:
                normal = struct.unpack_from('<3f', raw, offset)
                length = math.sqrt(sum(value * value for value in normal))
                normals.append([value / length for value in normal] if length else [0, 1, 0])
                offset += 12
            if fvf & 4:
                b, g, r, a = raw[offset:offset + 4]
                colors.append([value / 255 for value in (r, g, b, a)])
                offset += 4
            uv.extend(struct.unpack_from('<2f', raw, offset))
        parts = []
        for part in mesh['parts']:
            material_index = len(materials)
            materials.append(dict(properties=part['properties'], textures=(part['textures'] + [''] * 4)[:4]))
            parts.append(dict(material=material_index, faces=[(*face, *face) for face in part['faces']], extra=[]))
        meshes.append(dict(name=mesh['name'], verticesCount=len(vertices),
            frames=[dict(time=0, vertices=vertices)], uv=uv, parts=parts, normals=normals, colors=colors))
    return dict(materials=materials, meshes=meshes, duration=0, tracks=[], tags=[])


def main():
    root = Path('recovery/output/verified/assets/data')
    output = Path('recovery/output/web-assets')
    textures = {}
    for path in root.rglob('*'):
        if path.suffix.lower() not in ('.dds', '.tga', '.bmp', '.jpg'):
            continue
        dest = output / path.relative_to(root).with_suffix('.png')
        textures.setdefault(path.parent, {})[path.stem.lower() + '.tga'] = dest
        textures[path.parent][path.name.lower()] = dest
    results = []
    for path in sorted(root.rglob('*')):
        if path.suffix.lower() != '.pol':
            continue
        original = read_pol(path)
        model = convert(original)
        local = dict(textures.get(path.parent, {}))
        for reference, asset in TERRAIN_TEXTURE_ADOPTIONS.get(path.relative_to(root).as_posix().lower(), {}).items():
            local[reference] = output / asset
        missing = sorted({m['textures'][0] for m in model['materials'] if m['textures'][0] and m['textures'][0].lower() not in local})
        dest = output / path.relative_to(root).with_suffix('.glb')
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(make_glb(model, local))
        results.append(dict(path=path.relative_to(root).as_posix(), output=dest.relative_to(output).as_posix(),
            meshes=len(model['meshes']), frames=len(model['meshes']), tracks=0, missingTextures=missing,
            triangles=sum(len(part['faces']) for mesh in model['meshes'] for part in mesh['parts']),
            sourceDescriptions=[mesh['description'] for mesh in original['meshes']],
            attachments=original['attachments']))
    (output / 'pol-conversion.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Converted {len(results)} POL models, {sum(r["meshes"] for r in results)} meshes, {sum(len(r["missingTextures"]) for r in results)} unresolved texture references')


if __name__ == '__main__':
    main()
