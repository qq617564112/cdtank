"""Verify original0004 placements and reuse the accepted original05466 c9 resource."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from scene import read_scene
from scene_breach import decode_breach_tail

WEB = ROOT / 'recovery/output/web-assets'
SOURCE = ROOT / 'recovery/output/verified/assets/data'
accepted = json.loads((ROOT / 'recovery/output/scene-breach07-source.json').read_text())
assert accepted['status'] == 'PASS'
model = next(r for r in accepted['models'] if r['model'] == 'obj05466')
native = json.loads((ROOT / 'recovery/output' / model['sharedNative']).read_text())
assert native['status'] == 'PASS'
library = json.loads((WEB / 'scene-breach-0004.json').read_text())
reference = json.loads((WEB / 'scene-breach-0007.json').read_text())
resource = next(r for r in reference['resources'] if r['reference'] == model['reference'])
assert library['resources'] == [resource]
assert {k: v for k, v in library.items() if k != 'resources'} == {
    k: v for k, v in reference.items() if k != 'resources'}
placements = [r for r in read_scene(SOURCE / 'Data/scn/0004/0004.obj') if r['className'] == 'SYcScnObjBreach']
placements = [r for r in placements if r['model'] == 'obj05466']
assert len(placements) == 17 and {r['model'] for r in placements} == {'obj05466'}
assert [r['id'] for r in placements] == ['113', '115', '116', '259', '260', '466', '467', '468', '469', '472', '474', '475', '476', '477', '478', '479', '480']
scene = next(s for s in json.loads((WEB / 'scene-placements.json').read_text()) if s['id'] == '0004')
for record in placements:
    entry = next(r for r in scene['records'] if r['id'] == record['id'])
    assert all(entry[k] == json.loads(json.dumps(v)) for k, v in record.items())
    assert entry['breachFields'] == decode_breach_tail(bytes.fromhex(record['tail']))
    assert (WEB / entry['asset']).exists()
for node in resource['nodes']:
    for part in node['parts']:
        assert not part.get('asset') or (WEB / part['asset']).exists()
result = dict(status='PASS', mapId=4, model='obj05466', placementCount=17,
              placements=placements, geometryNodes=model['geometryNodes'],
              reusedSourceEvidence='scene-breach07-source.json',
              reusedNativeEvidence=model['sharedNative'],
              scope='Original0017 placement/full tail and exact accepted same-model c9 library. No damage authority or actual-player-output claim.')
(ROOT / 'recovery/output/scene-breach04-source.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: original0004 seventeen05466 placements/tails and accepted same-model c9 library')
