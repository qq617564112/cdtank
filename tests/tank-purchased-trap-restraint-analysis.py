"""Check the purchased trap raw and its native database without running a new match."""
import json
import math
from pathlib import Path
import sqlite3
import sys

raw_path = Path(sys.argv[1])
raw = json.loads(raw_path.read_text())
assert raw['status'] == 'FAIL' and '0 !== 3' in raw['error']
assert raw['normalLeaves'] == 2 and raw['cleaned'] is True
placed, triggered = raw['placed'], raw['triggered']
owner, target = placed['playerId'], triggered['targetId']
ground, restraint = raw['ground'], raw['restraint']
assert placed['skillId'] == 3003 and ground['id'] == placed['targetId']
assert ground['ownerId'] == owner and ground['itemTableId'] == ground['modelId'] == 3003
assert triggered['skillId'] == 4001 and triggered['value'] == 0
assert restraint['state']['movePermissionCount'] == 0
assert restraint['state']['expiresAt'] - restraint['appliedAt'] == 5000
assert ground['expiresAt'] > restraint['appliedAt']
baseline = raw['expected']['baseline']
controls = raw['controls']
for segment in controls.values():
    assert segment['distance'] == 0 and segment['simulatedSeconds'] == .25
assert controls['combination']['bodyRadians'] == 0
for name, field in [('body', 'bodyRadians'), ('turret', 'turretRadians')]:
    assert abs(controls[name][field] - baseline['turn'] * .25) < .001
assert abs(raw['restored']['speed'] - baseline['speed']) < .1

def player(frame):
    return next(row for row in frame['players'] if row['id'] == target)

frames = [frame for frame in raw['snapshots'][0] if frame['phase'] == 'PLAYING']
active = [frame for frame in frames if player(frame).get('trapRestraint')]
assert len(active) == 100
for frame in active:
    assert player(frame)['trapRestraint'] == restraint['state']
    assert restraint['appliedAt'] <= frame['serverTime'] < restraint['state']['expiresAt']
first_expired = next(frame for frame in frames if frame['serverTime'] >= restraint['state']['expiresAt'])
assert not player(first_expired).get('trapRestraint')
assert first_expired['tick'] == active[-1]['tick'] + 1
assert all(player(frame)['hp'] == player(active[0])['hp'] for frame in frames)
assert any(event['type'] == 'fire' and event['playerId'] == target and event.get('skillId') == 2001
           for event in raw['events'][0])
assert any(event['type'] == 'trapRestraintEnded' and event['playerId'] == target
           and event['value'] == 1 for event in raw['events'][0])
peer_frames = {(frame['roomId'], frame['tick']): frame for frame in raw['snapshots'][1]
               if frame['phase'] == 'PLAYING'}
common = [frame for frame in frames if (frame['roomId'], frame['tick']) in peer_frames]
assert len(common) == raw['commonTicks']
for frame in common:
    peer = peer_frames[frame['roomId'], frame['tick']]
    assert frame['players'] == peer['players']
    assert frame['match']['groundTraps'] == peer['match']['groundTraps']
event_count = raw['commonEvents']
assert raw['events'][0][:event_count] == raw['events'][1][:event_count]

record = raw['afterPlacementStock']['records'][0]
instance = record['instanceId']
assert record['itemTableId'] == 3003 and record['ownedQuantity'] == 1
assert raw['afterPlacementStock']['hotkeys'][0] == instance
identity_path = Path(raw['checkpoint']['identityFile'])
db_path = Path(raw['checkpoint']['database'])
assert identity_path.stat().st_mode & 0o777 == 0o600
assert db_path.stat().st_mode & 0o777 == 0o600
owner_account = json.loads(identity_path.read_text())['accounts'][0]['accountId']
db = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
try:
    persisted = json.loads(db.execute('SELECT record FROM inventory WHERE account_id=? AND instance_id=?',
                                     (owner_account, instance)).fetchone()[0])
    hotkeys = db.execute('SELECT slot,instance_id FROM hotkeys WHERE account_id=?', (owner_account,)).fetchall()
finally:
    db.close()
assert persisted['itemTableId'] == 3003 and persisted['ownedQuantity'] == 1
assert (1, instance) in hotkeys
result = dict(status='PASS_LIMITED_PURCHASED_TRAP_SCOPE_FROM_RAW_AND_NATIVE_DB', raw=str(raw_path),
    rawStatus=raw['status'], instrumentFailure='Final hotkeys[1] assertion used the wrong array index; API slot1 maps to hotkeys[0]. Raw FAIL retained; no match rerun.',
    originalSource='Flag9 permission and movement formula; Func12 placement/time/radius and server count producer are rebuilt.',
    commonTicks=len(common), commonEvents=event_count, hp=player(active[0])['hp'],
    expectedBaseline=baseline, controls=controls, restored=raw['restored'],
    deadline=dict(appliedAt=restraint['appliedAt'], expiresAt=restraint['state']['expiresAt'],
        lastActiveTick=active[-1]['tick'], lastActiveServerTime=active[-1]['serverTime'],
        firstExpiredTick=first_expired['tick'], firstExpiredServerTime=first_expired['serverTime'],
        serverOvershootMs=first_expired['serverTime'] - restraint['state']['expiresAt'],
        simulatedSeconds=(first_expired['tick'] - active[0]['tick']) * .05),
    persistedInventoryRecord=persisted, persistedHotkeys=hotkeys,
    checkpoint=raw['checkpoint'], normalLeaves=raw['normalLeaves'], cleaned=raw['cleaned'],
    limitations=['Only purchased tank3/pet2 and one3003 enemy contact/normal expiry.',
                 'No ground timeout, death/reset, ownerLeave with live ground, overlap or teammate actual acceptance.',
                 'No original server Func12/3 semantics or graphical acceptance.'])
output = raw_path.with_suffix('.analysis.json')
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'PASS limited purchased trap: {len(common)} common ticks; native stock1/slot1; raw FAIL retained. {output}')
