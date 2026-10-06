"""Verify original0017 placements and reuse the accepted original05469 c9 resource."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from scene import read_scene
from scene_breach import decode_breach_tail

WEB = ROOT / 'recovery/output/web-assets'
SOURCE = ROOT / 'recovery/output/verified/assets/data'
accepted = json.loads((ROOT / 'recovery/output/scene-breach22-source.json').read_text())
assert accepted['status'] == 'PASS'
model = next(r for r in accepted['models'] if r['model'] == 'obj05469')
assert model['framesTracksIndicesExact'] and model['materialExact'] and model['originalTextureRGBA']
library = json.loads((WEB / 'scene-breach-0017.json').read_text())
reference = json.loads((WEB / 'scene-breach-0022.json').read_text())
resource = next(r for r in reference['resources'] if r['reference'] == model['reference'])
assert library['resources'] == [resource]
assert {k: v for k, v in library.items() if k != 'resources'} == {
    k: v for k, v in reference.items() if k != 'resources'}
placements = [r for r in read_scene(SOURCE / 'Data/scn/0017/0017.obj') if r['className'] == 'SYcScnObjBreach']
assert len(placements) == 12 and {r['model'] for r in placements} == {'obj05469'}
assert [r['id'] for r in placements] == [str(i) for i in range(258, 270)]
scene = next(s for s in json.loads((WEB / 'scene-placements.json').read_text()) if s['id'] == '0017')
for record in placements:
    entry = next(r for r in scene['records'] if r['id'] == record['id'])
    assert all(entry[k] == json.loads(json.dumps(v)) for k, v in record.items())
    assert entry['breachFields'] == decode_breach_tail(bytes.fromhex(record['tail']))
    assert (WEB / entry['asset']).exists()
for node in resource['nodes']:
    for part in node['parts']:
        assert not part.get('asset') or (WEB / part['asset']).exists()
result = dict(status='PASS', mapId=17, model='obj05469', placementCount=12,
              placements=placements, geometryNodes=model['geometryNodes'],
              reusedSourceEvidence='scene-breach22-source.json',
              reusedNativeEvidence=model['native'],
              scope='Original0017 placement/full tail and exact accepted same-model c9 library. No damage authority or actual-player-output claim.')
(ROOT / 'recovery/output/scene-breach17-source.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: original0017 twelve05469 placements/tails and accepted same-model c9 library')
