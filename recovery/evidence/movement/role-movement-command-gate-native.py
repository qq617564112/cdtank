"""Execute full426a54+4269f4 command flow; gate/pose services captured explicitly."""
from pathlib import Path
import json, struct, sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_ECX, UC_X86_REG_EAX
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0x2000000,0x10000)
CTRL, ROLE, ACTOR, VTABLE, MANAGER, MAP, NAV, STACK, STOP, GATE=[0x2001000+i*0x1000 for i in range(10)]
def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def u32(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def done(pop=0,value=None):
 s=uc.reg_read(UC_X86_REG_ESP)
 if value is not None:uc.reg_write(UC_X86_REG_EAX,value)
 uc.reg_write(UC_X86_REG_EIP,u32(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
state={}
def hook(machine,address,size,data):
 s=uc.reg_read(UC_X86_REG_ESP)
 if address==0x422bc6:
  state['calls'].append(dict(kind='permission',command=u32(s+4)));done(4,int(state['permission']))
 elif address==0x432013:
  state['calls'].append(dict(kind='prepare',command=u32(s+4)));done(4)
 elif address==GATE:
  role,command,dt=struct.unpack('<IIf',uc.mem_read(s+4,12))
  state['calls'].append(dict(kind='gate',role=role,command=command,dt=dt));done(12,int(state['gate']))
 elif address==0x433190:
  dt,nav=struct.unpack('<fI',uc.mem_read(s+4,8));state['calls'].append(dict(kind='movement',dt=dt,nav=nav));done(8,int(state['wrapper']))
 elif address==0x42298b:state['calls'].append(dict(kind='pose'));done(12)
 elif address==0x42638a:
  mode,timestamp=struct.unpack('<If',uc.mem_read(s+4,8));state['calls'].append(dict(kind='broadcast',mode=mode,timestamp=timestamp));done(8)
 elif address==0x424be9:state['calls'].append(dict(kind='callback'));done(4)
 elif address==0x42296e:state['calls'].append(dict(kind='stop-actor'));done()
 elif address==0x431dbf:state['calls'].append(dict(kind='stop-action'));done(8)
 elif address==0x49cc05:state['calls'].append(dict(kind='gate-stop-actor'));done()
 elif address==0x40bd28:state['calls'].append(dict(kind='diagnostic'));done(0,0)
for a in [0x422bc6,0x432013,GATE,0x433190,0x42298b,0x42638a,0x424be9,0x42296e,0x431dbf,0x49cc05,0x40bd28]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
rows=[]
for initial in range(9):
 for command in range(1,9):
  for permission,gate,wrapper in [(False,True,True),(True,False,True),(True,True,True),(True,True,False)]:
   uc.mem_write(0x2000000,bytes(0x7000));put(CTRL,VTABLE);put(VTABLE+0x40,GATE);put(CTRL+0x3c,ROLE)
   put(ROLE+0x310,ACTOR);put(ROLE+0x258,initial)
   put(0x633588,MANAGER);put(MANAGER+0x124,MAP);put(MAP+0x60,NAV);put(NAV+4,0x1234)
   state=dict(permission=permission,gate=gate,wrapper=wrapper,calls=[])
   uc.mem_write(STACK,struct.pack('<IIff',STOP,command,.05,12.5));uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,CTRL)
   uc.emu_start(0x426a54,STOP,count=10000)
   assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+16
   final=u32(ROLE+0x258);kinds=[c['kind'] for c in state['calls']]
   if not permission:assert final==initial and kinds==['permission']
   elif not gate:
    assert final==0 and 'movement' not in kinds and kinds[-1]=='gate-stop-actor'
    assert ('stop-actor' in kinds)==(initial!=0)
   else:
    assert final==command and 'movement' in kinds and 'pose' in kinds and kinds[-1]=='callback'
    assert next(c for c in state['calls'] if c['kind']=='movement')['nav']==0x1234
    # Caller ignores actual wrapper's false return and still writes command.
   rows.append(dict(initialCommand=initial,command=command,permission=permission,gate=gate,wrapper=wrapper,finalCommand=final,calls=state['calls']))
out=dict(status='PASS',rows=rows,scope='Full426a54 and4269f4 plus real422adf/4320c7 command writes. Permission, preparation, dynamic gate, movement, actor/action, pose publication and callbacks are supplied/captured services. No claim full controller+OBB+movement executed together.')
(ROOT/'recovery/output/movement-command-gate-native.json').write_text(json.dumps(out,indent=2)+'\n')
print(f'PASS: {len(rows)} full command/collision-stop flows; permission retains old command, gate rejection clears it, NAV result ignored before command publication')
