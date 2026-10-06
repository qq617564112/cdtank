"""Verify every POL triangle corner, UV, source normal and vertex color in GLB."""
import json
from pathlib import Path
import struct
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'recovery'))
from pol import read_pol

root = Path('recovery/output/verified/assets/data')
output = Path('recovery/output/web-assets')
checked, triangles = 0, 0
for path in sorted(root.rglob('*')):
    if path.suffix.lower() != '.pol':
        continue
    source = read_pol(path)
    blob = (output / path.relative_to(root).with_suffix('.glb')).read_bytes()
    length = struct.unpack_from('<I', blob, 12)[0]
    gltf = json.loads(blob[20:20 + length])
    binary = blob[28 + length:]
    def values(index):
        accessor = gltf['accessors'][index]
        view = gltf['bufferViews'][accessor['bufferView']]
        size = {'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[accessor['type']]
        return struct.unpack_from(f'<{accessor["count"] * size}f', binary, view['byteOffset'])
    parts = [(mesh, part) for mesh in source['meshes'] for part in mesh['parts'] if part['faces']]
    assert len(parts) == len(gltf['meshes']), path
    for (mesh, part), target in zip(parts, gltf['meshes']):
        references = [index for face in part['faces'] for index in face]
        primitive = target['primitives'][0]
        positions = values(primitive['attributes']['POSITION'])
        expected = [value for index in references for value in struct.unpack_from('<3f', mesh['vertices'][index])]
        assert positions == tuple(expected), f'Position mismatch: {path}'
        uv = values(primitive['attributes']['TEXCOORD_0'])
        expected_uv = [value for index in references for value in struct.unpack_from('<2f', mesh['vertices'][index], mesh['stride'] - 8)]
        assert uv == tuple(expected_uv), f'UV mismatch: {path}'
        if mesh['fvf'] == 21:
            expected_colors = [value / 255 for index in references
                for value in [mesh['vertices'][index][14], mesh['vertices'][index][13],
                              mesh['vertices'][index][12], mesh['vertices'][index][15]]]
            colors = values(primitive['attributes']['COLOR_0'])
            assert all(abs(a - b) < 0.000001 for a, b in zip(colors, expected_colors)), path
        else:
            normals = values(primitive['attributes']['NORMAL'])
            for corner, index in enumerate(references):
                source_normal = struct.unpack_from('<3f', mesh['vertices'][index], 12)
                length_normal = sum(value * value for value in source_normal) ** 0.5
                if length_normal:
                    assert all(abs(normals[corner * 3 + axis] - source_normal[axis] / length_normal) < 0.000001 for axis in range(3)), path
        triangles += len(part['faces'])
    checked += 1
print(f'{checked} POL files: {triangles} triangles preserve source positions, UVs, normals and colors')
