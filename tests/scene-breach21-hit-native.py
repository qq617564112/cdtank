"""Execute the registered ShotItem receiver and preserve its HP source boundary."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX,UC_X86_REG_ECX,UC_X86_REG_EIP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
# Reuse original-model loader bindings; execute the receiver into44e081/45e7b0.
namespace = {'__file__': str(ROOT / 'tests/scene-breach21-05466-native.py')}
model_source = (ROOT / 'tests/scene-breach21-05466-native.py').read_text().split("mode='loader';call(0x4610f1,0)")[0]
exec(compile(model_source, 'scene-breach21-05466-native.py', 'exec'), namespace)
uc = namespace['uc']
images = namespace['images']
OBJECT = namespace['OBJ']
namespace['mode'] = 'loader'
namespace['call'](0x4610f1, 0)
loader = list(namespace['events'])
namespace['mode'] = 'sound'
uc.mem_map(0x2040000,0x10000)
OWNER,ROLE,MESSAGE,GLOBAL,MAP,VTABLE,LOOKUP,STACK,STOP=[0x2041000+i*0x1000 for i in range(9)]
def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def get(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def finish(value=0,pop=0):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,get(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
events=[]
def receiver_hook(machine,address,size,data):
 s=machine.reg_read(UC_X86_REG_ESP)
 if address==0x48a226:events.append(dict(kind='roleLookup',identifier=get(s+4)));finish(ROLE,4)
 elif address==LOOKUP:
  events.append(dict(kind='sceneLookup',position=list(struct.unpack('<3f',uc.mem_read(get(s+4),12))),objectType=get(s+8)));finish(OBJECT,8)
 elif address==0x457ca0:events.append(dict(kind='scenePostNotification'));finish()
 else:raise AssertionError(hex(address))
for a in [0x48a226,LOOKUP,0x457ca0]:uc.hook_add(UC_HOOK_CODE,receiver_hook,begin=a,end=a)
put(0x635830,GLOBAL);put(GLOBAL+0x60,MAP);put(MAP,VTABLE);put(VTABLE+0x48,LOOKUP);put(OWNER+0x3c,ROLE)
rows=[]
for kind in [0,1,2,3]:
 for parameter in [0,1,54,200,0xffffffff]:
  events.clear();namespace['events'].clear();put(OBJECT+0xe4,namespace['INTACT']);uc.mem_write(OBJECT+0xe8,b'\0');put(ROLE+0x314,0);put(MESSAGE+0xc,73,2001);uc.mem_write(MESSAGE+0x14,struct.pack('<3f',1,2,3));put(MESSAGE+0x34,kind,parameter);put(MESSAGE+0x48,0)
  put(STACK,STOP,MESSAGE,0,0);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK);uc.emu_start(0x4247aa,STOP,count=10000)
  assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+16
  assert sum(e['kind']=='sound' for e in namespace['events'])==int(kind!=2)
  assert get(OBJECT+0xe4)==(namespace['BROKEN'] if kind!=2 else namespace['INTACT'])
  if kind!=2:assert [e['reference'] for e in namespace['events'] if e['kind']=='sound']==['GA13']
  assert get(ROLE+0x314)==int(kind!=2)
  rows.append(dict(objectType=kind,parameter=parameter,count=get(ROLE+0x314),events=list(events),presentation=list(namespace['events'])))
pe=images['cdtank.exe'];decoder=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
result=dict(status='PASS',loader=loader,listener='UMsgPrNotifyShotItem',receiver='0x4247aa',rows=rows,
 substitutes=['role lookup','scene lookup','graphics model loading/device methods','navigation update','scene post-notification'],
 scope='Receiver non-type2 dispatch always requests destruction; parameter does not gate HP. No original nonlethal server resolution/producer recovered.',
 sources=[dict(start=hex(a),end=hex(b),instructions=[dict(address=hex(i.address),bytes=i.bytes.hex(),instruction=f'{i.mnemonic} {i.op_str}') for i in decoder.disasm(pe.get_data(a-0x400000,b-a),a)]) for a,b in [(0x42b92f,0x42b975),(0x4247aa,0x42489a),(0x45e7b0,0x45e7f2),(0x44e081,0x44e3cd)]])
(ROOT/'recovery/output/scene-breach21-hit-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS: 20 original ShotItem cases; receiver through native44e081/45e7b0 always selects c9/GA13 for non-type2 independent of parameter; original nonlethal producer remains missing')
