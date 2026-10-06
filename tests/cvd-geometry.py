"""Compare all CVD triangle corners and vertex-animation frames with GLB."""
import json
from pathlib import Path
import struct
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'recovery'))
from cvd import read_cvd

root = Path('recovery/output/verified/assets/data')
out = Path('recovery/output/web-assets')
catalog = json.loads((out / 'cvd-conversion.json').read_text())
triangles, frames = 0, 0
for entry in catalog:
    model = read_cvd(root / entry['path'])
    blob = (out / entry['output']).read_bytes()
    length = struct.unpack_from('<I', blob, 12)[0]
    document = json.loads(blob[20:20 + length])
    binary = blob[28 + length:]
    def values(index):
        accessor = document['accessors'][index]
        view = document['bufferViews'][accessor['bufferView']]
        size = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[accessor['type']]
        return struct.unpack_from(f'<{accessor["count"] * size}f', binary, view['byteOffset'])
    parts = [(node, part) for node in model['nodes'] if node.get('frames')
             for part in node['parts'] if part['faces']]
    assert len(parts) == len(document['meshes']), entry['path']
    animations = iter(document.get('animations', []))
    for (node, part), mesh in zip(parts, document['meshes']):
        primitive = mesh['primitives'][0]
        references = [i for face in part['faces'] for i in face]
        base = [value for i in references for value in node['frames'][0][i][5:8]]
        assert values(primitive['attributes']['POSITION']) == tuple(base), entry['path']
        uv = [value for i in references for value in node['frames'][0][i][:2]]
        assert values(primitive['attributes']['TEXCOORD_0']) == tuple(uv), entry['path']
        targets = primitive.get('targets', [])
        assert len(targets) == len(node['frames']) - 1, entry['path']
        def source_normals(frame):
            result = []
            for index in references:
                normal = frame[index][2:5]
                magnitude = sum(v * v for v in normal) ** 0.5
                result.extend([v / magnitude for v in normal] if magnitude else [0, 1, 0])
            return result
        base_normals = source_normals(node['frames'][0])
        assert all(abs(a - b) < 0.000001 for a, b in zip(values(primitive['attributes']['NORMAL']), base_normals)), entry['path']
        for target, frame in zip(targets, node['frames'][1:]):
            expected = [value for i in references for value in frame[i][5:8]]
            actual = values(target['POSITION'])
            assert all(abs(a - (p - b)) < 0.0001 for a, p, b in zip(actual, expected, base)), entry['path']
            animated_normals = values(target['NORMAL'])
            expected_normals = source_normals(frame)
            assert all(abs(a - (p - b)) < 0.000001 for a, p, b in zip(animated_normals, expected_normals, base_normals)), entry['path']
        if targets:
            animation = next(animations)
            times = values(animation['samplers'][0]['input'])
            assert all(abs(a - (t - node['times'][0])) < 0.00001 for a, t in zip(times, node['times'])), entry['path']
        triangles += len(part['faces'])
        frames += len(node['frames'])
print(f'{len(catalog)} CVD files: {triangles} triangles, {frames} part frames preserve XYZ, UV, animated normals and source times')
