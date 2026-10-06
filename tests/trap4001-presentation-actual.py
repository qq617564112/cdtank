"""Verify the ordinary enemy-contact victim112 presentation evidence."""
import json
from pathlib import Path

raw = Path('recovery/output/browser-trap4001-presentation-2026-10-05T02-21-33-529Z.json')
data = json.loads(raw.read_text())
a, b = data['observed']
events = [[e for e in page['events'] if e['type'] == 'trapTriggered'] for page in [a, b]]
assert events[0] == events[1] and len(events[0]) == 1
event = events[0][0]
assert event['targetId'] == 'P2'
assert event['playSkillEffect'] == {'skillId': 4001, 'effectIndex': 0, 'duration': 0, 'roleId': 2, 'xBits': 0, 'zBits': 0}
assert len(b['effects']) == 1
fx = b['effects'][0]
assert fx['event'] == event and fx['root'] == 3019
assert fx['owner'] == 'player-P2' and fx['attached']
assert set(fx['rendered']) == {3021, 3110} and fx['expired']
assert fx['textures']['3110'].endswith('/Data/effect/xy/112.png')
assert len(b['resultFrames']) == 3 and b['canvas'] == {'width': 320, 'height': 180}
for page in [a, b]:
    assert len(page['sounds']) == 1
    sound = page['sounds'][0]
    assert sound['event'] == event and sound['reference'] == 'SE44'
    assert sound['selector'] == 1 and not sound['loop']
    assert sound['played'] and sound['ended'] and sound['postGainPeak'] > 0
for row in data['cleanup']:
    assert row['world'] is None and row['instances'] == row['meshes'] == row['voices'] == 0
result = {
    'status': 'PASS_LOCAL_VICTIM112_LOWRES_PIXEL_DUAL_SE44_END_LEAVE_SCOPE',
    'raw': str(raw),
    'source': 'trap4001-presentation-source.json',
    'event': event,
    'victimEffect': fx,
    'frames': b['resultFrames'],
    'pixelReview': {'resolution': [320, 180], 'victimAccepted': True, 'observerAccepted': False,
                    'observation': 'Whole victim canvas shows original112 red-ring graphic above the victim and original smoke particles around its body.'},
    'sounds': [page['sounds'] for page in [a, b]],
    'cleanup': data['cleanup'],
    'scope': 'Actual purchased checkpoint remaining1; ordinary Digit2 placement and A/D/W enemy contact. Original nonretained112 victim effect/SE44 single output and natural end, dual normal Leave. Ground/contact/restraint policies reconstructed. Observer built no112 tree; its exact clipping decision was not observed. No effect017 expiry or5s FX duration inferred. HD and dual independent pixels remain open.',
}
Path('recovery/output/trap4001-presentation-actual.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
