"""Verify static-box ordinary result scope without assigning pixel acceptance."""
import json
from pathlib import Path
import sys
raw=Path(sys.argv[1])
d=json.loads(raw.read_text())
a,b=d['observed']
local=[r for r in a['results'] if r['local'] and r['event']['type']=='sceneStaticHit']
remote=[r for r in b['results'] if not r['local'] and r['event']['type']=='sceneStaticHit']
assert local and remote
assert all(r['feedback']==0 for r in local)
assert not a['effects'] and not a['sounds'] and not a.get('gaSounds')
shared=[r['event']for r in remote if any(l['event']==r['event']for l in local)]
assert shared and all(e['shotItemResult']['itemId']==2001 for e in shared)
field=json.loads(Path('recovery/output/web-assets/battlefields.json').read_text())
source=next(row for row in field if row['id']=='0007')
box_ids={str(box['id']) for box in source['collisionBoxes']}
assert all(e['targetId'] in box_ids for e in shared)
assert all(r['feedback']==1 for r in remote)
assert any(e['world'] and e['expired'] and len(e['rendered'])>0 for e in b['effects'])
assert any(s['reference']=='SE30' and s['played'] and s['ended'] and s['outputPeak']>0 for s in b['sounds'])
assert any(s['soundId']==48 and s['ended'] and s['postGainPeak']>0 and not s['loop']for s in b['gaSounds'])
assert b.get('actualResultFrame')
initial={p['id']:p for p in d['initial'][0]['players']}
assert all(p['hp']==initial[p['id']]['hp']for p in d['finalWorld'][0]['players'])
for row in d['cleanup']:
 assert not row['world'] and row['instances']==row['meshes']==row['voices']==0
result={'status':'PASS_STATICBOX_RESULT_EVENT_DRAW_AUDIO_END_LEAVE_ONLY',
        'raw':str(raw),'source':'scene-shot-type2-source.json',
        'staticIds':sorted({e['targetId'] for e in shared}),'sameEvents':shared,
        'renderedNodes':[e['rendered']for e in b['effects']],'allFiveDrawn':any(len(e['rendered'])==5 for e in b['effects']),
        'pixelAccepted':False,'pixelFrame':b['actualResultFrame'],
        'scope':'Ordinary2001 staticBOX, same dual events, local silent, remote007 observed node draws/SE30/GA07 actual output and end, unchanged HP, normal Leave. Whole canvas pixel review separate; identity/authority remains rebuilt.'}
Path('recovery/output/scene-shot-type2-actual.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
