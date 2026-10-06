"""Verify ordinary equipped two-entry queue transitions and observed output scope."""
import json
from pathlib import Path
import sys

raw = Path(sys.argv[1])
data = json.loads(raw.read_text())
assert data['status'] == 'PASS_QUEUE_ALTERNATION_PENDING_PIXEL_REVIEW'
assert [row['purchased']['itemTableId'] for row in data['purchases']] == [17031, 17032]
assert [row['money'] for row in data['purchases']] == [92480, 90980]
summary = []
for page in data['observed']:
    assert [row['skillId'] for row in page['notifications']] == [13501, 13502]
    assert all(row['duration'] == 0 and row['roleId'] == 1 for row in page['notifications'])
    assert [row['root'] for row in page['effects']] == [2500, 2755, 2500]
    assert [row['kind'] for row in page['calls']] == ['start', 'remove', 'start', 'remove', 'start']
    assert all(row['owner'] == 'player-P1' for row in page['effects'])
    assert all(row['rendered'] == row['nodes'] for row in page['effects'])
    assert all(row['removed'] and row['quiescentAtRemove'] for row in page['effects'][:2])
    assert [row['skillId'] for row in page['alternations']] == [13501, 13502]
    intervals = []
    for index, transition in enumerate(page['alternations']):
        elapsed = transition['clock'] - page['effects'][index]['clock']
        assert 5 <= elapsed <= 5 + transition['delta'] + 0.00001
        assert transition['timerAfter'] == {'skillId': [13502, 13501][index], 'remaining': 5}
        calls = page['calls'][transition['callStart']:transition['callEnd']]
        assert [row['kind'] for row in calls] == ['remove', 'start']
        intervals.append(elapsed)
    assert not page['treeSounds']
    assert len(page['skillSounds']) == 3
    assert all(row[0] == '0' for row in page['skillSounds'])
    assert [row['root'] for row in page['captures']] == [2500, 2755, 2500]
    for frame in page['captures']:
        assert frame['treeVoices'] == frame['skillVoices'] == 0
        assert Path(frame['file']).is_file()
    summary.append({'notifications': page['notifications'], 'intervals': intervals,
                    'alternations': page['alternations'], 'calls': page['calls'],
                    'effects': page['effects'],
                    'frames': [{key: value for key, value in row.items() if key != 'world'}
                               for row in page['captures']]})
assert len(data['cleanup']) == 2
for row in data['cleanup']:
    assert row['world'] is None
    assert all(row[key] == 0 for key in ['instances', 'meshes', 'skillVoices', 'treeVoices', 'battleVoices'])
result = {'status': 'PASS_ORDINARY_DUAL_QUEUE_ALTERNATION_SILENCE_LEAVE_LIMITED_PIXELS',
          'raw': str(raw), 'source': 'recovery/output/role-queued-glow-source.json',
          'purchases': [{'item': row['purchased'], 'money': row['money'], 'tokens': row['tokens']}
                        for row in data['purchases']],
          'pages': summary, 'cleanup': data['cleanup'],
          'pixelReview': {'resolution': [640, 360],
                          '31': 'Both endpoints first and returned31 yellow particles identifiable.',
                          '32': 'Intermediate32 captured canvases have no identifiable particles; draw only.'},
          'scope': 'Genuine purchased tank3/pet2 checkpoint, ordinary API BUY/EQUIP17031/17032, React Ready; original two-entry queue elapsed alternation, original silence, normal Leave. No repeated single/life/restart or HD claim. Strict remaining<delta source reused; timerBefore absent in actual because scheduler deletes before alternate.'}
Path('recovery/output/queued-part-alternation-actual.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
