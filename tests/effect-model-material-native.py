"""Execute original model shader parameter setup with explicit graphics state."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from pol import read_pol
from cvd import read_cvd
machine,_=map_original_binaries([ROOT/'CDTank'/name for name in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,4096);machine.mem_map(0x2000000,0x80000)
GFX,STACK_A,STACK_B,MATRIX_A,MATRIX_B,NODE,INFO,MATERIAL,EFFECT,VTABLE,STACK,STOP=[0x2010000+i*0x1000 for i in range(12)]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def put(a,*values):machine.mem_write(a,struct.pack('<'+'I'*len(values),*values))
def finish(pop=0):
 stack=machine.reg_read(UC_X86_REG_ESP);machine.reg_write(UC_X86_REG_EIP,uint(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
events=[]
def hook(uc,address,size,data):
 stack=uc.reg_read(UC_X86_REG_ESP)
 if address==0x100264d0:
  index,pointer=uint(stack+4),uint(stack+8)
  events.append(dict(kind='parameter',index=index,values=list(struct.unpack('<'+('16f' if index==0 else '4f'),machine.mem_read(pointer,64 if index==0 else 16)))))
  finish(8)
 elif address==0x10026780:uc.reg_write(UC_X86_REG_EAX,EFFECT);finish()
 elif address==STOP+16:events.append(dict(kind='commit'));finish(4)
machine.hook_add(UC_HOOK_CODE,hook)
identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
put(GFX+0xd4,STACK_A);put(GFX+0xd0,STACK_B)
put(STACK_A,MATRIX_A,1,0,0);put(STACK_B,MATRIX_B,1,0,0)
machine.mem_write(MATRIX_A,struct.pack('<16f',*identity));machine.mem_write(MATRIX_B,struct.pack('<16f',*identity))
put(INFO,NODE);put(INFO+0xc,EFFECT);put(EFFECT,VTABLE);put(VTABLE+0x104,STOP+16)
root=ROOT/'recovery/output/verified/assets/data'
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text());references={c['reference'].replace('\\','/').lower() for c in library['modelControls']};parts=[]
for path in root.rglob('*'):
 if path.relative_to(root).as_posix().lower() not in references:continue
 if path.suffix.lower()=='.pol':
  for mesh in read_pol(path)['meshes']:
   for part in mesh['parts']:parts.append(dict(reference=path.relative_to(root).as_posix(),properties=part['properties'],flags=(0x801 if mesh['fvf']&4 else 1)|(0x80 if part['kind']==1 else 0)))
 elif path.suffix.lower()=='.cvd':
  for node in read_cvd(path)['nodes']:
   for part in node.get('parts',[]):
    raw=bytes.fromhex(part['material']);properties=[]
    for off in range(0,16,4):
     b,g,r,a=raw[off:off+4];properties.extend([r/255,g/255,b/255,a/255])
    parts.append(dict(reference=path.relative_to(root).as_posix(),properties=properties+[struct.unpack('<f',raw[16:])[0]],flags=1|(0x80 if part['kind']==1 else 0)))
rows=[]
for part in parts:
 for ambient,emissive in [([.2,.2,.2,1],0),([.35,.6,.8,.5],1)]:
  for alpha in [1,.45,.75]:
   machine.mem_write(GFX+0x1a8,struct.pack('<5f',*ambient,emissive));machine.mem_write(MATERIAL,struct.pack('<17f',*part['properties']))
   machine.mem_write(NODE+0x4c,struct.pack('<fI',alpha,int(alpha<1)))
   flags=part['flags']|(0x80 if alpha<1 else 0);put(INFO+0x1c,flags)
   put(STACK,STOP,INFO,GFX,MATERIAL);machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,0);machine.reg_write(UC_X86_REG_FPCW,0x27f)
   events.clear();machine.emu_start(0x1001b6f0,STOP,count=100000)
   assert machine.reg_read(UC_X86_REG_ESP)==STACK+4
   rows.append({**part,'flags':flags,'ambient':ambient,'emissive':emissive,'alpha':alpha,'events':list(events)})
(ROOT/'recovery/output/effect-model-material-native.json').write_text(json.dumps(dict(rows=rows))+'\n')
print(f'PASS: {len(rows)} complete original model shader parameter calls / {len(parts)} source material sections')
