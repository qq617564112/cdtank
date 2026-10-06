"""Publish original legal map17 Plant placements and sway inputs."""
import json
from pathlib import Path
import struct

from pol import read_pol
from scene import read_scene

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'


def export():
    records = [record for record in read_scene(SOURCE / 'Data/scn/0017/0017.obj')
               if record['className'] == 'SYcScnObjPlant']
    assert len(records) == 128
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
        assert record['rotation'] == (0.0, 0.0, 0.0)
        plants.append(dict(sourcePlacementId=record['id'], model=record['model'],
                           height=model['height'], enabled=bool(record['enabled']),
                           sourceBounds=model['sourceBounds']))
    result = dict(mapId=17, plants=plants,
                  references=[f'Data/scnobj/{name}/{name}.POL' for name in models],
                  sourceLoader='4616f8', sourceUpdate='45e8a5', sourceDraw='45e90a',
                  sourceShader='Data/gfxscript/plant80.gbf')
    (WEB / 'scene-plant-0017.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    print(f"Published {len(export()['plants'])} original map17 Plant sway inputs")
