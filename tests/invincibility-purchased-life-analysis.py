"""Compare the saved purchased-life invincibility network observations."""
import json
from pathlib import Path
import sys
p=Path(sys.argv[1]);d=json.loads(p.read_text());pid=d['used']['playerId']
streams=d['frames'];key=lambda row:(row['snapshot']['match']['round'],row['snapshot']['phase'],row['snapshot']['tick'])
remote={key(row):row for row in streams[1]}
common=[row for row in streams[0] if row['snapshot']['phase']=='PLAYING' and key(row) in remote]
for row in common:
    assert row['snapshot']['players']==remote[key(row)]['snapshot']['players']
player=lambda row:next(player for player in row['snapshot']['players'] if player['id']==pid)
active=[row for row in common if player(row).get('invincibility')]
assert active
before=player(d['beforeUse']);initial=d['initial'];after=player(d['restoredDamage'])
assert initial['hp']==initial['maxHp'] and before['hp']<initial['hp']
for row in active:
    assert player(row)['hp']==before['hp'] and player(row)['maxHp']==initial['maxHp']
last=active[-1]
ended=next(row for row in common if row['snapshot']['tick']>last['snapshot']['tick'] and not player(row).get('invincibility'))
assert after['hp']<before['hp'] and after['alive']
types={'hit','immuneHit','itemUsed','itemRejected','skillStopped'}
core=lambda rows:[e for e in rows if e['type'] in types and (e['playerId']==pid or e['targetId']==pid)]
assert core(d['events'][0])==core(d['events'][1])
assert len([e for e in core(d['events'][0]) if e['type']=='immuneHit'])>=2
metric=lambda row:{'tick':row['snapshot']['tick'],'simulationSeconds':row['snapshot']['tick']*.05,'serverTime':row['snapshot']['serverTime'],'wallTime':row['wallTime']}
proof={'status':'PASS_LIMITED_PURCHASED_LIFE_INVINCIBILITY_CONSUMER','raw':str(p),'runner':'tests/invincibility-purchased-life-network.cts','analysis':'tests/invincibility-purchased-life-analysis.py','sourceReuse':['recovery/docs/invincibility-runtime.md','recovery/docs/invincibility-whole-scope.md','recovery/docs/tank-life-qualification.md'],'sharedPlayersObservations':len(common),'uniqueRoundPhaseTickKeys':len({key(r) for r in common}),'coreEventsPerClient':len(core(d['events'][0])),'activeHpStableObservations':len(active),'lifeSequence':[initial['hp'],before['hp'],player(d['immuneObservation'])['hp'],after['hp']],'deadline':player(active[0])['invincibility']['expiresAt'],'stages':{'beforeUse':metric(d['beforeUse']),'active':metric(d['active']),'lastActive':metric(last),'firstExpiredObservation':metric(ended),'restoredNaturalDamage':metric(d['restoredDamage'])},'stock':{'purchased':d['purchase']['res']['purchased']['ownedQuantity'],'afterUseAndRepeat':next(r['ownedQuantity'] for r in d['stockAfter']['records'] if r['itemTableId']==8)},'normalLeaves':d['leave'],'mainReview':{'status':'PENDING'},'limitations':['Original damage and duration/authorization policy not recovered by this slice','No native SQLite persistence/restart, FX, AI or other loadouts claim','Sampling distinguishes fixed simulation, server time and receive wall time; post-expiry hit is not first-eligible fire proof']}
assert proof['stock']=={'purchased':2,'afterUseAndRepeat':1}
assert len(proof['normalLeaves'])==2 and all(r['isSucc'] for r in proof['normalLeaves'])
Path('recovery/output/invincibility-purchased-life-player-evidence.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print(proof['status'], len(common), len(active), len(core(d['events'][0])))
