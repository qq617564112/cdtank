"""Original MyTank update slice, full472e01 dispatch and4572aa angle accumulation."""
import json, struct, sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESI, UC_X86_REG_ESP, UC_X86_REG_EIP
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);uc.mem_map(0,4096);uc.mem_map(0x2000000,0x10000)
PAGE,PREVIEW,ENGINE,TABLE,CAMERA,STACK,RETURN= [0x2001000+i*0x1000 for i in range(7)]
def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def floats(a,*v):uc.mem_write(a,struct.pack('<'+'f'*len(v),*v))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def finish(value=0):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,read(s));uc.reg_write(UC_X86_REG_ESP,s+4)
def hook(machine,address,size,data):
 assert machine.reg_read(UC_X86_REG_ECX)==ENGINE
 finish(CAMERA)
write(0x635830,ENGINE);write(ENGINE,TABLE);write(TABLE+0x28,RETURN+0x100)
uc.hook_add(UC_HOOK_CODE,hook,begin=RETURN+0x100,end=RETURN+0x100)
rows=[]
for initial in [(0,0,0),(1,-1,2),(100,200,300),(-3.14,6.28,-9.42)]:
 for frame in range(16):
  uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);uc.mem_map(0,4096);uc.mem_map(0x2000000,0x10000)
  write(0x635830,ENGINE);write(ENGINE,TABLE);write(TABLE+0x28,RETURN+0x100)
  uc.hook_add(UC_HOOK_CODE,hook,begin=RETURN+0x100,end=RETURN+0x100)
  write(0,0);write(PAGE+0x68,PREVIEW);write(STACK,RETURN)
  uc.reg_write(UC_X86_REG_ESI,PAGE);uc.reg_write(UC_X86_REG_ESP,STACK)
  uc.emu_start(0x4e5e22,0x4572aa,count=1000)
  assert uc.reg_read(UC_X86_REG_ECX)==CAMERA+0xd4, (frame,hex(uc.reg_read(UC_X86_REG_ECX)),hex(uc.reg_read(UC_X86_REG_EIP)))
  delta=list(struct.unpack('<2f',uc.mem_read(uc.reg_read(UC_X86_REG_ESP)+4,8)))
  assert delta==[0.0,struct.unpack('<f',struct.pack('<f',.0075))[0]]
  values=initial if frame==0 else rows[-1]['after']
  for off,value in zip([8,12,16],values):floats(CAMERA+0xd4+off,value)
  before=[struct.unpack('<f',uc.mem_read(CAMERA+0xd4+off,4))[0] for off in [8,12,16]]
  uc.emu_start(0x4572aa,0x4572de,count=1000)
  after=[struct.unpack('<f',uc.mem_read(CAMERA+0xd4+off,4))[0] for off in [8,12,16]]
  rows.append(dict(before=before,delta=delta,after=after))
(ROOT/'recovery/output/home-preview-orbit-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,
 scope='Actual MyTank update4e5e22..4e5e3a and full472e01 through its4572aa call. Engine camera getter supplied; native4572aa prefix through4572de executes all angle additions. Matrix/look-at suffix and initial projection/lighting not executed.'),indent=2)+'\n')
print('PASS: 64 original home preview update calls and float32 angle accumulations')
