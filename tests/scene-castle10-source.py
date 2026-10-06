"""Verify map0010 Castle placements and reuse the accepted original action libraries."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from scene import read_scene

WEB = ROOT / 'recovery/output/web-assets'
source = ROOT / 'recovery/output/verified/assets/data'
records = read_scene(source / 'Data/scn/0010/0010.cas')
library = json.loads((WEB / 'scene-castle-0010.json').read_text())
reference = json.loads((WEB / 'scene-castle-0002.json').read_text())
accepted = json.loads((ROOT / 'recovery/output/scene-castle02-source.json').read_text())
assert accepted['status'] == 'PASS'
assert library['mapId'] == 10 and len(library['castles']) == len(records) == 2
assert [(r['id'], r['model']) for r in records] == [('93', 'obj05447'), ('94', 'obj05448')]
for record, entry in zip(records, library['castles']):
    assert entry['sourcePlacementId'] == record['id'] and entry['model'] == record['model']
    assert entry['position'] == list(record['position']) and entry['matrix'] == list(record['matrix'])
    original = next(r for r in reference['castles'] if r['model'] == entry['model'])
    assert entry['actions'] == original['actions']
    assert all(a['available'] and (WEB / a['asset']).exists() for a in entry['actions'])
result = dict(status='PASS', mapId=10, placements=[dict(sourcePlacementId=r['sourcePlacementId'], model=r['model'],
                               position=r['position'], matrix=r['matrix'],
                               actions=[dict(name=a['name'], asset=a['asset']) for a in r['actions']])
                          for r in library['castles']],
              reusedModelEvidence='scene-castle02-source.json',
              scope='Original map0010 CAS position/matrix/model and exact accepted same-model action libraries. No state/authority or actual-player-output claim.')
(ROOT / 'recovery/output/scene-castle10-source.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: original Castle93/94 placements and accepted same-model five-action libraries')
