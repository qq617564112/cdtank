"""Index every original function slot, trigger, target and linked item for implementation."""
import json
from collections import defaultdict
from pathlib import Path
from export_combat_catalog import export

ROOT = Path(__file__).resolve().parents[1]


def coverage(catalog):
    skills = {skill['skillId']: skill for skill in catalog['skills']}
    item_links = defaultdict(set)
    missing = defaultdict(set)
    for item in catalog['items']:
        for skill_id in item['skillIds']:
            if skill_id == 0:
                continue
            (item_links if skill_id in skills else missing)[skill_id].add(item['itemTableId'])
    groups = defaultdict(list)
    triggers = defaultdict(list)
    targets = defaultdict(list)
    for skill in skills.values():
        triggers[skill['triggerType']].append(skill['skillId'])
        targets[skill['target']].append(skill['skillId'])
        for index, function in enumerate(skill['functions']):
            groups[function['type']].append(dict(skillId=skill['skillId'], name=skill['name'],
                slot=index + 1, triggerType=skill['triggerType'], target=skill['target'],
                range=skill['range'], parameters={key: function[key] for key in ['t', 'x', 'y', 'z']},
                itemTableIds=sorted(item_links[skill['skillId']]),
                runtimeStatus='unimplemented'))
    return dict(source='CDTank/Data/table/skill.dat and item.dat',
        scope='Table definitions and links only; descriptions do not prove authoritative function semantics.',
        skillCount=len(skills), itemCount=len(catalog['items']), slotCount=sum(map(len, groups.values())),
        types=[dict(type=kind, slotCount=len(rows), skillCount=len({row['skillId'] for row in rows}),
                    slots=rows) for kind, rows in sorted(groups.items())],
        triggers=[dict(value=key, skillIds=rows) for key, rows in sorted(triggers.items())],
        targets=[dict(value=key, skillIds=rows) for key, rows in sorted(targets.items())],
        missingSkills=[dict(skillId=key, itemTableIds=sorted(rows)) for key, rows in sorted(missing.items())])


if __name__ == '__main__':
    result = coverage(export())
    destination = ROOT / 'recovery/output/skill-function-coverage.json'
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(skills=result['skillCount'], items=result['itemCount'], slots=result['slotCount'],
        types=[{key: row[key] for key in ['type', 'slotCount', 'skillCount']} for row in result['types']],
        missingSkills=result['missingSkills']), ensure_ascii=False))
