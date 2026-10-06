"""Verify original activation and the ordinary two-page rendered camera evidence."""
import base64
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
raw_path = Path(sys.argv[1])
raw = json.loads(raw_path.read_text())
native = json.loads((ROOT / 'recovery/output/combat-local-fire-camera-native.json').read_text())
assert raw['status'] == native['status'] == 'PASS'
assert len(native['rows']) == 16
assert all(row['activated'] == (row['parts'] == 3 and row['local'] and not row['blocked']) for row in native['rows'])
local, remote = raw['observed']
assert local['shakes'] and not remote['shakes']
fire_shakes = [row for row in local['shakes'] if row['kind'] == 'fire']
assert fire_shakes
for shake in fire_shakes:
    assert (shake['parameter'], shake['duration'], shake['strength']) == (1, 0.20000000298023224, 10)
    event = shake['event']
    assert event['type'] == 'fire' and event['playerId'] == raw['victimId']
    player = next(p for p in shake['world']['players'] if p['id'] == raw['victimId'])
    assert player['tankId'] == 151 and player['alive']
    assert any(event == e for e in remote['events'])
active = [row for row in local['framesObserved'] if row['active'] and row['kind'] == 'fire']
assert active and all(row['phase'] == 'PLAYING' for row in active)
assert any(row['viewDifference'] > 1e-6 for row in active)
for owner in (local, remote):
    for row in owner['framesObserved']:
        maximum = max(abs(a - b) for a, b in zip(row['actual'], row['base']))
        assert maximum == row['viewDifference']
assert all(not row['active'] and row['viewDifference'] < 1e-6 for row in remote['framesObserved'])
assert any(not row['active'] and row['viewDifference'] < 1e-6 and
           any(before['active'] for before in local['framesObserved'][:i])
           for i, row in enumerate(local['framesObserved']))
assert any(e['type'] == 'fire' and e['playerId'] in local['fourPartIds'] for e in local['events'])
for owner in (local, remote):
    assert any(v['playerId'] == raw['victimId'] and v['soundId'] == 48 and v['ended'] for v in owner['fireVoices'])
    assert any(v['owner'] == 'player-' + raw['victimId'] and v['vertices'] > 0 for v in owner['muzzleDraws'])
    assert any(v['id'] == raw['victimId'] and not v['alive'] for v in owner['life'])
    assert any(v['id'] == raw['victimId'] and v['alive'] and v['deaths'] > 0 for v in owner['life'])
assert all(row['world']['match']['round'] == raw['finished'][0]['match']['round'] + 1 for row in raw['rematch'])
assert all(any(not clear['active'] and clear['elapsed'] == 0 for clear in row['clear']) for row in raw['rematch'])
assert all(all(value == 0 for value in row.values()) for row in raw['cleanup'])
images = []
for i, row in enumerate(row for row in active if row.get('canvas')):
    path = ROOT / f'recovery/output/combat-local-fire-camera-active-{i+1}.png'
    path.write_bytes(base64.b64decode(row['canvas'].split(',')[1]))
    images.append(dict(path=str(path), frame=row['frame'], tick=row['tick'], elapsed=row['elapsed'], viewDifference=row['viewDifference']))
out = dict(status='PASS', raw=str(raw_path), originalSequences=len(native['rows']), localFireShakes=len(fire_shakes),
           localActiveFrames=len(active), maximumViewDifference=max(row['viewDifference'] for row in active),
           remoteShakes=0, fourPartFireEvents=sum(e['type'] == 'fire' and e['playerId'] in local['fourPartIds'] for e in local['events']),
           images=images, cleanup=raw['cleanup'],
           scope='Independent diagnostic page with ordinary authority inputs; actual view versus unmodified camera base matrix, native fire activation replacing prior hurt shake, remote/four-part silence, original004/GA07, natural restoration/death/revival, same-room rematch and Leave. No original Windows framebuffer claim.')
(ROOT / 'recovery/output/combat-local-fire-camera-actual.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps(out, indent=2))
