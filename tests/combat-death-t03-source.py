"""Verify tank003's original death components and empty death ELK binding."""
import configparser
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from mv3 import read_mv3
from effect_action_keys import action_identifier
from export_effect_links import read_links
base=ROOT/'recovery/output/verified/assets/data'
published=ROOT/'recovery/output/web-assets'
tank=next(t for t in json.loads((published/'tanks.json').read_text()) if t['id']==3)
rows=[]
for component in tank['components']:
    ini=configparser.ConfigParser();ini.read(base/component['ini'],encoding='gbk')
    entry=next(dict(ini[s])for s in ini.sections()if ini[s]['name']=='09')
    source=base/'Data/role/003'/entry['file']
    model=read_mv3(source)
    action=next(a for a in component['actions'] if a['fields']['name']=='09')
    events=[dict(time=e['id'],name=e['name'],identifier=action_identifier(e['name']))for e in model['tags']]
    assert action['fields']==entry and model['duration']==action['duration']==5601
    assert events==action['events']
    expected=([dict(time=160,name='effect1',identifier=1416378268)]
              if component['part']=='M' else [])
    assert events==expected and (published/action['asset']).is_file()
    assert next(a for a in component['actions'] if a['fields']['name']=='01')['duration']==3201
    rows.append(dict(part=component['part'],source=str(source.relative_to(ROOT)),asset=action['asset'],
        duration=model['duration'],stopTime=5501,events=events,meshes=len(model['meshes'])))
raw=(base/'Data/effect/link/003.elk').read_bytes()
groups=read_links(raw)
links=json.loads((published/'effect-links.json').read_text())
entry=next(f for f in links['files'] if f['tankCode']=='003')
assert len(raw)==692 and groups==entry['groups']
assert [g['key']for g in groups]==[action_identifier('03')]
assert all(g['key']!=action_identifier('09')for g in groups)
records=groups[0]['actions'][0]['records']
assert groups[0]['actions'][0]['name']=='attack1' and len(records)==1
assert records[0]['field04String']=='_root\\online\\004'
out=dict(status='PASS',tankId=3,name=tank['name'],components=rows,
    elk=dict(source='Data/effect/link/003.elk',bytes=len(raw),groups=[dict(key=g['key'],actions=[a['name']for a in g['actions']])for g in groups],deathBinding=None),
    deathEffect=None,deathSound=None,
    scope='Original tank003 INI/MV3 events and duration versus published asset; full original ELK records versus published groups. No replacement death effect/sound; common action-clock source evidence reused.')
(ROOT/'recovery/output/combat-death-t03-source.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS: tank003 M/U/X/Y original09 duration5601, M160 effect1, complete ELK only03/attack1; death lookup empty and no replacement sound/effect')
