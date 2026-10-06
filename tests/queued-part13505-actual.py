"""Check purchased13505 formal035 presentation and record missing tree sound scope."""
import json
from pathlib import Path
import sys

raw = Path(sys.argv[1])
data = json.loads(raw.read_text())
assert data['status'] == 'PASS_RENDER_PENDING_PIXEL_REVIEW'
assert data['purchase']['purchased']['itemTableId'] == 17035
assert data['purchase']['purchased']['ownedQuantity'] == 1
for state in data['initial']:
    assert next(player for player in state['players'] if player['id'] == 'P1')['queuedPartSkillIds'] == [13505]
pages = []
for page in data['observed']:
    assert len(page['effects']) == 1
    effect = page['effects'][0]
    assert effect['root'] == 2668 and effect['owner'] == 'player-P1'
    assert sorted(effect['rendered']) == [2670, 2671, 2674, 2883, 2884]
    assert {'ww101', 'ww102'} <= {row[0] for row in page['treeSounds']}
    assert page['skillSounds'] and all(row[0] == '0' for row in page['skillSounds'])
    assert page['captures']
    for frame in page['captures']:
        assert frame['elapsed'] >= .5
        assert frame['skillVoices'] == 0
    pages.append({'effect': effect, 'treeSounds': page['treeSounds'], 'slotSounds': page['skillSounds'],
                  'frames': [{k: v for k, v in frame.items() if k != 'world'} for frame in page['captures']]})
for row in data['cleanup']:
    assert row['world'] is None
    assert all(row[key] == 0 for key in ['instances', 'meshes', 'skillVoices', 'treeVoices', 'battleVoices'])
result = {'status': 'PASS_PURCHASED17035_DUAL035_DRAW_LEAVE_PIXELS_PENDING_TREE_SOUND_GAP',
          'raw': str(raw), 'source': 'queued-part13505-source.json', 'module': 'queued-part13505-runtime.json',
          'purchase': data['purchase']['purchased'], 'money': data['purchase']['money'], 'pages': pages,
          'cleanup': data['cleanup'], 'missingTreeSoundAssets': ['ww101', 'ww102'],
          'scope': 'Original035 five drawable nodes via real normal BUY/EQUIP and formal reconstructed qualification. Original tree sound references requested but exact assets absent, no complete silence or sound output claim. Pixels pending direct whole-canvas review; no respawn/rotation/HD.'}
Path('recovery/output/queued-part13505-actual.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
