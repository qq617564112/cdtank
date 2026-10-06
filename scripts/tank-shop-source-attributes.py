import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
rows = json.loads((root / 'recovery/output/verified/tables/tank.json').read_text())['rows']
fields = {
    'txtAttack': 'TankAtk', 'txtAttackExtra': 'TankAtkBonus',
    'txtPanzer': 'TankDef', 'txtPanzerExtra': 'TankDefBonus',
    'txtPanzerSide': 'SideDef', 'txtPanzerBack': 'BackDef',
}
values = {int(row['values']['ID']): {control: int(row['values'][column]) for control, column in fields.items()}
          for row in rows}
output = root / 'apps/web/src/interface/account/tank-shop-source-attributes.ts'
output.write_text('/** Original tank-table directory values; no current equipped or combat authority. */\n'
                  'export const TANK_SHOP_SOURCE_ATTRIBUTES: Readonly<Record<number, Readonly<Record<string, number>>>> = '
                  + json.dumps(values, ensure_ascii=False, indent=2) + ';\n')
(root / 'recovery/output/tank-shop-source-attributes-source.json').write_text(json.dumps({
    'tasks': ['M5-10', 'UI-57'], 'table': 'verified/tables/tank.json', 'fields': fields,
    'rows': values, 'originalControlSetterProved': False, 'fullFidelityComplete': False,
}, ensure_ascii=False, indent=2) + '\n')
