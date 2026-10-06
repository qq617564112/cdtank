"""Check ordinary purchased2017 dual026/SE20 events, end and Leave evidence."""
import json
from pathlib import Path
import sys

raw = Path(sys.argv[1])
data = json.loads(raw.read_text())
assert data['status'] == 'PASS_VICTIM026_SCOPE_PENDING_PIXEL_REVIEW'
pages = data['observed']
assert len(pages) == 2
hits = [[event for event in page['events']
         if event['type'] == 'hit' and event.get('shotPlayerResult', {}).get('itemId') == 2017]
        for page in pages]
assert len(hits[0]) == 1 and hits[0] == hits[1]
event = hits[0][0]
assert event['targetId'] == 'P2'
assert data['shopScroll'][-1]['visible']
assert int(data['purchase']['instance']) > 0
assert data['inventoryBefore']['slot'] == data['purchase']['instance']
assert data['inventoryAfterLeave']['itemTableId'] == 2017
assert data['inventoryAfterLeave']['ownedQuantity'] == 0
for page in pages:
    assert len(page['effects']) == 1
    effect = page['effects'][0]
    assert effect['root'] == 2564 and effect['owner'] == 'player-P2'
    assert effect['event'] == event and effect['result']['itemId'] == 2017
    assert effect['attached'] and effect['expired']
    drawable = {2565, 2566, 2567, 2568, 2628, 2629, 2630, 2631}
    assert set(effect['rendered']) <= drawable and effect['rendered']
    assert all(effect['vertices'][str(node)] > 0 for node in effect['rendered'])
    assert page['resultFrames']
    for frame in page['resultFrames']:
        assert Path(frame['file']).is_file()
    assert len(page['sounds']) == 1
    sound = page['sounds'][0]
    assert sound['event'] == event and sound['reference'] == 'SE20'
    assert sound['selector'] == 1 and not sound['loop']
    assert sound['played'] and sound['ended'] and sound['postGainPeak'] > 0
assert len(data['cleanup']) == 2
for row in data['cleanup']:
    assert not row['world']
    assert row['instances'] == row['meshes'] == row['voices'] == row['battleVoices'] == 0
result = {
    'status': 'PASS_PURCHASED_2017_DUAL026_DRAW_SE20_END_LEAVE_PIXELS_PENDING',
    'raw': str(raw),
    'source': 'combat-shot-player-result-2017-source.json',
    'module': 'combat-shot-player-result-2017-runtime.json',
    'event': event,
    'purchase': data['purchase'],
    'inventoryAfterLeave': data['inventoryAfterLeave'],
    'effects': [page['effects'] for page in pages],
    'undrawnSourceNodes': [sorted({2565, 2566, 2567, 2568, 2628, 2629, 2630, 2631} - set(page['effects'][0]['rendered'])) for page in pages],
    'frames': [page['resultFrames'] for page in pages],
    'sounds': [page['sounds'] for page in pages],
    'cleanup': data['cleanup'],
    'pixelReview': {'status': 'PENDING_DIRECT_WHOLE_CANVAS_REVIEW'},
    'scope': 'Ordinary BUY/Home configuration/Ready/input hit with frozen2017 result. '
             'Original026/SE20 source consumer, dual natural end and normal Leave. '
             'Original Func2HP0 numerical semantics and HD not established.',
}
Path('recovery/output/combat-shot-player-result-2017-actual.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
