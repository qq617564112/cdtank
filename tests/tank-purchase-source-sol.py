"""Capture one paid tank's original configuration; no native execution or grants."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
TABLES = ROOT / 'recovery/output/verified/tables'
def table(name):
    return json.loads((TABLES / f'{name}.json').read_text())['rows']
def row(name, record_id):
    return next((entry for entry in table(name) if entry['recordId'] == record_id), None)
shop = row('tankshop', 3)
tank = row('tank', 3)
values = shop['values']
ids = [int(values[key]) for key in ['默认贴图(炮塔)', '默认贴图(车身)', '默认贴图(履带)']]
output = dict(selectedTankId=3, tank=tank, tankshop=shop,
    textures=[row('tanktexture', value) for value in ids],
    preferredCandidates=[dict(tankId=value, tankshop=row('tankshop', value)) for value in [1, 2]],
    knownOwnedFields={'0x1c': 'allocated instance ID', '0x24': 3,
        '0x28': ids[0], '0x2c': ids[1], '0x30': ids[2]},
    clientEmptyRecordConstructor='0x421ec2: numeric fields zero; not purchase initialization',
    purchaseServerRecordProducerRecovered=False,
    scope='Static original table extraction and existing source references; no native rerun, account grant or inferred full purchase template.')
(ROOT / 'recovery/output/tank-purchase-source-sol.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(dict(tankId=3, name=tank['values']['TankName'], money=int(values['坦克金钱价']),
    tokens=int(values['坦克代币价']), purchaseMode=int(values['购买方式']), textures=ids,
    base={key:tank['values'][key] for key in ['TankAtk','TankAtkBonus','TankDef','TankDefBonus','TankPartSlot']}), ensure_ascii=False))
