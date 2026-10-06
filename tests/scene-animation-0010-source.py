"""Compare published General106 geometry, tracks and texture with original files."""
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
resource = json.loads((web / 'scene-animation-0010.json').read_text())['resources'][0]
native = read_cvd(source / resource['reference'])['nodes']
assert len(native) == len(resource['nodes']) == 2
constant_tracks=[]
for original, published in zip(native, resource['nodes']):
    assert original['parent'] == published['parent']
    if not original['present']:
        assert published['parts'] == [] and 'animation' not in published
        continue
    assert published['animation'] == {key:original[key] for key in ['position', 'rotation', 'scale', 'value']}
    for track in ['position','rotation','scale']:
        keys=original[track]['keys']
        constant_tracks.append(dict(node=len(constant_tracks)//3,track=track,keyCount=len(keys),sourceValues=keys[0][2:],constantSourceValues=len({tuple(key[2:]) for key in keys})==1))
    assert published['frames'] == [list(map(list, frame)) for frame in original['frames']]
    assert published['times'] == list(original['times'])
    for part, output in zip(original['parts'], published['parts']):
        assert output['indices'] == [i for face in part['faces'] for i in face]
        assert output['kind'] == part['kind']
with Image.open(source / 'Data/scnobj/obj05015/obj05015.dds') as original, Image.open(web / 'Data/scnobj/obj05015/obj05015.png') as published:
    assert original.convert('RGBA').tobytes() == published.convert('RGBA').tobytes()
placement = next(s for s in json.loads((web / 'scene-placements.json').read_text()) if s['id'] == '0010')
record = next(r for r in placement['records'] if r['id'] == '106')
assert record['className'] == 'SYcScnObjGeneral' and record['model'] == 'obj05015'
assert record['animation'] == dict(library='scene-animation-0010.json', reference=resource['reference'])
original_placement=next(r for r in read_scene(source/'Data/scn/0010/0010.obj') if r['id']=='106')
assert all(record[k]==json.loads(json.dumps(original_placement[k])) for k in original_placement)
assert original_placement['enabled']==1
fields=decode_breach_tail(bytes.fromhex(record['tail']))
assert fields['field5c']==1 and not any(fields[k] for k in ['field04','field20','field24','field60','field88'])
assert len(constant_tracks)==6 and all(n['present'] for n in native)
assert all(len({str(frame) for frame in node['frames']})==1 for node in native)
assert all(row['constantSourceValues'] for row in constant_tracks if row['node']==0)
assert not next(row for row in constant_tracks if row['node']==1 and row['track']=='rotation')['constantSourceValues']
assert not next(row for row in constant_tracks if row['node']==1 and row['track']=='scale')['constantSourceValues']
output=dict(status='PASS',record=record,fields=fields,resource=resource['reference'],nodes=len(native),geometryNodes=[i for i,n in enumerate(native) if n.get('parts')],triangles=sum(len(p['faces']) for n in native for p in n.get('parts',[])),constantTracks=constant_tracks,emptyNodes=0,sourceResourceReused=True,textureDecodedRGBA=True,sourceStartPhase='Web start0/rate1/independent page phase convention')
(ROOT/'recovery/output/scene-animation-0010-source.json').write_text(json.dumps(output,indent=2)+'\n')
print('PASS: original0010 General106 source placement,2 nodes,two geometry frames/tracks/indices and DDS pixels match publication')
