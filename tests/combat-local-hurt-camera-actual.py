"""Verify original activation and the ordinary two-page rendered camera evidence."""
import base64
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
raw_path = Path(sys.argv[1])
raw = json.loads(raw_path.read_text())
native = json.loads((ROOT / 'recovery/output/combat-local-hurt-camera-native.json').read_text())
assert raw['status'] == native['status'] == 'PASS'
assert len(native['rows']) == 32
assert all(row['camera']['active'] == (row['parts'] == 3 and row['local']) for row in native['rows'])
local, remote = raw['observed']
assert local['shakes'] and not remote['shakes']
for shake in local['shakes']:
    assert (shake['parameter'], shake['duration'], shake['strength']) == (1, .5, 10)
    event = shake['event']
    assert event['type'] == 'hit' and event['targetId'] == raw['victimId']
    player = next(p for p in shake['world']['players'] if p['id'] == raw['victimId'])
    assert player['tankId'] == 151 and player['alive']
    assert any(event == e for e in remote['events'])
active = [row for row in local['framesObserved'] if row['active']]
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
assert any(e['type'] == 'hit' and e['targetId'] in local['fourPartIds'] for e in local['events'])
assert all(row['world']['match']['round'] == raw['finished'][0]['match']['round'] + 1 for row in raw['rematch'])
assert all(any(not clear['active'] and clear['elapsed'] == 0 for clear in row['clear']) for row in raw['rematch'])
assert all(all(value == 0 for value in row.values()) for row in raw['cleanup'])
images = []
for i, row in enumerate(row for row in active if row.get('canvas')):
    path = ROOT / f'recovery/output/combat-local-hurt-camera-active-{i+1}.png'
    path.write_bytes(base64.b64decode(row['canvas'].split(',')[1]))
    images.append(dict(path=str(path), frame=row['frame'], tick=row['tick'], elapsed=row['elapsed'], viewDifference=row['viewDifference']))
out = dict(status='PASS', raw=str(raw_path), originalSequences=len(native['rows']), localShakes=len(local['shakes']),
           localActiveFrames=len(active), maximumViewDifference=max(row['viewDifference'] for row in active),
           remoteShakes=0, fourPartHitEvents=sum(e['type'] == 'hit' and e['targetId'] in local['fourPartIds'] for e in local['events']),
           images=images, cleanup=raw['cleanup'],
           scope='Independent diagnostic page with ordinary authority inputs; actual view versus unmodified camera base matrix, native activation parameters, remote/four-part silence, natural restoration, same-room rematch and Leave. No original Windows framebuffer claim.')
(ROOT / 'recovery/output/combat-local-hurt-camera-actual.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps(out, indent=2))
