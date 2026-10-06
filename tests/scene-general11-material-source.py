"""Save legal General POL draw identity and original packed-colour inputs."""
import json
from pathlib import Path
import struct
import sys
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from pol import read_pol
from scene import read_scene

source = ROOT / 'recovery/output/verified/assets/data'
web = ROOT / 'recovery/output/web-assets'
records = [r for r in read_scene(source / 'Data/scn/0011/0011.obj')
           if r['className'] == 'SYcScnObjGeneral' and r['model'] == 'obj05431']
assert len(records) == 23 and all(r['enabled'] == 1 for r in records)
model = read_pol(source / 'Data/scnobj/obj05431/obj05431.POL')
assert len(model['meshes']) == 1
mesh = model['meshes'][0]
assert mesh['fvf'] == 21 and len(mesh['parts']) == 1 and mesh['parts'][0]['kind'] == 0
raw = (web / 'Data/scnobj/obj05431/obj05431.glb').read_bytes()
size = struct.unpack_from('<I', raw, 12)[0]
glb = json.loads(raw[20:20+size])
binary = 28 + size
primitive = glb['meshes'][0]['primitives'][0]
def values(accessor, components):
    a = glb['accessors'][accessor]
    view = glb['bufferViews'][a['bufferView']]
    return struct.unpack_from('<' + 'f' * a['count'] * components, raw,
        binary + view.get('byteOffset', 0) + a.get('byteOffset', 0))
colors = values(primitive['attributes']['COLOR_0'], 4)
uvs = values(primitive['attributes']['TEXCOORD_0'], 2)
indices = [i for face in mesh['parts'][0]['faces'] for i in face]
nonwhite = 0
for k, i in enumerate(indices):
    vertex = mesh['vertices'][i]
    b, g, r, a = vertex[12:16]
    expected = [struct.unpack('<f', struct.pack('<f', x/255))[0] for x in (r,g,b,a)]
    assert list(colors[4*k:4*k+4]) == expected
    assert uvs[2*k:2*k+2] == struct.unpack_from('<2f', vertex, 16)
    nonwhite += expected[:3] != [1,1,1]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
image = pe.get_memory_mapped_image()
def at(a, n): return image[a-0x400000:a-0x400000+n]
slots = {hex(o):hex(struct.unpack('<I',at(0x5c73d0+o,4))[0]) for o in [0xc,0x1c,0x24,0x34]}
assert slots == {'0xc':'0x45f7dd','0x1c':'0x44dd82','0x24':'0x45e9d2','0x34':'0x4606d3'}
assert at(0x45f7ef,5) == b'\x68' + struct.pack('<I',0x5c7860)
assert at(0x5c7860,32).split(b'\0')[0] == b'SYcScnObjGeneral'
assert struct.unpack('<I',at(0x5c7148+0x10,4))[0] == 0x56f21e
assert at(0x56f21e,6) == b'\xff\x25' + struct.pack('<I',0x5c09c8)
imports = {i.address:i.name.decode() for e in pe.DIRECTORY_ENTRY_IMPORT for i in e.imports if i.name}
assert imports[0x5c09c8] == '?Attach@gbGeomNode@@UAEHPAVgbRenderEffect@@@Z'
assert 'LoadFromFile@gbGeomNode' in imports[0x5c09d8]
decoder = capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
ranges = [(0x45f7dd,0x45f811),(0x4606d3,0x460989),(0x44dd82,0x44ddc0),(0x45e9d2,0x45e9e9),(0x56f21e,0x56f224)]
result = dict(status='PASS_STATIC_GENERAL_SOURCE_INPUTS_ONLY', mapId=11,
    model='obj05431',className='SYcScnObjGeneral',vtable=dict(address='0x5c73d0',slots=slots),
    sourceCallPath=['4606d3→gbGeomNode.LoadFromFile(.pol before .cvd)',
        '44dd82 enabled+64→Push/MultMatrix(+78)→vslot24 45e9d2',
        '45e9d2 model+dc→vslot10→56f21e→gbGeomNode.Attach'],
    imports={hex(a):imports[a] for a in [0x5c09c8,0x5c09d8,0x5c09dc]},
    sources=[dict(start=hex(a),end=hex(b),instructions=[dict(address=hex(i.address),
        instruction=f'{i.mnemonic} {i.op_str}') for i in decoder.disasm(at(a,b-a),a)]) for a,b in ranges],
    placements=records, mesh=mesh['name'], fvf=21,kind=0,
    expandedVertices=len(indices),nonwhiteDiffuseVertices=nonwhite,sourceUVAndPackedRGBAExact=True,
    shader='geom_c1.gbf',shaderContract=(source/'Data/gfxscript/geom_c1.gbf').read_text(),
    selectorEvidence='scene-terrain02-material-native.json FVF21/kind0→0x801; effect-attach-material-sol-native.json complete gbGeomNode Attach',
    currentPublishedMaterial=glb['materials'][primitive['material']],
    scope='Static General class/loader/render import identities and original asset inputs; existing selector/Attach evidence reused. No full General loader execution, new GPU draw or ordinary player pixels.')
(ROOT/'recovery/output/scene-general11-material-source.json').write_text(json.dumps(result,indent=2)+'\n')
print(f'PASS_STATIC_GENERAL_SOURCE_INPUTS_ONLY:23 General placements/{len(indices)} expanded vertices/{nonwhite} nonwhite')
