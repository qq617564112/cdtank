"""Compare the exported battlefield data with every source record."""
import json
import base64
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'recovery'))
from pol import read_pol
from scene import read_scene
from nav import read_nav

root = Path('recovery/output/verified/assets/data')
fields = json.loads(Path('recovery/output/web-assets/battlefields.json').read_text())
triangles = slots = boxes = cells = 0
assert len(fields) == 25
for field in fields:
    identifier = field['id']
    navigation = read_nav(root / f'Data/scn/{identifier}/{identifier}.nav')
    assert len(field['navigationLayers']) == len(navigation['layers'])
    for source, exported in zip(navigation['layers'], field['navigationLayers']):
        for key in ['minimum', 'maximum', 'width', 'height']:
            assert source[key] == (tuple(exported[key]) if key in ['minimum', 'maximum'] else exported[key])
        assert base64.b64decode(exported['cells']) == b''.join(
            struct.pack('<fI', *cell) for cell in source['cells'])
        cells += len(source['cells'])
    model = read_pol(root / f'Data/map/{identifier}/{identifier}.POL')
    expected = []
    for mesh in model['meshes']:
        vertices = [struct.unpack_from('<3f', vertex) for vertex in mesh['vertices']]
        for part in mesh['parts']:
            expected.extend([[*vertices[index]] for index in face] for face in part['faces'])
    assert field['terrainTriangles'] == expected
    triangles += len(expected)
    raw = (root / f'Data/scn/{identifier}/{identifier}.rpt').read_bytes()
    assert field['respawnStamp'] == struct.unpack_from('<I', raw)[0]
    assert len(raw) == 4 + 2 * 12 * 16
    for group, spawns in enumerate(field['respawnGroups']):
        assert len(spawns) == 12
        for slot, spawn in enumerate(spawns):
            values = struct.unpack_from('<4f', raw, 4 + group * 192 + slot * 16)
            assert tuple(spawn['position']) == values[:3]
            assert spawn['heading'] == values[3]
            assert spawn['slot'] == slot
            slots += 1
    source_boxes = read_scene(root / f'Data/scn/{identifier}/{identifier}.box')
    assert len(source_boxes) == len(field['collisionBoxes'])
    for source, exported in zip(source_boxes, field['collisionBoxes']):
        assert source['id'] == exported['id']
        assert source['matrix'] == tuple(exported['matrix'])
        assert source['bounds'] == tuple(exported['dimensions'])
        boxes += 1
assert slots == 600
assert boxes == 2058
assert cells == 1417662
print(f'PASS: 25 maps, {triangles} terrain triangles, {boxes} box transforms, '
      f'{slots} exact source respawn slots and {cells} byte-exact NAV cells')
