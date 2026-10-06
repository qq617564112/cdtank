"""Verify both0022 original c9s, textures, cues and all46 source placements."""
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
library = json.loads((web / 'scene-breach-0022.json').read_text())
scene = next(s for s in json.loads((web / 'scene-placements.json').read_text()) if s['id'] == '0022')
original_placements = [r for r in read_scene(base / 'Data/scn/0022/0022.obj') if r['className'] == 'SYcScnObjBreach']
assert len(original_placements) == 46 and len(library['resources']) == 2
rows = []
for model, amount, sound, native_path in [('obj05424', 18, 'GA13', 'scene-breach18-05424-native.json'),
                                          ('obj05469', 28, 'GA33', 'scene-breach22-05469-native.json')]:
    reference = f'Data/scnobj/{model}/c9.CVD'
    published = next(r for r in library['resources'] if r['reference'] == reference)
    original = read_cvd(base / reference)
    assert published['resolution'] == 'published' and len(published['nodes']) == len(original['nodes'])
    geometries = []
    for index, (source, output) in enumerate(zip(original['nodes'], published['nodes'])):
        assert source['parent'] == output['parent']
        if not source['present']:
            assert not output['parts']
            continue
        assert json.loads(json.dumps(source['frames'])) == output['frames']
        assert list(source['times']) == output['times']
        assert output['animation'] == {k: source[k] for k in ['position', 'rotation', 'scale', 'value']}
        assert len(source['parts']) == len(output['parts'])
        for part, mesh in zip(source['parts'], output['parts']):
            assert mesh['indices'] == [v for face in part['faces'] for v in face] and mesh['kind'] == part['kind']
            texture = Path(part['texture']).stem
            assert mesh['asset'] == f'Data/scnobj/{model}/{texture}.png'
            with Image.open(base / f'Data/scnobj/{model}/{texture}.dds') as dds, Image.open(web / mesh['asset']) as png:
                assert dds.size == png.size and dds.convert('RGBA').tobytes() == png.convert('RGBA').tobytes()
            raw = bytes.fromhex(part['material'])
            properties = []
            for offset in range(0, 16, 4):
                b,g,r,a = raw[offset:offset+4]
                properties.extend([r/255,g/255,b/255,a/255])
            properties.append(struct.unpack_from('<f',raw,16)[0])
            assert mesh['properties'] == properties
        if source['parts']:
            geometries.append(index)
    native = json.loads((ROOT / 'recovery/output' / native_path).read_text())
    assert native['status'] == 'PASS' and native['model'] == model and native['repeat'] == []
    assert [e['reference'] for e in native['destroy'] if e['kind'] == 'sound'] == [sound]
    assert (web / f'audio/sound/{sound}.wav').read_bytes() == (ROOT / f'CDTank/Data/sound/{sound}.wav').read_bytes()
    records = [r for r in original_placements if r['model'] == model]
    assert len(records) == amount
    for record in records:
        output = next(r for r in scene['records'] if r['id'] == record['id'])
        assert all(output[k] == json.loads(json.dumps(v)) for k,v in record.items())
        assert output['breachFields'] == decode_breach_tail(bytes.fromhex(record['tail']))
        assert (web / output['asset']).is_file()
    with wave.open(str(web / f'audio/sound/{sound}.wav')) as wav:
        duration = wav.getnframes()/wav.getframerate()
    rows.append(dict(model=model,reference=reference,geometryNodes=geometries,nodes=len(original['nodes']),
                     triangles=sum(len(p['faces']) for n in original['nodes'] for p in n['parts']),
                     placementCount=amount,placements=records,sound=dict(reference=sound,duration=duration),
                     originalTextureRGBA=True,materialExact=True,framesTracksIndicesExact=True,native=native_path))
out = dict(status='PASS',mapId=22,placementCount=46,models=rows)
(ROOT / 'recovery/output/scene-breach22-source.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS:0022 both original c9 geometry/tracks/material/DDS,46 placements,original GA13/GA33 bytes/once-native')
