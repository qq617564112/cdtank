"""Read the original broom definition and confirm the existing published contract."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table

item_table = read_table(ROOT / 'CDTank/Data/table/item.dat')
skill_table = read_table(ROOT / 'CDTank/Data/table/skill.dat')
item = next(row for row in item_table['rows']
            if int(row['values']['ItemTableID']) == 12)
skill = next(row for row in skill_table['rows']
             if int(row['values']['SkillTableID']) == 12)
i, s = item['values'], skill['values']
assert [int(i[f'ItemSkill{n}']) for n in range(1, 4)] == [12, 0, 0]
assert [int(i[k]) for k in ['ItemMoney', 'ItemCoin', 'ItemType', 'BattleUseMax']] == [10, 10, 1, 5]
assert [int(s[k]) for k in ['TriggerType', 'Target', 'Range']] == [1, 1, 400]
assert [int(s[k]) for k in ['FuncType1', 'FuncT1', 'FuncX1', 'FuncY1', 'FuncZ1']] == [14, 0, 0, 0, 0]
assert [int(s[k]) for k in ['Effect1', 'EffectTag1', 'EffectMethod1']] == [19, 0, 3]
assert s['Sound1'] == 'GA35'
published = json.loads((ROOT / 'recovery/output/web-assets/combat-catalog.json').read_text())
pi = next(row for row in published['items'] if row['itemTableId'] == 12)
ps = next(row for row in published['skills'] if row['skillId'] == 12)
assert pi['moneyPrice'] == int(i['ItemMoney']) and pi['battleUseMax'] == int(i['BattleUseMax'])
assert ps['range'] == int(s['Range']) and ps['functions'][0]['type'] == int(s['FuncType1'])
assert ps['effects'][0] == dict(effectId=19, sound='GA35', tag=0, method=3)
output = dict(status='PASS_ORIGINAL_TABLE_AND_PUBLISHED_BROOM_FIELDS_ONLY',
              itemRecordId=item['recordId'], skillRecordId=skill['recordId'],
              columns=dict(item={key: item_table['columns'].index(key) for key in
                                ['ItemSkill1', 'ItemMoney', 'ItemCoin', 'ItemType', 'BattleUseMax']},
                           skill={key: skill_table['columns'].index(key) for key in
                                  ['TriggerType', 'Target', 'Range', 'FuncType1', 'FuncT1', 'FuncX1', 'FuncY1', 'FuncZ1']}),
              item=pi, skill=ps,
              sourceReuse=['skill-function-coverage.json', 'skill-effect-wire.md', 'skill-effect-message.md'],
              confirmedCalls=[
                  '43d2e3 source battle quantity initialization caps configured instance by BattleUseMax',
                  '4cb2f5 original hotkey index5..8 dispatches configured finite record as useItem',
                  '488517..488536 original role effect usual branch uses19/tag0; not a ground removal executor'],
              missingProducer=dict(field='FuncType14 skill12 Range400 -> actual ground object removal',
                                   tableRead='skill.dat record12 FuncType1/Range; loader43aefa..43af57 reads function slots into158/164/170/17c/188',
                                   originalWriteAddress=None,
                                   nextEntrance='Original authoritative Func14 dispatcher or sender causing ground object retirement; current repository has no original server code',
                                   reconstructedPolicyPending='Radius/coordinate units, ownership eligibility, absence rejection, consumption/removal order'),
              limits='No native execution repeated; no original server sweep authorization/removal/time or normal BUY/usage/render acceptance')
(ROOT / 'recovery/output/trap-sweep-source.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(output['status'])
