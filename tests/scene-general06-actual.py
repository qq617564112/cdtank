"""Verify saved General06 draw inputs, instance transforms and normal departure."""
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
raw_path = Path(sys.argv[1])
raw = json.loads(raw_path.read_text())
assert raw['status'] == 'PASS_HOST_MATERIAL_NORMAL_LEAVE' and raw['mapId'] == 6
source = json.loads((ROOT / 'recovery/output/scene-general06-material-source.json').read_text())
records = {r['id']: r for r in source['placements']}
assert raw['sourceApproach']['reached']
observed = raw['observed'][0]
assert observed['inputCompleted'] and observed['captures']['natural']
sides = []
for page, proof in enumerate(raw['observed'], 1):
    rows = []
    for draw in proof['draws'].values():
        assert draw['shader'] == 'geom_c1.gbf' and draw['kind'] == 0
        assert draw['vertices'] == source['expandedVertices'] and draw['count'] > 0
        batch = draw['lastBatch']
        assert batch['hardwareInstanced']
        for instance in batch['instances']:
            identifier = instance['name'].split('/')[0]
            assert identifier in records
            record = records[identifier]
            expected = [v * (-1 if i % 4 == 0 else 1) for i,v in enumerate(record['matrix'])]
            x,y,z = record['position']
            expected[12:16] = [-x,y,z,1]
            assert max(abs(a-b) for a,b in zip(instance['matrix'], expected)) < .001
            rows.append(dict(sourcePlacementId=identifier,sourceWorldMatrixExact=True))
    sides.append(dict(page=page,actualSourceInstances=rows,
        actualDraws=sum(d['count'] for d in proof['draws'].values())))
assert sides[0]['actualSourceInstances']
assert all(not s['owner'] and s['materials'] == 0 for s in raw['leave'])
assert all(not s['owner'] and s['materials'] == 0 for s in raw['finalCleanup'])
result = dict(status='PASS_HOST_DRAW_CONTRACT_NORMAL_LEAVE',raw=raw_path.name,
    sides=sides,hostDraws=sides[0]['actualDraws'],
    leave=raw['leave'],finalCleanup=raw['finalCleanup'],
    limits=['Guest nearby box pixels are unverified.', 'Source draw and transform identity do not prove original GPU pixel equivalence.', 'Full map/HD remain open.'])
(ROOT / 'recovery/output/scene-general06-actual.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status'])
