"""Original full4236ac equipment errors and profile array getter/setter dispatch."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0x2000000,0x30000)
GAME, OWNER, MESSAGE, INVENTORY, ITEM, VECTOR, CALLBACK_OBJECT, CALLBACK_TABLE, PROFILE, ARRAY = [0x2001000+i*0x1000 for i in range(10)]
STACK, RETURN, CALLBACK = 0x2020000,0x2021000,0x2022000

def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
notifications=[];diagnostics=[]
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 if address==CALLBACK:
  notifications.append(read(stack+4));pop=4
 else:
  text=bytes(machine.mem_read(read(stack+20),80)).split(b'\0')[0].decode()
  assert text=='Equip Slot Limit';diagnostics.append(text);pop=0
 machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for address in [CALLBACK,0x40bd28]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
write(0x633588,GAME);write(GAME+0x120,INVENTORY)
write(CALLBACK_OBJECT,CALLBACK_TABLE);write(CALLBACK_TABLE+8,CALLBACK)
write(INVENTORY+0x60,VECTOR,VECTOR+4);write(VECTOR,ITEM)
rows=[]
for table in [1,10001,13001,14001,15001,16001,17001,0xffffffff]:
 for result in [0,1,2,3,255]:
  for callback in [False,True]:
   write(OWNER+0xe8,CALLBACK_OBJECT if callback else 0)
   write(ITEM+4,71);write(ITEM+0xc,table)
   write(MESSAGE+0xc,71,0xf1234567,result)
   before=[bytes(uc.mem_read(a,0x100)) for a in [OWNER,ITEM,MESSAGE]]
   notifications.clear();diagnostics.clear()
   write(STACK,RETURN,MESSAGE,0,0);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OWNER)
   uc.emu_start(0x4236ac,RETURN,count=1000)
   assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+16
   assert before==[bytes(uc.mem_read(a,0x100)) for a in [OWNER,ITEM,MESSAGE]]
   rows.append(dict(itemTableId=table,result=result,callback=callback,notifications=list(notifications),diagnostics=list(diagnostics)))
arrays=[]
for seed in range(16):
 before=bytes((i*7+seed)&255 for i in range(0x170));uc.mem_write(PROFILE,before);write(PROFILE,0x5c4118)
 values=[(seed*0x1000000+i*0xf1234567)&0xffffffff for i in range(5)];write(ARRAY,*values)
 write(STACK,RETURN,2);uc.reg_write(UC_X86_REG_ECX,PROFILE);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(read(0x5c4118+0x20),RETURN,count=100)
 assert uc.reg_read(UC_X86_REG_EAX)==PROFILE+0x148
 old=list(struct.unpack('<5I',uc.mem_read(PROFILE+0x148,20)))
 original=bytes(uc.mem_read(PROFILE,0x170))
 write(STACK,RETURN,2,ARRAY);uc.reg_write(UC_X86_REG_ECX,PROFILE);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(read(0x5c4118+0x38),RETURN,count=1000)
 assert uc.reg_read(UC_X86_REG_ESP)==STACK+12 and (uc.reg_read(UC_X86_REG_EAX)&255)==1
 after=bytes(uc.mem_read(PROFILE,0x170));expected=bytearray(original);struct.pack_into('<5I',expected,0x148,*values)
 assert after==expected
 arrays.append(dict(before=list(original),old=old,values=values,after=list(after)))
(ROOT/'recovery/output/role-equipment-error-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,arrays=arrays,
 scope='Full4236ac, real43cd38 inventory vector lookup/43bd13/439762 classifier. Callback/log supplied. All source bytes unchanged. Real profile virtual getter42fe3f and setter42fe47 dispatch to4208b7/420916 selector2. No success/ownership server rule inferred.'),indent=2)+'\n')
print(f'PASS: {len(rows)} equipment error replies and {len(arrays)} full profile part array getters/setters')
