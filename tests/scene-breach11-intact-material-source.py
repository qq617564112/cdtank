"""Compare original Breach11 intact asset inputs with its published geometry."""
import json
from io import BytesIO
from PIL import Image
from pathlib import Path
import struct
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from pol import read_pol
from scene import read_scene
source = ROOT / 'recovery/output/verified/assets/data'
records = [r for r in read_scene(source / 'Data/scn/0011/0011.obj')
           if r['className'] == 'SYcScnObjBreach' and r['model'] == 'obj05430']
assert len(records) == 32 and all(r['enabled'] == 1 for r in records)
mesh = read_pol(source / 'Data/scnobj/obj05430/obj05430.POL')['meshes'][0]
assert mesh['name'] == 'anangua04' and mesh['fvf'] == 21 and len(mesh['parts']) == 1
part = mesh['parts'][0]
assert part['kind'] == 0 and part['textures'] == ['obj05430.tga']
raw = (ROOT / 'recovery/output/web-assets/Data/scnobj/obj05430/obj05430.glb').read_bytes()
size = struct.unpack_from('<I', raw, 12)[0]
glb = json.loads(raw[20:20+size]); binary = 28 + size
primitive = glb['meshes'][0]['primitives'][0]
def values(accessor, components):
    a = glb['accessors'][accessor]; view = glb['bufferViews'][a['bufferView']]
    return struct.unpack_from('<' + 'f' * a['count'] * components, raw,
        binary + view.get('byteOffset', 0) + a.get('byteOffset', 0))
positions = values(primitive['attributes']['POSITION'], 3)
colors = values(primitive['attributes']['COLOR_0'], 4)
uvs = values(primitive['attributes']['TEXCOORD_0'], 2)
indices = [i for face in part['faces'] for i in face]
for k, i in enumerate(indices):
    vertex = mesh['vertices'][i]; b,g,r,a = vertex[12:16]
    expected = tuple(struct.unpack('<f',struct.pack('<f',x/255))[0] for x in (r,g,b,a))
    assert positions[3*k:3*k+3] == struct.unpack_from('<3f',vertex)
    assert colors[4*k:4*k+4] == expected
    assert uvs[2*k:2*k+2] == struct.unpack_from('<2f',vertex,16)
image = glb['images'][0]
view = glb['bufferViews'][image['bufferView']]
png = raw[binary+view.get('byteOffset',0):binary+view.get('byteOffset',0)+view['byteLength']]
original_pixels = Image.open(source / 'Data/scnobj/obj05430/obj05430.dds').convert('RGBA')
published_pixels = Image.open(BytesIO(png)).convert('RGBA')
assert original_pixels.size == published_pixels.size
assert original_pixels.tobytes() == published_pixels.tobytes()
result = dict(status='PASS_BREACH11_INTACT_SOURCE_INPUTS_ONLY',mapId=11,model='obj05430',
    placements=records,mesh=mesh['name'],fvf=21,kind=0,expandedVertices=len(indices),
    originalTexture=part['textures'][0],originalMaterial=part['properties'],
    publishedMaterial=glb['materials'][primitive['material']],sourcePositionUVPackedRGBAExact=True,originalDdsPublishedPngRGBAExact=True,textureSize=original_pixels.size,
    loaderReuse='scene-breach20-05442-native.json: original intact POL load and blend mode0 alpha1; scene-breach21-native.json original Breach4610f1 loader',
    selectorReuse='scene-terrain02-material-native.json: FVF21/kind0 geom_c1.gbf',
    scope='Original new asset inputs only; no production hook, player pixels, sounds or Castle changes.')
(ROOT / 'recovery/output/scene-breach11-intact-material-source.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS_BREACH11_INTACT_SOURCE_INPUTS_ONLY:32 placements/144 original expanded vertices')
