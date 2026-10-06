"""Publish original map0002 water geometry and all32 caustic textures."""
import json
from pathlib import Path
from PIL import Image
from pol import read_pol

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'


def export():
    geometry = []
    for name in ['water', 'waves']:
        reference = f'Data/map/0002/{name}.POL'
        model = read_pol(SOURCE / reference)
        asset = f'Data/map/0002/{name}.glb'
        assert (WEB / asset).is_file()
        geometry.append(dict(name=name, reference=reference, asset=asset,
                             opacity=[part['properties'][3] for mesh in model['meshes']
                                      for part in mesh['parts']],
                             bounds=[mesh['bounds'] for mesh in model['meshes']]))
    textures = []
    for index in range(32):
        source = f'Data/image/water/CAUST{index:02d}.dds'
        asset = f'Data/image/water/CAUST{index:02d}.png'
        target = WEB / asset
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(SOURCE / source) as image:
            image.convert('RGBA').save(target)
        textures.append(dict(index=index, reference=source, asset=asset))
    result = dict(mapId=2, geometry=geometry, textures=textures,
                  sourceLoader='462f24', sourceUpdate='462d14', sourceDraw='462dc6')
    (WEB / 'scene-water-0002.json').write_text(json.dumps(result, indent=2)+'\n')
    print('Published original0002 water/waves and32 caustic textures')


if __name__ == '__main__':
    export()
