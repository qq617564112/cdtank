"""Full original4661c9 rewrites every03/attack1 effect name."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0x2000000,0x30000)
ROLE,GROUP,RECORDS,STACK,RETURN,IDENTIFIER=[0x2001000+i*0x1000 for i in range(6)]
def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def string(a):return bytes(uc.mem_read(a,256)).split(b'\0')[0].decode()
write(0x5c0954,IDENTIFIER)
events=[];has_action=True;has_event=True;effect_name=''
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP);pop=0;value=0
 if address==IDENTIFIER:
  name=string(read(stack+4));events.append(dict(kind='identifier',name=name));value=73 if name=='03' else 99;pop=4
 elif address==0x57c0d6:
  dest,length,format_address,bits=[read(stack+i) for i in [4,8,12,16]]
  assert length==256 and string(format_address)=='_root\\online\\%.3d'
  signed=bits if bits<0x80000000 else bits-0x100000000
  name='_root\\online\\'+('-' if signed<0 else '')+str(abs(signed)).zfill(3)
  machine.mem_write(dest,name.encode()+b'\0');value=len(name)
 elif address==0x47bf33:
  assert machine.reg_read(UC_X86_REG_ECX)==ROLE+0x1f0 and read(stack+4)==73
  events.append(dict(kind='action',key=73));write(read(stack+8),GROUP);value=int(has_action);pop=8
 else:
  assert read(stack+4)==GROUP and string(read(stack+8))=='attack1'
  events.append(dict(kind='event',name='attack1'));write(read(stack+12),GROUP+0x100);value=int(has_event);pop=12
 machine.reg_write(UC_X86_REG_EAX,value);machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for a in [IDENTIFIER,0x57c0d6,0x47bf33,0x47c056]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
rows=[]
for has_action in [False,True]:
 for has_event in [False,True]:
  for count in [0,1,3]:
   for value in [0,1,7,2001,0x7fffffff,0x80000000,0xffffffff]:
    write(GROUP+0x104,RECORDS,RECORDS+count*0x294)
    uc.mem_write(RECORDS,b'\xaa'*(3*0x294));events.clear()
    write(STACK,RETURN,value);uc.reg_write(UC_X86_REG_ECX,ROLE);uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.emu_start(0x4661c9,RETURN,count=10000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+8
    signed=value if value<0x80000000 else value-0x100000000
    effect_name='_root\\online\\'+('-' if signed<0 else '')+str(abs(signed)).zfill(3)
    written=[read(RECORDS+i*0x294) for i in range(3)]
    expected=[99 if has_action and has_event and i<count else 0xaaaaaaaa for i in range(3)]
    assert written==expected
    for i in range(3):assert bytes(uc.mem_read(RECORDS+i*0x294+4,0x290))==b'\xaa'*0x290
    rows.append(dict(action=has_action,event=has_event,count=count,value=value,name=effect_name,written=written,events=list(events)))
(ROOT/'recovery/output/role-ammo-visual-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,
 scope='Full4661c9, actual464c05 vector count and record-stride writes. Action/event lookups, identifier interning and CRT snprintf supplied; original virtual+a4 maps to4661c9 in both3/4-part vtables. No asset availability or original rendering asserted.'),indent=2)+'\n')
print(f'PASS: {len(rows)} full ammo visual overrides,03/attack1 lookup, all-record writes and signed minimum3-digit paths')
