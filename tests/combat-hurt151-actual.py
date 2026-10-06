"""Verify ordinary three-component hurt draws against complete original frames."""
import base64
import json
import math
import struct
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from mv3 import read_mv3
runpath=Path(sys.argv[1]).resolve();run=json.loads(runpath.read_text())
source=json.loads((ROOT/'recovery/output/combat-hurt-representatives-source.json').read_text())
assert run['status']=='FAIL'and source['status']=='PASS'
lifepath=Path(sys.argv[3]).resolve();life=json.loads(lifepath.read_text());assert life['status']=='PASS'and life['lifecycleOnly']
assert life['acceptanceTimeLimitSeconds']==60
visiblepath=Path(sys.argv[4]).resolve();visible=json.loads(visiblepath.read_text());assert visible['status']=='FAIL'
visible08path=Path(sys.argv[5]).resolve();visible08=json.loads(visible08path.read_text());assert visible08['status']=='PASS'
assert visible['stages'][0]['complete']and visible['stages'][1]['complete']
priorpath=Path(sys.argv[2]).resolve()
prior=json.loads(priorpath.read_text())
assert prior['status']=='FAIL'
assert [s['complete']for s in prior['stages'][:3]]==[True,True,True]
metadata=next(r for r in source['representatives']if r['tankId']==151)
assert metadata['hurtEffect']is None and metadata['hurtSound']is None
assert run['acceptanceTimeLimitSeconds']==240
assert all(w['mode']==4 and w['mapId']==7 and len(w['players'])==4 for w in run['initial'])
target=run['victimId'];owner='player-'+target;parts=['M','X','Y'];pages=[];hits=[]
assert all(s['complete'] and s['inputs']for s in run['stages'])
for page,observed in enumerate(run['observed'],1):
    events=[e for e in observed['events']if e['type']=='hit' and e['targetId']==target]
    assert 4 in {e['hurtSelector']for e in events};hits.append(events)
    for selector in [1,2,3]:
        left=[e for e in prior['observed'][0]['events']if e['type']=='hit'and e['targetId']==prior['victimId']and e['hurtSelector']==selector]
        right=[e for e in prior['observed'][1]['events']if e['type']=='hit'and e['targetId']==prior['victimId']and e['hurtSelector']==selector]
        assert left and left==right
    results=[]
    for selector,action in enumerate(['05','06','07','08'],1):
        actionRun=prior if action=='05'else visible08 if action=='08'else visible
        actionObserved=actionRun['observed'][page-1]
        actionTarget=actionRun['victimId']
        left=[e for e in actionRun['observed'][0]['events']if e['type']=='hit'and e['targetId']==actionTarget and e['hurtSelector']==selector]
        right=[e for e in actionRun['observed'][1]['events']if e['type']=='hit'and e['targetId']==actionTarget and e['hurtSelector']==selector]
        assert left and left==right
        actionOwner='player-'+actionTarget
        capture=next(c for c in actionObserved['captures']if c['id']==actionTarget and c['action']==action)
        victim=next(p for p in capture['world']['players']if p['id']==actionTarget)
        assert victim['alive'] and 0<victim['hp']<victim['maxHp'] and victim['tankId']==151
        assert sorted({d['part']for d in capture['draws']})==parts
        assert all(d['owner']==actionOwner for d in capture['draws'])
        assert any(h['owner']==actionOwner and h['selector']==selector and h['alive']for h in actionObserved['hurts'])
        states=[s for s in actionObserved['states']if s['id']==actionTarget]
        finished=next(i for i,s in enumerate(states)if s['action']==action and s['alive'] and len(s['clocks'])==3 and all(c['time']==2461 and c['overMessage']==0 for c in s['clocks']))
        restored=next(s for s in states[finished+1:]if s['alive']and s['action']in ['01','02'])
        complete=[m for m in actionObserved['messages']if m['owner']==actionOwner and m['action']==action and m['identifier']==1870030194]
        assert sorted({m['part']for m in complete})==parts and all(m['time']==2461 for m in complete)
        timed=[m for m in actionObserved['messages']if m['owner']==actionOwner and m['action']==action and m['identifier']==1416378268]
        assert timed and {m['part']for m in timed}=={'M'} and all(160<=m['time']<2561 for m in timed)
        assert all(m['before']==m['after']and m['voicesBefore']==m['voicesAfter']and m['skillBefore']==m['skillAfter']for m in [*complete,*timed])
        checked=[];projected=[]
        for part in parts:
            draws=[d for d in actionObserved['draws']if d['owner']==actionOwner and d['action']==action and d['part']==part]
            model=read_mv3(ROOT/f'recovery/output/verified/assets/data/Data/role/151/{action}{part}.MV3')
            meshparts={f"{mesh['name']}/{i}":(mesh,p)for mesh in model['meshes']for i,p in enumerate(mesh['parts'])if p['faces']}
            assert {d['mesh']for d in draws}==set(meshparts)
            maximum=0
            assert len({json.dumps(d['morphs'])for d in draws})>1
            for name,(mesh,originalpart)in meshparts.items():
                references=[(face[i],face[i+3])for face in originalpart['faces']for i in range(3)]
                positions=[[v/64 for vertex,_ in references for v in f['vertices'][vertex][:3]]for f in mesh['frames']]
                geometry=next(d['geometry']for d in draws if d['mesh']==name and 'geometry'in d)
                assert geometry['positions']==positions[0]
                assert geometry['targets']==positions[1:]
                assert geometry['uvs']==[mesh['uv'][uv*2+axis]for _,uv in references for axis in range(2)]
                assert geometry['indices']==[]
                times=[struct.unpack('<f',struct.pack('<f',f['time']/1000))[0]for f in mesh['frames']]
                for d in [d for d in draws if d['mesh']==name]:
                    assert d['asset']==f'Data/role/151/{action}{part}.glb' and d['clock']['duration']==2561
                    time=d['clock']['time']/1000;low=max(i for i,t in enumerate(times)if t<=time);high=min(low+1,len(times)-1)
                    fraction=(time-times[low])/(times[high]-times[low])if high!=low else 0
                    expected=[(1-fraction if i==low else 0)+(fraction if i==high else 0)for i in range(1,len(times))]
                    error=max(abs(a-b)for a,b in zip(d['morphs'],expected));assert error<1e-5;maximum=max(maximum,error)
                    if d['frame']==capture['frame']:
                        sampled=[positions[low][i]*(1-fraction)+positions[high][i]*fraction for i in range(len(positions[0]))]
                        def transform(v,m):
                            return [sum(v[j]*m[j*4+i]for j in range(4))for i in range(4)]
                        points=[]
                        for i in range(0,len(sampled),3):
                            v=transform([*sampled[i:i+3],1],d['matrix']);v=transform(v,capture['camera']['view']);v=transform(v,capture['camera']['projection'])
                            points.append(((v[0]/v[3]+1)*capture['camera']['width']/2,(1-v[1]/v[3])*capture['camera']['height']/2))
                        projected.append(dict(part=part,mesh=name,minX=min(p[0]for p in points),maxX=max(p[0]for p in points),minY=min(p[1]for p in points),maxY=max(p[1]for p in points)))
            checked.append(dict(part=part,draws=len(draws),morphStates=len({json.dumps(d['morphs'])for d in draws}),sourceMeshes=list(meshparts),completeOriginalGeometry=True,maximumSourceWeightError=maximum))
        png=f'recovery/output/combat-hurt151-{action}-accepted-{page}.png';(ROOT/png).write_bytes(base64.b64decode(capture['canvas'].split(',',1)[1]))
        bounds=dict(minX=min(p['minX']for p in projected),maxX=max(p['maxX']for p in projected),minY=min(p['minY']for p in projected),maxY=max(p['maxY']for p in projected))
        assert bounds['maxX']>0 and bounds['minX']<capture['camera']['width']and bounds['maxY']>0 and bounds['minY']<capture['camera']['height']
        results.append(dict(selector=selector,action=action,frame=capture['frame'],hp=victim['hp'],parts=checked,completion=states[finished],restored=restored,timedMessages=timed,projected=projected,candidateBounds=bounds,png=png))
    assert any(s['id']==target and not s['alive']and s['action']=='09'for s in observed['states'])
    assert any(s['id']==target and s['alive']and s['action']=='01'and s['deaths']>0 and s['hp']==s['maxHp']for s in observed['states'])
    pages.append(dict(page=page,actions=results,ordinaryDeathRespawn=True))
assert hits[0]==hits[1]
assert all(w['phase']=='FINISHED'and w['match']['result']['reason']in ['TIME_LIMIT','OBJECTIVE']for w in run['finished'])
assert all(w['phase']=='FINISHED'and w['match']['result']['reason']in ['TIME_LIMIT','OBJECTIVE']for w in life['finished'])
assert all(r['world']['roomId']==life['finished'][i]['roomId']and r['world']['match']['round']==life['finished'][i]['match']['round']+1 for i,r in enumerate(life['rematch']))
assert all(r['world']['phase']=='PLAYING'and all(p['alive']for p in r['world']['players'])and all(a['action']in ['01','02']for a in r['actions']if a['id']==target)for r in life['rematch'])
assert all(all(n==0 for n in r.values())for r in life['cleanup'])
for reference in run['fourPartReference']:
    assert json.loads((ROOT/'recovery/output'/reference).read_text())['status']=='PASS'
output=dict(status='PASS',visibleBrowser=str(visiblepath.relative_to(ROOT)),visibleBrowserOverallStatus=visible['status'],visibleAcceptedScope=['06','07'],visible08Browser=str(visible08path.relative_to(ROOT)),visible08BrowserOverallStatus=visible08['status'],priorBrowser=str(priorpath.relative_to(ROOT)),priorBrowserOverallStatus=prior['status'],priorAcceptedScope=['05','06','07'],sourceBrowser=str(runpath.relative_to(ROOT)),sourceBrowserStatus=run['status'],targetId=target,sourceMetadata='combat-hurt-representatives-source.json',acceptanceTimeLimitSeconds=240,pages=pages,hits=hits[0],finished=run['finished'],lifecycleBrowser=str(lifepath.relative_to(ROOT)),lifecycleBrowserOverallStatus=life['status'],lifecycleAcceptanceTimeLimitSeconds=60,lifecycleFinished=life['finished'],rematch=life['rematch'],cleanup=life['cleanup'],fourPartReference=run['fourPartReference'],boundaries='Per-action acceptance retains all five raw overall statuses and targetP1-only original geometry/morph-clock/event scope. Independent60s normal lifecycle establishes Rematch and Leave. Historical hurt draw textureURLs were not observed per draw; lifecycle material state is separate. Software640x360 does not establish original Windows GPU whole-frame equality.')
(ROOT/'recovery/output/combat-hurt151-actual.json').write_text(json.dumps(output,indent=2)+'\n')
print('PASS: original151 three-part four ordinary selectors/source geometry/morph sampling/silent messages/natural base/death/respawn/TIME_LIMIT/rematch/Leave')
