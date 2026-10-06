"""Check ordinary purchased3004 contact and victim115/SE47 output evidence."""
import json
from pathlib import Path
import sys

raw = Path(sys.argv[1])
data = json.loads(raw.read_text())
assert data['status'] == 'PASS_TRAP115_SCOPE_PENDING_PIXEL_REVIEW'
pages = data['observed']
events = [[event for event in page['events']
           if event['type'] == 'trapTriggered' and event.get('skillId') == 4002] for page in pages]
assert len(events[0]) == 1 and events[0] == events[1]
event = events[0][0]
assert event['targetId'] == 'P2'
assert event['playSkillEffect'] == {
    'skillId': 4002, 'effectIndex': 0, 'duration': 0, 'roleId': 2, 'xBits': 0, 'zBits': 0}
assert data['placed']['skillId'] == 3004
assert int(data['purchase']['instance']) > 0
assert data['inventoryBefore']['slot'] == data['purchase']['instance']
assert data['inventoryAfterLeave']['itemTableId'] == 3004
assert data['inventoryAfterLeave']['ownedQuantity'] == 0
victim = pages[1]
assert len(victim['effects']) == 1
effect = victim['effects'][0]
assert effect['root'] == 2954 and effect['owner'] == 'player-P2'
assert effect['attached'] and effect['expired'] and effect['event'] == event
assert effect['rendered'] and set(effect['rendered']) <= {2955, 3113}
assert victim['canvas'] == {'width': 320, 'height': 180}
assert victim['resultFrames']
for frame in victim['resultFrames']:
    assert Path(frame['file']).is_file()
for page in pages:
    assert len(page['sounds']) == 1
    sound = page['sounds'][0]
    assert sound['event'] == event and sound['reference'] == 'SE47'
    assert sound['selector'] == 1 and not sound['loop']
    assert sound['played'] and sound['ended'] and sound['postGainPeak'] > 0
    assert any(event['type'] == 'trapRestraintEnded' and event.get('skillId') == 4002
               for event in page['events'])
for world in data['finalWorld']:
    assert not next(player for player in world['players'] if player['id'] == event['targetId']).get('trapTurnRestraint')
assert len(data['cleanup']) == 2
for row in data['cleanup']:
    assert row['world'] is None
    assert row['instances'] == row['meshes'] == row['voices'] == row['treeVoices'] == 0
result = {
    'status': 'PASS_PURCHASED3004_VICTIM115_DRAW_DUAL_SE47_END_LEAVE_PENDING_PIXEL_REVIEW',
    'raw': str(raw), 'source': 'trap4002-presentation-source.json',
    'event': event, 'placed': data['placed'], 'purchase': data['purchase'],
    'inventoryAfterLeave': data['inventoryAfterLeave'], 'victimEffect': effect,
    'observerEffects': pages[0]['effects'], 'frames': [page['resultFrames'] for page in pages],
    'sounds': [page['sounds'] for page in pages], 'cleanup': data['cleanup'],
    'pixelReview': 'Pending direct whole-canvas review; original geometry draw alone does not prove visible output.',
    'scope': 'Genuine purchased3004 persisted checkpoint/Home/Ready/Digit2/A/D/W contact; no repeated BUY or inventory import. Original115/SE47 nonretained presentation. Placement/contact/flag10 contribution and five-second restoration explicitly reconstructed. No expiry016, ground-model acceptance or full Func4 numerical recovery claimed.',
}
Path('recovery/output/trap4002-presentation-actual.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
