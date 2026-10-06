"""Export original tank components, INI actions and turret attachment positions."""
import configparser
import json
from pathlib import Path
from mv3 import read_mv3
from effect_action_keys import action_identifier

root = Path('recovery/output/verified/assets/data')
out = Path('recovery/output/web-assets')
models = {entry['path'].lower(): entry['output']
          for entry in json.loads((out / 'mv3-conversion.json').read_text())}
rows = json.loads(Path('recovery/output/verified/tables/tank.json').read_text())['rows']
tanks = []
for row in rows:
    values = row['values']
    identifier = int(values['ID'])
    directory = root / f'Data/role/{identifier:03}'
    components = []
    for part in ['M', 'U', 'X', 'Y']:
        ini = directory / f'{identifier:03}{part}.ini'
        config = configparser.ConfigParser()
        config.read(ini, encoding='gbk')
        actions = []
        for section in config.sections():
            fields = dict(config[section])
            path = directory / fields['file']
            # Resolve the case-insensitive paths used by the Windows client.
            path = next(p for p in directory.iterdir() if p.name.lower() == path.name.lower())
            model = read_mv3(path)
            tag = next((track for track in model['tracks']
                        if track['name'] == 'tag_c'), None)
            actions.append(dict(section=section, fields=fields,
                asset=models[path.relative_to(root).as_posix().lower()],
                duration=model['duration'],
                primaryTags=[track for track in model['tracks'] if track['name'] in
                    {'tag_efcenter', 'tag_effront', 'tag_efback', 'tag_efleft',
                     'tag_efright', 'tag_efsoot', 'tag_efattack'}],
                events=[dict(time=event['id'], name=event['name'],
                             identifier=action_identifier(event['name'])) for event in model['tags']],
                turretPivotFrames=tag['frames'] if tag else None,
                turretPivot=tag['frames'][0]['matrix'][:3] if tag and tag['frames'] else None))
        components.append(dict(part=part, ini=ini.relative_to(root).as_posix(), actions=actions))
    tanks.append(dict(id=identifier, name=values['TankName'], tankType=int(values['TankType']),
        components=components))
(out / 'tanks.json').write_text(json.dumps(tanks, ensure_ascii=False, separators=(',', ':')))
print(f'{len(tanks)} tanks, {sum(len(t["components"]) for t in tanks)} components, '
      f'{sum(len(c["actions"]) for t in tanks for c in t["components"])} source actions')
