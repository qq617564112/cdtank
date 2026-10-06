"""Execute complete421ca9/421cbe dynamic part capacity with supplied skill lookup."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);uc.mem_map(0x2000000,0x20000)
TANK,GEAR,TABLE,SKILL,STACK,RETURN=[0x2001000+i*0x1000 for i in range(6)]
lookups=[];bonus={}
def write(address,*values):uc.mem_write(address,struct.pack('<'+'I'*len(values),*[v&0xffffffff for v in values]))
def read(address):return struct.unpack('<I',uc.mem_read(address,4))[0]
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP);pop=0
 if address==0x413c65:value=TABLE
 else:
  assert machine.reg_read(UC_X86_REG_ECX)==TABLE+0xc
  key=read(stack+4);lookups.append(key);pop=4
  if key in bonus:write(SKILL+0x138,bonus[key]);value=SKILL
  else:value=0
 machine.reg_write(UC_X86_REG_EAX,value);machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for address in [0x413c65,0x411068]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
rows=[]
for flags,capacity,gear_present,scenario in itertools.product(range(8),[0,1,3,8,0x80000000,0xffffffff],[False,True],range(4)):
 parts=[7 if flags&(1<<i) else 0 for i in range(3)];write(TANK+0x58,*parts);write(TANK+0x6c,capacity)
 bases=[0,1,101,201,0x80000000,0xffffffff];ranks=[0,1,2,3,1,2]
 if scenario==3:bases=[101]*6;ranks=[1]*6
 write(GEAR+0x44,*bases);write(GEAR+0x5c,*ranks)
 keys=[(b+r-1)&0xffffffff for b,r in zip(bases,ranks)]
 bonus.clear()
 if scenario==1:bonus.update({key:i+1 for i,key in enumerate(keys)})
 if scenario==2:bonus.update({key:0xffffffff for key in keys[::2]})
 if scenario==3:bonus[101]=2
 lookups.clear();write(STACK,RETURN,GEAR if gear_present else 0);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,TANK)
 uc.emu_start(0x421cbe,RETURN,count=1000)
 result=uc.reg_read(UC_X86_REG_EAX);assert uc.reg_read(UC_X86_REG_ESP)==STACK+8
 expected=(capacity-sum(bool(x) for x in parts)+sum(bonus.get(key,0) for key in keys if gear_present))&0xffffffff
 assert result==expected and lookups==(keys if gear_present else [])
 rows.append(dict(parts=parts,capacity=capacity,gearPresent=gear_present,bases=bases,ranks=ranks,bonuses=list(bonus.items()),result=result,lookups=list(lookups)))
(ROOT/'recovery/output/role-equipment-slot-count-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,scope='Complete421cbe and actual421ca9;413c65/411068 skill lookup supplied. Includes missing definitions, absent gear, duplicate skills, uint32 overflow; no default capacity or World.'),indent=2)+'\n')
print(f'PASS: {len(rows)} native dynamic equipment slot counts and lookup order')
