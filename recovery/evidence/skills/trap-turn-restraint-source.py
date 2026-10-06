"""Read original3004/4002 fields without repeating prior observer execution."""
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table

tables = {name:read_table(ROOT / f'CDTank/Data/table/{name}.dat') for name in ['item','skill']}
records = []
for name, key, ids in [('item','ItemTableID',[3004]), ('skill','SkillTableID',[3004,4002])]:
    for record in tables[name]['rows']:
        if int(record['values'][key]) in ids:
            records.append(dict(table=name, recordId=record['recordId'], values=record['values']))
result = dict(status='ORIGINAL_FIELDS_WITH_REBUILT_TURN_RESTRAINT_POLICY', records=records,
    sourceReuse=['permission-trap-observer-source.json','movement-permission-native.json'],
    confirmed=dict(loader='43aee9..43af57 function slots158/164/170/17c/188',
                   permission='432f91 command3/4 reads flag10; mixed commands read9 and10',
                   observer='42f6ed..42f74d record+126 vs role+36a, HP15>0 and decreasing count ->4886aa/4002/duration0'),
    missing=dict(field='Func12/Func4 -> flag10 decrease and expiry restoration',
                 originalWriteAddress=None, timeReader=None,
                 nextEntrance='Original authoritative3004 ground trigger/4002 Func4 dispatcher and attribute33 array10 sender'),
    reconstruction=dict(groundDurationMs=30000, triggerRadius=30, groundModelId=3004,
                        restraintDurationMs=5000, removedTurnPermission=1,
                        counter='current uint8 minus1 on apply; current plus own contribution on expiry/clear',
                        repetition='no stacking/refresh', inactive='discard contribution'),
    units=dict(source='T30/X30/Z3004 and T5 are original table values',
               reconstructed='T seconds to server milliseconds; X world-coordinate XZ radius',
               clientBehaviorMeasurement='none added'),
    scope='No native rerun or normal network acceptance; item producer/time/counter policy explicitly rebuilt')
(ROOT / 'recovery/output/trap-turn-restraint-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
