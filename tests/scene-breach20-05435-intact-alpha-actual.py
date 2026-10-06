"""Check saved ordinary intact plane02 draw identity and original placement matrix."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
raw_path = Path(sys.argv[1])
raw = json.loads(raw_path.read_text())
assert raw['status'] == 'PASS_HOST_MATERIAL_NORMAL_LEAVE' and raw['mapId'] == 20
assert all(world['mode'] == 5 and len(world['players']) == 4 for world in raw['initial'])
assert not raw['browserErrors']
assert all(state['world'] is None and not state['loadingError'] for state in raw['finalLoadState'])
source = json.loads((ROOT / 'recovery/output/scene-breach20-05435-intact-material-source.json').read_text())
scene = next(value for value in json.loads((ROOT / 'recovery/output/web-assets/scene-placements.json').read_text()) if value['id'] == '0020')
records = {value['id']: value for value in scene['records'] if value['className'] == 'SYcScnObjBreach' and value['model'] == 'obj05435'}
rows = []
for side, observed in enumerate(raw['observed'], 1):
    if side == 1:
        assert observed['captures']['natural']
        target = next(d for d in observed['draws'].values() if d['name'].startswith('135/'))
        assert observed['captures']['natural']['frame'] in target['drawFrames']
    draws = []
    for draw in observed['draws'].values():
        identifier = draw['name'].split('/')[0]
        if identifier not in records:
            continue
        record = records[identifier]
        assert draw['shader'] == 'geom_t_c1.gbf' and draw['kind'] == 1
        assert draw['vertices'] == source['expandedVertices'] and draw['count'] > 0
        assert any(name.split(' (')[0] == source['originalTexture'] for name in draw['texture'])
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
    if side == 1:
        assert draws, 'Ordinary visible intact original plane02 draw is required'
    rows.append(dict(page=side,draws=draws))
assert any(row['draws'] for row in rows)
assert all(not row['owner'] and row['materials']==0 for row in raw['leave'])
assert all(not row['owner'] and row['materials']==0 for row in raw['finalCleanup'])
result = dict(status='PASS_HOST_INTACT_DRAW_NORMAL_LEAVE',raw=raw_path.name,rawStatus=raw['status'],sides=rows,
              leave=raw.get('leave'),finalCleanup=raw['finalCleanup'],
              limits=['Actual draw identity and placement matrix do not prove original GPU pixel equivalence.',
                      'Complete 57-placement pixels, c9/events, sound and HD are outside this slice.'])
(ROOT / 'recovery/output/scene-breach20-05435-intact-alpha-actual.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status'] + ': original intact plane02 saved actual draw/matrix scope')
