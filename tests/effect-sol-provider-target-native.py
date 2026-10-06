"""Original bolt target observer binding and provider-position endpoint resolution."""
import json
from pathlib import Path
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine,_=map_original_binaries([ROOT/'CDTank'/n for n in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,4096);machine.mem_map(0x2000000,0x100000)
OBJECT,DEFINITION,RESOURCE,SEGMENTS,WORLD=0x2010000,0x2011000,0x2015000,0x2020000,0x2030000
TARGET_A,TARGET_B,VTABLE,GET_POSITION,PARENT=0x2040000,0x2041000,0x2042000,0x2043000,0x2044000
STACK,STOP=0x2008000,0x203f000
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
random_values=[];random_index=0;alloc=0x2050000;position_calls=[]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def write(a,v):machine.mem_write(a,struct.pack('<I',v))
def hook(uc,a,size,data):
 global random_index,alloc
 stack=uc.reg_read(UC_X86_REG_ESP)
 if a==0x57cbcb:
  value=[8191,24575,16383,1000][random_index%4];random_index+=1;random_values.append(value)
 elif a==GET_POSITION:
  target=uc.reg_read(UC_X86_REG_ECX);position_calls.append(target);value=target+0x18
 elif a in [0x578620,0x57a6c7]:
  if a==0x578620:value=alloc;alloc+=0x100
  else:value=0
 else:return
 uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4)
machine.hook_add(UC_HOOK_CODE,hook)
write(VTABLE+0x1c,GET_POSITION)
def call(address,obj,args=b''):
 machine.mem_write(STACK,struct.pack('<I',STOP)+args);machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,obj);machine.reg_write(UC_X86_REG_FPCW,0x27f)
 machine.emu_start(address,STOP,count=1000000)
 assert machine.reg_read(UC_X86_REG_ESP)==STACK+4+len(args)
def setup_target(target):
 machine.mem_write(target,bytes(0x100));write(target,VTABLE)
 sentinel=target+0x100
 machine.mem_write(sentinel,struct.pack('<3I',sentinel,sentinel,0))
 write(target+0x3c,sentinel);write(target+0x40,0)
 machine.mem_write(target+0x18,struct.pack('<3f',15,-2,31))
def observers(target):
 sentinel=uint(target+0x3c);item=uint(sentinel);result=[]
 while item!=sentinel:
  result.append(uint(item+8));item=uint(item)
 return result
identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
rotated=[0,1,0,0,-1,0,0,0,0,0,1,0,12.5,-3.75,21,1]
rows=[]
for node_index in [131,606,1941]:
 node=library['nodes'][node_index];config=next(c for c in library['boltControls'] if c['node']==node_index)
 for parent in [None,identity,rotated,[0]*16]:
  machine.mem_write(OBJECT,bytes(0x100));machine.mem_write(DEFINITION,bytes(0x180));machine.mem_write(RESOURCE,bytes(0x200))
  write(OBJECT+12,DEFINITION);write(DEFINITION+0x150,RESOURCE);write(OBJECT+0x70,SEGMENTS);write(OBJECT+0x80,WORLD)
  machine.mem_write(RESOURCE+0x148,bytes.fromhex(node['resource'])[324:]);machine.mem_write(OBJECT+0x14,struct.pack('<3f',8,-4,11))
  if parent:write(OBJECT+0x20,PARENT);machine.mem_write(PARENT,struct.pack('<16f',*parent))
  setup_target(TARGET_A);setup_target(TARGET_B)
  call(0x47431c,OBJECT+0x58,struct.pack('<I',0))
  random_index=0;operations=[]
  actions=[('bind','a'),('draw','a'),('move','a'),('draw','a'),('bind','b'),('draw','b'),('invalidate','a'),('draw','b'),('invalidate','b'),('draw',None),('bind','a'),('draw','a'),('bind',None),('draw',None)]
  for kind,name in actions:
   target=TARGET_A if name=='a' else TARGET_B if name=='b' else 0
   random_values.clear();position_calls.clear()
   if kind=='bind':call(0x47d3eb,OBJECT,struct.pack('<I',target))
   elif kind=='move':machine.mem_write(target+0x18,struct.pack('<3f',-6,12,44))
   elif kind=='invalidate':
    call(0x44d8e8,target+0x34)
    # The destroyed provider slot is a fresh object before later explicit rebinding.
   else:call(0x47e161,OBJECT)
   count=uint(OBJECT+0x68)
   operations.append(dict(kind=kind,target=name,bound='a' if uint(OBJECT+0x5c)==TARGET_A else 'b' if uint(OBJECT+0x5c)==TARGET_B else None,
    observersA=len(observers(TARGET_A)) if kind!='invalidate' or name!='a' else 0,
    observersB=len(observers(TARGET_B)) if kind!='invalidate' or name!='b' else 0,
    positionCalls=['a' if p==TARGET_A else 'b' for p in position_calls],randomValues=list(random_values),
    state=dict(start=list(struct.unpack('<3f',machine.mem_read(OBJECT+0x40,12))),end=list(struct.unpack('<3f',machine.mem_read(OBJECT+0x4c,12))),
    segments=[list(struct.unpack('<3f',machine.mem_read(SEGMENTS+i*12,12))) for i in range(count)],
    worldSegments=[list(struct.unpack('<10f',machine.mem_read(WORLD+i*40,40))) for i in range(count)])))
   if kind=='invalidate':setup_target(target)
  rows.append(dict(node=node_index,config=config,parent=parent,origin=[8,-4,11],operations=operations))
instructions=[]
for address,length in [(0x474196,0x33),(0x474317,5),(0x47d3eb,0x1c),(0x47dadc,0xd5),(0x44d8e8,0x4d),(0x44ef01,5)]:
 instructions.extend(dict(address=hex(i.address),mnemonic=i.mnemonic,operands=i.op_str) for i in Cs(CS_ARCH_X86,CS_MODE_32).disasm(bytes(machine.mem_read(address,length)),address))
(ROOT/'recovery/output/effect-sol-provider-target-native.json').write_text(json.dumps(dict(rows=rows,instructions=instructions))+'\n')
print(f'PASS: {len(rows)} original target-provider sequences / {sum(len(r["operations"]) for r in rows)} bind/move/invalidate/draw operations')
