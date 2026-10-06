"""Select original model attachment tracks referenced by supported ELK records."""
import json
from pathlib import Path
from effect_action_events import source_actions
from effect_action_keys import action_identifier
from mv3 import read_mv3

ROOT = Path(__file__).resolve().parents[1]


def source_tracks():
    links = json.loads((ROOT / 'recovery/output/web-assets/effect-links.json').read_text())
    references = set()
    for source in links['files']:
        for group in source['groups']:
            action = next(name for name in ['03', '09'] if action_identifier(name) == group['key'])
            for event in group['actions']:
                for record in event['records']:
                    if record['bindingMode'] == 3:
                        references.add((int(source['tankCode']), action, record['field148String']))
    root = ROOT / 'recovery/output/verified/assets/data'
    rows = []
    for action in source_actions():
        names = {tag for tank, name, tag in references
                 if tank == action['tankId'] and name == action['action']}
        if not names:
            continue
        model = read_mv3(root / action['path'])
        for index, track in enumerate(model['tracks']):
            if track['name'] in names:
                rows.append({'tankId': action['tankId'], 'part': action['part'],
                             'action': action['action'], 'path': action['path'],
                             'trackIndex': index, 'name': track['name'],
                             'value': track['value'], 'frames': track['frames']})
    return rows


if __name__ == '__main__':
    rows = source_tracks()
    output = ROOT / 'recovery/output/web-assets/effect-tag-tracks.json'
    output.write_text(json.dumps({'tracks': rows}, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(rows)} original attachment tracks referenced by mode3 ELK')
