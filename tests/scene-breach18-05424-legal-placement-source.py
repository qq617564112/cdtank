"""Check new legal placement inputs for already qualified intact assets."""
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from scene import read_scene
published = json.loads((ROOT / 'recovery/output/web-assets/scene-placements.json').read_text())
models = ('obj05424',)
rows = []
for map_id in (18,):
    key = f'{map_id:04d}'
    original = read_scene(ROOT / f'recovery/output/verified/assets/data/Data/scn/{key}/{key}.obj')
    scene = next(value for value in published if value['id'] == key)
    source_records = [r for r in original if r['className'] == 'SYcScnObjBreach' and r['model'] in models and r['enabled']]
    records = [r for r in scene['records'] if r['className'] == 'SYcScnObjBreach' and r['model'] in models and r['enabled']]
    assert len(source_records) == len(records)
    by_id = {r['id']: r for r in records}
    for source in source_records:
        record = by_id[source['id']]
        assert all(record[field] == (list(value) if isinstance(value, tuple) else value) for field, value in source.items())
        assert record['asset'] == f"Data/scnobj/{source['model']}/{source['model']}.glb"
    rows.append(dict(mapId=map_id,placements=len(records),byModel={m:sum(r['model']==m for r in records) for m in models},sourceIds=[r['id'] for r in records],originalPublishedRecordExact=True))
result = dict(status='PASS_NEW_LEGAL_PLACEMENT_INPUTS_ONLY',maps=rows,
    assetSourceReuse=['scene-general06-material-source.json'], loaderReuse='scene-breach21-native.json original Breach4610f1 intact loader; asset POL and texture input reused from General06',
    scope='New original placement inputs for legal map18 only; no material registration, player output, collision or normal Leave acceptance.')
(ROOT / 'recovery/output/scene-breach18-05424-legal-placement-source.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status'], rows)
