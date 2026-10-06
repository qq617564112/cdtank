"""Verify all original map17 sound placements, source tails and WAV bytes."""
import json
from pathlib import Path
import sys
import wave
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from scene import read_scene
from scene_sound import decode_sound_tail
records=[r for r in read_scene(ROOT/'recovery/output/verified/assets/data/Data/scn/0017/0017.obj') if r['className']=='SYcScnObjSound']
asset=json.loads((ROOT/'recovery/output/web-assets/scene-environment-sound-0017.json').read_text())
catalog=json.loads((ROOT/'recovery/output/web-assets/audio.json').read_text())
native=json.loads((ROOT/'recovery/output/scene-environment-sound20-native.json').read_text())
assert native['status']=='PASS' and all(asset['spatial'][key]==native['spatial'][key] for key in ['referenceDistance','rolloffFactor','maxDistance'])
assert [(r['id'],decode_sound_tail(bytes.fromhex(r['tail']))['field24']) for r in records]==[('215','BG06'),('230','BG12'),('231','BG11')]
rows=[]
for r,out in zip(records,asset['sounds']):
 fields=decode_sound_tail(bytes.fromhex(r['tail']))
 assert fields['intervalMs']==0 and fields['randomGate']==0 and fields['field5c']==1 and r['enabled']==1
 expected=dict(id=r['id'],name=fields['field24'],position=list(r['position']),enabled=True,gain=1.0,intervalMs=0,randomGate=False,selector=-1,spatial=True,direction=[0,0,-1])
 assert out==expected
 entry=next(e for e in catalog['sounds'] if e['name']==out['name']);assert entry['asset']==f'audio/sound/{out["name"]}.wav'
 original=ROOT/f'CDTank/Data/sound/{out["name"]}.wav';published=ROOT/'recovery/output/web-assets'/entry['asset'];assert original.read_bytes()==published.read_bytes()
 with wave.open(str(original)) as wav:duration=wav.getnframes()/wav.getframerate()
 rows.append(dict(placement=expected,tail=r['tail'],fields=fields,wav=dict(asset=entry['asset'],identicalBytes=True,duration=duration)))
assert len(records)==len(asset['sounds'])==3 and asset['mapId']==17
out=dict(status='PASS',rows=rows,spatial=asset['spatial'],sharedNative='scene-environment-sound20-native.json',scope='Original map17 placements and WAV bytes; shared original zero-interval Sound loader/manager contract')
(ROOT/'recovery/output/scene-environment-sound17-source.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS: original Sound215/230/231 placements/tails/BG06+BG11+BG12 WAV bytes and shared zero-interval spatial loop contract')
