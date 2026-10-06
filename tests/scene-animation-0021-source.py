"""Compare published General170 geometry, tracks and texture with original files."""
import json
from pathlib import Path
import sys
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from cvd import read_cvd
from scene import read_scene
from scene_breach import decode_breach_tail

source = ROOT / 'recovery/output/verified/assets/data'
web = ROOT / 'recovery/output/web-assets'
resource = json.loads((web / 'scene-animation-0007.json').read_text())['resources'][0]
native = read_cvd(source / resource['reference'])['nodes']
assert len(native) == len(resource['nodes']) == 23
constant_tracks=[]
for original, published in zip(native, resource['nodes']):
    assert original['parent'] == published['parent']
    if not original['present']:
        assert published['parts'] == [] and 'animation' not in published
        continue
    assert published['animation'] == {key:original[key] for key in ['position', 'rotation', 'scale', 'value']}
    for track in ['position','rotation','scale']:
        keys=original[track]['keys']
        assert len({tuple(key[2:]) for key in keys})==1
        constant_tracks.append(dict(node=len(constant_tracks)//3,track=track,keyCount=len(keys),sourceValues=keys[0][2:],constantSourceValues=True))
    assert published['frames'] == [list(map(list, frame)) for frame in original['frames']]
    assert published['times'] == list(original['times'])
    for part, output in zip(original['parts'], published['parts']):
        assert output['indices'] == [i for face in part['faces'] for i in face]
        assert output['kind'] == part['kind']
with Image.open(source / 'Data/scnobj/obj05025/obj05025.dds') as original, Image.open(web / 'Data/scnobj/obj05025/obj05025.png') as published:
    assert original.convert('RGBA').tobytes() == published.convert('RGBA').tobytes()
placement = next(s for s in json.loads((web / 'scene-placements.json').read_text()) if s['id'] == '0021')
record = next(r for r in placement['records'] if r['id'] == '170')
assert record['className'] == 'SYcScnObjGeneral' and record['model'] == 'obj05025'
assert record['animation'] == dict(library='scene-animation-0007.json', reference=resource['reference'])
original_placement=next(r for r in read_scene(source/'Data/scn/0021/0021.obj') if r['id']=='170')
assert all(record[k]==json.loads(json.dumps(original_placement[k])) for k in original_placement)
assert original_placement['enabled']==1
fields=decode_breach_tail(bytes.fromhex(record['tail']))
assert not any(fields[k] for k in ['field04','field20','field24','field5c','field60','field88'])
assert len(constant_tracks)==9 and len([n for n in native if not n['present']])==20
output=dict(status='PASS',record=record,fields=fields,resource=resource['reference'],nodes=len(native),geometryNodes=[i for i,n in enumerate(native) if n.get('parts')],triangles=sum(len(p['faces']) for n in native for p in n.get('parts',[])),constantTracks=constant_tracks,emptyNodes=20,sourceResourceReused=True,textureDecodedRGBA=True,sourceStartPhase='Web start0/rate1/independent page phase convention')
(ROOT/'recovery/output/scene-animation-0021-source.json').write_text(json.dumps(output,indent=2)+'\n')
print('PASS: original0021 General170 source placement,23 nodes,three geometry frames/tracks/indices and DDS pixels match publication')
