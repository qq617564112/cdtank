"""Check Castle06 rendered source geometry and ordinary player lifecycle evidence."""
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'recovery/output/web-assets'
raw_path = Path(sys.argv[1]).resolve()
raw = json.loads(raw_path.read_text())
library = json.loads((WEB / 'scene-castle-0006.json').read_text())
source = json.loads((ROOT / 'recovery/output/scene-castle06-source.json').read_text())
assert source['status'] == raw['status'] == 'PASS'
assert all(w['mode'] == 1 and w['mapId'] == 6 and w['phase'] == 'PLAYING'
           and w['players'] and len(w['players']) == 4 for w in raw['initial'])
for state in raw['loaded']:
    assert {r['id'] for r in state['instances']} == {'81', '82'}
    assert all(r['action'] == 'n1' and r['state'] == dict(stage=2, mask=0)
               for r in state['instances'])
    assert len(state['roots']) == 10
    assert {r['name'] for r in state['roots'] if r['enabled']} == {'castle-81/n1', 'castle-82/n1'}
rows = []
for index, observed in enumerate(raw['observed']):
    placement_id = raw['commonPlacementId']
    entry = next(r for r in library['castles'] if r['sourcePlacementId'] == placement_id)
    action = next(a for a in entry['actions'] if a['name'] == 'n1')
    draw = next(d for d in observed['draws'] if d['id'] == placement_id)
    assert draw['action'] == 'n1' and draw['model'] == entry['model']
    assert observed['counts'][placement_id + ':n1'] > 0
    assert draw['root']['position'] == [-entry['position'][0], *entry['position'][1:]]
    assert all(abs(value - 1) < 1e-5 for value in draw['root']['scaling'])
    assert draw['root']['metadata']['action'] == 'n1'
    # GLB root changes handedness; the placement uses the explicit original position.
    expected = list(entry['matrix'])
    for axis in (0, 4, 8):
        expected[axis] *= -1
    expected[12:15] = [-entry['position'][0], *entry['position'][1:]]
    assert all(abs(a - b) < 1e-4 for a, b in zip(draw['matrix'], expected))
    blob = (WEB / action['asset']).read_bytes()
    size = struct.unpack_from('<I', blob, 12)[0]
    document = json.loads(blob[20:20 + size])
    binary = blob[28 + size:]

    def values(index):
        accessor = document['accessors'][index]
        view = document['bufferViews'][accessor['bufferView']]
        count = accessor['count'] * {'VEC2': 2, 'VEC3': 3}[accessor['type']]
        return list(struct.unpack_from(f'<{count}f', binary, view.get('byteOffset', 0)))

    primitive = document['meshes'][0]['primitives'][0]
    assert draw['positions'] == values(primitive['attributes']['POSITION'])
    assert draw['uvs'] == values(primitive['attributes']['TEXCOORD_0'])
    material = document['materials'][primitive['material']]['extras']['originalMV3']
    assert draw['material']['originalMV3']['properties'] == material['properties']
    assert any(action['asset'] in t['url'] for t in draw['textures'])
    image_path = raw_path.with_name(raw_path.stem + f'-natural-{index + 1}.png')
    assert image_path.exists()
    if raw.get('near81'):
        assert placement_id == '81'
        route = [r for r in raw['routeInputs'] if r['page'] == index + 1]
        assert any(r['keys'] for r in route)
        world = raw['active'][index]['world']
        player = next(p for p in world['players'] if p['id'] == world['playerId'])
        initial = next(p for p in raw['initial'][index]['players'] if p['id'] == world['playerId'])
        assert (player['x'] - initial['x']) ** 2 + (player['z'] - initial['z']) ** 2 > 50 ** 2
    rows.append(dict(page=index + 1, sourcePlacementId=placement_id, action='n1',
                     draws=observed['counts'][placement_id + ':n1'], vertices=draw['vertices'],
                     sourceAsset=action['asset'], image=str(image_path.relative_to(ROOT))))
assert all(s == dict(instances=0, roots=0, meshes=0) for s in raw['leave'])
if not raw.get('near81'):
    assert raw['initial'][0]['roomId'] != raw['reentry'][0]['world']['roomId']
    for state in raw['reentry']:
        assert len(state['instances']) == 2
        assert all(r['action'] == 'n1' and r['state'] == dict(stage=2, mask=0)
                   for r in state['instances'])
        assert len(state['roots']) == 10
    assert all(s == dict(instances=0, roots=0, meshes=0) for s in raw['finalLeave'])
result = dict(status='PASS_RENDER_LIFECYCLE', visibleOutputAccepted=False, mapId=6, raw=str(raw_path.relative_to(ROOT)), rows=rows,
              near81=raw.get('near81', False),
              scope='Original n1 rendered geometry/UV/material/placement and ordinary Leave; reentry only in the initial lifecycle segment. Original wall occlusion leaves player-visible Castle output unaccepted. No ordinary damage/death, complete-map or HD claim.')
output = ROOT / ('recovery/output/scene-castle06-near81-actual.json' if raw.get('near81')
                 else 'recovery/output/scene-castle06-actual.json')
output.write_text(json.dumps(result, indent=2) + '\n')
print('PASS: Castle06 actual original n1 geometry/material/placement and owned scene cleanup')
