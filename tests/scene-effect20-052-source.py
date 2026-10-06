"""Verify supplied 052 subtree, sprite controls and decoded texture publication."""
import json
from pathlib import Path
import struct
import sys
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_sav import read_library

base = ROOT / 'recovery/output/verified/assets/data'
web = ROOT / 'recovery/output/web-assets'
original = read_library((base/'Data/effect/effect.sav').read_bytes())
published = json.loads((web/'effect-library.json').read_text())
indices = [2987, 2988, 2989]
nodes = [original['nodes'][index] for index in indices]
assert [node['type'] for node in nodes] == [0, 1, 1]
assert nodes[0]['name'] == '_root\\online\\052'
assert nodes[0]['children'] == [nodes[1]['id'], nodes[2]['id']]
assert nodes[1]['children'] == nodes[2]['children'] == []
for node in nodes:
    assert node == published['nodes'][node['index']]
    timing = next(r for r in published['nodeTimings'] if r['node'] == node['index'])
    assert (timing['field14c'], timing['delay'], timing['lifetime']) == struct.unpack('<Iff', bytes.fromhex(node['fields']))
    assert timing['delay'] == timing['lifetime'] == 0
controls = []
for node in nodes[1:]:
    control = next(r for r in published['spriteControls'] if r['node'] == node['index'])
    raw = bytes.fromhex(node['modifiers'][0]['payload'])
    for field, offset in [('scale',0), ('scaleRate',12), ('angles',60), ('angleRate',72)]:
        assert control['appearance'][field] == list(struct.unpack_from('<3f', raw, offset))
    for field, offset in [('color',104), ('colorSubtractRate',120)]:
        assert control['appearance'][field] == list(struct.unpack_from('<4f', raw, offset))
    for field, offset in [('position',24), ('velocity',36), ('acceleration',48)]:
        assert control['motion'][field] == list(struct.unpack_from('<3f', raw, offset)) == [0,0,0]
    assert (control['baseStart'],control['baseEnd'],control['baseFlag']) == struct.unpack('<ffB',bytes.fromhex(node['modifiers'][0]['base'])) == (0,0,0)
    assert not control['trailEnabled'] and not control['endOnModelAnimation']
    grid = next(r for r in published['textureGrids'] if r['node'] == node['index'])
    resource = bytes.fromhex(node['resource'])
    assert grid['sourceReference'] == resource[:324].split(b'\0')[0].decode('ascii')
    assert (grid['cellWidth'],grid['cellHeight'],grid['frameCount']) == struct.unpack_from('<III',resource,648) == (64,64,1)
    assert grid['uvFrames'] == [[0,0,1,1]]
    controls.append(control)
with Image.open(base/grid['source']) as source, Image.open(web/grid['asset']) as output:
    assert source.size == output.size == (64,64)
    assert source.convert('RGBA').tobytes() == output.convert('RGBA').tobytes()
assert [r['appearance']['scale'][0] for r in controls] == [40,45]
assert [r['appearance']['angleRate'][2] for r in controls] == [15,-10]
native = json.loads((ROOT/'recovery/output/scene-effect20-052-native.json').read_text())
scene_map = json.loads((web/'scene-effects-0020.json').read_text())
assert scene_map['mapId'] == 20
assert scene_map['effects'] == [dict(id=r['id'],name='_root\\online\\052',enabled=True,position=r['position'],matrix=r['matrix']) for r in native['rows']]
silence = json.loads((ROOT/'recovery/output/scene-effect20-052-silence-native.json').read_text())
assert native['status'] == silence['status'] == 'PASS'
assert not silence['descriptorValid'] and not silence['loaderReached'] and not silence['stopReachedDevice']
out = dict(status='PASS', nodes=nodes, controls=controls, texture=dict(source=grid['source'],asset=grid['asset'],identicalDecodedRGBA=True,pixels=4096),
    placements=native['rows'], silent=dict(noSoundNodes=True,emptyNameNative=silence),
    boundaries=['zero-lifetime infinite behavior uses the existing native lifecycle contract', 'decoded pixels do not establish original GPU sampling'])
(ROOT/'recovery/output/scene-effect20-052-source.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS: original052 three nodes, two infinite sprite controls,4096 decoded texture pixels and silent object lookup')
