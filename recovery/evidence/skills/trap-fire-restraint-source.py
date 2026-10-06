"""Record original3005/4003 fields and existing flag11 consumers."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table

records = []
for name, key, ids in [('item', 'ItemTableID', [3005]), ('skill', 'SkillTableID', [3005, 4003])]:
    for row in read_table(ROOT / f'CDTank/Data/table/{name}.dat')['rows']:
        if int(row['values'][key]) in ids:
            records.append(dict(table=name, recordId=row['recordId'], values=row['values']))
result = dict(status='SOURCE_ONLY_FIRE_RESTRAINT_AUTHORITY_PENDING', records=records,
    original=dict(loader='43aee9..43af57 loads skill functions158/164/170/17c/188',
                  flag='record+127 uint8 flag11; role+36b observer cache',
                  observer='42f68d..42f6ed -> HP15>0, changed and (new0 or old=new+1) ->4886aa/4003/duration0',
                  fire='435499 reads flag11 then inclusive f32 reload deadline',
                  setter='431dbf nonzero request increments byte and notifies33; false clears byte'),
    formalConsumer=dict(file='apps/server/src/battle/actors.ts',
                        call='isRoleFireReady(player.combat.getFlag(11)!==0, currentSeconds, nextAvailableSeconds)',
                        effect='Permission refusal precedes accepted fire and inventory-ammo consumption'),
    sourceReuse=['permission-trap-observer-source.json', 'movement-permission-native.json',
                 'role-reload-native.json'],
    missing=dict(field='Func12 item3005 ground trigger -> Func5 skill4003 -> flag11 decrement/restoration',
                 originalWriteAddress=None, timeReader=None,
                 nextEntrance='Original authoritative3005 trigger/4003 Func5 executor and attribute33 array11 sender'),
    reconstruction='Not implemented by this source artifact; seconds/radius/ownership/counter/repetition remain explicit authority decisions',
    behaviorMeasurement='No new original-client behavior measurement',
    scope='One direct original-table read, existing receiver/permission evidence reused. No native rerun, module or actual network acceptance.')
(ROOT / 'recovery/output/trap-fire-restraint-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(result['status'])
