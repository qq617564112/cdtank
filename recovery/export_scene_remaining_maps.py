"""Publish the remaining maps' Castle and Plant scene resources."""
import configparser
import json
import struct
from pathlib import Path

from mv3 import read_mv3
from pol import read_pol
from scene import read_scene


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'


def export_castle_0023():
    converted = {entry['path'].lower(): entry['output']
                 for entry in json.loads((WEB / 'mv3-conversion.json').read_text())}
    castles = []
    for record in read_scene(SOURCE / 'Data/scn/0023/0023.cas'):
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
    result = dict(mapId=23, castles=castles)
    (WEB / 'scene-castle-0023.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result


def export_plants(map_id):
    records = [record for record in read_scene(SOURCE / f'Data/scn/{map_id}/{map_id}.obj')
               if record['className'] == 'SYcScnObjPlant']
    models = {}
    for name in sorted({record['model'] for record in records}):
        model = read_pol(SOURCE / f'Data/scnobj/{name}/{name}.POL')
        assert len(model['meshes']) == 1
        mesh = model['meshes'][0]
        assert mesh['fvf'] == 21 and len(mesh['parts']) == 1
        assert mesh['parts'][0]['kind'] == 1 and any(mesh['parts'][0]['textures'])
        bounds = mesh['bounds']
        height = struct.unpack('<f', struct.pack('<f', bounds[4] - bounds[1]))[0]
        models[name] = dict(height=height, sourceBounds=bounds)
    plants = []
    for record in records:
        model = models[record['model']]
        assert record['bounds'][1] == model['height']
        plants.append(dict(sourcePlacementId=record['id'], model=record['model'],
                           height=model['height'], enabled=bool(record['enabled']),
                           sourceBounds=model['sourceBounds']))
    references = [f'Data/scnobj/{name}/{name}.POL' for name in models]
    result = dict(mapId=int(map_id), plants=plants,
                  sourceLoader='4616f8', sourceUpdate='45e8a5', sourceDraw='45e90a',
                  sourceShader='Data/gfxscript/plant80.gbf')
    if len(references) == 1:
        result['reference'] = references[0]
    else:
        result['references'] = references
    (WEB / f'scene-plant-{map_id}.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def export():
    castle = export_castle_0023()
    plants = [export_plants(map_id)
              for map_id in ('0003', '0008', '0012', '0016', '0019', '0023', '0024', '0025')]
    return dict(castle=castle, plants=plants)


if __name__ == '__main__':
    result = export()
    print(f'Published {len(result["castle"]["castles"])} map0023 Castle libraries '
          f'and {len(result["plants"])} remaining Plant maps')
