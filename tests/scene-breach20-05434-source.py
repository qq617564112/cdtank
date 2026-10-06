"""Verify original05434 destruction geometry, material and placement publication."""
import json
from pathlib import Path
import sys
import wave
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from cvd import read_cvd
from scene import read_scene
base = ROOT / 'recovery/output/verified/assets/data'
web = ROOT / 'recovery/output/web-assets'
reference = 'Data/scnobj/obj05434/c9.CVD'
original = read_cvd(base / reference)
resource = next(r for r in json.loads((web / 'scene-breach-0020.json').read_text())['resources'] if r['reference'] == reference)
assert len(original['nodes']) == len(resource['nodes']) == 13
nodes = []
for index, (source, published) in enumerate(zip(original['nodes'], resource['nodes'])):
    assert source['present'] and source['parent'] == published['parent']
    assert json.loads(json.dumps(source['frames'])) == published['frames'] and list(source['times']) == published['times']
    assert published['animation'] == {key: source[key] for key in ['position', 'rotation', 'scale', 'value']}
    assert len(source['parts']) == len(published['parts']) == 1
    for part, output in zip(source['parts'], published['parts']):
        assert output['indices'] == [i for face in part['faces'] for i in face]
        assert output['asset'] == 'Data/scnobj/obj05434/obj05434.png' and (web / output['asset']).is_file()
        assert part['texture'].lower() == 'obj05434.tga'
    nodes.append(dict(index=index, frames=len(source['frames']), vertices=len(source['frames'][0]), triangles=sum(len(p['faces']) for p in source['parts'])))
records = [r for r in read_scene(base / 'Data/scn/0020/0020.obj') if r['className'] == 'SYcScnObjBreach' and r['model'] == 'obj05434']
assert len(records) == 24 and all(abs(r['bounds'][2]) < 1e-10 for r in records)
native = json.loads((ROOT / 'recovery/output/scene-breach20-05434-native.json').read_text())
assert native['status'] == 'PASS' and native['model'] == 'obj05434'
assert [e['reference'] for e in native['destroy'] if e['kind'] == 'sound'] == ['GA12'] and native['repeat'] == []
assert (web / 'audio/sound/GA12.wav').read_bytes() == (ROOT / 'CDTank/Data/sound/GA12.wav').read_bytes()
with wave.open(str(web / 'audio/sound/GA12.wav')) as audio:
    duration = audio.getnframes() / audio.getframerate()
output = dict(status='PASS', reference=reference, nodes=nodes, placementCount=len(records),
              thinBoundsUnchanged=[dict(id=r['id'], bounds=r['bounds']) for r in records],
              sound=dict(name='GA12', identicalOriginalBytes=True, duration=duration),
              native='scene-breach20-05434-native.json')
(ROOT / 'recovery/output/scene-breach20-05434-source.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS: original05434 thirteen CVD nodes/frames/indices/texture,24 thin placements, GA12 original bytes and native dispatch')
