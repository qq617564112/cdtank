"""Execute new original ShotPlayer dispatch and ordinary victim-effect terminal."""
import json,struct,sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,0x1000)
uc.mem_map(0x2000000,0x40000)
OWNER,ATTACKER,VICTIM,MESSAGE,TABLE,ITEM,SKILL,GLOBAL,MANAGER,ACTOR,VTABLE,STACK,STOP=[0x2001000+i*0x1000 for i in range(13)]
def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def get(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def finish(value=0,pop=0):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,get(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
phase='dispatch';events=[];present=True;trigger=8
GETAMMO=STOP+0x100;GETID=STOP+0x200;ATTACH=STOP+0x300
put(ATTACKER,VTABLE);put(VICTIM,VTABLE+0x100);put(VTABLE+0x18,GETAMMO);put(VTABLE+0x104,GETID)
put(ITEM+0x108,2001,4020,0);put(SKILL+0xc,4020);put(0x633588,GLOBAL);put(GLOBAL+0x128,MANAGER);put(VICTIM+0x310,ACTOR);put(ACTOR,VTABLE+0x200);put(VTABLE+0x2a8,ATTACH)
uc.mem_write(VICTIM+0x25c,struct.pack('<fff',125.5,20.0,-77.25))
put(SKILL+0x70,7);put(SKILL+0xd0,0);uc.mem_write(SKILL+0x80,b'SE30\0');put(SKILL+0x94,4)
def hook(machine,address,size,data):
 s=machine.reg_read(UC_X86_REG_ESP)
 if address==0x48a226:
  ident=get(s+4);events.append(dict(kind='lookup',roleId=ident));finish((ATTACKER if ident==11 else VICTIM if ident==22 and present else 0),4)
 elif address==GETAMMO:events.append(dict(kind='currentAmmo',selector=get(s+4)));finish(2001,4)
 elif address==GETID:finish(22)
 elif address in [0x413c74,0x413c65]:finish(TABLE)
 elif address==0x411068:
  ident=get(s+4);finish(ITEM if ident==2001 else SKILL if ident==4020 else 0,4)
 elif address==0x4886aa and phase=='dispatch':events.append(dict(kind='skillDispatch',victim=get(s+4),skill=get(s+8),retention=get(s+12)));finish(0,12)
 elif address==0x4246d0:
  events.append(dict(kind='beforeLocalBranch'));uc.reg_write(UC_X86_REG_EIP,STOP)
 elif address==0x486122:finish(0,4)
 elif address==ATTACH:events.append(dict(kind='attached',actor=machine.reg_read(UC_X86_REG_ECX),effectId=get(s+4),binding=get(s+8),tag=get(s+12),oneShot=get(s+16)));finish(91,16)
 elif address==0x431fe0:events.append(dict(kind='victimPosition',role=machine.reg_read(UC_X86_REG_ECX)))
 elif address==0x485b1b:
  name=bytes(machine.mem_read(get(s+8),20)).split(b'\0')[0].decode();events.append(dict(kind='spatialSound',name=name,position=get(s+12),coordinates=list(struct.unpack('<fff',machine.mem_read(get(s+12),12))),selector=get(s+16)));finish(get(s+4))
for a in [0x48a226,GETAMMO,GETID,0x413c74,0x413c65,0x411068,0x4886aa,0x4246d0,0x486122,ATTACH,0x431fe0,0x485b1b]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
rows=[]
for local in [ATTACKER,VICTIM,0]:
 for present in [False,True]:
  for trigger in [0,8]:
   phase='dispatch';events.clear();put(OWNER+0x3c,local);put(SKILL+0x2c,trigger);put(MESSAGE+0xc,11,22);put(STACK,STOP,MESSAGE,0,0);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK);uc.emu_start(0x424614,STOP,count=10000)
   assert [e for e in events if e['kind']=='skillDispatch']==([dict(kind='skillDispatch',victim=22,skill=4020,retention=0)] if present and trigger==8 else [])
   rows.append(dict(local=local,victimPresent=present,trigger=trigger,events=list(events)))
phase='terminal';present=True;put(0x633588,GLOBAL);put(GLOBAL+0x118,OWNER);events.clear();put(STACK,STOP,22,4020,0);uc.reg_write(UC_X86_REG_ECX,MANAGER);uc.reg_write(UC_X86_REG_ESP,STACK);uc.emu_start(0x4886aa,STOP,count=10000)
assert next(e for e in events if e['kind']=='attached')==dict(kind='attached',actor=ACTOR,effectId=7,binding=3,tag=0,oneShot=1)
assert next(e for e in events if e['kind']=='spatialSound')==dict(kind='spatialSound',name='SE30',position=VICTIM+0x25c,coordinates=[125.5,20.0,-77.25],selector=1)
(ROOT/'recovery/output/combat-shot-player-result-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,terminal=events,scope='New424614 lookup/Trigger8 dispatch through skill call; stop before existing hit/HUD/local branches. Original4886aa nonqueued retention0 terminal and431fe0 position getter execute; supplied victim+25c coordinates reach spatial sound call. Tables/role lookup/queue whitelist/actor/audio supplied; existing effect resources not rerun.'),indent=2)+'\n')
print('PASS: original ShotPlayer victim Trigger8 dispatch independent of local attacker; ordinary007/tag0/oneShot1 and victim spatialSE30/selector1')
