"""Execute original Play/StopSkillEffect packets and presentation handler branches."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table
uc,images=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x40000)
MESSAGE,STREAM,BUFFER,LISTENER=0x2001000,0x2002000,0x2003000,0x2004000
MANAGER,TABLE,SKILL,ROLE,GAME,SYSTEM,HEAP=0x2005000,0x2006000,0x2007000,0x2008000,0x2009000,0x200a000,0x200b000
STACK,STOP,VTABLE,CALLBACK,VECTOR=0x2020000,0x2021000,0x2022000,0x2023000,0x2024000
events=[];heap=HEAP;mode='wire';record=0;role_result=ROLE;skill_result=SKILL
queues={};last_effect=0

def put(address,*values):uc.mem_write(address,struct.pack('<'+'I'*len(values),*[v&0xffffffff for v in values]))
def uint(address):return struct.unpack('<I',uc.mem_read(address,4))[0]
def finish(pop=0,value=None):
 stack=uc.reg_read(UC_X86_REG_ESP)
 if value is not None:uc.reg_write(UC_X86_REG_EAX,value)
 uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4+pop)
def call(address,this,*args):
 put(STACK,STOP,*args);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,this)
 uc.emu_start(address,STOP,count=100000)
 assert uc.reg_read(UC_X86_REG_EIP)==STOP
 assert uc.reg_read(UC_X86_REG_ESP)==STACK+4+4*len(args)
 return uc.reg_read(UC_X86_REG_EAX)
def hook(machine,address,size,data):
 global heap,record,last_effect
 stack=machine.reg_read(UC_X86_REG_ESP)
 if mode=='wire':return
 if address==0x413c65:finish(value=TABLE)
 elif address==0x411068:events.append(dict(kind='skillLookup',key=uint(stack+4)));finish(4,skill_result)
 elif address==0x48a226:events.append(dict(kind='roleLookup',key=uint(stack+4)));finish(4,role_result)
 elif address==0x57c0d6:
  buffer,length,pattern,identifier=[uint(stack+o) for o in [4,8,12,16]]
  text=bytes(uc.mem_read(pattern,40)).split(b'\0')[0].decode()%identifier
  uc.mem_write(buffer,text.encode()+b'\0');finish(value=len(text))
 elif address==0x45afc2:
  name=bytes(uc.mem_read(uint(stack+8),256)).split(b'\0')[0].decode()
  xyz=struct.unpack('<3f',uc.mem_read(stack+12,12))
  events.append(dict(kind='worldEffect',name=name,position=list(xyz),last=uint(stack+24)))
  finish(24,uint(stack+4))
 elif address==0x401171:finish(8)
 elif address==CALLBACK:
  effect,bind,method,oneShot=[uint(stack+o) for o in [4,8,12,16]]
  events.append(dict(kind='attachedEffect',effectId=effect,argument2=bind,effectTag=method,oneShot=oneShot));finish(16,0x12345)
 elif address==0x578620:
  count=uint(stack+4);record=heap;heap+=(count+15)&~15;finish(value=record)
 elif address==0x431fe0:
  events.append(dict(kind='soundPosition',selector=uint(stack+4)));finish(8,ROLE+0x400)
 elif address==0x485b1b:
  if mode=='state':
   reference=bytes(uc.mem_read(uint(stack+8),32)).split(b'\0')[0].decode()
   events.append(dict(kind='sound',reference=reference))
  output=uint(stack+4);uc.mem_write(output,bytes(24));finish(value=output)
 elif address==0x48804a:
  pointer=uint(uint(stack+4))
  events.append(dict(kind='retain',record=list(struct.unpack('<6I',uc.mem_read(pointer,24)))))
  if mode=='state':
   if machine.reg_read(UC_X86_REG_ECX)==MANAGER+0xc:
    end=uint(MANAGER+0x14);put(end,pointer);put(MANAGER+0x14,end+4)
   else:
    target=machine.reg_read(UC_X86_REG_ECX)
    queue=next((q for q in queues.values() if q['object']==target),None)
    if queue:queue['records'].append(pointer)
    else:pending_queue.append(pointer)
  finish(4)
 elif address==0x4501fa and mode=='state':
  out,key=uint(stack+4),uint(uint(stack+8));node=0x2025000
  if key in queues:put(node+0x10,queues[key]['object']);put(out,node)
  else:put(out,uint(MANAGER+0x20))
  finish(8,out)
 elif address==0x487493 and mode=='state':
  pair=uint(stack+8);key,target=uint(pair),uint(pair+4)
  queues[key]=dict(object=target,records=list(pending_queue));pending_queue.clear();finish(8,uint(stack+4))
 elif address==0x47b81b:
  last_effect=uint(stack+4);events.append(dict(kind='effectLookup',handle=last_effect));finish(4,HEAP+0x700)
 elif address==0x4791de:events.append(dict(kind='stopEffect'));finish()
 elif address==0x48568d:events.append(dict(kind='stopSound'));finish()
 elif address==0x57a6c7:
  pointer=uint(stack+4);event=dict(kind='free',pointer=pointer)
  if mode=='state':event['record']=list(struct.unpack('<5I',uc.mem_read(pointer,20)))
  events.append(event);finish()
 elif address==0x4f14f5:
  out=uint(stack+4);item=uint(stack+8);end=uint(MANAGER+0x14)
  uc.mem_write(item,bytes(uc.mem_read(item+4,end-item-4)));put(MANAGER+0x14,end-4);put(out,item);finish(8,out)
uc.hook_add(UC_HOOK_CODE,hook)
pe=images['cdtank.exe'];wire=[]
for v,ctor,type_id,writer,reader,values,widths in [
 (0x5ca2a8,0x48619d,0x4170,0x4893cb,0x48944e,[12,2,30,47,0x41480000,0xc0800000],[16,4,16,32,32,32]),
 (0x5ca2d0,0x4861db,0x4171,0x4895be,0x4895f2,[12,47],[16,32])]:
 call(ctor,LISTENER,0,0);lv=uint(LISTENER)
 assert call(uint(lv+12),LISTENER)==type_id==call(uint(v+4),MESSAGE)
 for alignment in range(8):
  uc.mem_write(MESSAGE,bytes(0x40));put(MESSAGE,v);put(MESSAGE+12,*values)
  uc.mem_write(BUFFER,bytes(64));put(STREAM,alignment,0,BUFFER,64);call(writer,MESSAGE,STREAM)
  total=sum(widths);payload=bytes(uc.mem_read(BUFFER,(alignment+total+7)//8))
  packed=0;shift=alignment
  for value,width in zip(values,widths):packed|=(value&((1<<width)-1))<<shift;shift+=width
  assert int.from_bytes(payload,'little')==packed
  uc.mem_write(MESSAGE+12,b'\xaa'*24);put(STREAM,alignment,0,BUFFER,64);call(reader,MESSAGE,STREAM)
  result=[uint(MESSAGE+12+i*4) for i in range(len(values))];assert result==values
  wire.append(dict(type=type_id,alignment=alignment,widths=widths,values=values,payload=payload.hex()))
mode='handler';put(0x633588,SYSTEM);put(SYSTEM+0x118,MANAGER);put(0x635830,GAME);put(GAME+0x60,MANAGER)
put(ROLE+0x310,ROLE+0x500);put(ROLE+0x500,VTABLE);put(VTABLE+0xa8,CALLBACK)
put(SKILL+0x70,19,23,31);put(SKILL+0xd0,7,8,9)
rows=[]
for skill,slot,duration,role in [(12,0,0,0),(12,2,0,0),(12,0,0,47),(12,1,30,47),(8,2,30,47)]:
 events.clear();heap=HEAP;put(MANAGER+0x10,VECTOR);put(MANAGER+0x14,VECTOR)
 put(MESSAGE+12,skill,slot,duration,role,0x41480000,0xc0800000)
 call(0x488291,MANAGER,MESSAGE,0,0)
 rows.append(dict(skill=skill,slot=slot,duration=duration,role=role,events=list(events)))
 assert events[0]==dict(kind='skillLookup',key=skill)
 if role==0:
  assert events[1]==dict(kind='worldEffect',name=f'_root\\online\\{[19,23,31][slot]:03d}',position=[12.5,0,-4],last=1)
 else:
  assert events[1]==dict(kind='roleLookup',key=role)
  attached=next(e for e in events if e['kind']=='attachedEffect')
  assert attached==dict(kind='attachedEffect',effectId=[19,23,31][slot],argument2=3,effectTag=[7,8,9][slot],oneShot=0 if skill==8 else 1)
  if skill==8:
   saved=next(e for e in events if e['kind']=='retain')['record']
   assert saved==[role,skill,slot,duration,0x12345,0]
# Nonzero missing role or missing actor is discarded, without world fallback.
missing=[]
for available in [False,True]:
 events.clear();role_result=ROLE if available else 0;put(ROLE+0x310,0)
 put(MESSAGE+12,12,0,0,47,0x41480000,0xc0800000);call(0x488291,MANAGER,MESSAGE,0,0)
 assert [event['kind'] for event in events]==['skillLookup','roleLookup']
 missing.append(dict(roleExists=available,events=list(events)))
role_result=ROLE;put(ROLE+0x310,ROLE+0x500)
# Persistent duplicate tuple(role,skill,slot) skips another attached effect.
events.clear();put(MANAGER+0x10,VECTOR);put(MANAGER+0x14,VECTOR+4);put(VECTOR,HEAP)
put(HEAP,47,8,2,30,0x12345,0);put(MESSAGE+12,8,2,60,47,0,0)
call(0x488291,MANAGER,MESSAGE,0,0)
assert [e['kind'] for e in events]==['skillLookup','roleLookup']
duplicate=list(events)
# Stop compares skill+role, ignoring selector; supply three retained records.
events.clear();put(MANAGER+0x10,VECTOR);put(MANAGER+0x14,VECTOR+16)
for index,(role,skill,slot) in enumerate([(47,8,0),(48,8,1),(47,12,2),(47,8,2)]):
 address=HEAP+index*0x100;put(VECTOR+index*4,address);put(address,role,skill,slot,30,0x12345+index,0)
put(MESSAGE+12,8,47);call(0x486b4a,MANAGER,MESSAGE,0,0)
assert [e['kind'] for e in events]==['effectLookup','stopEffect','stopSound','free']*2
assert events[0]['handle']==0x12345
stop=list(events)
# Retention countdown decreases once whenever accumulated update arguments reach30.
events.clear();put(0x892b4c,0);put(MANAGER+0x10,VECTOR);put(MANAGER+0x14,VECTOR+4);put(VECTOR,HEAP)
put(HEAP,47,8,0,2,0x12345,0)
call(0x48698f,MANAGER,29);assert uint(HEAP+12)==2
call(0x48698f,MANAGER,1);assert uint(HEAP+12)==1 and events==[]
call(0x48698f,MANAGER,30);assert uint(MANAGER+0x14)==VECTOR
countdown=list(events)
mode='state';pending_queue=[];state_rows=[]
def state():
 return dict(accumulator=uint(0x892b4c),records=[list(struct.unpack('<5I',uc.mem_read(uint(p),20)))
  for p in range(uint(MANAGER+0x10),uint(MANAGER+0x14),4)],
  queues=[dict(roleId=key,records=[list(struct.unpack('<5I',uc.mem_read(p,20))) for p in queue['records']])
   for key,queue in sorted(queues.items())])
def play_message(skill=12,slot=0,duration=0,role=47):
 return dict(kind='play',skillId=skill,effectIndex=slot,duration=duration,roleId=role,xBits=0x41480000,zBits=0xc0800000)
scenarios=[dict(name='world-and-ordinary',actions=[play_message(role=0),play_message(slot=2,role=0),play_message(),play_message(duration=30)]),
 dict(name='all-retained-skills',actions=[play_message(skill=s,duration=2) for s in [8,10,11,19,4005,30001,30003]]+
  [dict(kind='update',argument=a) for a in [29,1,90]]),
 dict(name='duplicate-stop-multiple-slots',actions=[play_message(skill=8,duration=3),play_message(skill=8,duration=99),
  play_message(skill=8,slot=2,duration=4),play_message(skill=8,role=48,duration=5),play_message(skill=10,duration=6),
  dict(kind='stop',skillId=8,roleId=47),dict(kind='stop',skillId=8,roleId=47)]),
 dict(name='special-queues',actions=[play_message(skill=s,duration=2) for s in range(13500,13508)]+
  [play_message(skill=13501,slot=1),play_message(skill=13501,role=48),dict(kind='stop',skillId=13501,roleId=47),
   dict(kind='update',argument=100)]),
 dict(name='zero-duration-white-list',actions=[play_message(skill=8),play_message(skill=8,duration=2),dict(kind='update',argument=100)]),
 *[dict(name=name,skillPresent=skillPresent,rolePresent=rolePresent,actorPresent=actorPresent,effectIds=ids,
  actions=[play_message(),play_message(role=0)]) for name,skillPresent,rolePresent,actorPresent,ids in [
   ('missing-skill',False,True,True,[19,23,31]),('missing-role',True,False,True,[19,23,31]),
   ('missing-actor',True,True,False,[19,23,31]),('zero-effect',True,True,True,[0,0,0])]]]
for scenario in scenarios:
 events.clear();heap=HEAP;queues.clear();pending_queue.clear();put(0x892b4c,0)
 put(MANAGER+0x10,VECTOR);put(MANAGER+0x14,VECTOR);put(MANAGER+0x20,0x2026000)
 skill_result=SKILL if scenario.get('skillPresent',True) else 0
 role_result=ROLE if scenario.get('rolePresent',True) else 0
 put(ROLE+0x310,ROLE+0x500 if scenario.get('actorPresent',True) else 0)
 put(SKILL+0x70,*scenario.get('effectIds',[19,23,31]));put(SKILL+0xd0,7,8,9)
 for index in range(3):
  string=SKILL+0x7c+index*0x1c;uc.mem_write(string+4,f'sound{index}'.encode()+b'\0');put(string+0x18,15)
 steps=[]
 for action in scenario['actions']:
  events.clear()
  if action['kind']=='play':
   put(MESSAGE+12,*[action[k] for k in ['skillId','effectIndex','duration','roleId','xBits','zBits']])
   call(0x488291,MANAGER,MESSAGE,0,0)
  elif action['kind']=='stop':
   put(MESSAGE+12,action['skillId'],action['roleId']);call(0x486b4a,MANAGER,MESSAGE,0,0)
  else:call(0x48698f,MANAGER,action['argument'])
  steps.append(dict(action=action,events=list(events),state=state()))
 state_rows.append(dict(**{k:v for k,v in scenario.items() if k!='actions'},steps=steps))
decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
skill12=next(row['values'] for row in read_table(ROOT/'CDTank/Data/table/skill.dat')['rows'] if row['values']['SkillTableID']=='12')
assert [skill12[key] for key in ['Effect1','EffectTag1','EffectMethod1']]==['19','0','3']
evidence={name:[dict(va=hex(i.address),instruction=f'{i.mnemonic} {i.op_str}') for i in decoder.disasm(pe.get_data(start-0x400000,end-start),start)]
 for name,start,end in [('playRegister',0x488a76,0x488aad),('stopRegister',0x488ac1,0x488af8),
 ('busRegistration',0x48baff,0x48bb51),('playWriteRead',0x4893cb,0x4894c3),('stopWriteRead',0x4895be,0x489623),
 ('playHandler',0x488291,0x48860c),('stopHandler',0x486b4a,0x486bb7),('effectTableColumns',0x43ac83,0x43acf2),
 ('persistentSkillPredicate',0x48603a,0x486070),('persistentTick',0x48698f,0x486a07)]}
(ROOT/'recovery/output/skill-effect-message-native.json').write_text(json.dumps(dict(wire=wire,play=rows,missingRole=missing,duplicate=duplicate,stop=stop,countdown=countdown,states=state_rows,skill12=skill12,evidence=evidence),indent=2)+'\n')
print(f'PASS: Play4170/Stop4171 getters;16 real bitstream roundtrips;{len(state_rows)} original notification sequences/{sum(len(row["steps"]) for row in state_rows)} callback/state samples; Stop/countdown/role queues')
