"""Publish original map0004 textured terrain identities."""
import json
from pathlib import Path
from pol import read_pol
ROOT = Path(__file__).resolve().parents[1]


def export():
    model = read_pol(ROOT/'recovery/output/verified/assets/data/Data/map/0004/0004.POL')
    parts = []
    withheld = []
    for mesh in model['meshes']:
        assert mesh['fvf'] == 21
        for index, part in enumerate(mesh['parts']):
            assert part['kind'] in (0, 1)
            if not any(part['textures']):
                withheld.append(dict(mesh=f"{mesh['name']}/{index}", kind=part['kind'],
                    reason='Original empty texture; fixed-function null-texture draw contract unresolved'))
                continue
            shader = 'geom_t_c1.gbf' if part['kind'] == 1 else 'geom_c1.gbf'
            parts.append(dict(mesh=f"{mesh['name']}/{index}", kind=part['kind'],
                              shader=f'Data\\gfxscript\\{shader}'))
    assert len(parts) == 146
    assert [part['mesh'] for part in withheld] == ['box2162/3', 'line589/3', 'line590/3', 'box2172/3']
    assert sum(part['kind'] == 0 for part in parts) == 123
    assert sum(part['kind'] == 1 for part in parts) == 23
    result = dict(mapId=4, source='Data/map/0004/0004.POL', parts=parts, withheldParts=withheld)
    (ROOT/'recovery/output/web-assets/scene-terrain-material-0004.json').write_text(
        json.dumps(result, indent=2)+'\n')
    return result


if __name__ == '__main__':
    print(f"Published {len(export()['parts'])} original0004 terrain material selectors")
