"""Verify tank001's original hurt components and empty hurt ELK binding."""
import configparser
import json
import struct
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from mv3 import read_mv3
from effect_action_keys import action_identifier
from export_effect_links import read_links
base=ROOT/'recovery/output/verified/assets/data'
published=ROOT/'recovery/output/web-assets'
tank=next(t for t in json.loads((published/'tanks.json').read_text()) if t['id']==1)
rows=[]
for component in tank['components']:
    ini=configparser.ConfigParser();ini.read(base/component['ini'],encoding='gbk')
    entry=next(dict(ini[s])for s in ini.sections()if ini[s]['name']=='08')
    source=base/'Data/role/001'/entry['file']
    model=read_mv3(source)
    action=next(a for a in component['actions'] if a['fields']['name']=='08')
    events=[dict(time=e['id'],name=e['name'],identifier=action_identifier(e['name']))for e in model['tags']]
    assert action['fields']==entry and model['duration']==action['duration']==2561
    assert events==action['events']
    expected=([dict(time=160,name='effect1',identifier=1416378268)]
              if component['part'] in ('M','U') else [])
    assert events==expected and (published/action['asset']).is_file()
    blob=(published/action['asset']).read_bytes()
    json_size=struct.unpack_from('<I',blob,12)[0]
    document=json.loads(blob[20:20+json_size])
    binary=blob[28+json_size:]
    def values(index):
        accessor=document['accessors'][index]
        view=document['bufferViews'][accessor['bufferView']]
        size={'SCALAR':1,'VEC2':2,'VEC3':3}[accessor['type']]
        return list(struct.unpack_from('<'+'f'*(accessor['count']*size),binary,view.get('byteOffset',0)+accessor.get('byteOffset',0)))
    source_parts=[(mesh,part_index,part)for mesh in model['meshes']for part_index,part in enumerate(mesh['parts'])if part['faces']]
    assert len(source_parts)==len(document['meshes'])
    checked=[]
    for (mesh,part_index,part),output_mesh,animation in zip(source_parts,document['meshes'],document['animations']):
        assert output_mesh['name']==f"{mesh['name']}/{part_index}"
        primitive=output_mesh['primitives'][0]
        references=[(face[i],face[i+3])for face in part['faces']for i in range(3)]
        positions=[[value/64 for vertex,_ in references for value in frame['vertices'][vertex][:3]]for frame in mesh['frames']]
        base_positions=values(primitive['attributes']['POSITION'])
        assert base_positions==positions[0]
        assert len(primitive['targets'])==len(positions)-1==15
        for frame,target in zip(positions[1:],primitive['targets']):
            assert values(target['POSITION'])==[a-b for a,b in zip(frame,positions[0])]
        assert values(primitive['attributes']['TEXCOORD_0'])==[mesh['uv'][uv*2+axis]for _,uv in references for axis in range(2)]
        sampler=animation['samplers'][0]
        expected_times=[struct.unpack('<f',struct.pack('<f',f['time']/1000))[0]for f in mesh['frames']]
        assert values(sampler['input'])==expected_times and sampler['interpolation']=='LINEAR'
        assert values(sampler['output'])==[float(column==frame-1)for frame in range(16)for column in range(15)]
        checked.append(dict(mesh=output_mesh['name'],expandedVertices=len(references),sourceFrames=16,exactPositionMorphs=True,exactUV=True,exactAnimationTimes=True))
    assert next(a for a in component['actions'] if a['fields']['name']=='01')['duration']==3201
    rows.append(dict(part=component['part'],source=str(source.relative_to(ROOT)),asset=action['asset'],
        duration=model['duration'],stopTime=2461,events=events,meshes=len(model['meshes']),meshNames=[mesh['name'] for mesh in model['meshes']],framesByMesh={mesh['name']: len(mesh['frames']) for mesh in model['meshes']},glb=checked))
raw=(base/'Data/effect/link/001.elk').read_bytes()
groups=read_links(raw)
links=json.loads((published/'effect-links.json').read_text())
entry=next(f for f in links['files'] if f['tankCode']=='001')
assert len(raw)==692 and groups==entry['groups']
assert [g['key']for g in groups]==[action_identifier('03')]
assert all(g['key']!=action_identifier('08')for g in groups)
records=groups[0]['actions'][0]['records']
assert groups[0]['actions'][0]['name']=='attack1' and len(records)==1
assert records[0]['field04String']=='_root\\online\\004'
out=dict(status='PASS',tankId=1,name=tank['name'],components=rows,
    elk=dict(source='Data/effect/link/001.elk',bytes=len(raw),groups=[dict(key=g['key'],actions=[a['name']for a in g['actions']])for g in groups],hurtBinding=None),
    hurtEffect=None,hurtSound=None,
    scope='Original001 INI/MV3 08 metadata and completeELK versus publication; existing original hurt-selector/dispatcher and action-clock source reused.')
(ROOT/'recovery/output/combat-hit-t01-08-0020-source.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS: tank001 M/U/X/Y original08 duration2561, M160/U160 effect1, complete ELK only03/attack1; hurt lookup empty and no replacement sound/effect')
