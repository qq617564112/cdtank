"""Publish original item/skill bindings and effect slots for both runtimes."""
import json
from pathlib import Path
from inspect_assets import read_table

ROOT = Path(__file__).resolve().parents[1]

def export():
    skills = []
    table = read_table(ROOT / 'CDTank/Data/table/skill.dat')
    for row in table['rows']:
        values = row['values']
        skills.append(dict(skillId=int(values['SkillTableID']), name=values['SkillName'],
            info=values['Info'], triggerType=int(values['TriggerType']), target=int(values['Target']),
            range=int(values['Range']),
            attributes={column: int(values[column]) for column in table['columns'][19:47]},
            effects=[dict(effectId=int(values[f'Effect{slot}']), sound=values[f'Sound{slot}'],
                          tag=int(values[f'EffectTag{slot}']), method=int(values[f'EffectMethod{slot}']))
                     for slot in range(1, 4)],
            functions=[dict(type=int(values[f'FuncType{slot}']), t=int(values[f'FuncT{slot}']),
                            x=int(values[f'FuncX{slot}']), y=int(values[f'FuncY{slot}']), z=int(values[f'FuncZ{slot}']))
                       for slot in range(1, 4)]))
    items = []
    for row in read_table(ROOT / 'CDTank/Data/table/item.dat')['rows']:
        values = row['values']
        items.append(dict(itemTableId=int(values['ItemTableID']), name=values['ItemName'],
            info=values['ItemInfo'], moneyPrice=int(values['ItemMoney']), tokenPrice=int(values['ItemCoin']),
            getMethod=int(values['GGet']) & 0xffffffff, durable=int(values['Durable']) & 0xffffffff, breakMode=int(values['Break']) & 0xffffffff,
            iconId=int(values['D2']), itemType=int(values['ItemType']), battleUseMax=int(values['BattleUseMax']),
            skillIds=[int(values[f'ItemSkill{slot}']) for slot in range(1, 4)],
            effects=[dict(effectId=int(values[f'Effect{slot}']), sound=values[f'Sound{slot}'],
                          tag=int(values[f'EffectTag{slot}']), method=int(values[f'EffectMethod{slot}']))
                     for slot in range(1, 4)]))
    scales = [dict(id=int(row['values']['ID']), name=row['values']['Name'],
                   minimum=int(row['values']['Min']), maximum=int(row['values']['Max']))
              for row in read_table(ROOT / 'CDTank/Data/table/datascale.dat')['rows']]
    pet_types = [dict(petId=int(row['values']['ID']), petType=int(row['values']['PetType']),
                      petSize=int(row['values']['PetSize']), petMoney=int(row['values']['PetMoney']),
                      baseIds=[int(row['values'][f'Skill{i}']) for i in range(6)],
                      rankCaps=[int(row['values'][f'SkillLv{i}']) for i in range(6)])
                 for row in read_table(ROOT / 'CDTank/Data/table/pet.dat')['rows']]
    tank_types = [dict(tankId=int(row['values']['ID']), tankType=int(row['values']['TankType']),
                       partSlotCount=int(row['values']['TankPartSlot']), tankMoney=int(row['values']['TankMoney']),
                       tankCoin=int(row['values']['TankCoin']))
                  for row in read_table(ROOT / 'CDTank/Data/table/tank.dat')['rows']]
    pet_prices = [dict(skillId=int(row['values']['技能ID']), groupId=int(row['values']['技能类别']),
                       level=int(row['values']['技能等级']), cost=int(row['values']['花费技能点数']))
                  for row in read_table(ROOT / 'CDTank/Data/table/petskill.dat')['rows']]
    return dict(petSkillPrices=pet_prices, skills=skills, items=items, dataScales=scales, petTypes=pet_types, tankTypes=tank_types)

if __name__ == '__main__':
    catalog = export()
    destination = ROOT / 'recovery/output/web-assets/combat-catalog.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    print(f"Published {len(catalog['skills'])} skills, {len(catalog['items'])} items and {len(catalog['dataScales'])} data scales")
