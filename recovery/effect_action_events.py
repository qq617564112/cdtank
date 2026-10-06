"""Export MV3 timed messages used by ELK action-event dispatch."""
import json
from pathlib import Path
from effect_action_keys import action_identifier
from mv3 import read_mv3

ROOT = Path(__file__).resolve().parents[1]


def source_actions():
    asset_root = ROOT / 'recovery/output/verified/assets/data'
    tanks = json.loads((ROOT / 'recovery/output/web-assets/tanks.json').read_text())
    cache = {}
    actions = []
    for tank in tanks:
        for component in tank['components']:
            directory = asset_root / Path(component['ini']).parent
            files = {path.name.lower(): path for path in directory.iterdir()}
            for action in component['actions']:
                path = files[action['fields']['file'].lower()]
                if path not in cache:
                    cache[path] = read_mv3(path)
                model = cache[path]
                actions.append({'tankId': tank['id'], 'part': component['part'],
                                'action': action['fields']['name'],
                                'path': path.relative_to(asset_root).as_posix(),
                                'duration': model['duration'],
                                'events': [{'time': event['id'], 'name': event['name'],
                                            'identifier': action_identifier(event['name'])}
                                           for event in model['tags']]})
    return actions


if __name__ == '__main__':
    actions = source_actions()
    output = ROOT / 'recovery/output/web-assets/effect-action-events.json'
    output.write_text(json.dumps({'actions': actions}, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(actions)} source actions / {sum(len(a["events"]) for a in actions)} timed messages')
