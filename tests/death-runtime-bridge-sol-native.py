"""Execute local death scheduling, countdown callback and revive cancellation."""
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
GLOBAL, OWNER, MANAGER, ACCOUNT, MODES, MODE, ROLE, LOCAL, RECORD, LOCAL_RECORD = [0x2001000+i*0x1000 for i in range(10)]
VTABLE, CALLBACK, CALLBACK_VTABLE = 0x200b000, 0x200c000, 0x200d000
STACK, RETURN, MODE_GET, CHANGE, RESET, COMPLETE = [0x2020000+i*0x100 for i in range(6)]
def write(address,*values): uc.mem_write(address,struct.pack('<'+'I'*len(values),*values))
def read(address): return struct.unpack('<I',uc.mem_read(address,4))[0]
def finish(pop=0,result=0):
 s=uc.reg_read(UC_X86_REG_ESP)
 uc.reg_write(UC_X86_REG_EAX,result);uc.reg_write(UC_X86_REG_EIP,read(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
events=[]
def hook(machine,address,size,data):
 s=machine.reg_read(UC_X86_REG_ESP)
 if address==MODE_GET: finish(result=mode);return
 if address==0x437446:
  args=[read(s+4+i*4) for i in range(6)]
  assert args[:5]==[0x63547c,0x3f800000,OWNER,0x437626,0]
  events.append(['schedule',1,args[5]]);finish(24);return
 if address==0x4041fb:
  assert read(s+4)==0x63547c
  events.append(['cancel']);finish(4);return
 if address==CHANGE:events.append(['countdown',read(s+4)]);finish(4);return
 events.append(['reset' if address==RESET else 'complete']);finish()
for address in [MODE_GET,0x437446,0x4041fb,CHANGE,RESET,COMPLETE]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
write(0x633588,GLOBAL);write(GLOBAL+0x110,OWNER,ACCOUNT,MANAGER)
write(GLOBAL+0xac,0);write(GLOBAL+0xe0,MODES);write(MODES,MODE);write(MODE,VTABLE);write(VTABLE+4,MODE_GET)
write(ROLE,0x5c41b8);write(LOCAL,0x5c41b8);write(ROLE+0x2a0,RECORD);write(LOCAL+0x2a0,LOCAL_RECORD)
write(CALLBACK,CALLBACK_VTABLE)
rows=[]
def execute(address,args):
 events.clear();write(STACK,RETURN,*args);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(address,RETURN,count=10000)
 assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+4*(len(args)+1)
 return events[:]
for mode in [2,4,5]:
 for local in [False,True]:
  for matching in [False,True]:
   for status in [0,2,3]:
    for callback in [False,True]:
     write(MANAGER+0x3c,LOCAL if local else 0)
     # Mode2 selects manager+40's embedded role instead of manager+3c.
     write(MANAGER+0x40,LOCAL-0x20 if local else -0x20 & 0xffffffff)
     write(ACCOUNT+0x6c,71);write(RECORD+0xc,71 if matching else 72);write(LOCAL_RECORD+0xc,71)
     write(LOCAL_RECORD+0x90,status)
     for offset,target in [(0x60,CHANGE),(0x64,RESET),(0x68,COMPLETE)]:
      obj=CALLBACK+offset*4;vt=CALLBACK_VTABLE+offset*4
      write(obj,vt);write(vt+8,target);write(OWNER+offset,obj if callback else 0)
     initial=execute(0x4376bb,[ROLE,0])
     ticks=[dict(countdown=n,events=execute(0x437626,[n])) for n in [5,1,0]]
     reset=execute(0x436464,[ROLE])
     absent=execute(0x436464,[0])
     rows.append(dict(mode=mode,local=local,matching=matching,status=status,callback=callback,start=initial,ticks=ticks,reset=reset,absent=absent))
path=ROOT/'recovery/output/death-runtime-bridge-sol-native.json'
path.write_text(json.dumps(dict(status='PASS',rows=rows),indent=2)+'\n')
print(f'PASS: {len(rows)} original local death/countdown/revive service fixtures')
