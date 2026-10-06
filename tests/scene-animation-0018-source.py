"""Verify original05018 CVD/material/DDS and four0018 placements."""
import json
import struct
import sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from cvd import read_cvd
from scene import read_scene
from scene_breach import decode_breach_tail
base=ROOT/'recovery/output/verified/assets/data';web=ROOT/'recovery/output/web-assets'
resource=json.loads((web/'scene-animation-0018.json').read_text())['resources'][0]
native=read_cvd(base/resource['reference'])['nodes']
assert len(native)==len(resource['nodes'])==6
tracks=[]
for index,(original,published) in enumerate(zip(native,resource['nodes'])):
    assert original['parent']==published['parent']
    if not original['present']:
        assert index==1 and original['parent'] is None and published['parts']==[] and 'animation' not in published
        continue
    assert published['animation']=={key:original[key] for key in ['position','rotation','scale','value']}
    assert published['frames']==json.loads(json.dumps(original['frames'])) and published['times']==list(original['times'])
    assert len(original['frames'])==4 and len({str(frame) for frame in original['frames']})==1
    for kind in ['position','rotation','scale']:
        keys=original[kind]['keys'];distinct=len({str(key[2:])for key in keys})
        assert distinct==(1 if index==0 else 4)
        tracks.append(dict(node=index,track=kind,keyCount=len(keys),distinctValues=distinct))
    assert len(original['parts'])==len(published['parts'])==1
    duration=max([*original['times'],*[original[key]['keys'][-1][0]-original[key]['keys'][0][0] for key in ['position','rotation','scale'] if original[key]['keys']]])
    assert published['duration']==duration==.5
    for part,out in zip(original['parts'],published['parts']):
        assert out['indices']==[i for face in part['faces']for i in face] and out['kind']==part['kind']
        assert out['asset']=='Data/scnobj/obj05018/obj05018.png' and part['texture'].lower()=='obj05018.tga'
        raw=bytes.fromhex(part['material']);properties=[]
        for offset in range(0,16,4):
            b,g,r,a=raw[offset:offset+4];properties.extend([r/255,g/255,b/255,a/255])
        properties.append(struct.unpack_from('<f',raw,16)[0]);assert out['properties']==properties
with Image.open(base/'Data/scnobj/obj05018/obj05018.dds')as source,Image.open(web/'Data/scnobj/obj05018/obj05018.png')as output:
    assert source.size==output.size and source.convert('RGBA').tobytes()==output.convert('RGBA').tobytes();pixels=source.width*source.height
original=[r for r in read_scene(base/'Data/scn/0018/0018.obj')if r['model']=='obj05018']
scene=next(s for s in json.loads((web/'scene-placements.json').read_text())if s['id']=='0018')
assert [r['id']for r in original]==['66','67','68','69']
for row in original:
    published=next(r for r in scene['records']if r['id']==row['id'])
    assert all(published[key]==json.loads(json.dumps(value))for key,value in row.items())
    assert published['animation']==dict(library='scene-animation-0018.json',reference=resource['reference'])
    assert row['enabled']==1 and row['className']=='SYcScnObjGeneral'
    fields=decode_breach_tail(bytes.fromhex(row['tail']));assert not any(fields[k]for k in ['field04','field20','field24','field5c','field60','field88'])
out=dict(status='PASS',reference=resource['reference'],geometryNodes=[0,2,3,4,5],emptyParentNode=1,nodeCount=6,triangles=108,
         localVertexFrames=4,localVertexDistinctFrames=1,duration=.5,tracks=tracks,placements=original,texturePixels=pixels,
         materialPropertiesExact=True,decodedRGBAExact=True,startPhase='Web start0/rate1/independent page phase convention')
(ROOT/'recovery/output/scene-animation-0018-source.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS:05018 six nodes/five geometries,original parent/static vertices/dynamic tracks/material/DDS and four0018 placements')
