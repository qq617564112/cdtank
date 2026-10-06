"""Publish the already verified named05413 material properties."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'recovery'))
from pol import read_pol


def export():
    source = read_pol(ROOT / 'recovery/output/verified/assets/data/Data/scnobj/obj05413/obj05413.POL')
    mesh = source['meshes'][0]
    part = mesh['parts'][0]
    resource = {'model': 'obj05413', 'mesh': mesh['name'] + '/0',
                'properties': part['properties'], 'originalTexture': part['textures'][0],
                'shader': 'Data/gfxscript/plant80.gbf',
                'scope': 'Original named material inputs; scene ambient is supplied by the formal Web provider.'}
    (ROOT / 'recovery/output/web-assets/scene-plant-material-05413.json').write_text(
        json.dumps(resource, indent=2) + '\n')
    return resource


if __name__ == '__main__':
    print('Published ' + export()['model'] + ' original Plant material inputs')
