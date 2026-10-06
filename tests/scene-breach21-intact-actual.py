"""Check saved ordinary intact barrel draw identity and original placement matrix."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
raw_path = Path(sys.argv[1])
raw = json.loads(raw_path.read_text())
assert raw['status'] in ('PASS', 'FAIL') and raw['mapId'] == 21
complete = raw['status'] == 'PASS'
source = json.loads((ROOT / 'recovery/output/scene-breach21-intact-material-source.json').read_text())
scene = next(value for value in json.loads((ROOT / 'recovery/output/web-assets/scene-placements.json').read_text()) if value['id'] == '0021')
records = {value['id']: value for value in scene['records'] if value['className'] == 'SYcScnObjBreach' and value['model'] == 'obj05467'}
rows = []
for side, observed in enumerate(raw['observed'], 1):
    if complete:
        assert observed['captures']['natural']
    draws = []
    for draw in observed['draws'].values():
        identifier = draw['name'].split('/')[0]
        if identifier not in records:
            continue
        record = records[identifier]
        assert draw['shader'] == 'geom_c1.gbf' and draw['kind'] == 0
        assert draw['vertices'] == source['expandedVertices'] and draw['count'] > 0
        assert draw['texture']
        linear = record['matrix']
        x,y,z = record['position']
        reflection = [-1,1,1,1]
        expected = []
        for column in range(4):
            for row in range(4):
                if column == 3:
                    expected.append([-x,y,z,1][row])
                else:
                    expected.append(linear[column*4+row]*reflection[row]*reflection[column])
        # Imported glTF root reflects X after the source placement transform.
        for column in range(3):
            for row in range(4):
                expected[column*4+row] *= reflection[column]
        assert max(abs(a-b) for a,b in zip(draw['matrix'],expected)) < .001
        draws.append(dict(sourcePlacementId=identifier,actualDraws=draw['count'],vertices=draw['vertices'],sourceWorldMatrixExact=True))
    if complete:
        assert draws, 'Ordinary visible intact original barrel draw is required'
    rows.append(dict(page=side,draws=draws))
assert any(row['draws'] for row in rows)
if complete:
    assert all(not row['owner'] and row['materials']==0 for row in raw['leave'])
assert all(not row['owner'] and row['materials']==0 for row in raw['finalCleanup'])
result = dict(status='PASS_LIMITED_INTACT_DRAW_CONTRACT' if complete else 'PARTIAL_HOST_DRAW_GUEST_LEAVE_GAP',raw=raw_path.name,rawStatus=raw['status'],sides=rows,
              leave=raw.get('leave'),finalCleanup=raw['finalCleanup'],
              limits=['Actual draw identity and placement matrix do not prove original GPU pixel equivalence.',
                      'Complete eight-placement pixels, c9/events, sound and HD are outside this slice.'])
(ROOT / 'recovery/output/scene-breach21-intact-actual.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status'] + ': original intact barrel saved actual draw/matrix scope')
