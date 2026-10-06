"""Preserve the original static-box ShotItem receiver and scene lookup contract."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
u,images=map_original_binaries([ROOT/'CDTank/CDTank.exe']);u.mem_map(0,4096);p=images['cdtank.exe'];decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
u.mem_map(0x2040000,0x10000)
OWNER,ROLE,MESSAGE,GLOBAL,SCENE,OBJECT,STACK,STOP=[0x2041000+i*0x1000 for i in range(8)]
def put(a,*v):u.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def get(a):return struct.unpack('<I',u.mem_read(a,4))[0]
def finish(value=0,pop=0):
 s=u.reg_read(UC_X86_REG_ESP);u.reg_write(UC_X86_REG_EAX,value);u.reg_write(UC_X86_REG_EIP,get(s));u.reg_write(UC_X86_REG_ESP,s+4+pop)
events=[];lookup=True;role=True
# Original scene vtable and original4591a4 switch execute; only the geometric find is supplied.
put(SCENE,0x5c7178);put(SCENE+0x1bc,OBJECT);put(SCENE+0x1c0,OBJECT+8);put(OBJECT,OBJECT+0x100)
put(0x635830,GLOBAL);put(GLOBAL+0x60,SCENE)
def hook(machine,address,size,data):
 s=machine.reg_read(UC_X86_REG_ESP)
 if address==0x48a226:
  events.append({'kind':'roleLookup','id':get(s+4)});finish(ROLE if role else 0,4)
 elif address==0x458e9e:
  output,start,end,point=[get(s+i)for i in [4,8,12,16]]
  events.append({'kind':'boxFind','start':start,'end':end,'lookupXYZ':list(struct.unpack('<3f',u.mem_read(point,12)))})
  put(output,start if lookup else end);finish(output)
 elif address==0x423956:
  events.append({'kind':'endpointDisplay','position':list(struct.unpack('<3f',u.mem_read(s+4,12)))});finish(0,12)
 elif address==0x423092:
  events.append({'kind':'shotFeedback','role':get(s+4),'itemId':get(s+8)});finish(0,8)
 else:raise AssertionError('Type2 must not destroy or post scene navigation: '+hex(address))
for a in [0x48a226,0x458e9e,0x423956,0x423092,0x44e081,0x457ca0]:u.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
rows=[]
for local in [False,True]:
 for has_role,has_box in [(True,True),(False,True),(True,False)]:
  role=has_role;lookup=has_box;events.clear();put(OWNER+0x3c,ROLE if local else ROLE+4);put(ROLE+0x314,19)
  put(MESSAGE+0xc,73,2001);u.mem_write(MESSAGE+0x14,struct.pack('<3f',123.5,4,-77.25));put(MESSAGE+0x34,2,200);u.mem_write(MESSAGE+0x3c,struct.pack('<3f',9.5,25,-12.25));put(MESSAGE+0x48,0)
  put(STACK,STOP,MESSAGE,0,0);u.reg_write(UC_X86_REG_ECX,OWNER);u.reg_write(UC_X86_REG_ESP,STACK);u.emu_start(0x4247aa,STOP,count=10000)
  assert u.reg_read(UC_X86_REG_EIP)==STOP and u.reg_read(UC_X86_REG_ESP)==STACK+16
  assert get(ROLE+0x314)==19
  expected=['roleLookup']+(['boxFind'] if has_role else [])+(['endpointDisplay','shotFeedback']if has_role and has_box and not local else [])
  assert [e['kind']for e in events]==expected
  if has_role:assert events[1]['start']==OBJECT and events[1]['end']==OBJECT+8
  rows.append({'local':local,'roleExists':has_role,'boxExists':has_box,'events':list(events),'destroyCounter':get(ROLE+0x314)})
def source(a,b):return {'start':hex(a),'end':hex(b),'instructions':[{'address':hex(i.address),'bytes':i.bytes.hex(),'instruction':i.mnemonic+' '+i.op_str}for i in decoder.disasm(p.get_data(a-0x400000,b-a),a)]}
assert struct.unpack('<I',p.get_data(0x5c7178+0x48-0x400000,4))[0]==0x4591a4
assert struct.unpack('<I',p.get_data(0x45924b+8-0x400000,4))[0]==0x4591d7
assert p.get_data(0x5c7214-0x400000,5)==b'.box\0'
result={'status':'PASS_ORIGINAL_STATIC_BOX_SHOTITEM_RECEIVER','sceneVtable':'0x5c7178','querySlot48':'0x4591a4','type2Container':{'vector':'scene+1b8','begin':'scene+1bc','end':'scene+1c0','extension':'.box'},'rows':rows,'sources':[source(a,b)for a,b in [(0x45aba5,0x45abab),(0x45b791,0x45b811),(0x4591a4,0x45926b),(0x4247aa,0x42489b)]],'substitutes':['role lookup','geometric box find','already-proven423956 display/423092 feedback boundary'],'scope':'Original scene virtual48/type2 vector selection and complete4247aa execute. Static .box identity proven by loader range; no Castle/Breach HP interpretation, original server producer or real player acceptance claimed.'}
(ROOT/'recovery/output/scene-shot-type2-source.json').write_text(json.dumps(result,indent=2)+'\n');print(result['status'])
