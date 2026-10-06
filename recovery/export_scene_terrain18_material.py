"""Publish original map0018 opaque terrain material identity."""
import json
from pathlib import Path
from pol import read_pol
ROOT=Path(__file__).resolve().parents[1]
def export():
    model=read_pol(ROOT/'recovery/output/verified/assets/data/Data/map/0018/0018.POL')
    parts=[]
    for mesh in model['meshes']:
        assert mesh['fvf']==21 and '_water' not in mesh['name']
        for index,part in enumerate(mesh['parts']):
            assert part['kind']==0
            parts.append(dict(mesh=f"{mesh['name']}/{index}",kind=0,shader='Data\\gfxscript\\geom_c1.gbf'))
    assert len(parts)==21
    result=dict(mapId=18,source='Data/map/0018/0018.POL',parts=parts)
    (ROOT/'recovery/output/web-assets/scene-terrain-material-0018.json').write_text(json.dumps(result,indent=2)+'\n')
    return result
if __name__=='__main__':print(f"Published {len(export()['parts'])} original0018 opaque material selectors")
