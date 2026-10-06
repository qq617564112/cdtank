"""Publish original0002 terrain material selectors, preserving primitive identity."""
import json
from pathlib import Path
from pol import read_pol
ROOT=Path(__file__).resolve().parents[1]
# Original1002727f/10027290 registrations for flags0x801/0x881.
SHADERS={0:'Data\\\\gfxscript\\\\geom_c1.gbf',1:'Data\\\\gfxscript\\\\geom_t_c1.gbf'}
def export():
    model=read_pol(ROOT/'recovery/output/verified/assets/data/Data/map/0002/0002.POL')
    parts=[dict(mesh=f"{mesh['name']}/{index}",kind=part['kind'],shader=SHADERS[part['kind']]) for mesh in model['meshes'] for index,part in enumerate(mesh['parts'])]
    assert len(parts)==76 and all(mesh['fvf']==21 for mesh in model['meshes'])
    result=dict(mapId=2,source='Data/map/0002/0002.POL',parts=parts)
    (ROOT/'recovery/output/web-assets/scene-terrain-material-0002.json').write_text(json.dumps(result,indent=2)+'\n')
    return result
if __name__=='__main__':print(f"Published {len(export()['parts'])} original terrain material selectors")
