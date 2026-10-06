"""Verify map7's original oil barrel family using the same published source21 resources."""
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from scene import read_scene
from scene_breach import decode_breach_tail
web=ROOT/'recovery/output/web-assets';base=ROOT/'recovery/output/verified/assets/data'
lib=json.loads((web/'scene-breach-0007.json').read_text());prior=json.loads((web/'scene-breach-0020.json').read_text())
scene=next(s for s in json.loads((web/'scene-placements.json').read_text()) if s['id']=='0007')
original=[r for r in read_scene(base/'Data/scn/0007/0007.obj') if r['className']=='SYcScnObjBreach']
rows=[]
for model,count,native in [('obj05462',3,'scene-breach20-05462-native.json')]:
 reference=f'Data/scnobj/{model}/c9.CVD';resource=next(r for r in lib['resources'] if r['reference']==reference)
 assert resource==next(r for r in prior['resources'] if r['reference']==reference)
 proof=json.loads((ROOT/'recovery/output'/native).read_text());assert proof['status']=='PASS' and proof.get('model', 'obj05467')==model
 assert [e['reference'] for e in proof['destroy'] if e['kind']=='sound']==['GA41'] and proof['repeat']==[]
 records=[r for r in original if r['model']==model];assert len(records)==count
 for record in records:
  out=next(r for r in scene['records'] if r['id']==record['id'])
  assert all(out[k]==json.loads(json.dumps(v)) for k,v in record.items())
  assert out['breachFields']==decode_breach_tail(bytes.fromhex(record['tail'])) and (web/out['asset']).is_file()
 rows.append(dict(model=model,reference=reference,placementCount=count,placements=records,geometryNodes=[i for i,n in enumerate(resource['nodes']) if n['parts']],sharedNative=native))
assert len(lib['resources'])==4 and (web/'audio/sound/GA41.wav').read_bytes()==(ROOT/'CDTank/Data/sound/GA41.wav').read_bytes()
out=dict(status='PASS',mapId=7,placementCount=3,models=rows,scope='Same original oil barrel c9 resource/native cue as20; exact original map7 placements and original GA41 bytes')
(ROOT/'recovery/output/scene-breach07-05462-source.json').write_text(json.dumps(out,indent=2)+'\n');print('PASS: map7 three oil barrel placements, original c9 resource equal source20, shared GA41 once-native and original WAVbytes')
