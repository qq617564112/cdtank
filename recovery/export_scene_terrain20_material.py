"""Publish original map0020 opaque and alpha-test terrain identities."""
import json
from pathlib import Path
from pol import read_pol
ROOT = Path(__file__).resolve().parents[1]

def export():
    model = read_pol(ROOT/'recovery/output/verified/assets/data/Data/map/0020/0020.POL')
    parts = []
    for mesh in model['meshes']:
        assert mesh['fvf'] == 21
        for index, part in enumerate(mesh['parts']):
            assert part['kind'] in (0, 1)
            shader = 'geom_t_c1.gbf' if part['kind'] == 1 else 'geom_c1.gbf'
            parts.append(dict(mesh=f"{mesh['name']}/{index}", kind=part['kind'],
                              shader=f'Data\\gfxscript\\{shader}'))
    assert len(parts) == 190
    assert sum(part['kind'] == 0 for part in parts) == 139
    assert sum(part['kind'] == 1 for part in parts) == 51
    result = dict(mapId=20, source='Data/map/0020/0020.POL', parts=parts)
    (ROOT/'recovery/output/web-assets/scene-terrain-material-0020.json').write_text(
        json.dumps(result, indent=2)+'\n')
    return result

if __name__ == '__main__':
    print(f"Published {len(export()['parts'])} original0020 terrain material selectors")
