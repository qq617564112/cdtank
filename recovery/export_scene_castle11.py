"""Publish map0011's original Castle action assets and attachment tracks."""
import configparser
import json
from pathlib import Path
from mv3 import read_mv3
from scene import read_scene

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'


def export():
    converted = {entry['path'].lower(): entry['output']
                 for entry in json.loads((WEB / 'mv3-conversion.json').read_text())}
    castles = []
    for record in read_scene(SOURCE / 'Data/scn/0011/0011.cas'):
        model_dir = SOURCE / 'Data/scnobj' / record['model']
        ini = configparser.ConfigParser()
        ini.read(model_dir / (record['model'] + '.ini'), encoding='gbk')
        actions = []
        for section in ini.sections():
            name, filename = ini[section]['name'], ini[section]['file']
            path = model_dir / filename
            reference = path.relative_to(SOURCE).as_posix()
            asset = converted.get(reference.lower())
            available = path.exists() and asset is not None and (WEB / asset).exists()
            action = dict(name=name, file=reference, asset=asset, available=available,
                          sourceBounds=[], tracks=[], tags=[])
            if path.exists():
                model = read_mv3(path)
                action.update(durationMs=model['duration'],
                              sourceBounds=[dict(name=mesh['name'], bounds=mesh['bounds'])
                                            for mesh in model['meshes']],
                              tracks=model['tracks'], tags=model['tags'])
            actions.append(action)
        castles.append(dict(sourcePlacementId=record['id'], model=record['model'],
                            position=record['position'], matrix=record['matrix'],
                            actions=actions))
    result = dict(mapId=11, castles=castles)
    (WEB / 'scene-castle-0011.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result


if __name__ == '__main__':
    result = export()
    print(f'Published {len(result["castles"])} map0011 Castle action libraries')
