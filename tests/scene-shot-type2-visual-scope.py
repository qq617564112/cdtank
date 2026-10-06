"""Verify ordinary static BOX29 short-node and cleanup evidence."""
import json
from pathlib import Path

raw = Path('recovery/output/browser-scene-shot-type2-visual-2026-10-05T02-12-10-247Z.json')
data = json.loads(raw.read_text())
local, remote = data['observed']
local_events = [event for event in local['events'] if event['type'] == 'sceneStaticHit']
remote_events = [event for event in remote['events'] if event['type'] == 'sceneStaticHit']
assert local_events == remote_events and len(local_events) == 1
assert local_events[0]['targetId'] == '29'
assert local_events[0]['shotItemResult']['itemId'] == 2001
assert data['beforeFireQuery']['kind'] == 'SCENE'
assert data['beforeFireQuery']['targetId'] == '29'
assert all(row['stableTicks'] == 3 for row in data['settledAim'])
assert not local['effects'] and not local['sounds'] and not local.get('gaSounds')
assert all(row['feedback'] == 0 for row in local['results'])
assert len(remote['effects']) == 1
assert set(remote['effects'][0]['rendered']) == {2433, 2434, 2435, 2447, 2448}
assert remote['effects'][0]['expired']
frames = remote['resultFrames']
assert len(frames) == 3 and frames[0]['elapsed'] < .15
assert {2447, 2448}.issubset(frames[0]['rendered'])
assert remote['canvas'] == {'width': 320, 'height': 180}
for frame in frames:
    assert Path(frame['file']).is_file()
for row in data['cleanup']:
    assert row['world'] is None and row['instances'] == row['meshes'] == row['voices'] == 0
output = {
    'status': 'PASS_STATICBOX_SHORT_NODES_LOWRES_PIXEL_END_LEAVE_SCOPE',
    'raw': str(raw),
    'firstEvidence': 'scene-shot-type2-actual.json',
    'staticId': '29',
    'event': local_events[0],
    'releasedStableAim': data['settledAim'],
    'frames': frames,
    'allFiveDrawn': True,
    'allFiveSameFrame': False,
    'pixelReview': {
        'accepted': True,
        'resolution': [320, 180],
        'observation': 'Whole canvas frame0 shows orange burst; frames1/2 show bright yellow-white blast plume at the static hit endpoint.',
    },
    'cleanup': data['cleanup'],
    'scope': 'Ordinary input and frozen2001 BOX29 result; original five nodes cumulatively drawn, short nodes drawn before lifetime, natural end and dual normal Leave. Source timing unchanged. Static query/authorization reconstructed. Original viewport and HD pixel coverage remain open.',
}
Path('recovery/output/scene-shot-type2-visual-supplement.json').write_text(
    json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(output['status'])
