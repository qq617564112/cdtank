"""Verify recorded ordinary00105 draws, timed messages and completion separately."""
import base64
import json
import struct
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from mv3 import read_mv3
source=ROOT/'recovery/output/browser-combat-hit-t01-0020-2026-10-03T23-35-05-094Z.json'
run=json.loads(source.read_text());metadata=json.loads((ROOT/'recovery/output/combat-hit-t01-0020-source.json').read_text())
assert run['status']=='FAIL' and metadata['status']=='PASS'
assert len(run['initial'])==2 and all(w['mapId']==20 and w['mode']==5 for w in run['initial'])
target,attacker=run['victimId'],run['attackerId'];owner='player-'+target
assert run['inputs'] and any('Space' in r['attackerKeys'] for r in run['inputs']) and any('KeyS' in r['attackerKeys'] for r in run['inputs'])
parts=['M','U','X','Y'];pages=[];hits=[]
for index,observed in enumerate(run['observed'],1):
    events=[e for e in observed['events'] if e['type']=='hit' and e['playerId']==attacker and e['targetId']==target]
    assert len(events)==2 and all(e['hurtSelector']==1 and e['value']==43 for e in events)
    hits.append(events)
    capture=next(c for c in observed['captures'] if c['id']==target)
    assert sorted({d['part'] for d in capture['draws']})==parts
    assert all(d['asset']==f"Data/role/001/05{d['part']}.glb" and d['vertices']>0 and d['action']=='05' for d in capture['draws'])
    original=[r for r in metadata['components']];assert sorted(r['part'] for r in original)==parts
    assert all(r['duration']==2561 and r['stopTime']==2461 for r in original)
    assert all(r['events']==([dict(time=160,name='effect1',identifier=1416378268)] if r['part'] in ['M','U'] else []) for r in original)
    timed=[m for m in observed['messages'] if m['owner']==owner and m['identifier']==1416378268]
    complete=[m for m in observed['messages'] if m['owner']==owner and m['identifier']==1870030194]
    assert sorted({m['part'] for m in timed})==['M','U'] and len(timed)==4
    assert sorted({m['part'] for m in complete})==parts and len(complete)==4 and all(m['time']==2461 for m in complete)
    assert all(m['before']==m['after'] and m['voicesBefore']==m['voicesAfter'] and m['skillBefore']==m['skillAfter'] for m in [*timed,*complete])
    states=[s for s in observed['states'] if s['id']==target]
    finished=next(i for i,s in enumerate(states) if s['action']=='05' and s['alive'] and sorted(c['part'] for c in s['clocks'])==parts and all(c['time']==2461 and c['overMessage']==0 for c in s['clocks']))
    restored=next(s for s in states[finished+1:] if s['action']=='01' and s['alive'])
    assert restored['hp']==214 and not any(e['type']=='destroy' and e['targetId']==target for e in observed['events'])
    poseChanges={}
    for part in parts:
        draws=[d for d in observed['draws'] if d['owner']==owner and d['part']==part]
        morphs=len({json.dumps(d['morphs']) for d in draws});assert morphs>1
        model=read_mv3(ROOT/f'recovery/output/verified/assets/data/Data/role/001/05{part}.MV3')
        assert len(model['meshes'])==1
        times=[struct.unpack('<f',struct.pack('<f',f['time']/1000))[0] for f in model['meshes'][0]['frames']]
        maximumError=0
        for draw in draws:
            weights=draw['morphs'];assert len(weights)==len(times)-1 and any(w>0 for w in weights)
            time=draw['clock']['time']/1000;assert draw['clock']['duration']==2561
            low=max(i for i,t in enumerate(times) if t<=time);high=min(low+1,len(times)-1)
            fraction=(time-times[low])/(times[high]-times[low]) if high!=low else 0
            expected=[(1-fraction if i==low else 0)+(fraction if i==high else 0) for i in range(1,len(times))]
            error=max(abs(a-b) for a,b in zip(weights,expected));assert error<1e-5,(part,time,error)
            maximumError=max(maximumError,error)
        poseChanges[part]=dict(draws=len(draws),morphStates=morphs,sourceFrames=len(times),maximumSourceWeightError=maximumError)
    png=ROOT/f'recovery/output/combat-hit-t01-0020-accepted-05-{index}.png'
    png.write_bytes(base64.b64decode(capture['canvas'].split(',',1)[1]))
    pages.append(dict(frame=capture['frame'],poseChanges=poseChanges,draws=capture['draws'],timedMessages=timed,completionMessages=complete,completeState=states[finished],restored=restored,png=str(png.relative_to(ROOT)),pngSource='Original run capture.canvas; no new browser run'))
assert hits[0]==hits[1]
result=dict(status='PASS',scope='Recorded local nonlethal00105 only: same target, dual four-source-component actual draws, M/U source160 silence, original over messages and natural01 restore. Original browser main status remainsFAIL due unfiltered timed-message assertion; no ordinaryLeave executed here.',sourceBrowser=str(source.relative_to(ROOT)),sourceBrowserStatus=run['status'],sourceMetadata='recovery/output/combat-hit-t01-0020-source.json',targetId=target,attackerId=attacker,hits=hits[0],inputSamples=len(run['inputs']),pages=pages,lifecycleReferences=dict(sameMapRoleRematch=run['lifecycleReferences']['sameMapRoleRematch'],sameRoleDeath=run['lifecycleReferences']['sameRoleDeath'],scope='Original browser lifecycle.scope was planned intent, not execution: this run did not reach ordinaryLeave. Unchanged same-map001 player/effect/scene consumers reuse named evidence only.'),limitations='Death/rematch/Leave reuse unchanged consumers and named evidence; no claim of a complete browser run or all selectors/roles.')
(ROOT/'recovery/output/combat-hit-t01-0020-actual.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS: recorded same P4 local00105 dual four-part draws, M/U timed-event silence, four nativeover messages2461 and natural01 restore; main browserFAIL retained, Leave not executed')
