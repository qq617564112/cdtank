"""Execute original owned instance → pet/tank definition getters."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0x2000000,0x20000)
GLOBAL,RESOURCES,OWNED,SENTINEL,NODE,RECORD,TABLE,DEFINITION=[0x2001000+n*0x1000 for n in range(8)]
STACK,RETURN=0x2010000,0x2011000
calls=[]
def write(address,*values):uc.mem_write(address,struct.pack('<'+'I'*len(values),*[v&0xffffffff for v in values]))
def read(address):return struct.unpack('<I',uc.mem_read(address,4))[0]
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 if address==0x4501fa:
  assert machine.reg_read(UC_X86_REG_ECX)==OWNED+4
  output,key=read(stack+4),read(stack+8);assert read(key)==instance
  write(output,NODE if owned_found else SENTINEL);value=output;pop=8
 else:
  assert machine.reg_read(UC_X86_REG_ECX)==TABLE+0xc
  key=read(stack+4);calls.append(key);assert key==table_id
  value=DEFINITION if table_found else 0;pop=4
 machine.reg_write(UC_X86_REG_EAX,value);machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for address in [0x4501fa,0x411068]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
write(0x633588,GLOBAL);write(GLOBAL+0x114,RESOURCES);write(OWNED+8,SENTINEL)
rows=[]
for kind,entry,offset,manager_offset,file in [('base',0x41e9f1,8,0x80,'role-pet-base-native.json'),('equipment',0x421f88,0x24,0x84,'role-tank-base-native.json')]:
 ids=[row['result']['id'] for row in json.loads((ROOT/'recovery/output'/file).read_text())['rows']]
 for table_id,instance,owned_found,record_present,manager_present,table_found in itertools.product(ids,[0,73,0x80000001,0xffffffff],[False,True],[False,True],[False,True],[False,True]):
  write(NODE+0x10,RECORD if record_present else 0);write(RECORD+offset,table_id)
  write(RESOURCES+manager_offset,TABLE if manager_present else 0)
  calls.clear();write(STACK,RETURN,instance)
  uc.reg_write(UC_X86_REG_ECX,OWNED);uc.reg_write(UC_X86_REG_ESP,STACK)
  uc.emu_start(entry,RETURN,count=1000)
  searched=owned_found and record_present and manager_present
  assert calls==([table_id] if searched else [])
  result=bool(uc.reg_read(UC_X86_REG_EAX));assert result==(searched and table_found)
  assert uc.reg_read(UC_X86_REG_ESP)==STACK+8
  rows.append(dict(kind=kind,tableId=table_id,instanceId=instance,ownedFound=owned_found,recordPresent=record_present,managerPresent=manager_present,tableFound=table_found,result=result,lookups=list(calls)))
(ROOT/'recovery/output/role-owned-definition-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,scope='Complete41e9f1/421f88 with actual413c83/413c95 getters; owned-map node search4501fa and table lookup411068 supplied. All10 pet/21 tank table IDs; no equip mutation or account selection business.'),indent=2)+'\n')
print(f'PASS: {len(rows)} original owned instance/pet/tank definition queries')
