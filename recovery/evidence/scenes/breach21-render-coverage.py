"""Verify 0021 source Breach placements have published formal destruction resources."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / 'recovery/output/web-assets'
scene = next(row for row in json.loads((ASSETS / 'scene-placements.json').read_text())
             if row['id'] == '0021')
records = [row for row in scene['records'] if row['className'] == 'SYcScnObjBreach']
library = json.loads((ASSETS / 'scene-breach-0021.json').read_text())
resources = {row['reference']: row for row in library['resources']}
rows = []
for placement in records:
    reference = f"Data/scnobj/{placement['model']}/c9.CVD"
    resource = resources[reference]
    textures = sorted({part['asset'] for node in resource['nodes'] for part in node['parts']
                       if part.get('asset')})
    assert resource['resolution'] == 'published' and resource['nodes'] and textures
    assert all((ASSETS / asset).is_file() for asset in textures)
    rows.append(dict(sourcePlacementId=placement['id'], model=placement['model'],
                     reference=reference, nodes=len(resource['nodes']), assets=textures))
assert len(records) == 73 and len(resources) == 4
counts = dict(Counter(row['model'] for row in records))
formal = (ROOT / 'apps/web/src/assets/scenes/scene-preview.ts').read_text()
assert "id === '0021'" in formal and all(repr(model) in formal for model in counts)
consumer = (ROOT / 'apps/web/src/assets/scenes/scene-breach-visual.ts').read_text()
assert 'library.resources.find' in consumer and 'this.model}/c9.CVD' in consumer
actual_evidence = {}
for model, filename in {
    'obj05467': 'browser-scene-breach21.json',
    'obj05468': 'browser-scene-breach21-05468.json',
    'obj05422': 'browser-scene-breach21-05422.json',
    'obj05466': 'browser-scene-breach21-05466.json',
}.items():
    evidence = json.loads((ROOT / 'recovery/output' / filename).read_text())
    assert evidence['status'] == 'PASS' and model in evidence['scope']
    actual_evidence[model] = dict(file=filename, scope=evidence['scope'])
result = dict(status='PASS', counts=counts, rows=rows, actualEvidence=actual_evidence,
              scope='Source0021 73 Breach records mapped to four published c9 resources and '
                    'current formal model-selected consumer. Per-model browser evidence proves '
                    'actual draws; this coverage check does not prove every instance or original rules.')
(ROOT / 'recovery/output/breach21-render-coverage.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS:', counts, 'all73 resources/textures and formal model selection present')
