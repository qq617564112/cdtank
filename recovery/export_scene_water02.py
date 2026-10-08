"""Publish original map0002/0003/0016 water geometry and 32 caustic textures."""
import json
from pathlib import Path
from PIL import Image
from pol import read_pol

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'


def export_map(map_id):
    geometry = []
    for name in ['water', 'waves']:
        reference = f'Data/map/{map_id}/{name}.POL'
        model = read_pol(SOURCE / reference)
        asset = f'Data/map/{map_id}/{name}.glb'
        assert (WEB / asset).is_file()
        geometry.append(dict(name=name, reference=reference, asset=asset,
                             opacity=[part['properties'][3] for mesh in model['meshes']
                                      for part in mesh['parts']],
                             bounds=[mesh['bounds'] for mesh in model['meshes']]))
    textures = []
    for index in range(32):
        source = f'Data/image/water/CAUST{index:02d}.dds'
        asset = f'Data/image/water/CAUST{index:02d}.png'
        assert (SOURCE / source).is_file() and (WEB / asset).is_file()
        textures.append(dict(index=index, reference=source, asset=asset))
    result = dict(mapId=int(map_id), geometry=geometry, textures=textures,
                  sourceLoader='462f24', sourceUpdate='462d14', sourceDraw='462dc6')
    (WEB / f'scene-water-{map_id}.json').write_text(json.dumps(result, indent=2)+'\n')
    return result


def export():
    for index in range(32):
        source = SOURCE / f'Data/image/water/CAUST{index:02d}.dds'
        target = WEB / f'Data/image/water/CAUST{index:02d}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            image.convert('RGBA').save(target)
    resources = [export_map(map_id) for map_id in ('0002', '0003', '0016')]
    print('Published original0002/0003/0016 water/waves and32 caustic textures')
    return resources


if __name__ == '__main__':
    export()
