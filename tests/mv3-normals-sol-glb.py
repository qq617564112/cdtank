"""Check MV3 conversion preserves source normal indices and animation deltas."""
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from mv3 import read_mv3
from mv3_normals import decode_frame_normals

SOURCE = ROOT / 'recovery/output/verified/assets/data/Data'
published = '--published' in sys.argv
OUTPUT = ROOT / ('recovery/output/web-assets/Data' if published else 'recovery/output/mv3-normals-sol-glb')
fixtures = ['role/001/01M.MV3', 'role/001/04X.MV3', 'role/001/c14m.MV3', 'Pet/001/n1.MV3']
if not published:
    with tempfile.TemporaryDirectory() as temporary:
        source = Path(temporary)
        for relative in fixtures:
            destination = source / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(SOURCE / relative, destination)
        subprocess.run([sys.executable, str(ROOT / 'recovery/convert_mv3.py'), '--assets',
                        str(source), '--out', str(OUTPUT), '--models-only'], check=True)

rows = []
for relative in fixtures:
    model = read_mv3(SOURCE / relative)
    blob = (OUTPUT / Path(relative).with_suffix('.glb')).read_bytes()
    size = struct.unpack_from('<I', blob, 12)[0]
    document = json.loads(blob[20:20 + size])
    binary = blob[28 + size:]
    def values(index):
        accessor = document['accessors'][index]
        view = document['bufferViews'][accessor['bufferView']]
        return struct.unpack_from(f'<{accessor["count"] * 3}f', binary, view.get('byteOffset', 0))
    parts = [(mesh, part) for mesh in model['meshes'] if mesh['frames']
             for part in mesh['parts'] if part['faces']]
    assert len(parts) == len(document['meshes'])
    checked = 0
    maximum_error = 0
    for (mesh, part), output_mesh in zip(parts, document['meshes']):
        decoded = decode_frame_normals(mesh)
        indices = [face[i] for face in part['faces'] for i in range(3)]
        primitive = output_mesh['primitives'][0]
        base = [v for index in indices for v in decoded[0][index]]
        assert values(primitive['attributes']['NORMAL']) == tuple(base)
        targets = primitive.get('targets', [])
        assert len(targets) == len(decoded) - 1
        for target, normals in zip(targets, decoded[1:]):
            expanded = [v for index in indices for v in normals[index]]
            actual = values(target['NORMAL'])
            error = max(abs(b + delta - expected)
                        for b, delta, expected in zip(base, actual, expanded))
            assert error <= 1e-7, (relative, error)
            maximum_error = max(maximum_error, error)
            checked += len(indices)
    rows.append(dict(asset=relative, primitives=len(parts), morphNormalVertices=checked,
                     maximumReconstructionError=maximum_error))
(ROOT / ('recovery/output/mv3-normals-sol-published.json' if published else 'recovery/output/mv3-normals-sol-glb.json')).write_text(json.dumps(rows, indent=2) + '\n')
print(f'PASS: {len(rows)} source MV3 models, {sum(r["primitives"] for r in rows)} primitives, '
      f'{sum(r["morphNormalVertices"] for r in rows)} normal morph vertices')
