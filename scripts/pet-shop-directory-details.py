import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
tables = root / 'recovery/output/verified/tables'
pets = json.loads((tables / 'pet.json').read_text())['rows']
skills = {int(row['values']['SkillTableID']): row['values']['SkillName']
          for row in json.loads((tables / 'skill.json').read_text())['rows']}
details = {
    int(row['values']['ID']): {
        'critical': int(row['values']['Critical']),
        'lucky': int(row['values']['Lucky']),
        'skills': [{'id': int(row['values'][f'Skill{index}']),
                    'name': skills.get(int(row['values'][f'Skill{index}']), ''),
                    'level': int(row['values'][f'SkillLv{index}'])}
                   for index in range(6)],
    } for row in pets
}
(root / 'apps/web/src/interface/account/pet-shop-directory-metadata.ts').write_text(
    '/** Original pet directory metadata; not owned growth or battle skill authority. */\n'
    'export const PET_SHOP_DIRECTORY_DETAILS: Readonly<Record<number, {critical: number; lucky: number; '
    'skills: readonly {id: number; name: string; level: number}[]}>> = '
    + json.dumps(details, ensure_ascii=False, indent=2) + ';\n')
(root / 'recovery/output/pet-shop-directory-details-source.json').write_text(json.dumps({
    'tasks': ['M5-10', 'UI56'], 'tables': ['verified/tables/pet.json', 'verified/tables/skill.json'],
    'fields': {'txtCritical': 'Critical', 'txtLucky': 'Lucky',
               'txtSkillName0..5': 'Skill0..5 -> SkillTableID/SkillName',
               'txtSkillLevel0..5': 'SkillLv0..5'},
    'rows': details, 'originalSetterProved': False, 'fullFidelityComplete': False,
}, ensure_ascii=False, indent=2) + '\n')
