"""Check ordinary purchased2014 dual023/SE18 events, end and Leave evidence."""
import json
from pathlib import Path
import sys

raw = Path(sys.argv[1])
data = json.loads(raw.read_text())
assert data['status'] == 'PASS_VICTIM023_SCOPE_PENDING_PIXEL_REVIEW'
pages = data['observed']
assert len(pages) == 2
hits = [[event for event in page['events']
         if event['type'] == 'hit' and event.get('shotPlayerResult', {}).get('itemId') == 2014]
        for page in pages]
assert len(hits[0]) == 1 and hits[0] == hits[1]
event = hits[0][0]
assert event['targetId'] == 'P2'
assert data['shopScroll'][-1]['visible']
assert int(data['purchase']['instance']) > 0
assert data['inventoryBefore']['slot'] == data['purchase']['instance']
assert data['inventoryAfterLeave']['itemTableId'] == 2014
assert data['inventoryAfterLeave']['ownedQuantity'] == 0
for page in pages:
    assert len(page['effects']) == 1
    effect = page['effects'][0]
    assert effect['root'] == 2714 and effect['owner'] == 'player-P2'
    assert effect['event'] == event and effect['result']['itemId'] == 2014
    assert effect['attached'] and effect['expired']
    drawable = {2715, 2716, 2723, 2724, 2725, 2726}
    assert set(effect['rendered']) <= drawable and effect['rendered']
    assert all(effect['vertices'][str(node)] > 0 for node in effect['rendered'])
    assert sorted(row['reference'] for row in page['treeSounds']) == ['ww077', 'ww078', 'ww079']
    assert all(row['parameter'] == 0 and row['asset'] is None for row in page['treeSounds'])
    assert page['resultFrames']
    for frame in page['resultFrames']:
        assert Path(frame['file']).is_file()
    assert len(page['sounds']) == 1
    sound = page['sounds'][0]
    assert sound['event'] == event and sound['reference'] == 'SE18'
    assert sound['selector'] == 1 and not sound['loop']
    assert sound['played'] and sound['ended'] and sound['postGainPeak'] > 0
assert len(data['cleanup']) == 2
for row in data['cleanup']:
    assert not row['world']
    assert row['instances'] == row['meshes'] == row['voices'] == row['battleVoices'] == row['treeVoices'] == 0
result = {
    'status': 'PASS_PURCHASED_2014_DUAL023_DRAW_SE18_END_LEAVE_PIXELS_PENDING',
    'raw': str(raw),
    'source': 'combat-shot-player-result-2014-source.json',
    'module': 'combat-shot-player-result-2014-runtime.json',
    'event': event,
    'purchase': data['purchase'],
    'inventoryAfterLeave': data['inventoryAfterLeave'],
    'effects': [page['effects'] for page in pages],
    'undrawnSourceNodes': [sorted({2715, 2716, 2723, 2724, 2725, 2726} - set(page['effects'][0]['rendered'])) for page in pages],
    'frames': [page['resultFrames'] for page in pages],
    'sounds': [page['sounds'] for page in pages],
    'missingTreeSoundAssets': ['ww077', 'ww078', 'ww079'],
    'treeRequests': [page['treeSounds'] for page in pages],
    'cleanup': data['cleanup'],
    'pixelReview': {'status': 'PENDING_DIRECT_WHOLE_CANVAS_REVIEW'},
    'scope': 'Ordinary BUY/Home configuration/Ready/input hit with frozen2014 result. '
             'Original023/SE18 source consumer, dual natural end and normal Leave. '
             'Original Func2HP0 numerical semantics and HD not established.',
}
Path('recovery/output/combat-shot-player-result-2014-actual.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
