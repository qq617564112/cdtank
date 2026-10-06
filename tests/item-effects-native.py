"""Original439c06 loop: all item effect/tag/method/sound column assignments."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_EBP,UC_X86_REG_EBX,UC_X86_REG_ECX,UC_X86_REG_EDI,UC_X86_REG_EIP,UC_X86_REG_ESI,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe']);uc.mem_map(0x2000000,0x10000)
RECORD,FRAME,STACK,VALUE=0x2001000,0x2002000,0x2003000,0x2004000
columns=[];sounds=[];values={}
table=read_table(ROOT/'CDTank/Data/table/item.dat')
def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 if address==0x4391c4:
  column,mode=read(stack+4),read(stack+8);columns.append(column)
  value=values[table['columns'][column]]
  if mode==0:write(VALUE,int(value))
  else:
   assert mode==5
   machine.mem_write(VALUE,value.encode()+b'\0')
  result=VALUE;pop=8
 else:
  text=bytes(machine.mem_read(read(stack+4),64)).split(b'\0')[0].decode()
  sounds.append(text);result=machine.reg_read(UC_X86_REG_ECX);pop=4
 machine.reg_write(UC_X86_REG_EAX,result);machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for a in [0x4391c4,0x401609]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
rows=[]
for row in table['rows']:
 values=row['values'];columns.clear();sounds.clear()
 uc.mem_write(RECORD,b'\xaa'*0x114);write(FRAME-4,RECORD+0x98);write(FRAME-8,3);write(FRAME+8,RECORD+0x80)
 for reg,value in [(UC_X86_REG_ESI,RECORD),(UC_X86_REG_EDI,8),(UC_X86_REG_EBX,0),(UC_X86_REG_EBP,FRAME),(UC_X86_REG_ESP,STACK)]:uc.reg_write(reg,value)
 uc.emu_start(0x439c06,0x439c5c,count=1000)
 assert uc.reg_read(UC_X86_REG_EIP)==0x439c5c and uc.reg_read(UC_X86_REG_ESP)==STACK
 assert columns==list(range(8,20))
 effects=[]
 for i in range(3):
  effect=dict(effectId=read(RECORD+0x74+i*4),tag=read(RECORD+0x80+i*4),method=read(RECORD+0x8c+i*4),sound=sounds[i])
  expected=dict(effectId=int(values[f'Effect{i+1}'])&0xffffffff,tag=int(values[f'EffectTag{i+1}'])&0xffffffff,method=int(values[f'EffectMethod{i+1}'])&0xffffffff,sound=values[f'Sound{i+1}'])
  assert effect==expected;effects.append(effect)
 rows.append(dict(itemTableId=int(values['ItemTableID']),effects=effects))
(ROOT/'recovery/output/item-effects-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,
 scope='Actual439c06–439c5a three-slot loop for all204 original item rows; column source4391c4 and sound string-assignment boundary supplied. Exact effect/tag/method assignments execute; full loader/resource initialization and sounds not emulated.'),indent=2)+'\n')
print(f'PASS: {len(rows)} item rows, all612 original effect/tag/method/sound loading slots; record+74=Effect1')
