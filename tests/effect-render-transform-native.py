"""Original DLL matrix stack for all source sprite/strip controller orientations."""
import json, struct, sys
from pathlib import Path
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll'])
machine.mem_map(0,4096); machine.mem_map(0x2000000,0x20000)
OBJECT,MATRIX,VECTOR,STACK,STOP=0x2010000,0x2011000,0x2012000,0x2008000,0x201f000
identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
parents=[None,[0,0,-1,0,0,1,0,0,1,0,0,0,100,20,300,1]]
machine.mem_write(OBJECT,struct.pack('<4I',MATRIX,1,0,0))
def call(address,args):
 machine.mem_write(STACK,struct.pack('<I',STOP)+args)
 machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,OBJECT)
 machine.reg_write(UC_X86_REG_FPCW,0x27f);machine.emu_start(address,STOP,count=10000)
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text());rows=[]
for kind in ['spriteControls','stripControls']:
 for control in library[kind]:
  angles=control['appearance']['angles'] if kind=='spriteControls' else control['angles']
  scale=control['appearance']['scale'] if kind=='spriteControls' else control['scale']
  for parent in parents:
   position=control['motion']['position'];orbit=[2,3,4]
   machine.mem_write(MATRIX,struct.pack('<16f',*(parent or identity)))
   machine.mem_write(VECTOR,struct.pack('<3f',*(a+b for a,b in zip(position,orbit))))
   call(0x10031420,struct.pack('<I',VECTOR))
   for axis in range(3):
    machine.mem_write(VECTOR,struct.pack('<3f',*(int(axis==n) for n in range(3))))
    call(0x10032410,struct.pack('<fI',angles[axis],VECTOR))
   machine.mem_write(VECTOR,struct.pack('<3f',*scale));call(0x10031490,struct.pack('<I',VECTOR))
   rows.append(dict(node=control['node'],position=position,orbit=orbit,angles=angles,scale=scale,parent=parent,matrix=list(struct.unpack('<16f',machine.mem_read(MATRIX,64)))))
(ROOT/'recovery/output/effect-render-transform-native.json').write_text(json.dumps(rows)+'\n')
print(f'PASS: original matrix stack / {len(rows)} source orientations')
