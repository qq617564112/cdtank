"""Check complete original hurt geometry for three- and four-component tanks."""
import configparser
import json
import struct
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from mv3 import read_mv3
from effect_action_keys import action_identifier
from export_effect_links import read_links
base=ROOT/'recovery/output/verified/assets/data'
published=ROOT/'recovery/output/web-assets'
catalog=json.loads((published/'tanks.json').read_text())
rows=[]
for tid in [1,151]:
    tank=next(t for t in catalog if t['id']==tid)
    code=f'{tid:03}'
    components=[]
    for component in tank['components']:
        ini=configparser.ConfigParser();ini.read(base/component['ini'],encoding='gbk')
        if not component['actions']:
            assert tid==151 and component['part']=='U' and not ini.sections()
            components.append(dict(part='U',empty=True,ini=component['ini']))
            continue
        actions=[]
        for name in ['05','06','07','08']:
            entry=next(dict(ini[s])for s in ini.sections()if ini[s]['name']==name)
            source=base/Path(component['ini']).parent/entry['file'];model=read_mv3(source)
            action=next(a for a in component['actions']if a['fields']['name']==name)
            events=[dict(time=e['id'],name=e['name'],identifier=action_identifier(e['name']))for e in model['tags']]
            assert action['fields']==entry and action['events']==events and model['duration']==action['duration']==2561
            blob=(published/action['asset']).read_bytes();size=struct.unpack_from('<I',blob,12)[0]
            document=json.loads(blob[20:20+size]);binary=blob[28+size:]
            def values(index):
                accessor=document['accessors'][index];view=document['bufferViews'][accessor['bufferView']]
                width={'SCALAR':1,'VEC2':2,'VEC3':3}[accessor['type']]
                return list(struct.unpack_from('<'+'f'*(accessor['count']*width),binary,view.get('byteOffset',0)+accessor.get('byteOffset',0)))
            parts=[(mesh,i,part)for mesh in model['meshes']for i,part in enumerate(mesh['parts'])if part['faces']]
            assert len(parts)==len(document['meshes'])==len(document['animations'])
            checked=[]
            for (mesh,part_index,part),output,animation in zip(parts,document['meshes'],document['animations']):
                assert output['name']==f"{mesh['name']}/{part_index}"
                primitive=output['primitives'][0]
                references=[(face[i],face[i+3])for face in part['faces']for i in range(3)]
                positions=[[v/64 for vertex,_ in references for v in frame['vertices'][vertex][:3]]for frame in mesh['frames']]
                assert values(primitive['attributes']['POSITION'])==positions[0]
                assert len(primitive['targets'])==len(positions)-1
                for frame,target in zip(positions[1:],primitive['targets']):
                    assert values(target['POSITION'])==[a-b for a,b in zip(frame,positions[0])]
                assert values(primitive['attributes']['TEXCOORD_0'])==[mesh['uv'][uv*2+axis]for _,uv in references for axis in range(2)]
                sampler=animation['samplers'][0]
                assert values(sampler['input'])==[struct.unpack('<f',struct.pack('<f',f['time']/1000))[0]for f in mesh['frames']]
                assert sampler['interpolation']=='LINEAR'
                assert values(sampler['output'])==[float(column==frame-1)for frame in range(len(positions))for column in range(len(positions)-1)]
                checked.append(dict(mesh=output['name'],expandedVertices=len(references),sourceFrames=len(positions),exactPositionMorphs=True,exactUV=True,exactAnimationTimes=True))
            actions.append(dict(name=name,source=str(source.relative_to(ROOT)),asset=action['asset'],duration=2561,stopTime=2461,events=events,glb=checked))
        components.append(dict(part=component['part'],empty=False,actions=actions))
    raw=(base/f'Data/effect/link/{code}.elk').read_bytes();groups=read_links(raw)
    entry=next(f for f in json.loads((published/'effect-links.json').read_text())['files']if f['tankCode']==code)
    assert groups==entry['groups'] and all(g['key']not in [action_identifier(n)for n in ['05','06','07','08']]for g in groups)
    rows.append(dict(tankId=tid,code=code,components=components,elkBytes=len(raw),hurtEffect=None,hurtSound=None))
result=dict(status='PASS',representatives=rows,nativeSelector='combat-hit-native.json',clockNative='tank-actor-clock-runtime.md')
(ROOT/'recovery/output/combat-hurt-representatives-source.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS: original001 four parts and151 three parts; complete05–08 geometry/morphs/UV/clocks; empty151U; original hurt ELK absent')
