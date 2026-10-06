"""Publish original legal map5 Plant placements and sway inputs."""
import json
from pathlib import Path
import struct

from pol import read_pol
from scene import read_scene

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'


def export():
    records = read_scene(SOURCE / 'Data/scn/0005/0005.obj')
    model = read_pol(SOURCE / 'Data/scnobj/obj05413/obj05413.POL')
    assert len(model['meshes']) == 1
    bounds = model['meshes'][0]['bounds']
    height = struct.unpack('<f', struct.pack('<f', bounds[4] - bounds[1]))[0]
    plants = []
    for record in records:
        if record['className'] != 'SYcScnObjPlant' or record['model'] != 'obj05413':
            continue
        assert record['bounds'][1] == height
        assert record['rotation'] == (0.0, 0.0, 0.0)
        plants.append(dict(sourcePlacementId=record['id'], model=record['model'],
                           height=height, enabled=bool(record['enabled']),
                           sourceBounds=bounds))
    assert len(plants) == 38 and all(plant['enabled'] for plant in plants)
    result = dict(mapId=5, plants=plants,
                  reference='Data/scnobj/obj05413/obj05413.POL',
                  sourceLoader='4616f8', sourceUpdate='45e8a5', sourceDraw='45e90a',
                  sourceShader='Data/gfxscript/plant80.gbf')
    (WEB / 'scene-plant-0005.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f'Published {len(plants)} original map5 Plant sway inputs')


if __name__ == '__main__':
    export()
