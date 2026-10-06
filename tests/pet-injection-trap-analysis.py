"""Validate the recorded cure scope without replaying the successful battle segment."""
import json
import math
from pathlib import Path

root = Path('recovery/output')
raw_path = root / 'pet-injection-trap-network-2026-10-05T02-24-28-234Z.json'
raw = json.loads(raw_path.read_text())
assert raw['status'] == 'FAIL' and not raw['leave']
restrained = raw['restrained']
cleared = raw['cleared']
state = restrained['player']['trapRestraint']
assert state['skillId'] == 4001 and state['movePermissionCount'] == 0
assert cleared['ended']['value'] == 1 and cleared['ended']['skillId'] == 4001
assert cleared['serverTime'] < state['expiresAt']
assert 'trapRestraint' not in cleared['player']
assert restrained['player']['hp'] == cleared['player']['hp'] == 700
assert restrained['player']['maxHp'] == cleared['player']['maxHp'] == 700
for key in ['usedStock', 'repeatStock']:
    item = next(row for row in raw[key]['records'] if row['itemTableId'] == 3)
    assert item['ownedQuantity'] == item['battleQuantity'] == 1
assert raw['afterOriginalDeadline']['serverTime'] > state['expiresAt']
assert 'trapRestraint' not in raw['afterOriginalDeadline']['player']
assert raw['afterOriginalDeadline']['restraintEndEvents'] == 1
movement = raw['restoredMovement']
distance = math.hypot(movement['to']['x'] - movement['from']['x'],
                      movement['to']['z'] - movement['from']['z'])
assert distance > 10 and movement['toTick'] > movement['fromTick']
frames = [{row['tick']: row for row in rows} for rows in raw['snapshots']]
common = sorted(frames[0].keys() & frames[1].keys())
assert common == raw['sharedTicks'] and len(common) == 151
for tick in common:
    assert frames[0][tick]['players'] == frames[1][tick]['players']
for kind in ['trapTriggered', 'trapRestraintEnded', 'itemUsed', 'itemRejected']:
    matched = [row for row in raw['events'][0] if row['type'] == kind
               and (row['playerId'] == 'P2' or row['targetId'] == 'P2')]
    assert len(matched) == 1
    assert matched[0] in raw['events'][1]
assert [row['type'] for row in raw['events'][0]].index('trapRestraintEnded') < next(
    i for i, row in enumerate(raw['events'][0]) if row['type'] == 'itemUsed' and row['playerId'] == 'P2')
analysis = {
    'status': 'PASS_LIMITED_EVENT_STATE_CURE_REJECT_MOVE_SCOPE',
    'raw': str(raw_path), 'rawStatus': raw['status'],
    'sharedPlayerTicks': len(common), 'cureBeforeDeadlineMs': state['expiresAt'] - cleared['serverTime'],
    'restoredMovementDistance': distance,
    'movementTickDelta': movement['toTick'] - movement['fromTick'],
    'movementServerMs': movement['toServerTime'] - movement['fromServerTime'],
    'stock': [2, 1, 1], 'hp': [700, 700],
    'oldDeadlineNoSecondEnd': True, 'normalLeave': False,
    'nativeDbPersistenceProof': False,
    'limitations': ['Leave omitted round and was rejected; no normal departure acceptance',
                    'Inventory replies are authoritative business responses, not native SQLite read proof',
                    'Current flag9 single-write rule checked separately; no new projection invented'],
}
output = root / 'pet-injection-trap-network-analysis.json'
output.write_text(json.dumps(analysis, ensure_ascii=False, indent=2) + '\n')
print(analysis['status'])
