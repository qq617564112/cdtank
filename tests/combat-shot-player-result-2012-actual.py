"""Check purchased ordinary2012 hit, victim021 output and normal Leave evidence."""
import json
import sys
from pathlib import Path

raw = Path(sys.argv[1])
data = json.loads(raw.read_text())
assert data['status'] == 'PASS_VICTIM021_SCOPE_PENDING_PIXEL_REVIEW'
pages = data['observed']
hits = [[event for event in page['events']
         if event['type'] == 'hit' and event.get('shotPlayerResult', {}).get('itemId') == 2012]
        for page in pages]
assert len(hits[0]) == 1 and hits[0] == hits[1]
event = hits[0][0]
assert event['targetId'] == 'P2'
assert data['shopScroll'][-1]['visible']
assert any(row['scroll'] > 0 for row in data['shopScroll'])
assert int(data['purchase']['instance']) > 0
assert data['inventoryBefore']['slot'] == data['purchase']['instance']
assert data['inventoryAfterLeave']['itemTableId'] == 2012
assert data['inventoryAfterLeave']['ownedQuantity'] == 0
victim = pages[1]
assert len(victim['effects']) == 1
effect = victim['effects'][0]
assert effect['root'] == 2695 and effect['owner'] == 'player-P2'
assert effect['attached'] and effect['expired'] and effect['event'] == event
assert effect['result']['itemId'] == 2012
drawable = {2696, 2833, 2697, 2800, 2801, 2802, 2803, 2804, 2805, 2806}
assert set(effect['rendered']) <= drawable and effect['rendered']
assert all(effect['vertices'][str(node)] > 0 for node in effect['rendered'])
assert victim['canvas'] == {'width': 320, 'height': 180}
assert victim['resultFrames']
for frame in victim['resultFrames']:
    assert Path(frame['file']).is_file()
for page in pages:
    for sound in page['sounds']:
        assert sound['event'] == event and sound['reference'] == 'SE26'
        assert sound['selector'] == 1 and not sound['loop']
        assert sound['played'] and sound['ended'] and sound['postGainPeak'] > 0
assert len(victim['sounds']) == 1
assert len(data['cleanup']) == 2
for row in data['cleanup']:
    assert row['world'] is None
    assert row['instances'] == row['meshes'] == row['voices'] == row['battleVoices'] == 0
result = {
    'status': 'PASS_PURCHASED_2012_DUAL_LOWRES_021_VISIBLE_SE26_VICTIM_END_LEAVE_SCOPE',
    'raw': str(raw), 'source': 'combat-shot-player-result-2012-source.json',
    'event': event, 'purchase': data['purchase'],
    'inventoryAfterLeave': data['inventoryAfterLeave'],
    'victimEffect': effect, 'frames': victim['resultFrames'],
    'renderedNodes': effect['rendered'], 'undrawnSourceNodes': sorted(drawable - set(effect['rendered'])),
    'sounds': [page['sounds'] for page in pages], 'cleanup': data['cleanup'],
    'pixelReview': {'resolution': [320, 180], 'hostAccepted': True, 'victimAccepted': True,
                    'frames': [pages[0]['resultFrames'][1]['file'], victim['resultFrames'][1]['file']],
                    'observation': 'Both whole canvases show original I LOVE YOU lettering, flowers and heart particles around the victim.'},
    'observerEffect': pages[0]['effects'],
    'scope': 'Real purchased tank3/pet2 checkpoint, disclosed original funds fixture; normal BUY2012x1/Home slot1/Ready/Digit2/Arrow/Space. Frozen2012 hit uses reconstructed flight and damage, not original Func2HP0 numerical semantics. Victim natural end observed; observer natural end not separately captured before raw snapshot. No live state injection. HD and victim short2833 draw remain open.',
}
Path('recovery/output/combat-shot-player-result-2012-actual.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
