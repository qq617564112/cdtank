"""Execute original tank UI selection tail and complete3ab4 request emission/writer."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_EBP,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESI,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);uc.mem_map(0,4096);uc.mem_map(0x2000000,0x20000)
GAME,OWNER,ROLE,VTABLE,UI,SELECTED,OTHER=[0x2001000+i*0x1000 for i in range(7)]
STACK,RETURN,GET_CURRENT=[0x2010000+i*0x1000 for i in range(3)]
current=0;sent=[];wire=[]
def write(address,*values):uc.mem_write(address,struct.pack('<'+'I'*len(values),*[v&0xffffffff for v in values]))
def read(address):return struct.unpack('<I',uc.mem_read(address,4))[0]
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP);pop=0
 if address==0x4269c4:
  assert machine.reg_read(UC_X86_REG_ECX)==OWNER
  value=ROLE
 elif address==GET_CURRENT:value=current
 elif address==0x413ec4:
  assert machine.reg_read(UC_X86_REG_ECX)==GAME
  packet=read(stack+4);assert read(packet)==0x5c32e0
  sent.append(read(packet+0xc));value=1;pop=4
 else:
  assert read(stack+8)==32
  wire.append(read(read(stack+4)));value=1;pop=8
 machine.reg_write(UC_X86_REG_EAX,value);machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for address in [0x4269c4,GET_CURRENT,0x413ec4,0x401c7a]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
write(0x633588,GAME);write(GAME+0x118,OWNER);write(ROLE,VTABLE);write(VTABLE+0x40,GET_CURRENT);write(UI+0x20,SELECTED)
rows=[]
for instance,case in itertools.product([0,73,0x80000001,0xffffffff],range(4)):
 write(SELECTED+0x1c,instance);write(OTHER+0x1c,instance if case==2 else 19)
 current=[0,SELECTED,OTHER,OTHER][case];sent.clear();wire.clear()
 before=bytes(uc.mem_read(SELECTED,0x70));write(STACK,RETURN);write(0,0x12345678)
 uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_EBP,0x1234);uc.reg_write(UC_X86_REG_ESI,UI)
 uc.emu_start(0x4e63a0,0x4e63d1,count=5000)
 assert uc.reg_read(UC_X86_REG_EIP)==0x4e63d1 and uc.reg_read(UC_X86_REG_ESP)==STACK
 assert sent==([] if case==1 else [instance]) and bytes(uc.mem_read(SELECTED,0x70))==before
 assert read(0)==0x12345678
 # Full type getter and writer42571f reused by this packet vtable.
 packet=UI+0x100;write(packet+0xc,instance);write(STACK,RETURN);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(0x424a5b,RETURN,count=20);assert uc.reg_read(UC_X86_REG_EAX)==0x3ab4
 write(STACK,RETURN,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,packet)
 uc.emu_start(0x42571f,RETURN,count=100);assert wire==[instance]
 rows.append(dict(instanceId=instance,sameRecord=case==1,sameInstanceDifferentRecord=case==2,sent=list(sent),wire=list(wire)))
(ROOT/'recovery/output/role-tank-selection-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,scope='UI4e63a0–4e63d1 tail after widget event validation; complete4265e5, real425bde/425c11 constructor/destructor, type424a5b and writer42571f. Current role/getter, transport and bitstream sink supplied. No server-selected mutation or preceding UI event parsing.'),indent=2)+'\n')
print(f'PASS: {len(rows)} original tank selection UI tail and complete3ab4 request/writer')
