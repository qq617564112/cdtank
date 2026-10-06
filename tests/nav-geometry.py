"""Check NAV offsets, grid values and geometry against every original file."""
from pathlib import Path
import math
import struct
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'recovery'))
from nav import read_nav

count = cells = triangles = 0
for path in sorted(Path('recovery/output/verified/assets/data/Data/scn').rglob('*.nav')):
    raw = path.read_bytes()
    nav = read_nav(path)
    assert nav['size'] == len(raw)
    assert nav['gridOffset'] == 14
    assert len(nav['layers']) == raw[5]
    offset = nav['gridOffset']
    for layer in nav['layers']:
        assert bytes.fromhex(layer['description']) == raw[offset:offset + 128]
        offset += 128
        assert layer['maximum'] + layer['minimum'] == struct.unpack_from('<6f', raw, offset)
        offset += 24
        assert (layer['width'], layer['height']) == struct.unpack_from('<2I', raw, offset)
        offset += 8
        for height, flags in layer['cells']:
            assert (height, flags) == struct.unpack_from('<fI', raw, offset)
            assert math.isfinite(height)
            offset += 8
            cells += 1
    assert offset == nav['geometryOffset']
    for layer in nav['layers']:
        assert (len(layer['vertices']), len(layer['faces'])) == struct.unpack_from('<2H', raw, offset)
        offset += 4
        for vertex in layer['vertices']:
            assert vertex == struct.unpack_from('<3f', raw, offset)
            offset += 12
        for face in layer['faces']:
            assert face == struct.unpack_from('<3H', raw, offset)
            offset += 6
            triangles += 1
    assert offset == len(raw)
    count += 1
assert count == 25
print(f'PASS: {count} complete source NAV grids, {cells} height/flag cells and {triangles} indexed triangles')
