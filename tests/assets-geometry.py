"""Check source triangles, UVs and animated geometry survive GLB conversion."""
import json
from pathlib import Path
import struct
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'recovery'))
from mv3 import read_mv3

root = Path('recovery/output/verified/assets/data/Data')
converted = Path('recovery/output/web-assets/Data')
fixtures = ['role/001/01M.MV3', 'role/001/04X.MV3', 'role/001/c14m.MV3', 'Pet/001/n1.MV3']
for relative in fixtures:
    model = read_mv3(root / relative)
    blob = (converted / Path(relative).with_suffix('.glb')).read_bytes()
    json_size = struct.unpack_from('<I', blob, 12)[0]
    document = json.loads(blob[20:20 + json_size])
    binary = blob[28 + json_size:]
    def values(index):
        accessor = document['accessors'][index]
        view = document['bufferViews'][accessor['bufferView']]
        count = accessor['count'] * {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[accessor['type']]
        return struct.unpack_from(f'<{count}f', binary, view.get('byteOffset', 0))
    def equal(actual, expected):
        assert len(actual) == len(expected), relative
        assert all(abs(a - b) < 0.0001 for a, b in zip(actual, expected)), relative
    parts = [(mesh, part) for mesh in model['meshes'] if mesh['frames']
             for part in mesh['parts'] if part['faces']]
    assert len(parts) == len(document['meshes']), relative
    for (mesh, part), converted_mesh in zip(parts, document['meshes']):
        primitive = converted_mesh['primitives'][0]
        references = [(face[i], face[i + 3]) for face in part['faces'] for i in range(3)]
        base = [v / 64 for vertex, _ in references for v in mesh['frames'][0]['vertices'][vertex][:3]]
        equal(values(primitive['attributes']['POSITION']), base)
        equal(values(primitive['attributes']['TEXCOORD_0']),
              [mesh['uv'][uv * 2 + axis] for _, uv in references for axis in range(2)])
        assert primitive['material'] == part['material'], relative
        targets = primitive.get('targets', [])
        assert len(targets) == len(mesh['frames']) - 1, relative
        for target, frame in zip(targets, mesh['frames'][1:]):
            positions = [v / 64 for vertex, _ in references for v in frame['vertices'][vertex][:3]]
            equal(values(target['POSITION']), [p - b for p, b in zip(positions, base)])
    print(f'{relative}: {len(parts)} primitives, source geometry and morph frames preserved')
