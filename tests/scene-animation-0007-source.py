"""Compare published General32 geometry, tracks and texture with original files."""
import json
from pathlib import Path
import sys
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from cvd import read_cvd

source = ROOT / 'recovery/output/verified/assets/data'
web = ROOT / 'recovery/output/web-assets'
resource = json.loads((web / 'scene-animation-0007.json').read_text())['resources'][0]
native = read_cvd(source / resource['reference'])['nodes']
assert len(native) == len(resource['nodes']) == 23
for original, published in zip(native, resource['nodes']):
    assert original['parent'] == published['parent']
    if not original['present']:
        assert published['parts'] == [] and 'animation' not in published
        continue
    assert published['animation'] == {key:original[key] for key in ['position', 'rotation', 'scale', 'value']}
    assert published['frames'] == [list(map(list, frame)) for frame in original['frames']]
    assert published['times'] == list(original['times'])
    for part, output in zip(original['parts'], published['parts']):
        assert output['indices'] == [i for face in part['faces'] for i in face]
        assert output['kind'] == part['kind']
with Image.open(source / 'Data/scnobj/obj05025/obj05025.dds') as original, Image.open(web / 'Data/scnobj/obj05025/obj05025.png') as published:
    assert original.convert('RGBA').tobytes() == published.convert('RGBA').tobytes()
placement = next(s for s in json.loads((web / 'scene-placements.json').read_text()) if s['id'] == '0007')
record = next(r for r in placement['records'] if r['id'] == '32')
assert record['className'] == 'SYcScnObjGeneral' and record['model'] == 'obj05025'
assert record['animation'] == dict(library='scene-animation-0007.json', reference=resource['reference'])
print('PASS: original0007 General32 source placement,23 nodes,three geometry frames/tracks/indices and DDS pixels match publication')
