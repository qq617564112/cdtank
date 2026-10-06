"""Publish original0002 terrain material selectors, preserving primitive identity."""
import json
from pathlib import Path
from pol import read_pol
ROOT=Path(__file__).resolve().parents[1]
def export():
    native=json.loads((ROOT/'recovery/output/scene-terrain02-material-native.json').read_text())
    model=read_pol(ROOT/'recovery/output/verified/assets/data/Data/map/0002/0002.POL')
    parts=[dict(mesh=f"{mesh['name']}/{index}",kind=part['kind'],shader=native['registrations']['0x881' if part['kind'] else '0x801']) for mesh in model['meshes'] for index,part in enumerate(mesh['parts'])]
    assert len(parts)==76 and all(mesh['fvf']==21 for mesh in model['meshes'])
    result=dict(mapId=2,source='Data/map/0002/0002.POL',parts=parts)
    (ROOT/'recovery/output/web-assets/scene-terrain-material-0002.json').write_text(json.dumps(result,indent=2)+'\n')
    return result
if __name__=='__main__':print(f"Published {len(export()['parts'])} original terrain material selectors")
