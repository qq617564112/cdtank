"""Execute original registration slices and3aac dispatch into actual page callbacks."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_EBP,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESI,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);uc.mem_map(0,4096);uc.mem_map(0x2000000,0x40000)
GAME,OWNER,UI,MESSAGE,CONTAINER,INVENTORY,OBJECT,VTABLE=[0x2001000+i*0x3000 for i in range(8)]
STACK,RETURN,DISPATCH,CONTROL=[0x2030000+i*0x1000 for i in range(4)]
callback=0;events=[];copies=[]
def write(address,*values):uc.mem_write(address,struct.pack('<'+'I'*len(values),*values))
def read(address):return struct.unpack('<I',uc.mem_read(address,4))[0]
def finish(value=0,pop=0):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,read(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
def hook(machine,address,size,data):
 s=machine.reg_read(UC_X86_REG_ESP)
 if address in [0x4e7cff,0x4dc7ff]:
  assert read(s+4)==UI and read(s+8)==callback
  finish(machine.reg_read(UC_X86_REG_ECX),8)
 elif address in [0x4e8c85,0x4dcf1b]:finish(OBJECT)
 elif address==0x423f79:
  assert machine.reg_read(UC_X86_REG_ECX)==MESSAGE+0xc and read(s+4)==CONTAINER+0x20
  copies.append('profile');finish(0,4)
 elif address==DISPATCH:
  events.append(dict(kind='dispatch',value=read(s+4)))
  # Execute actual page callback with original bool argument.
  machine.reg_write(UC_X86_REG_ECX,UI);machine.reg_write(UC_X86_REG_EIP,callback)
 elif address==CONTROL:
  events.append(dict(kind='control',control=machine.reg_read(UC_X86_REG_ECX),value=read(s+4)));finish(0,4)
 else:
  assert machine.reg_read(UC_X86_REG_ECX)==UI
  events.append(dict(kind='refresh',address=address));finish()
for address in [0x4e7cff,0x4dc7ff,0x4e8c85,0x4dcf1b,0x423f79,DISPATCH,CONTROL,0x4e6231,0x4e8d64,0x4ecc2b,0x4de25c,0x4dbeda,0x4dcfb0]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
write(0x633588,GAME);write(GAME+0x118,OWNER);write(GAME+0x134,OWNER);write(OWNER+0x40,CONTAINER)
write(GAME+0x120,INVENTORY)
for off in [0x2c,0x3c,0x5c]:write(INVENTORY+off,0,UI+0x200,UI+0x200)
write(OBJECT,VTABLE);write(VTABLE+8,DISPATCH);write(0x5c0260,CONTROL)
rows=[]
for kind,start,end,code,offset,callback in [('tank',0x4ed32e,0x4ed360,1,0xa8,0x4ed1ae),('pet',0x4de83f,0x4de86b,0,0xa4,0x4de785)]:
 write(STACK,RETURN);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_EBP,STACK+0x400);uc.reg_write(UC_X86_REG_ESI,UI)
 uc.emu_start(start,end,count=300);assert read(OWNER+offset)==OBJECT
 for value in [0,1,255]:
  events.clear();copies.clear();write(UI+0x50,5)
  for off in [0x110,0x10c,0xf4,0xf8]:write(UI+off,UI+off+0x1000)
  write(STACK,RETURN,value);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,UI)
  uc.emu_start(callback,RETURN,count=1000)
  assert len(events)==(5 if value else 0)
  rows.append(dict(kind=kind,code=code,offset=offset,value=value,events=list(events)))
 events.clear();copies.clear();write(MESSAGE+0x1010,code,0)
 write(STACK,RETURN,MESSAGE,0,0);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OWNER)
 uc.emu_start(0x42662d,RETURN,count=1000)
 assert copies==['profile'] and events[0]==dict(kind='dispatch',value=1) and len(events)==6
 rows.append(dict(kind=kind,code=code,offset=offset,events=list(events),copies=list(copies)))
(ROOT/'recovery/output/role-selection-callback-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,scope='Original page registration slices using real4917fa/491818, complete42662d and actual4ed1ae/4de785 callback bodies. Callback allocation/cloning supplied; profile copy independently verified, widget setters and refresh supplied. Proves code0 pet and code1 tank refresh binding, not original server acceptance rules.'),indent=2)+'\n')
print('PASS: original MyPet code0 and MyTank code1 registration, callbacks and3aac dispatch')
