"""Publish original map0021 opaque and alpha-test terrain identities."""
import json
from pathlib import Path
from pol import read_pol
ROOT = Path(__file__).resolve().parents[2]

def export():
    model = read_pol(ROOT/'recovery/output/verified/assets/data/Data/map/0021/0021.POL')
    parts = []
    for mesh in model['meshes']:
        assert mesh['fvf'] == 21
        for index, part in enumerate(mesh['parts']):
            assert part['kind'] in (0, 1)
            shader = 'geom_t_c1.gbf' if part['kind'] == 1 else 'geom_c1.gbf'
            parts.append(dict(mesh=f"{mesh['name']}/{index}", kind=part['kind'],
                              shader=f'Data\\gfxscript\\{shader}', texture=part['textures'][0]))
    assert len(parts) == 104
    assert [part['mesh'] for part in parts if not part['texture']] == ['plane04/0']
    assert sum(part['kind'] == 0 for part in parts) == 71
    assert sum(part['kind'] == 1 for part in parts) == 33
    result = dict(mapId=21, source='Data/map/0021/0021.POL', parts=parts)
    (ROOT/'apps/web/public/scene-terrain-material-0021.json').write_text(
        json.dumps(result, indent=2)+'\n')
    return result

if __name__ == '__main__':
    print(f"Published {len(export()['parts'])} original0021 terrain material selectors")
