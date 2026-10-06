"""Verify original05442 c9/material/DDS/GA41 and map18 placement publication."""
import json
from pathlib import Path
import struct
import sys
import wave
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from cvd import read_cvd
from scene import read_scene
from scene_breach import decode_breach_tail
base = ROOT / 'recovery/output/verified/assets/data'
web = ROOT / 'recovery/output/web-assets'
reference = 'Data/scnobj/obj05442/c9.CVD'
library = json.loads((web / 'scene-breach-0018.json').read_text())
assert len(library['resources']) == 2
resource = next(resource for resource in library['resources'] if resource['reference']==reference)
assert resource['reference'] == reference and resource['resolution'] == 'published'
prior=next(r for r in json.loads((web/'scene-breach-0020.json').read_text())['resources'] if r['reference']==reference)
assert resource==prior
original = read_cvd(base / reference)
assert len(original['nodes']) == len(resource['nodes']) == 8
nodes = []
for index, (source, published) in enumerate(zip(original['nodes'], resource['nodes'])):
    assert source['parent']==published['parent'] is None
    if not source['present']:
        assert index==0 and published['parts']==[] and 'animation' not in published
        continue
    assert json.loads(json.dumps(source['frames'])) == published['frames'] and list(source['times']) == published['times']
    assert len(source['frames']) == 25 and len({str(frame) for frame in source['frames']}) == 1
    assert published['animation'] == {key: source[key] for key in ['position', 'rotation', 'scale', 'value']}
    duration = max([*source['times'], *[source[key]['keys'][-1][0] - source[key]['keys'][0][0] for key in ['position', 'rotation', 'scale']]])
    assert published['duration'] == duration == 0.800000011920929
    assert len(source['parts']) == len(published['parts']) == 1
    for part, output in zip(source['parts'], published['parts']):
        assert output['indices'] == [i for face in part['faces'] for i in face] and output['kind'] == part['kind']
        assert output['asset'] == 'Data/scnobj/obj05442/obj05442.png' and part['texture'].lower() == 'obj05442.tga'
        raw = bytes.fromhex(part['material']); properties = []
        for offset in range(0, 16, 4):
            b, g, r, a = raw[offset:offset+4]; properties.extend([r/255, g/255, b/255, a/255])
        properties.append(struct.unpack_from('<f', raw, 16)[0])
        assert output['properties'] == properties
    tracks = {key: dict(keys=len(source[key]['keys']), distinctValues=len({str(value[2:]) for value in source[key]['keys']}))
              for key in ['position', 'rotation', 'scale']}
    assert tracks['position']['distinctValues'] > 1 and tracks['rotation']['distinctValues'] > 1
    nodes.append(dict(index=index, parent=None, frames=25, localVertexPoses=1, duration=duration,
                      vertices=len(source['frames'][0]), triangles=sum(len(p['faces']) for p in source['parts']), tracks=tracks))
with Image.open(base / 'Data/scnobj/obj05442/obj05442.dds') as source_image, Image.open(web / 'Data/scnobj/obj05442/obj05442.png') as published_image:
    assert source_image.size == published_image.size and source_image.convert('RGBA').tobytes() == published_image.convert('RGBA').tobytes()
    texture_pixels = source_image.width * source_image.height
records = [r for r in read_scene(base / 'Data/scn/0018/0018.obj') if r['className'] == 'SYcScnObjBreach' and r['model'] == 'obj05442']
assert len(records) == 16
scene = next(s for s in json.loads((web / 'scene-placements.json').read_text()) if s['id'] == '0018')
for original_placement in records:
    published = next(r for r in scene['records'] if r['id'] == original_placement['id'])
    assert all(published[key] == json.loads(json.dumps(value)) for key, value in original_placement.items())
    assert published['asset'] == 'Data/scnobj/obj05442/obj05442.glb' and (web / published['asset']).is_file()
    assert published['breachFields'] == decode_breach_tail(bytes.fromhex(original_placement['tail']))
native = json.loads((ROOT / 'recovery/output/scene-breach20-05442-native.json').read_text())
empty_native=json.loads((ROOT / 'recovery/output/scene-breach20-05442-empty-native.json').read_text());assert empty_native['status']=='PASS' and empty_native['emptyRoot']['slotRetained']
assert native['status'] == 'PASS' and native['model'] == 'obj05442'
assert [e['reference'] for e in native['destroy'] if e['kind'] == 'sound'] == ['GA41'] and native['repeat'] == []
assert (web / 'audio/sound/GA41.wav').read_bytes() == (ROOT / 'CDTank/Data/sound/GA41.wav').read_bytes()
with wave.open(str(web / 'audio/sound/GA41.wav')) as audio:
    duration = audio.getnframes() / audio.getframerate()
output = dict(status='PASS', reference=reference, nodes=nodes, geometryNodes=list(range(1,8)),emptyNode=0, triangles=sum(n['triangles'] for n in nodes),
              placementCount=len(records), placements=records, materialPropertiesExact=True,
              texture=dict(resolvedSource='Data/scnobj/obj05442/obj05442.dds', identicalDecodedRGBA=True, pixels=texture_pixels),
              sound=dict(name='GA41', identicalOriginalBytes=True, duration=duration), native='scene-breach20-05442-native.json',emptyNative='scene-breach20-05442-empty-native.json')
(ROOT / 'recovery/output/scene-breach18-05442-source.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS:05442 empty0+seven geometry/25 constant local frames/original tracks/material/DDS,16 map18 placements,existing GA41 native/original bytes')
