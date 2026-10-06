"""Full455ef1 projection assembly and actual mode2 virtual455a42 binding."""
import json, struct, sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);uc.mem_map(0,4096);uc.mem_map(0x2000000,0x10000)
OWNER,CAMERA,PROJECTION,STACK,RETURN=[0x2001000+i*0x1000 for i in range(5)]
def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def f32(a,v):uc.mem_write(a,struct.pack('<f',v))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
constructor=[]
def hook(machine,address,size,data):
 s=machine.reg_read(UC_X86_REG_ESP)
 assert machine.reg_read(UC_X86_REG_ECX)==PROJECTION
 constructor.append([read(s+4),read(s+8)])
 machine.reg_write(UC_X86_REG_EIP,read(s));machine.reg_write(UC_X86_REG_ESP,s+12)
write(0x5c093c,RETURN+0x100)
uc.hook_add(UC_HOOK_CODE,hook,begin=RETURN+0x100,end=RETURN+0x100)
rows=[];switches=[]
for width,height in [(218,218),(392,392),(785,785),(800,600)]:
 for field98,field9c in [(0,.75),(1,0),(100,2),(0,1.5)]:
  uc.mem_write(CAMERA,bytes(0x180));write(CAMERA,0x5c6e20)
  f32(CAMERA+0x98,field98);f32(CAMERA+0x9c,field9c)
  write(OWNER+0x14,CAMERA);write(OWNER+0x1c,PROJECTION,width,height)
  uc.mem_write(PROJECTION,bytes([0xab])*32);constructor.clear()
  write(STACK,RETURN);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OWNER)
  uc.emu_start(0x455ef1,RETURN,count=1000)
  assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+4
  assert constructor==[[width,height]] and read(CAMERA+0x94)==PROJECTION
  near,far=struct.unpack('<2f',uc.mem_read(PROJECTION+0x10,8));assert (near,far)==(10,5000)
  rows.append(dict(width=width,height=height,field98=field98,field9c=field9c,near=near,far=far,
                   projectionFields=list(struct.unpack('<2f',uc.mem_read(PROJECTION,8)))))
  old=CAMERA+0x400;vector=OWNER+0x400
  write(CAMERA+0x90,2);write(old+0x90,0);f32(old+0x98,field98)
  for offset in [0x18,0x24,0x3c]:
   uc.mem_write(old+offset,struct.pack('<3f',width,offset,height))
  write(vector,old,CAMERA);write(OWNER+8,vector,vector+8);write(OWNER+0x14,old)
  write(STACK,RETURN,2);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OWNER)
  uc.emu_start(0x455f46,RETURN,count=1000)
  assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+8
  assert read(OWNER+0x14)==CAMERA
  for offset in [0x18,0x24,0x3c]:assert uc.mem_read(old+offset,12)==uc.mem_read(CAMERA+offset,12)
  assert read(old+0x98)==read(CAMERA+0x98)
  switches.append(dict(mode=2,copiedOffsets=[0x18,0x24,0x3c,0x98],width=width,height=height))
(ROOT/'recovery/output/home-preview-projection-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,switches=switches,
 scope='Complete mode switch455f46 including previous vectors18/24/3c and field98 copying, full455ef1 and original camera mode2 virtual+8 handler455a42 with empty observer vector. External projection construction supplied; near10/far5000 and actual camera binding/writes execute original code. Projection matrix, initial position and scene setup not reconstructed.'),indent=2)+'\n')
print('PASS: 16 native projection assemblies and mode2 camera bindings; near10/far5000')
