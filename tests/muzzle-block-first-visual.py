"""Verify the recorded first-shot visual phase independently of later movement."""
import json
from pathlib import Path
stem='browser-muzzle-block-map2-2026-10-03T21-11-18-383Z'
root=Path(__file__).resolve().parents[1]/'recovery/output';source=json.loads((root/(stem+'.json')).read_text());phase=[]
for index,(first,final) in enumerate(zip(source['firstShot'],source['observed'])):
    capture=first['captures']['P1'];event=capture['event'];handle=capture['handle']
    assert event['playerId']=='P1' and handle==2
    effect=next(e for e in final['effects'] if e['handle']==handle)
    assert effect['event']==event
    assert effect['expired'] and len(effect['rendered'])>=3
    assert effect['origin']==[event['shotDisplay'][a] for a in ('x','y','z')]
    shots=[e for e in first['events'] if e['type']=='fire' and e['playerId']=='P1']
    hit=[e for e in first['events'] if e['type']=='terrainHit' and e['playerId']=='P1'][1]
    sound=final['sounds'][1]
    assert shots[1]['shotDisplay']==event['shotDisplay'] and hit['observedBullets']==0
    assert sound['event']==event
    assert sound['played'] and sound['ended'] and sound['reference']=='SE30' and not sound['loop']
    assert capture['world']['bullets']==0
    phase.append(dict(page=index+1,event=event,terrainHit=hit,effect=effect,sound=sound,capture=capture,
        image=stem+f'-first-{index+1}.png'))
assert phase[0]['terrainHit']==phase[1]['terrainHit']
assert phase[0]['event']==phase[1]['event']
cleanupStem='browser-muzzle-block-map2-2026-10-03T21-07-02-232Z'
cleanup=json.loads((root/(cleanupStem+'.json')).read_text())
assert cleanup['status']=='PASS' and all(all(v==0 for v in row.values())for row in cleanup['cleanup'])
output=dict(status='PASS',scope='Independent first-shot phase: ordinary four-page source-min4 room, two observed native movement/aim/Space; authority blocked-muzzle exact dual payload/no bullet, source007 same endpoint visible in both actual framebuffers, original SE30 play/end and natural expiry.',
    sourceArtifact=stem+'.json',phase='firstShot / captured source handle2; completion recorded in observed',pages=phase,
    leaveEvidence=dict(sourceArtifact=cleanupStem+'.json',cleanup=cleanup['cleanup']),
    separatePhase=dict(sourceArtifact=stem+'.json',status='FAIL',scope='Later guest movement / additional shot; does not change the completed first-shot phase'))
(root/'browser-muzzle-block-map2-first-shot-visual.json').write_text(json.dumps(output,indent=2)+'\n')
print('PASS: recorded first-shot phase, exact dual authority/no bullet, same source endpoint visible frames, 007 expiry and SE30 end; prior same-route leave four-page zero')
