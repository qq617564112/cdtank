"""Publish original map0022 opaque and alpha-test terrain identities."""
import json
from pathlib import Path
from pol import read_pol
ROOT = Path(__file__).resolve().parents[1]


def export():
    model = read_pol(ROOT/'recovery/output/verified/assets/data/Data/map/0022/0022.POL')
    parts = []
    for mesh in model['meshes']:
        assert mesh['fvf'] == 21
        for index, part in enumerate(mesh['parts']):
            assert part['kind'] in (0, 1)
            assert any(part['textures'])
            shader = 'geom_t_c1.gbf' if part['kind'] == 1 else 'geom_c1.gbf'
            parts.append(dict(mesh=f"{mesh['name']}/{index}", kind=part['kind'],
                              shader=f'Data\\gfxscript\\{shader}'))
    assert len(parts) == 72
    assert sum(part['kind'] == 0 for part in parts) == 46
    assert sum(part['kind'] == 1 for part in parts) == 26
    result = dict(mapId=22, source='Data/map/0022/0022.POL', parts=parts)
    (ROOT/'recovery/output/web-assets/scene-terrain-material-0022.json').write_text(
        json.dumps(result, indent=2)+'\n')
    return result


if __name__ == '__main__':
    print(f"Published {len(export()['parts'])} original0022 terrain material selectors")
