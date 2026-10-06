"""Full426419 default-ammo request and actual64-bit codec; field10 uninitialized."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_EBP,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);uc.mem_map(0,4096);uc.mem_map(0x2000000,0x20000)
OWNER,ROLE,RECORD,GLOBAL,STACK,RETURN,STREAM,BUFFER,PACKET=[0x2001000+i*0x1000 for i in range(9)]
def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
events=[]
constructor_fields=[]
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP);packet=read(stack+4)
 assert machine.reg_read(UC_X86_REG_ECX)==GLOBAL and read(packet)==0x5c32a4
 events.append(dict(slot=read(packet+0xc),field10=read(packet+0x10)))
 machine.reg_write(UC_X86_REG_EAX,1);machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+8)
def constructor_hook(machine,address,size,data):
 constructor_fields.append(read(machine.reg_read(UC_X86_REG_ECX)+0x10))
uc.hook_add(UC_HOOK_CODE,constructor_hook,begin=0x42592c,end=0x42592c)
uc.hook_add(UC_HOOK_CODE,hook,begin=0x413e8c,end=0x413e8c)
write(0x633588,GLOBAL);write(ROLE,0x5c2c28);write(ROLE+0x2a0,RECORD)
rows=[]
for present in [False,True]:
 for status in [0,1,2,3]:
  for selection in [0,1,2,8,0xffffffff]:
   for seed in [0,0x11223344,0x80000000,0xffffffff]:
    write(OWNER+0x3c,ROLE if present else 0);write(RECORD+0x90,status);write(RECORD+0x3c,selection)
    before=bytes(uc.mem_read(RECORD,0x140));uc.mem_write(STACK-0x200,struct.pack('<I',seed)*0x80)
    write(STACK,RETURN,1);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_EBP,0x1234)
    events.clear();constructor_fields.clear();uc.emu_start(0x426419,RETURN,count=10000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+8
    assert uc.reg_read(UC_X86_REG_EBP)==0x1234
    assert bytes(uc.mem_read(RECORD,0x140))==before
    assert len(constructor_fields)==(1 if present and status==2 else 0)
    assert events==([dict(slot=1,field10=constructor_fields[0])] if constructor_fields else []), (present,status,selection,hex(seed),events)
    rows.append(dict(present=present,status=status,selection=selection,seed=seed,constructorFields=list(constructor_fields),events=list(events)))
# Execute real array getter, both inventory vectors and item classification.
INVENTORY,VECTOR,ITEM=0x200b000,0x200c000,0x200d000
write(GLOBAL+0x120,INVENTORY)
gates=[]
source_ids=[int(row['values']['ItemTableID']) for row in read_table(ROOT/'CDTank/Data/table/item.dat')['rows']]
def gate(slot,table_id,group,quantity,instance=0x80000001,duplicate_table=None):
 write(OWNER+0x3c,ROLE);write(RECORD+0x90,2);write(RECORD+0x3c,slot)
 uc.mem_write(RECORD+0x94,bytes(28))
 if 2<=slot<=8:write(RECORD+0x94+(slot-2)*4,instance)
 uc.mem_write(INVENTORY,bytes(0x100));write(VECTOR,ITEM)
 write(ITEM+4,instance);write(ITEM+0xc,table_id);write(ITEM+0x1c,quantity)
 if group is not None:write(INVENTORY+0x10+group*16,VECTOR,VECTOR+4)
 if duplicate_table is not None:
  write(VECTOR+4,ITEM+0x100);write(ITEM+0x104,instance);write(ITEM+0x10c,duplicate_table)
  write(INVENTORY+0x20,VECTOR+4,VECTOR+8)
 before_record=bytes(uc.mem_read(RECORD,0x140));before_item=bytes(uc.mem_read(ITEM,0x140))
 write(STACK,RETURN,slot);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_EBP,0x1234)
 events.clear();constructor_fields.clear();uc.emu_start(0x426419,RETURN,count=10000)
 assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+8
 assert bytes(uc.mem_read(RECORD,0x140))==before_record
 assert bytes(uc.mem_read(ITEM,0x140))==before_item
 expected=slot==1 or (2<=slot<=8 and group in [0,1] and 2001<=table_id<=3000)
 assert bool(events)==expected,(slot,table_id,group,quantity,events)
 if events:assert events==[dict(slot=slot,field10=constructor_fields[0])]
 gates.append(dict(slot=slot,tableId=table_id,group=group,quantity=quantity,instance=instance,
                   duplicateTable=duplicate_table,sent=bool(events)))
for table_id in source_ids:
 for slot in range(2,9):
  for group in [0,1,2]:
   gate(slot,table_id,group,0)
for slot in [1,2,8,9,0xffffffff,0x80000000]:
 for group in [None,0,1]:
  for instance in [0,73,0xffffffff]:gate(slot,2001,group,5,instance)
# Primary record wins even when a secondary duplicate would pass classification.
for slot in range(2,9):gate(slot,3001,0,9,73,2001)
wire=[]
for slot in [0,1,2,8,0xffffffff]:
 for field10 in [0,0x11223344,0x80000000,0xffffffff]:
  for offset in range(8):
   write(PACKET+0xc,slot,field10);uc.mem_write(BUFFER,bytes(32));write(STREAM,offset,0,BUFFER,32)
   write(STACK,RETURN,STREAM);uc.reg_write(UC_X86_REG_ECX,PACKET);uc.reg_write(UC_X86_REG_ESP,STACK)
   uc.emu_start(0x521a15,RETURN,count=10000)
   payload=bytes(uc.mem_read(BUFFER,(offset+64+7)//8));assert int.from_bytes(payload,'little')==((slot|(field10<<32))<<offset)
   uc.mem_write(PACKET+0xc,b'\xaa'*8);write(STREAM,offset,0,BUFFER,32)
   write(STACK,RETURN,STREAM);uc.reg_write(UC_X86_REG_ECX,PACKET);uc.reg_write(UC_X86_REG_ESP,STACK);uc.emu_start(0x42595f,RETURN,count=10000)
   assert bytes(uc.mem_read(PACKET+0xc,8))==struct.pack('<2I',slot,field10)
   wire.append(dict(slot=slot,field10=field10,offset=offset,payload=payload.hex()))
(ROOT/'recovery/output/role-ammo-request-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,gates=gates,wire=wire,
 scope='Full426419 defaultslot1 request, actual role status/getter,42592c constructor/destructor and413f6a transport selection; final413e8c send supplied. Full521a15/42595f codecs. Specialslots2..8 execute actual4327ac/43d186 vector lookup and43bd13/439762 classification across204 source items; missing/wrong vectors, zero quantities and duplicate precedence included. Constructor/caller preservepacket+10 at constructor entry (earlier prologue calls may overwrite initial stack seeds); no local record write or confirmation producer inferred.'),indent=2)+'\n')
print(f'PASS: {len(rows)} default-ammo requests, stackfield10/unchanged record, {len(wire)} original64-bit codecs; {len(gates)} full inventory/classification gates')
