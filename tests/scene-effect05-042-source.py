"""Verify original map05 Effect042 placements, particle tree and texture pixels."""
import json
from pathlib import Path
import struct
import sys
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_sav import read_library
from effect_controls import particle_controls
from scene import read_scene
from mv3 import Reader

SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'
original = read_library((SOURCE / 'Data/effect/effect.sav').read_bytes())
published = json.loads((WEB / 'effect-library.json').read_text())
by_id = {node['id']: node for node in original['nodes']}
root = next(node for node in original['nodes'] if node['name'] == '_root\\online\\042')
nodes = []
queue = [root]
while queue:
    node = queue.pop(0)
    nodes.append(node)
    queue.extend(by_id[child] for child in node['children'])
assert [node['index'] for node in nodes] == [2453, 2454, 2796, 2797]
assert [node['type'] for node in nodes] == [0, 6, 0, 6]
for node in nodes:
    assert node == published['nodes'][node['index']]
    _, delay, lifetime = struct.unpack('<Iff', bytes.fromhex(node['fields']))
    assert delay == lifetime == 0
controls = particle_controls(nodes)
assert controls == [control for control in published['particleControls'] if control['node'] in [2454,2797]]
textures = []
for node in [nodes[1], nodes[3]]:
    grid = next(grid for grid in published['textureGrids'] if grid['node'] == node['index'])
    raw = bytes.fromhex(node['resource'])
    assert grid['sourceReference'] == raw[:324].split(b'\0')[0].decode('ascii')
    assert [grid['cellWidth'],grid['cellHeight'],grid['frameCount']] == list(struct.unpack_from('<III', raw, 324))
    with Image.open(SOURCE / grid['source']) as source, Image.open(WEB / grid['asset']) as output:
        assert source.size == output.size
        assert source.convert('RGBA').tobytes() == output.convert('RGBA').tobytes()
    textures.append(dict(node=node['index'], source=grid['source'], asset=grid['asset'], identicalDecodedRGBA=True))
records = [record for record in read_scene(SOURCE / 'Data/scn/0005/0005.obj') if record['className'] == 'SYcScnObjEffect']
scene_map = json.loads((WEB / 'scene-effects-0005.json').read_text())
assert scene_map['mapId'] == 5 and [r['id'] for r in records] == ['213','214','215','216']
assert len(records) == len(scene_map['effects']) == 4
for record, placement in zip(records, scene_map['effects']):
    reader = Reader(bytes.fromhex(record['tail']))
    assert reader.integer() == 0x778346a2
    field04 = reader.name(reader.integer())
    field20 = reader.unpack('B')[0]
    sound = reader.name(reader.integer())
    gain = reader.unpack('f')[0]
    name = reader.name(reader.integer())
    field88 = reader.unpack('B')[0]
    assert reader.integer() == 0x77834705 and reader.position == len(reader.data)
    assert not any([field04,field20,sound,field88]) and record['enabled'] == 1
    assert placement == dict(id=record['id'], name=name, enabled=True, position=list(record['position']),
                             matrix=list(record['matrix']), soundName=sound, soundGain=gain)
assert [r['soundGain'] for r in scene_map['effects']] == [0,1,1,1]
native = json.loads((ROOT / 'recovery/output/scene-effect20-052-native.json').read_text())
assert native['status'] == 'PASS'
result = dict(status='PASS', placements=scene_map['effects'], nodes=nodes, controls=controls,
              textures=textures, sharedSceneContract='scene-effect20-052-native.json',
              scope='Original map05 four retained scene placements and full042 type6 subtree/controls/textures; same scene class startup/matrix/stop-release contract, no new actual drawing claim')
(ROOT / 'recovery/output/scene-effect05-042-source.json').write_text(json.dumps(result, indent=2)+'\n')
print('PASS: four original map05 placements, source042 particle tree/controls and decoded textures')
