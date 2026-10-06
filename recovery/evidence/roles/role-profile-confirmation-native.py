"""Execute complete3ab7 confirmation and profile-copy functions; string storage supplied."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0x2000000,0x20000)
OWNER,CONTAINER,MESSAGE,CALLBACK_OBJECT,VTABLE=[0x2001000+i*0x1000 for i in range(5)]
PROFILE=CONTAINER+0x20
STACK,RETURN,CALLBACK=0x2010000,0x2011000,0x2012000
strings={};events=[]
def write(address,*values):uc.mem_write(address,struct.pack('<'+'I'*len(values),*[v&0xffffffff for v in values]))
def read(address):return struct.unpack('<I',uc.mem_read(address,4))[0]
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 if address==0x4014c9:
  target=machine.reg_read(UC_X86_REG_ECX);source=read(stack+4)
  assert read(stack+8)==0 and read(stack+12)==0xffffffff
  strings[target]=strings[source];pop=12;value=target
 else:
  assert machine.reg_read(UC_X86_REG_ECX)==CALLBACK_OBJECT
  events.append(dict(result=read(stack+4),profile=list(uc.mem_read(PROFILE,0x170)),strings=[strings[PROFILE+0x20],strings[PROFILE+0x3c]]));pop=4;value=0
 machine.reg_write(UC_X86_REG_EAX,value);machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for address in [0x4014c9,CALLBACK]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
write(OWNER+0x40,CONTAINER);write(CALLBACK_OBJECT,VTABLE);write(VTABLE+8,CALLBACK)
rows=[]
for result,callback,seed in itertools.product(range(6),[False,True],[0,37,128,255]):
 before=bytes((i*17+seed)&255 for i in range(0x170));source=bytes((i*31+seed+7)&255 for i in range(0x170))
 uc.mem_write(PROFILE,before);uc.mem_write(MESSAGE+0xc,source);write(MESSAGE+0x17c,result)
 write(OWNER+0x64,CALLBACK_OBJECT if callback else 0)
 for offset,index in [(0x20,0),(0x3c,1)]:strings[PROFILE+offset]=f'old{index}';strings[MESSAGE+0xc+offset]=f'new{seed}-{index}'
 events.clear();write(STACK,RETURN,MESSAGE,0,0)
 uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(0x4249b6,RETURN,count=2000)
 assert uc.reg_read(UC_X86_REG_ESP)==STACK+16
 assert bytes(uc.mem_read(MESSAGE+0xc,0x170))==source
 output=bytes(uc.mem_read(PROFILE,0x170));names=[strings[PROFILE+0x20],strings[PROFILE+0x3c]]
 expected=bytearray(before)
 if result==1:
  for start,length in [(4,12),(0x10,1),(0x14,12),(0x58,1),(0x5c,4),(0x60,0x108),(0x168,3),(0x16c,4)]:expected[start:start+length]=source[start:start+length]
 assert output==bytes(expected)
 assert names==([f'new{seed}-0',f'new{seed}-1'] if result==1 else ['old0','old1'])
 assert len(events)==int(callback)
 if callback:assert events[0]==dict(result=result,profile=list(output),strings=names)
 rows.append(dict(result=result,callback=callback,before=list(before),source=list(source),beforeStrings=['old0','old1'],sourceStrings=[f'new{seed}-0',f'new{seed}-1'],profile=list(output),strings=names,events=list(events)))
(ROOT/'recovery/output/role-profile-confirmation-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,scope='Complete4249b6,424908 and4209fb including copy order and success gate. String assignment4014c9 storage and UIcallback supplied. No request emission/account save/World assembly.'),indent=2)+'\n')
print(f'PASS: {len(rows)} native player profile confirmations, selective copy and callback timing')
