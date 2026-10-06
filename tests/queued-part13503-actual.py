"""Check formal purchased17033 qualification and original033 actor presentation."""
import json
from pathlib import Path
import sys

raw = Path(sys.argv[1])
data = json.loads(raw.read_text())
assert data['status'] == 'PASS_RENDER_PENDING_PIXEL_REVIEW'
assert data['purchase']['purchased']['itemTableId'] == 17033
assert data['purchase']['purchased']['ownedQuantity'] == 1
assert data['purchase']['tokens'] == 0
for state in data['initial']:
    assert next(player for player in state['players'] if player['id'] == 'P1')['queuedPartSkillIds'] == [13503]
assert len(data['observed']) == 2
pages = []
for page in data['observed']:
    assert len(page['effects']) == 1
    effect = page['effects'][0]
    assert effect['root'] == 2605 and effect['owner'] == 'player-P1'
    assert effect['nodes'] == effect['rendered'] == [2606, 2607]
    assert not page['treeSounds']
    assert page['skillSounds'] and all(row[0] == '0' for row in page['skillSounds'])
    assert page['captures']
    for frame in page['captures']:
        assert frame['treeVoices'] == frame['skillVoices'] == 0
    pages.append({'effect': effect, 'notifications': page['notifications'],
                  'frames': [{key: value for key, value in frame.items() if key != 'world'}
                             for frame in page['captures']],
                  'skillSounds': page['skillSounds']})
assert len(data['cleanup']) == 2
for row in data['cleanup']:
    assert row['world'] is None
    assert all(row[key] == 0 for key in ['instances', 'meshes', 'skillVoices', 'treeVoices', 'battleVoices'])
result = {'status': 'PASS_PURCHASED17033_DUAL033_DRAW_SILENCE_LEAVE_PENDING_PIXEL_REVIEW',
          'raw': str(raw), 'source': 'queued-part13503-source.json',
          'module': 'queued-part13503-runtime.json',
          'purchase': data['purchase']['purchased'], 'money': data['purchase']['money'],
          'pages': pages, 'cleanup': data['cleanup'],
          'scope': 'Genuine purchased tank3/pet2 checkpoint with original disclosed funds fixture; normal BUY17033/EQUIP PART0 API and React Ready. Formal snapshot13503 qualification reconstructed, original033 tree/texture/tag0/Sound0. Pixels pending direct review, no death/respawn/rotation/HD claim.'}
Path('recovery/output/queued-part13503-actual.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
