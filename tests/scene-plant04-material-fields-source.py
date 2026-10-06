"""Record new named Plant material fields, reusing accepted geometry and loader."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from pol import read_pol

baseline = json.loads((ROOT / 'recovery/output/scene-plant04-source.json').read_text())
models = []
for name in ('obj05401', 'obj05403', 'obj05405'):
    source_path = ROOT / f'recovery/output/verified/assets/data/Data/scnobj/{name}/{name}.POL'
    source = read_pol(source_path)
    mesh = source['meshes'][0]
    part = mesh['parts'][0]
    baseline_model = next(model for model in baseline['models'] if model['model'] == name)
    assert mesh['name'] == baseline_model['mesh'] and len(source['meshes']) == 1
    assert len(mesh['parts']) == 1 and len(part['properties']) == 17
    models.append({'model': name, 'mesh': mesh['name'] + '/0',
                   'fvf': mesh['fvf'], 'kind': part['kind'],
                   'properties': part['properties'], 'originalTextures': part['textures']})
result = {'status': 'PASS_NEW_NAMED_PLANT_MATERIAL_FIELDS_SOURCE_ONLY',
          'models': models, 'geometryReuse': 'scene-plant04-source.json',
          'loaderReuse': 'scene-plant02-material-native.json',
          'loaderScope': 'Same original Plant class and plant80 consumer; prior GPU dispatch remains INCOMPLETE.',
          'scope': 'New named material field extraction only. No geometry/texture conversion, native execution, production consumer or ordinary output.'}
(ROOT / 'recovery/output/scene-plant04-material-fields-source.json').write_text(
    json.dumps(result, indent=2) + '\n')
print(result['status'])
