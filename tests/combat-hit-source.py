"""Match original105 hurt action geometry metadata and absent ELK groups."""
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from mv3 import read_mv3
from effect_action_keys import action_identifier
assets=ROOT/'recovery/output/web-assets'
tank=next(t for t in json.loads((assets/'tanks.json').read_text()) if t['id']==105)
links=json.loads((assets/'effect-links.json').read_text())
file=next(f for f in links['files'] if f['tankCode']=='105')
for component in tank['components']:
    for name in ['05','06','07','08']:
        action=next(a for a in component['actions'] if a['fields']['name']==name)
        source=ROOT/'recovery/output/verified/assets/data/Data/role/105'/action['fields']['file']
        source=next(p for p in source.parent.iterdir() if p.name.lower()==source.name.lower())
        original=read_mv3(source)
        assert action['duration']==original['duration']==2561
        assert action['events']==[dict(time=e['id'],name=e['name'],identifier=action_identifier(e['name'])) for e in original['tags']]
        assert action['events']==([dict(time=160,name='effect1',identifier=1416378268)] if component['part']=='M' else [])
        assert (assets/action['asset']).exists()
        key=action_identifier(name)
        assert not any(g['key']==key for g in file['groups'])
print('PASS: original105 M/U/X/Y05..08 duration2561 and unchanged timed messages; absent hurt ELK groups leave effect/audio silent')
