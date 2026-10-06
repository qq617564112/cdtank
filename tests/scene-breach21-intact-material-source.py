"""Check original intact barrel material inputs using the recovered Breach loader."""
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
loader = json.loads((ROOT / 'recovery/output/scene-breach21-native.json').read_text())
assert loader['status'] == 'PASS'
assert any(row.get('kind') == 'loadIntact' and row.get('reference') == 'data\\scnobj\\obj05467\\obj05467.pol'
           for row in loader['loader'])
records = [record for record in read_scene(source / 'Data/scn/0021/0021.obj')
           if record['className'] == 'SYcScnObjBreach' and record['model'] == 'obj05467']
assert len(records) == 8 and all(record['enabled'] for record in records)
model = read_pol(source / 'Data/scnobj/obj05467/obj05467.POL')
assert len(model['meshes']) == 1
mesh = model['meshes'][0]
assert mesh['name'] == 'object08' and mesh['fvf'] == 21
assert len(mesh['parts']) == 1 and mesh['parts'][0]['kind'] == 0
assert mesh['parts'][0]['textures'] == ['obj05467.TGA']
raw = (web / 'Data/scnobj/obj05467/obj05467.glb').read_bytes()
size = struct.unpack_from('<I', raw, 12)[0]
glb = json.loads(raw[20:20+size])
primitive = glb['meshes'][0]['primitives'][0]
def values(name, count):
    accessor = glb['accessors'][primitive['attributes'][name]]
    view = glb['bufferViews'][accessor['bufferView']]
    return struct.unpack_from('<'+'f'*(accessor['count']*count), raw,
        28+size+view.get('byteOffset', 0)+accessor.get('byteOffset', 0))
positions, colors, uv = values('POSITION', 3), values('COLOR_0', 4), values('TEXCOORD_0', 2)
indices = [index for face in mesh['parts'][0]['faces'] for index in face]
nonwhite = 0
for k,index in enumerate(indices):
    vertex = mesh['vertices'][index]
    assert positions[k*3:k*3+3] == struct.unpack_from('<3f',vertex)
    assert uv[k*2:k*2+2] == struct.unpack_from('<2f',vertex,16)
    b,g,r,a = vertex[12:16]
    expected = tuple(struct.unpack('<f',struct.pack('<f',value/255))[0] for value in (r,g,b,a))
    assert colors[k*4:k*4+4] == expected
    nonwhite += expected[:3] != (1,1,1)
material = glb['materials'][primitive['material']]
assert material['pbrMetallicRoughness']['baseColorFactor'] == list(mesh['parts'][0]['properties'][:4])
shader = (source / 'Data/gfxscript/geom_c1.gbf').read_text()
texture = glb['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]
image = glb['images'][texture['source']]
result = dict(status='PASS_INTACT_SOURCE_INPUTS_ONLY',mapId=21,model='obj05467',mesh='object08/0',
              className='SYcScnObjBreach',placements=[record['id'] for record in records],
              fvf=21,kind=0,expandedVertices=len(indices),nonwhiteVertices=nonwhite,
              sourcePositionUVPackedRGBAExact=True,sourceMaterialFactorExact=True,
              texture=image,sourceShader='Data/gfxscript/geom_c1.gbf',shaderText=shader,
              reusedLoader='scene-breach21-native.json',reusedSelector='scene-terrain02-material-native.json',
              limits=['Only intact POL material consumer source; no c9/event/sound/authority change.',
                      'No original GPU or ordinary player material pixels.'])
(ROOT / 'recovery/output/scene-breach21-intact-material-source.json').write_text(json.dumps(result,indent=2)+'\n')
print(f'PASS_INTACT_SOURCE_INPUTS_ONLY:8 source barrel placements/{len(indices)} original vertices')
