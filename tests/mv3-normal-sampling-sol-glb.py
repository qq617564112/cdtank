"""Compare original CPU normal sampling with published GLB morph weights."""
import json
import math
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from mv3 import read_mv3

def float32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


native = json.loads((ROOT / 'recovery/output/mv3-normal-sampling-sol-native.json').read_text())
rows = []
for source in native['rows']:
    relative = source['asset']
    model = read_mv3(ROOT / 'recovery/output/verified/assets/data/Data' / relative)
    blob = (ROOT / 'recovery/output/web-assets/Data' / Path(relative).with_suffix('.glb')).read_bytes()
    size = struct.unpack_from('<I', blob, 12)[0]
    document = json.loads(blob[20:20 + size])
    binary = blob[28 + size:]
    parts = [(mi, pi) for mi, mesh in enumerate(model['meshes']) if mesh['frames']
             for pi, part in enumerate(mesh['parts']) if part['faces']]
    output_index = parts.index((source['mesh'], source['part']))
    primitive = document['meshes'][output_index]['primitives'][0]
    def values(index):
        accessor = document['accessors'][index]
        view = document['bufferViews'][accessor['bufferView']]
        return struct.unpack_from(f'<{accessor["count"] * 3}f', binary, view.get('byteOffset', 0))
    base = values(primitive['attributes']['NORMAL'])
    frame_index = source['firstFrame']
    delta0 = values(primitive['targets'][frame_index - 1]['NORMAL']) if frame_index else [0] * len(base)
    delta1 = values(primitive['targets'][frame_index]['NORMAL'])
    samples = []
    for sample in source['samples']:
        alpha = sample['alpha']
        # glTF uses deltas. Babylon loads absolute target normals then applies
        # (target - base) * influence, producing this same weighted vector.
        weighted = []
        for base_value, d0, d1 in zip(base, delta0, delta1):
            target0 = float32(base_value + d0)
            target1 = float32(base_value + d1)
            first = float32(float32(target0 - base_value) * float32(1 - alpha))
            second = float32(float32(target1 - base_value) * float32(alpha))
            weighted.append(float32(float32(base_value + first) + second))
        maximum_error = 0
        maximum_normalization_change = 0
        for corner, original in enumerate(sample['vertices']):
            actual = weighted[corner * 3:corner * 3 + 3]
            maximum_error = max(maximum_error, max(abs(x - y) for x, y in zip(actual, original['normal'])))
            length = math.sqrt(sum(x*x for x in actual))
            normalized = [x / length for x in actual]
            maximum_normalization_change = max(maximum_normalization_change,
                max(abs(x - y) for x, y in zip(actual, normalized)))
        assert maximum_error < 4e-7, (relative, sample['time'], maximum_error)
        samples.append(dict(time=sample['time'], alpha=alpha, maximumAbsoluteError=maximum_error,
                            maximumBabylonNormalizationChange=maximum_normalization_change))
    rows.append(dict(asset=relative, samples=samples))

paths = [ROOT / 'node_modules/@babylonjs/loaders/glTF/2.0/glTFLoader.pure.js',
         ROOT / 'node_modules/@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertex.js',
         ROOT / 'node_modules/@babylonjs/core/Shaders/pbr.vertex.js']
sources = []
for path in paths:
    text = path.read_text()
    if path.name == 'glTFLoader.pure.js':
        start = text.index('loadAttribute("NORMAL", VertexBuffer.NormalKind,')
        excerpt = text[start:text.index('        });', start) + 11]
    elif path.name == 'morphTargetsVertex.js':
        excerpt = '\n'.join(line for line in text.splitlines() if 'normalUpdated+=' in line)
    else:
        excerpt = '\n'.join(line for line in text.splitlines() if 'normalize(normalWorld' in line)
    sources.append(dict(path=str(path.relative_to(ROOT)), excerpt=excerpt))
(ROOT / 'recovery/output/mv3-normal-sampling-sol-glb.json').write_text(json.dumps(dict(rows=rows,
    babylonSources=sources), indent=2) + '\n')
print(f'PASS: {len(rows)} original-renderer/GLB comparisons, 9 endpoint/intermediate samples; '
      f'max error {max(s["maximumAbsoluteError"] for r in rows for s in r["samples"])}')
