"""Check legal map4 Plant heights and published original vertex inputs."""
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from pol import read_pol
from scene import read_scene

source = ROOT / 'recovery/output/verified/assets/data'
web = ROOT / 'recovery/output/web-assets'
resource = json.loads((web / 'scene-plant-0004.json').read_text())
records = {record['id']: record for record in read_scene(source / 'Data/scn/0004/0004.obj')
           if record['className'] == 'SYcScnObjPlant'}
assert len(records) == len(resource['plants']) == 106
legal = []
for mode in range(1, 6):
    table = json.loads((ROOT / f'recovery/output/verified/tables/m{mode:03d}.json').read_text())
    legal.extend(dict(mode=mode, minimum=int(row['values']['PlayerMin']),
                      maximum=int(row['values']['PlayerMax']))
                 for row in table['rows'] if row['values']['MapID'] == '0004')
assert legal == [dict(mode=1, minimum=4, maximum=10), dict(mode=3, minimum=4, maximum=10)]
models = []
for name in sorted({plant['model'] for plant in resource['plants']}):
    model = read_pol(source / f'Data/scnobj/{name}/{name}.POL')
    mesh = model['meshes'][0]
    raw = (web / f'Data/scnobj/{name}/{name}.glb').read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    glb = json.loads(raw[20:20+size])
    primitive = glb['meshes'][0]['primitives'][0]
    def values(name, count):
        accessor = glb['accessors'][primitive['attributes'][name]]
        view = glb['bufferViews'][accessor['bufferView']]
        offset = 28+size+view.get('byteOffset', 0)+accessor.get('byteOffset', 0)
        return struct.unpack_from('<'+'f'*(accessor['count']*count), raw, offset)
    positions, colors, uv = values('POSITION', 3), values('COLOR_0', 4), values('TEXCOORD_0', 2)
    indices = [index for face in mesh['parts'][0]['faces'] for index in face]
    for k, index in enumerate(indices):
        vertex = mesh['vertices'][index]
        assert positions[k*3:k*3+3] == struct.unpack_from('<3f', vertex)
        assert uv[k*2:k*2+2] == struct.unpack_from('<2f', vertex, 16)
        b, g, r, a = vertex[12:16]
        expected = tuple(struct.unpack('<f', struct.pack('<f', value/255))[0] for value in (r,g,b,a))
        assert colors[k*4:k*4+4] == expected
    models.append(dict(model=name, mesh=mesh['name'], vertices=len(indices),
                       height=next(plant['height'] for plant in resource['plants'] if plant['model']==name)))
for plant in resource['plants']:
    record = records[plant['sourcePlacementId']]
    assert plant['model'] == record['model']
    assert plant['enabled'] == bool(record['enabled'])
    assert plant['height'] == record['bounds'][1] > 0
    assert record['rotation'] == (0.0, 0.0, 0.0)
result = dict(status='PASS_SOURCE_INPUTS_ONLY', mapId=4, legalModes=legal,
              placements=len(records), models=models,
              sourceVertexPositionsUVPackedRGBAExact=True, sourceHeightAndEnabledExact=True,
              reusedNative='scene-plant02-sway-native.json',
              limitations=['No ordinary player sway pixels or GPU precision proof.',
                           'Plant ambient/material producer remains outside this sway slice.'])
(ROOT / 'recovery/output/scene-plant04-source.json').write_text(json.dumps(result, indent=2)+'\n')
print('PASS_SOURCE_INPUTS_ONLY: 106 original Plant placements/four original POL and GLB vertex inputs')
