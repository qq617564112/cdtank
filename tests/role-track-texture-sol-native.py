"""Original four-component actor tick, XY phase and render texture setters."""
import json
import math
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT/'CDTank/CDTank.exe', ROOT/'CDTank/gbengine.dll'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x30000)
ROLE, MANAGER, ENGINE, TARGET, POINT = 0x2000000, 0x2001000, 0x2002000, 0x2003000, 0x2004000
ACTORS = [0x2005000 + 0x1000*i for i in range(4)]
STACK, RETURN, CALLBACK = 0x2020000, 0x2021000, 0x2022000
calls, renders = [], []
def w32(a,v): uc.mem_write(a,struct.pack('<I',v))
def u32(a): return struct.unpack('<I',uc.mem_read(a,4))[0]
def f32(v): return struct.unpack('<f',struct.pack('<f',v))[0]
def finish(value=0,pop=0):
    s=uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX,value)
    uc.reg_write(UC_X86_REG_EIP,u32(s)); uc.reg_write(UC_X86_REG_ESP,s+4+pop)
def callback(machine,address,size,data):
    s=machine.reg_read(UC_X86_REG_ESP); this=machine.reg_read(UC_X86_REG_ECX)
    calls.append(hex(address))
    if address in [0x4654f1,0x464fb3]: finish(0,4) # Base spatial motion boundary.
    elif address==0x46ae9c: assert this==TARGET; finish(TARGET)
    elif address==0x465c6e: finish(POINT)
    elif address==0x57b854:
        value=math.sqrt(struct.unpack('<d',uc.mem_read(s+4,8))[0])
        uc.mem_write(CALLBACK+0x100,struct.pack('<d',value))
        # Supply CRT sqrt's x87 return, retaining the original caller.
        uc.mem_write(CALLBACK+0x110,b'\xdd\x05'+struct.pack('<I',CALLBACK+0x100)+b'\xc3')
        uc.reg_write(UC_X86_REG_EIP,CALLBACK+0x110)
    elif address==0x466676: finish(0,4) # Empty attachment map.
    elif address in [0x4673b7,0x464b7f,0x46569b,0x48568d]: finish()
    elif address==CALLBACK: finish(0,4) # Tick virtual +60.
    elif address in [CALLBACK+0x10,CALLBACK+0x20,CALLBACK+0x30]: finish()
    elif address==CALLBACK+0x40: finish(0) # Manager rendering mode.
    elif address==CALLBACK+0x50:
        renders.append(dict(actor=hex(this),texture=hex(u32(this+0xa8)),argument=u32(s+4)))
        finish(0,4)
    elif address in [0x10031350,0x10031380]: finish()
    elif address==0x100313c0: finish(0,4)
    elif address==0x10031460: finish(0,12)
    elif address==0x44ef01: finish(POINT)
    elif address==0x100313f0: finish(0,8)
    else: raise AssertionError(hex(address))
for a in [0x48568d,0x4654f1,0x464fb3,0x46ae9c,0x465c6e,0x57b854,0x466676,0x4673b7,0x464b7f,0x46569b,
          CALLBACK,CALLBACK+0x10,CALLBACK+0x20,CALLBACK+0x30,CALLBACK+0x40,CALLBACK+0x50,
          0x10031350,0x10031380,0x100313c0,0x10031460,0x44ef01,0x100313f0]:
    uc.hook_add(UC_HOOK_CODE,callback,begin=a,end=a)
# Preserve original XY vtable and substitute unrelated virtual boundaries.
VTABLE=0x200a000
uc.mem_write(VTABLE,bytes(uc.mem_read(0x5c88c8,0x100))); w32(ROLE,VTABLE)
for off,fn in [(0x60,CALLBACK),(0x24,CALLBACK+0x10),(0xc8,CALLBACK+0x20),
               (0x70,CALLBACK+0x30),(0x20,CALLBACK+0x30)]: w32(VTABLE+off,fn)
w32(0x635830,MANAGER); w32(MANAGER,MANAGER+0x400); w32(MANAGER+0x400+0x34,CALLBACK+0x40)
w32(MANAGER+8,ENGINE); w32(ENGINE+0xd4,ENGINE+0x400)
uc.mem_write(ROLE+0x23d,b'\1'); w32(ROLE+0x1a0,1)
for off in [0x1dc,0x1e8]: w32(ROLE+off,ROLE+off+0x800);w32(ROLE+off+0x800,ROLE+off+0x800)
for i,a in enumerate(ACTORS):
    w32(ROLE+0x2a8+4*i,a);w32(a,a+0x400);w32(a+0x400+0x10,CALLBACK+0x50)
w32(ROLE+0x360,0x201a000);w32(ROLE+0x364,0x201b000)
# Map graphics methods from their imported addresses to supplied matrix boundaries.
for slot,pop in [(0x5c09c0,12),(0x5c0978,8)]:
    a=u32(slot)
    uc.hook_add(UC_HOOK_CODE,lambda m,a,s,d,pop=pop: finish(0,pop),begin=a,end=a)
def execute(address,args=()):
    uc.mem_write(STACK,struct.pack('<I',RETURN)+b''.join(struct.pack('<f',v) for v in args))
    uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,ROLE)
    uc.emu_start(address,RETURN,count=20000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+4+4*len(args)
def state(): return dict(elapsed=struct.unpack('<f',uc.mem_read(ROLE+0x350,4))[0],index=u32(ROLE+0x354))
threshold=struct.unpack('<f',uc.mem_read(0x5c7e58,4))[0]
rows=[]
for label,d8,target,distance in [('pending-forward',0,True,10),('pending-backward',0,True,10),('pending-turn-input',0,True,10),('pending-zero-input',0,True,10),
                                  ('flag-d8',1,True,10),('absent-target',0,False,10),('at-target',0,True,0)]:
    w32(ROLE+0x124,0xffffffff if label=='pending-backward' else 1)
    uc.mem_write(ROLE+0xc0,struct.pack('<3f',0,0,0 if label=='pending-zero-input' else 1))
    uc.mem_write(ROLE+0xd8,bytes([d8]));w32(ROLE+0x120,TARGET if target else 0)
    uc.mem_write(POINT,struct.pack('<3f',distance,0,0));uc.mem_write(ROLE+0x28,b'\0'*12)
    uc.mem_write(ROLE+0x350,struct.pack('<f',0));w32(ROLE+0x354,0)
    steps=[]
    for delta in [0,.05,.05,1e-8,.1,.10001,.25,0,.04,.07]:
        before=state();calls.clear();renders.clear();execute(0x46c483,[delta]);after=state()
        gated=bool(d8 or not target or distance==0)
        total=before['elapsed']+f32(delta)
        expected=before if gated else dict(elapsed=0 if total>threshold else f32(total),index=(before['index']+1)%2 if total>threshold else before['index'])
        assert after==expected,(label,delta,after,expected)
        update_calls=list(calls);execute(0x46cec7)
        assert len(renders)==3 # M and both tracks; U presence flag is false.
        expected_texture=hex(0x201a000+after['index']*0x1000)
        assert [r['texture'] for r in renders[1:]]==[expected_texture]*2
        steps.append(dict(delta=f32(delta),before=before,after=after,updateCalls=update_calls,renderSubmissions=list(renders)))
    rows.append(dict(label=label,d8=d8,targetPresent=target,targetDistance=distance,steps=steps))
uc.mem_write(ROLE+0x350,struct.pack('<f',.05));w32(ROLE+0x354,1)
stop_before=state();execute(0x46495d)
assert state()==stop_before and uc.mem_read(ROLE+0xd8,1)==b'\1'
assert bytes(uc.mem_read(ROLE+0xc0,12))==b'\0'*12
execute(0x46c483,[.25]);assert state()==stop_before
output=dict(stopPreservesPhase=stop_before,status='PASS',threshold=threshold,rows=rows,
    scope='Complete46c483/46753f/4660a5 tick gate, complete46e0e3 XY phase, complete46cec7 render and real10009f70 SetTexture. Base spatial motion, getters, empty attachment map, graphics matrix and actor source render supplied at boundaries.',
    initialState=dict(elapsed=0,index=0),clock='float32 delta argument of actor virtual+0xc; accumulator compares x87 sum before stored float32 rounding; strict greater threshold resets all excess')
(ROOT/'recovery/output/role-track-texture-sol-native.json').write_text(json.dumps(output,indent=2)+'\n')
print(f'PASS {len(rows)} actor tick scenarios, {sum(len(r["steps"]) for r in rows)} XY phase/render steps')
