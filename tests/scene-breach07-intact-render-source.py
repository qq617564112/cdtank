"""Record original Breach intact plant-node render inputs for legal map7."""
import json
from pathlib import Path
import struct
import sys
import capstone
import pefile
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from scene import read_scene
from pol import read_pol
base = ROOT / 'recovery/output/verified/assets/data'
exe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
dll = pefile.PE(str(ROOT / 'CDTank/gbengine.dll'))
cs = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
def data(pe, address, count):
    offset = address - pe.OPTIONAL_HEADER.ImageBase
    return pe.get_memory_mapped_image()[offset:offset + count]
def instructions(pe, start, end):
    return [{'address': hex(i.address), 'instruction': f'{i.mnemonic} {i.op_str}'}
            for i in cs.disasm(data(pe, start, end-start), start)]
imports = {i.address: i.name.decode() for e in exe.DIRECTORY_ENTRY_IMPORT for i in e.imports if i.name}
exports = {e.name.decode(): dll.OPTIONAL_HEADER.ImageBase + e.address
           for e in dll.DIRECTORY_ENTRY_EXPORT.symbols if e.name}
assert struct.unpack('<I', data(exe, 0x5c7450+0x1c, 4))[0] == 0x45ee7f
assert struct.unpack('<I', data(exe, 0x5c7450+0x34, 4))[0] == 0x4610f1
assert 'gbPlantNode' in imports[0x5c0a5c]
assert 'GetTop@gbMatrixStack' in imports[0x5c09ec]
assert exports['?SetRotationY@gbPlantNode@@QAEX_N@Z'] == 0x10018040
assert exports['?SetViewPosition@gbPlantNode@@QAEXABUgbMatrix4@@ABUgbVec3D@@@Z'] == 0x10018050
assert exports['?Attach@gbPlantNode@@UAEHPAVgbRenderEffect@@@Z'] == 0x10019510
records = [r for r in read_scene(base/'Data/scn/0007/0007.obj')
           if r['className'] == 'SYcScnObjBreach' and r['model'] == 'obj05462']
assert len(records) == 3
model = read_pol(base/'Data/scnobj/obj05462/obj05462.POL')
prior = json.loads((ROOT/'recovery/output/scene-breach20-05462-native.json').read_text())
assert prior['status'] == 'PASS'
result = {
 'status': 'SOURCE_INTACT_PLANT_RENDER_INPUTS_ONLY', 'mapId': 7, 'model': 'obj05462',
 'placements': records, 'originalLoaderEvidence': 'scene-breach20-05462-native.json',
 'loader': prior['loader'],
 'imports': {hex(a): imports[a] for a in [0x5c0a58,0x5c0a5c,0x5c0a68,0x5c09bc,0x5c09ec]},
 'sources': [dict(start=hex(a),end=hex(b),instructions=instructions(pe,a,b)) for pe,a,b in [
  (exe,0x4611ec,0x461209),(exe,0x461329,0x46134e),(exe,0x45ee7f,0x45ef0b),
  (dll,0x10018040,0x1001804d),(dll,0x10018050,0x10018085),
  (dll,0x1002f4f0,0x1002f503),(dll,0x10019579,0x100195a9),
  (dll,0x100313c0,0x100313e8),(dll,0x10019666,0x100196c8),(dll,0x100197f0,0x1001985f)]],
 'contract': {
  'intactNode': 'gbPlantNode object+dc, selected object+e4',
  'rotationY': '461201 pushes1 to SetRotationY; 10018040 writes node+100',
  'parentInput': '45eebd GetTop(matrixStack) before object+78 MultMatrix; this is the current stack top, not a named camera-view getter',
  'position': '45eec3..45eed2 dereference object+78 matrix translation (+30/+34/+38)',
  'retain': '10018050 copies16 floats to node+104 and position to +144/+148/+14c',
  'attach': 'rotationY true replaces current matrix-stack top with saved node+104 before submission',
  'shaderQualification': '10019666 branches render setting180/240/default and rotationY; not the static geom_c1 selector'},
 'geometry': [{'name':m['name'],'fvf':m['fvf'],'sourceVertices':len(m['vertices']),
   'kinds':[p['kind'] for p in m['parts']]} for m in model['meshes']],
 'rotationShader': (base/'Data/gfxscript/rotationy80.gbf').read_text(),
 'parameterProducer': '461329 loads object+6c yaw, multiplies f32 radians-per-degree at5c73c0 and calls SetParameter10018090; this is fixed source yaw, not time-driven animation',
 'radiansPerDegree': struct.unpack('<f', data(exe,0x5c73c0,4))[0],
 'parameterSubmission': '10019801..10019857 submits saved position xyz and node+150 as w',
 'missing': ['Exact effect flag to rotationy shader registration and ambient material provider qualification remain required before production material behavior'],
 'scope': 'Named original setters/render branch only; no new loader/native execution, shader qualification, ordinary player output or production hook.'}
(ROOT/'recovery/output/scene-breach07-intact-render-source.json').write_text(json.dumps(result,indent=2)+'\n')
print('SOURCE_INTACT_PLANT_RENDER_INPUTS_ONLY: map7 obj05462 uses gbPlantNode rotationY/current stack input; static geom_c1 qualification withheld')
