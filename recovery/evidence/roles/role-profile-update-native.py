"""Execute complete3aac handler and profile wire readers with supplied string storage/UI."""
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
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x30000)
OWNER,CONTAINER,MESSAGE,GAME,INVENTORY,RECORDS,VECTORS,CALLBACK_OBJECT,CALLBACK_VTABLE=[0x2001000+i*0x2000 for i in range(9)]
PROFILE=CONTAINER+0x20
STACK,RETURN,CALLBACK=0x2024000,0x2025000,0x2026000
strings={};events=[]
def write(address,*values):uc.mem_write(address,struct.pack('<'+'I'*len(values),*[v&0xffffffff for v in values]))
def read(address):return struct.unpack('<I',uc.mem_read(address,4))[0]
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP);target=machine.reg_read(UC_X86_REG_ECX)
 if address==0x401609:strings[target]=bytearray();pop=4;value=target
 elif address==0x401f16:
  assert read(stack+8)==1
  strings[target].extend(machine.mem_read(read(stack+4),1));pop=8;value=target
 else:
  assert target==CALLBACK_OBJECT
  events.append(dict(value=read(stack+4),profile=list(uc.mem_read(PROFILE,0x170)),strings=[list(strings[PROFILE+0x20]),list(strings[PROFILE+0x3c])],states=[read(RECORDS+i*0x40+0x1c) for i in range(7)]));pop=4;value=0
 machine.reg_write(UC_X86_REG_EAX,value);machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for address in [0x401609,0x401f16,CALLBACK]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
write(0x633588,GAME);write(GAME+0x120,INVENTORY);write(OWNER+0x40,CONTAINER)
write(CALLBACK_OBJECT,CALLBACK_VTABLE);write(CALLBACK_VTABLE+8,CALLBACK)
# Seven original vector groups; pointers at10/20/30/40/60/70/80.
for index,offset in enumerate([0xc,0x1c,0x2c,0x3c,0x5c,0x6c,0x7c]):
 pointer=VECTORS+index*0x10;write(pointer,RECORDS+index*0x40)
 write(INVENTORY+offset,0,pointer,pointer+4)
numeric=[0x60,0x64,0x68,0x6c,0x70,0x74,0x3c,0x78,0x7c,0x80,0x84,0x88,0x8c,0x94,0x90,0x98,0x9c,0xa0,0xa4,0xa8,0xac,0xb8,0xbc,0xc0,0xc4,0xc8,0xcc,0xd0,0xd4,0xd8,0xdc,0xe0,0xe4]
numeric_tail=list(range(0xe8,0x148,4))
rows=[]
for alignment,names,seed in itertools.product(range(8),[(b'',b''),(b'Tank A',b'Pet B'),(bytes.fromhex('d5bd b3b5'),bytes.fromhex('b3e8 ceef'))],[0,37,0x80000001,0xffffffff]):
 values=[(seed+i*17)&0xffffffff for i in range(len(numeric)+len(numeric_tail)+2)]
 before=bytes((i*7+seed)&255 for i in range(0x170)); expected=bytearray(before)
 packed=0;cursor=alignment
 def emit(value,width):
  global packed,cursor
  packed|=(value&((1<<width)-1))<<cursor;cursor+=width
 def field(offset,value):
  emit(value,32);struct.pack_into('<I',expected,0x20+offset,value)
 field(0x60,values[0]);field(0x64,values[1])
 for name_index,offset in [(0,0),(1,0x1c)]:
  if name_index==1:
   emit(seed&1,1);expected[0x58]=seed&1
  name=names[name_index];emit(len(name),32)
  for byte in name:emit(byte,8)
 for index,offset in enumerate(numeric[2:],2):field(offset,values[index])
 flags=bytes((seed+i*11)&255 for i in range(32))
 for index,byte in enumerate(flags):emit(byte,8);expected[0x60+index]=byte
 for index,offset in enumerate(numeric_tail,len(numeric)):field(offset,values[index])
 for offset,value in zip([4,8],values[-2:]):emit(value,32);struct.pack_into('<I',expected,offset,value)
 raw=packed.to_bytes((cursor+7)//8,'little')
 # Direct42fd34 unaligned original bitstream read.
 uc.mem_write(PROFILE,before);write(PROFILE,0x5c4118);struct.pack_into('<I',expected,0,0x5c4118)
 uc.mem_write(MESSAGE+0xc,raw+bytes(3000-len(raw)))
 stream=VECTORS+0x200;write(stream,alignment,0,MESSAGE+0xc,3000)
 write(STACK,RETURN,stream);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,PROFILE)
 uc.emu_start(0x42fd34,RETURN,count=30000)
 assert read(stream)+read(stream+4)*8==cursor and bytes(uc.mem_read(PROFILE,0x170))==bytes(expected)
 assert [bytes(strings[PROFILE+0x20]),bytes(strings[PROFILE+0x3c])]==list(names)
 rows.append(dict(kind='reader',alignment=alignment,raw=list(raw),before=list(before),profile=list(expected),strings=[list(x) for x in names],endBit=cursor))
# Complete42662d including real423f79 ->42fd34 ->41fa67 at fixed byte-aligned payload.
reader=[row for row in rows if row['alignment']==0]
updates=[]
callback_offsets={0:0xa4,1:0xa8,2:0xb0,3:0xb4,4:0xac,5:0xbc,7:0xc0,8:0xb8}
for fixture,code,callback in itertools.product(reader,list(range(10))+[0xffffffff],[False,True]):
 before=bytes(fixture['before']);uc.mem_write(PROFILE,before);write(PROFILE,0x5c4118)
 strings[PROFILE+0x20]=bytearray(b'old0');strings[PROFILE+0x3c]=bytearray(b'old1')
 uc.mem_write(OWNER+0xa4,bytes(0x20))
 if callback and code in callback_offsets:write(OWNER+callback_offsets[code],CALLBACK_OBJECT)
 states=[0x80000001+i for i in range(7)]
 for i,state in enumerate(states):write(RECORDS+i*0x40+0x1c,state)
 raw=bytes(fixture['raw']);uc.mem_write(MESSAGE+0xc,raw+bytes(3000-len(raw)));write(MESSAGE+0x1010,code,0xf1234567)
 events.clear();write(STACK,RETURN,MESSAGE,0,0);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OWNER)
 uc.emu_start(0x42662d,RETURN,count=30000)
 assert uc.reg_read(UC_X86_REG_ESP)==STACK+16
 if code==1:
  for index in [2,3,4]:states[index]=0
 expected_profile=bytearray(before);struct.pack_into('<I',expected_profile,0,0x5c4118)
 if code!=3:expected_profile=bytearray(fixture['profile'])
 output=bytes(uc.mem_read(PROFILE,0x170));output_strings=[list(strings[PROFILE+0x20]),list(strings[PROFILE+0x3c])]
 assert output==bytes(expected_profile)
 assert [read(RECORDS+i*0x40+0x1c) for i in range(7)]==states
 assert len(events)==int(callback and code in callback_offsets)
 if events:
  assert events[0]==dict(value=0xf1234567 if code==3 else 1,profile=list(output),strings=output_strings,states=states)
 updates.append(dict(code=code,callback=callback,before=list(before),raw=fixture['raw'],profile=list(output),strings=output_strings,states=states,events=list(events)))
(ROOT/'recovery/output/role-profile-update-native.json').write_text(json.dumps(dict(status='PASS',readers=rows,updates=updates,scope='Complete42662d,423f79,42fd34,41fa67 and original numeric/bit/string wire reads; string storage and UIcallback supplied. All seven inventory groups populated; code1 clears only three actual vectors. No server-selected assembly or socket.'),indent=2)+'\n')
print(f'PASS: {len(rows)} complete profile wire reads and {len(updates)} complete3aac updates')
