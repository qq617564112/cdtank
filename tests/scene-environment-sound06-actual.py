"""Verify recorded ordinary map06 browser spatial playback and lifecycle."""
import json
from pathlib import Path
import sys
run=json.loads(Path(sys.argv[1]).read_text())
proof=json.loads(Path('recovery/output/scene-environment-sound06-source.json').read_text())
assert run['status']=='PASS' and proof['status']=='PASS'
assert all(w['mode']==1 and w['mapId']==6 and len(w['players'])==4 for w in run['initial'])
rows=[]
for i,page in enumerate(run['observed']):
 assert page['loads']==[dict(mapId=6,count=3)]
 assert len(page['sounds'])==3 and all(s['playing'] and s['loop'] for s in page['sounds'])
 assert any(s['outputPeak']>1e-5 for s in page['samples'])
 assert len({tuple(s['listener']) for s in page['samples']})>1
 voices=[]
 for source in proof['rows']:
  placement=source['placement'];id=placement['id']
  sound=next(s for s in page['sounds'] if s['id']==id)
  assert sound['name']==placement['name'] and sound['src'].endswith('/'+source['wav']['asset'])
  samples=[(s,next(v for v in s['voices'] if v['id']==id)) for s in page['samples'] if any(v['id']==id for v in s['voices'])]
  times=[v['time'] for s,v in samples];rewinds=sum(t<times[k-1]-.5 for k,t in enumerate(times) if k)
  assert rewinds>0
  for sample,voice in samples:
   assert voice['position']==placement['position'] and voice['loop'] and voice['src'].endswith('/'+source['wav']['asset'])
   if voice['duration'] is not None:assert abs(voice['duration']-source['wav']['duration'])<1e-6
   distance=sum((a-b)**2 for a,b in zip(voice['position'],sample['listener']))**.5
   expected=max(0,1-2*(max(100,min(1600,distance))-100)/1500)
   assert abs(voice['gain']-expected)<1e-6
  voices.append(dict(id=id,name=sound['name'],rewinds=rewinds,samples=len(samples),gainMinimum=min(v['gain'] for s,v in samples),gainMaximum=max(v['gain'] for s,v in samples)))
 rows.append(dict(page=i+1,voices=voices,outputPeak=max(s['outputPeak'] for s in page['samples']),listenerStates=len({tuple(s['listener']) for s in page['samples']})))
for states,total in [(run['leave'],3),(run['finalLeave'],6)]:
 assert all(s['count']==0 and len(s['old'])==total and all(v['paused'] and v['disconnectCalls']==['source','panner','gain'] for v in s['old']) for s in states)
assert all(s['count']==3 and len(s['old'])==3 and s['sharedContext'] and s['context']=='running' and all(v['paused'] for v in s['old']) and all(not v['paused'] and v['time']>0 for v in s['voices']) for s in run['reentry'])
assert all(o['loads']==[dict(mapId=6,count=3),dict(mapId=6,count=3)] and len(o['sounds'])==6 for o in run['reentryObserved'])
out=dict(status='PASS',input=sys.argv[1],rows=rows,leaveVoices=0,reentryVoices=3,finalLeaveVoices=0,outputScope='Nonzero browser master signal through existing destination connection; human audibility and OS speaker recording not measured')
Path('recovery/output/scene-environment-sound06-actual.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS: dual three original spatial loops/rewinds/gain, nonzero browser output signal, ordinary Leave/reentry/Leave')
