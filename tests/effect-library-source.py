"""Verify lossless full-library recovery and original ELK target linkage."""
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_sav import read_library, rebuild_library
from export_effect_library import export

source = ROOT / 'recovery/output/verified/assets/data/Data/effect/effect.sav'
raw = source.read_bytes()
result = export()
assert result == json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
assert len(result['nodes']) == 3118
assert result['sourceSize'] == 3367845
assert rebuild_library(result) == raw
sizes = {0: 0, 1: 670, 2: 381, 4: 329, 5: 661, 6: 341,
         7: 717, 8: 337, 10: 0, 11: 8}
modifier_sizes = {0: 0, 1: 158, 2: 0, 4: 0, 5: 116,
                  6: 602, 7: 153, 8: 40, 10: 0, 11: 0}
for node in result['nodes']:
    assert len(bytes.fromhex(node['resource'])) == sizes[node['type']]
    for modifier in node['modifiers']:
        assert len(bytes.fromhex(modifier['payload'])) == modifier_sizes[node['type']]
    # All boundaries are contiguous, without relying only on reconstruction.
    next_offset = (result['nodes'][node['index'] + 1]['offset']
                   if node['index'] < 3117 else len(raw))
    assert node['offset'] + node['size'] == next_offset
assert [(x['id'], x['count']) for x in result['duplicateIds']] == [(2202024325, 16), (0, 2)]
assert len(result['missingReferences']) == 99
by_id = {node['id']: node for node in result['nodes']}
for target in result['linkTargets']:
    assert len(target['nodes']) == 1
    root = result['nodes'][target['nodes'][0]]
    pending, descendants, seen = list(root['children']), [], set()
    while pending:
        identifier = pending.pop()
        assert identifier not in seen, 'duplicate or cycle in linked effect subtree'
        seen.add(identifier)
        node = by_id[identifier]
        assert node['name'].startswith(root['name'] + '\\')
        descendants.append(node['index'])
        pending.extend(node['children'])
    assert sorted(descendants) == target['descendants']
assert len(result['linkTargets'][0]['descendants']) == 5
assert len(result['linkTargets'][1]['descendants']) == 16
for bad in [raw[:-1], raw + b'\0', struct.pack('<f', 2) + raw[4:], raw[:200]]:
    try:
        read_library(bad)
    except ValueError:
        pass
    else:
        raise AssertionError('malformed library accepted')
print('PASS: 3118 nodes / 3367845 bytes, exact roundtrip, loader sizes, ELK child graph, preserved unresolved references')

from collections import Counter
from hashlib import sha256
from PIL import Image
from effect_resources import atlas_uvs

grids = result['textureGrids']
assert len(grids) == 2090
assert Counter(row['resolution'] for row in grids) == {'published': 2022, 'missing': 68}
assert sum(not row.get('uvWithinTexture', True) for row in grids) == 68
for row in grids:
    node = result['nodes'][row['node']]
    raw_resource = bytes.fromhex(node['resource'])
    offset = 648 if node['type'] == 1 else 325 if node['type'] == 8 else 324
    assert (row['cellWidth'], row['cellHeight'], row['frameCount']) == struct.unpack_from('<III', raw_resource, offset)
    if row['resolution'] != 'published':
        continue
    source = ROOT / 'recovery/output/verified/assets/data' / row['source']
    asset = ROOT / 'recovery/output/web-assets' / row['asset']
    assert sha256(source.read_bytes()).hexdigest() == row['sourceSha256']
    assert sha256(asset.read_bytes()).hexdigest() == row['assetSha256']
    with Image.open(asset) as image:
        assert image.size == (row['width'], row['height'])
        assert image.convert('RGBA').getbbox() is not None
    assert len(row['uvFrames']) == row['frameCount']
by_node = {row['node']: row for row in grids}
assert all(by_node[index]['resolution'] == 'published' for index in [2430, 2431, 2785, 2786, 2787])
explosion = by_node[2431]
assert (explosion['width'], explosion['height'], explosion['cellWidth'], explosion['cellHeight'], explosion['frameCount']) == (256, 256, 64, 64, 16)
assert explosion['uvFrames'][0] == [0, 0, .25, .25]
assert explosion['uvFrames'][3] == [.75, 0, 1, .25]
assert explosion['uvFrames'][4] == [0, .25, .25, .5]
assert explosion['uvFrames'][15] == [.75, .75, 1, 1]
# Original falls back to whole texture when either configured cell dimension is 0.
assert atlas_uvs(32, 16, 0, 0, 1) == [[0, 0, 1, 1]]
# Original integer division permits overflowing coordinates; preserve, do not clamp.
assert atlas_uvs(100, 60, 60, 20, 2)[1] == [.6, 0, 1.2, 1 / 3]
assert by_node[2785]['asset'].endswith('FlareBrightOrange_BLUE.png')
print('PASS: 2090 texture grids, 2022 decoded published references, 68 retained missing, 68 retained overflow, original explosion UV row order')

controls = result['spriteControls']
assert len(controls) == 1088
for control in controls:
    modifier = result['nodes'][control['node']]['modifiers'][control['modifier']]
    raw = bytes.fromhex(modifier['payload'])
    assert (control['frameInterval'], control['frameFlags']) == struct.unpack_from('<fI', raw, 136)
    assert (control['baseStart'], control['baseEnd'], control['baseFlag']) == struct.unpack('<ffB', bytes.fromhex(modifier['base']))
    assert control['frameInterval'] > 0
    appearance, motion, orbit = control['appearance'], control['motion'], control['orbit']
    for field, offset in [('scale', 0), ('scaleRate', 12), ('angles', 60), ('angleRate', 72)]:
        assert appearance[field] == list(struct.unpack_from('<fff', raw, offset))
    for field, offset in [('color', 104), ('colorSubtractRate', 120)]:
        assert appearance[field] == list(struct.unpack_from('<ffff', raw, offset))
    for field, offset in [('position', 24), ('velocity', 36), ('acceleration', 48)]:
        assert motion[field] == list(struct.unpack_from('<fff', raw, offset))
    assert orbit['axis'] == list(struct.unpack_from('<fff', raw, 84))
    assert (orbit['radius'], orbit['angularRate']) == struct.unpack_from('<ff', raw, 96)
    assert control['endOnModelAnimation'] == bool(raw[144])
explosion_control = next(c for c in controls if c['node'] == 2431)
assert explosion_control['baseStart'] == 0
assert explosion_control['baseEnd'] == .5
assert explosion_control['frameInterval'] == struct.unpack('<f', bytes.fromhex('0ad7a33c'))[0]
assert explosion_control['frameFlags'] == 1
assert explosion_control['trailEnabled'] and explosion_control['trailLimit'] == 1
print('PASS: 1088 type-1 frame control fields and exact original explosion timing bytes')

timings = result['nodeTimings']
assert len(timings) == len(result['nodes'])
for timing, node in zip(timings, result['nodes']):
    assert timing['node'] == node['index']
    assert (timing['field14c'], timing['delay'], timing['lifetime']) == struct.unpack(
        '<Iff', bytes.fromhex(node['fields']))
    assert len(timing['controllers']) == len(node['modifiers'])
    for boundary, modifier in zip(timing['controllers'], node['modifiers']):
        assert (boundary['start'], boundary['end'], boundary['flag']) == struct.unpack(
            '<ffB', bytes.fromhex(modifier['base']))
for control in controls:
    boundary = timings[control['node']]['controllers'][control['modifier']]
    assert (control['baseStart'], control['baseEnd'], control['baseFlag']) == (
        boundary['start'], boundary['end'], boundary['flag'])
print('PASS: 3118 source node delays/lifetimes and all controller absolute boundaries')

assert len(result['overlayControls']) == 2
for row in result['overlayControls']:
    node = result['nodes'][row['node']]
    modifier = bytes.fromhex(node['modifiers'][row['modifier']]['payload'])
    assert row['color'] == list(struct.unpack_from('<4f', modifier))
    assert row['colorAddRate'] == list(struct.unpack_from('<4f', modifier, 16))
    assert row['frameCount'] == 4
    assert row['reference'] == 'data\\effect\\effect\\pingmu2.tga'
assert by_node[905]['resolution'] == 'published'
print('PASS: original type8 texture and both overlay controller payloads')

bolts = result['boltTextures']
assert len(bolts) == 101
assert all(row['resolution'] == 'published' and row['source'] == 'Data/effect/effect/Bolt.dds' for row in bolts)
for row in bolts:
    resource = bytes.fromhex(result['nodes'][row['node']]['resource'])
    assert row['sourceReference'] == resource[:324].split(b'\0')[0].decode('gb18030')
    assert row['uvFrames'] == [[0, 0, 1, 1]]
print('PASS: 101 original type2 references resolved to published Bolt texture')
