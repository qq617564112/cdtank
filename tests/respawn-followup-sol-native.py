"""Execute original423157 and its actual base-role life getter/setter."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x30000)
OWNER, ROLE, RECORD, PET, GLOBAL, SERVICE, VIEW = [0x2001000 + i * 0x1000 for i in range(7)]
VTABLE, CALLBACK, CALLBACK_VTABLE, VIEW_VTABLE = 0x2008000, 0x2008100, 0x2008200, 0x2008300
STACK, RETURN, NOTIFY, OBSERVE, RENDER = 0x2020000, 0x2021000, 0x2021100, 0x2021200, 0x2021300

def write(address, *values): uc.mem_write(address, struct.pack('<'+'I'*len(values), *values))
def read(address): return struct.unpack('<I', uc.mem_read(address, 4))[0]
def state(): return dict(life=read(RECORD+0x54) if has_record else None, status=read(RECORD+0x90), dirty=uc.mem_read(ROLE+0x2b4,1)[0])
def finish(pop=0):
    stack=uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX,0); uc.reg_write(UC_X86_REG_EIP,read(stack)); uc.reg_write(UC_X86_REG_ESP,stack+4+pop)
events=[]
def hook(machine,address,size,data):
    stack=machine.reg_read(UC_X86_REG_ESP)
    kind,pop={NOTIFY:('notify',4),OBSERVE:('lifeCallback',8),RENDER:('renderAction',16),0x4376bb:('worldDeath',8),0x488678:('deactivateId',4)}[address]
    events.append(dict(kind=kind, arguments=[read(stack+4+i) for i in range(0,pop,4)], state=state()))
    finish(pop)
for address in [NOTIFY,OBSERVE,RENDER,0x4376bb,0x488678]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
write(0x633588,GLOBAL);write(GLOBAL+0x11c,SERVICE);write(GLOBAL+0x128,SERVICE)
write(RECORD,VTABLE);write(VTABLE+0x24,NOTIFY)
write(CALLBACK,CALLBACK_VTABLE);write(CALLBACK_VTABLE+8,OBSERVE)
write(VIEW,VIEW_VTABLE);write(VIEW_VTABLE+0xa8,RENDER)
rows=[]
for has_role in [False,True]:
 for has_record in [False,True]:
  for callback in [False,True]:
   for pet_type in [1,2,3]:
    for life in [0,73,350]:
     uc.mem_write(OWNER,bytes(0x200));uc.mem_write(ROLE,bytes(0x400))
     write(ROLE,0x5c41b8);write(ROLE+0x2a0,RECORD if has_record else 0,PET)
     write(ROLE+0x310,VIEW);write(PET+0x2c,pet_type)
     write(OWNER+0x74,CALLBACK if callback else 0)
     write(RECORD+0xc,71);write(RECORD+0x54,life,350);write(RECORD+0x90,3)
     events.clear();initial=state()
     write(STACK,RETURN,ROLE if has_role else 0,0)
     uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK)
     uc.emu_start(0x423157,RETURN,count=10000)
     assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+12
     assert state()['life']==(0 if has_role and has_record else initial['life'])
     rows.append(dict(hasRole=has_role,hasRecord=has_record,callback=callback,petType=pet_type,initial=initial,result=state(),events=events[:]))
(ROOT/'recovery/output/respawn-followup-sol-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,scope='Complete423157 with original433250 selector15 setter (including notification12/clamp),432417 selector15 getter and431d4d ID getter, base vtable5c41b8. Record observer, manager life callback, view+a8 and world4376bb/deactivate488678 supplied; role+2bc optional observer absent. Native fixtures, no server HP/respawn timing or player acceptance.'),indent=2)+'\n')
print(f'PASS: {len(rows)} original death followups and actual life setter/getters')
