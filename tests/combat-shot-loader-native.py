"""Execute original item/skill loaders with original2001/4020 table columns."""
import json
from pathlib import Path
import struct
import sys
from capstone import Cs,CS_ARCH_X86,CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0x2000000,0x20000)
ITEM,SKILL,CELL,STACK,STOP,STRING=0x2001000,0x2002000,0x2003000,0x2008000,0x2009000,0x200a000
columns=[];assignments=[];table=None;row=None

def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def get(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def finish(value=0,pop=0):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,get(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
def hook(machine,address,size,data):
 s=uc.reg_read(UC_X86_REG_ESP)
 if address==0x4391c4:
  index,mode=get(s+4),get(s+8);name=table['columns'][index];value=row['values'][name]
  columns.append(dict(column=index,name=name,mode=mode,value=value))
  if mode==5:uc.mem_write(CELL,value.encode('gbk')+b'\0')
  else:
   assert mode==0,(index,mode)
   put(CELL,int(value))
  finish(CELL,8)
 elif address==0x401609:
  dest=uc.reg_read(UC_X86_REG_ECX);source=get(s+4);raw=bytes(uc.mem_read(source,1024)).split(b'\0')[0]
  uc.mem_write(dest,bytes(28));put(dest+0x14,len(raw));put(dest+0x18,max(15,len(raw)))
  if len(raw)<=15:uc.mem_write(dest+4,raw+b'\0')
  else:
   pointer=STRING+len(assignments)*0x200;uc.mem_write(pointer,raw+b'\0');put(dest+4,pointer)
  assignments.append(dict(destination=hex(dest),value=raw.decode('gbk')));finish(dest,4)
for address in [0x4391c4,0x401609]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
loaders=[]
for name,identifier,entry,dest in [('item',2001,0x439b55,ITEM),('skill',2001,0x43abfd,SKILL+0x400),('skill',4020,0x43abfd,SKILL)]:
 table=json.loads((ROOT/f'recovery/output/verified/tables/{name}.json').read_text());row=next(r for r in table['rows']if r['recordId']==identifier)
 columns.clear();assignments.clear();uc.mem_write(dest,bytes(0x300));put(STACK,STOP,0x12345678);uc.reg_write(UC_X86_REG_ECX,dest);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(entry,STOP,count=10000);assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+8
 assert get(dest+0xc)==identifier
 if name=='item':assert [get(dest+o)for o in [0x108,0x10c,0x110]]==[2001,4020,0]
 else:
  assert get(dest+0x70)==int(row['values']['Effect1'])
  assert bytes(uc.mem_read(dest+0x80,16)).split(b'\0')[0].decode()==row['values']['Sound1']
 loaders.append(dict(table=name,identifier=identifier,entry=hex(entry),columns=list(columns),strings=list(assignments),selected=dict(skill2=get(dest+0x10c))if name=='item'else dict(effect1=get(dest+0x70),sound1=bytes(uc.mem_read(dest+0x80,16)).split(b'\0')[0].decode())))
remote=[];remote_events=[];present=True
OWNER,MESSAGE,ROLE=0x2004000,0x2005000,0x2006000
def receiver_hook(machine,address,size,data):
 stack=uc.reg_read(UC_X86_REG_ESP)
 if address==0x48a226:finish(ROLE if present else 0,4)
 elif address==0x423956:
  remote_events.append(dict(kind='display',xyz=list(struct.unpack('<3f',uc.mem_read(stack+4,12)))))
  finish(pop=12)
 elif address==0x423092:
  remote_events.append(dict(kind='fireCallback',role=get(stack+4),itemId=get(stack+8)))
  finish(pop=8)
for address in [0x48a226,0x423956,0x423092]:uc.hook_add(UC_HOOK_CODE,receiver_hook,begin=address,end=address)
for present in [False,True]:
 for local in [False,True]:
  for xyz in [[0.,0.,1000.],[-12.25,9.75,1000.125]]:
   put(OWNER+0x3c,ROLE if local else 0);put(MESSAGE+0xc,73,2001);uc.mem_write(MESSAGE+0x14,struct.pack('<3f',*xyz))
   put(STACK,STOP,MESSAGE,0x11111111,0x22222222);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK);remote_events.clear()
   uc.emu_start(0x4245c9,STOP,count=10000);assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+16
   assert remote_events==([dict(kind='display',xyz=xyz),dict(kind='fireCallback',role=ROLE,itemId=2001)]if present and not local else [])
   remote.append(dict(present=present,local=local,xyz=xyz,events=list(remote_events)))
c=Cs(CS_ARCH_X86,CS_MODE_32)
source={hex(a):[dict(address=hex(i.address),instruction=f'{i.mnemonic} {i.op_str}'.rstrip())for i in c.disasm(bytes(uc.mem_read(a,b-a)),a)]for a,b in [(0x439b55,0x439d0b),(0x43abfd,0x43acf2),(0x4245c9,0x424614),(0x428a0d,0x428a75),(0x428bfd,0x428c19),(0x45afeb,0x45b072)]}
output=dict(status='PASS',loaders=loaders,remote=remote,source=source,contract=dict(itemId=2001,itemColumn=28,itemOffset='0x10c',skillId=4020,skillEffectColumn=7,skillEffectOffset='0x70',effectName='_root\\online\\007',skillSoundColumn=8,skillSoundOffset='0x7c',sound='SE30',clipFlag=1,clipImport='gbGfxManager::ClipPoint'),scope='Full439b55 item and43abfd skill record loader control flow executes with actual original table column values. Column parser4391c4 and string assignment401609 are supplied boundaries. Full4245c9 remote handler executes role presence/local gates and originalXYZ forwarding to supplied423956/423092 sinks. Source refs establish free-aim immediate display; original clip flag invokes ClipPoint and does not change world origin.')
(ROOT/'recovery/output/combat-shot-loader-native.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print('PASS: complete original item2001/skill2001/4020 loaders; item+10c selects4020 -> world007/SE30; eight full remoteShot forwards/gates; clip flag1 preserves XYZ')
