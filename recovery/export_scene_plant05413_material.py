"""Publish the already verified named05413 material properties."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from pol import read_pol


def export():
    models = []
    for name in ('obj05413', 'obj05401', 'obj05403', 'obj05405', 'obj05416'):
        source = read_pol(ROOT / f'recovery/output/verified/assets/data/Data/scnobj/{name}/{name}.POL')
        mesh = source['meshes'][0]
        part = mesh['parts'][0]
        models.append({'model': name, 'mesh': mesh['name'] + '/0',
                       'properties': part['properties'], 'originalTexture': part['textures'][0]})
    resource = {'models': models, 'shader': 'Data/gfxscript/plant80.gbf',
                'scope': 'Original named material inputs; scene ambient is supplied by the formal Web provider.'}
    (ROOT / 'recovery/output/web-assets/scene-plant-material-05413.json').write_text(
        json.dumps(resource, indent=2) + '\n')
    return resource


if __name__ == '__main__':
    print('Published ' + str(len(export()['models'])) + ' named original Plant material inputs')
