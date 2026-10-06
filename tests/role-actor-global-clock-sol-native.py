"""Original engine clock, scene actor dispatch and three-component track phase."""
import json
import math
from pathlib import Path
import runpy
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_EBP, UC_X86_REG_ESI
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT/'CDTank/CDTank.exe', ROOT/'CDTank/gbengine.dll'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2100000, 0x20000)
SCENE, GFX, BACKEND, CAMERA, LOCAL_PROVIDER = [0x2100000+0x2000*i for i in range(5)]
LOCAL, REMOTE, OPTIONAL, STAGE, SYSTEM, VECTOR = [0x210a000+0x1000*i for i in range(6)]
STACK, RETURN, CALLBACK = 0x2118000, 0x2119000, 0x211a000
TIME = 0x10053340
calls, ticks = [], []
counter = 0

def w32(a, v): uc.mem_write(a, struct.pack('<I', v))
def u32(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
def wd(a, v): uc.mem_write(a, struct.pack('<d', v))
def rd(a): return struct.unpack('<d', uc.mem_read(a, 8))[0]
def rf(a): return struct.unpack('<f', uc.mem_read(a, 4))[0]
def f32(v): return struct.unpack('<f', struct.pack('<f', v))[0]
def finish(value=0, pop=0):
    s=uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, u32(s)); uc.reg_write(UC_X86_REG_ESP, s+4+pop)
def callback(m, address, size, data):
    s=m.reg_read(UC_X86_REG_ESP); this=m.reg_read(UC_X86_REG_ECX)
    calls.append(hex(address))
    if address==CALLBACK:
        uc.mem_write(u32(s+4), struct.pack('<Q', counter)); finish(1, 4)
    elif address==CALLBACK+0x10: finish(CAMERA)
    elif address==CALLBACK+0x20: finish(0, 4)
    elif address==CALLBACK+0x30:
        ticks.append(dict(actor=hex(this), delta=rf(s+4))); finish(0, 4)
    elif address==0x571bd4: finish(SYSTEM)
    elif address==0x47b81b: finish(SYSTEM)
    elif address==0x41415d: finish(SYSTEM, 4)
    elif address==0x408398: finish(0)
    elif address in [0x56fd88,0x571504,0x4790dc]: finish(0,4)
    elif address==0x56fdea: finish(0,8)
    elif address==CALLBACK+0x40: finish(0, 4)
    elif address==0x442a45: finish(0,4)
    elif address==0x40bd28: finish() # cdecl logging boundary.
    else: raise AssertionError(hex(address))
for a in [CALLBACK,CALLBACK+0x10,CALLBACK+0x20,CALLBACK+0x30,CALLBACK+0x40,
          0x571bd4,0x47b81b,0x41415d,0x408398,0x56fd88,0x571504,0x4790dc,0x56fdea,0x40bd28,0x442a45]:
    uc.hook_add(UC_HOOK_CODE, callback, begin=a, end=a)
w32(0x1003f044,CALLBACK);w32(0x1005b130,1);wd(0x1005b128,1000000)
w32(GFX+0xc8,BACKEND)
def execute(a, this, args=b''):
    uc.mem_write(STACK,struct.pack('<I',RETURN)+args)
    uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,this)
    uc.emu_start(a,RETURN,count=100000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN
    assert uc.reg_read(UC_X86_REG_ESP)==STACK+4+len(args),(hex(a),hex(uc.reg_read(UC_X86_REG_ESP)))
# GetDeltaTime returns an x87 double; preserve its real return in an original caller.
uc.mem_write(CALLBACK+0x100,b'\xe8'+struct.pack('<i',0x10028030-(CALLBACK+0x105))+b'\xdd\x1d'+struct.pack('<I',CALLBACK+0x200)+b'\xc3')
execute(0x10005060,0)
initial=dict(scale=rd(TIME),delta=rd(TIME+8),current=rd(TIME+0x18))
assert initial==dict(scale=1,delta=0,current=0)
clock_rows=[]
for scale,previous,now,update in [(1,10,10.016,True),(.5,10,10.25,True),(2,10,10.25,True),
    (1,10,10.499999,True),(1,10,10.5,True),(1,10,11,True),(1,10,10.75,True),(0,10,11,True),(1,10,11,False),
    (1,10,10.1,True)]:
    execute(0x10001040,TIME,struct.pack('<f',scale))
    wd(TIME+8,.03125);wd(TIME+0x18,3);wd(GFX+0x1f0,previous)
    w32(GFX+0x1fc,int(previous*1000));counter=round(now*1000000)
    calls.clear();execute(0x10028070,GFX,struct.pack('<I',int(update)))
    scaled=rd(TIME+8)
    expected=(now-previous)*f32(scale) if update else .03125
    assert math.isclose(scaled,expected,rel_tol=0,abs_tol=1e-14),(scaled,expected)
    assert (hex(CALLBACK) in calls)==update
    execute(CALLBACK+0x100,GFX)
    getter=rd(CALLBACK+0x200)
    assert getter==(scaled if scaled<.5 else .1)
    clock_rows.append(dict(scale=scale,previousSeconds=previous,currentSeconds=now,updateClock=update,
        scaledDelta=scaled,engineGetter= getter,sceneArgument=f32(getter),totalSeconds=rd(TIME+0x18)))
# Complete scene dispatch: actual gbGfx getter, actual local camera provider and real map iterator.
uc.mem_write(SCENE+0x400,bytes(uc.mem_read(0x5c6c48,0x40)));w32(SCENE,SCENE+0x400)
w32(SCENE+0x400+0x28,CALLBACK+0x10)
w32(SCENE+8,GFX);w32(SCENE+0xa4,SYSTEM);w32(SCENE+0xd4,SYSTEM)
w32(SYSTEM,SYSTEM+0x400);w32(SYSTEM+0x400+0xc,CALLBACK+0x20)
# Audio update import is unrelated to role dispatch.
w32(0x5c036c,CALLBACK+0x40)
w32(SCENE+0x5c,LOCAL_PROVIDER);w32(LOCAL_PROVIDER+0x14,LOCAL)
HEAD,NODE=SCENE+0x800,SCENE+0x900
w32(SCENE+0x6c,HEAD);w32(HEAD,NODE);w32(NODE,HEAD);w32(NODE+0x10,REMOTE)
# Tree iterator's supported one-node layout: parent=head and nil flag on head.
w32(NODE+4,HEAD);w32(NODE+8,HEAD);uc.mem_write(HEAD+0x15,b'\1')
uc.mem_write(NODE+0x15,b'\0')
for actor in [LOCAL,REMOTE,OPTIONAL]:
    w32(actor,actor+0x400);w32(actor+0x400+0xc,CALLBACK+0x30)
scene_rows=[]
for state in [0,1,2,3,4]:
    for present in [False,True]:
        for optional in [False,True]:
            execute(0x447262,SCENE,struct.pack('<I',state))
            w32(LOCAL_PROVIDER+0x14,LOCAL if present else 0);w32(SCENE+0x60,OPTIONAL if optional else 0)
            wd(TIME+8,.49999999);calls.clear();ticks.clear()
            execute(0x45004a,SCENE,struct.pack('<I',0x12345678))
            expected=([hex(REMOTE),hex(LOCAL)] if present else [])+([hex(OPTIONAL)] if optional else []) if state==4 else []
            assert [t['actor'] for t in ticks]==expected
            assert all(t['delta']==f32(.49999999) for t in ticks)
            assert rf(SCENE+0x14)==f32(.49999999)
            scene_rows.append(dict(sceneState=state,localActorPresent=present,optionalActorPresent=optional,
                incomingArgument='0x12345678',sceneArgument=rf(SCENE+0x14),ticks=list(ticks)))
scene_delta_rows=[]
execute(0x447262,SCENE,struct.pack('<I',4))
w32(LOCAL_PROVIDER+0x14,LOCAL);w32(SCENE+0x60,0)
for source_delta in [0,.016,.499999999,.5,.75,2]:
    wd(TIME+8,source_delta);ticks.clear()
    execute(0x45004a,SCENE,struct.pack('<I',0x12345678))
    expected=f32(source_delta if source_delta<.5 else .1)
    assert rf(SCENE+0x14)==expected and all(t['delta']==expected for t in ticks)
    scene_delta_rows.append(dict(scaledEngineDelta=source_delta,sceneArgument=rf(SCENE+0x14),ticks=list(ticks)))
# Complete GameStage update loops its actual subsystem vector only after initialization.
w32(STAGE+4,SYSTEM);w32(SYSTEM+0x94+4,VECTOR);w32(SYSTEM+0x94+8,VECTOR+4);w32(VECTOR,SCENE)
# Restore scene's real +8 update virtual.
w32(SCENE+0x400+8,0x45004a)
execute(0x447262,SCENE,struct.pack('<I',4))
stage_rows=[]
for initialized,subsystems_ready in [(False,False),(False,True),(True,False),(True,True)]:
    w32(STAGE+0xc,int(initialized));w32(STAGE+0x2c,int(subsystems_ready));ticks.clear()
    execute(0x442af0,STAGE,struct.pack('<I',0xabcdef01))
    assert bool(ticks)==(initialized and subsystems_ready)
    stage_rows.append(dict(initialized=initialized,subsystemsReady=subsystems_ready,ticks=list(ticks)))
# The original four-component harness supplies spatial/getter/graphics boundaries.
h=runpy.run_path(str(ROOT/'tests/role-track-texture-sol-native.py'))
u=h['uc'];role=h['ROLE'];vtable=h['VTABLE'];ex=h['execute'];wr=h['w32'];ur=h['u32']
# Three-component constructor: execute concrete constructor, base actor allocation boundary supplied.
def constructor_boundary(m,a,s,d):
    stack=m.reg_read(UC_X86_REG_ESP)
    m.reg_write(UC_X86_REG_EAX,m.reg_read(UC_X86_REG_ECX))
    m.reg_write(UC_X86_REG_EIP,struct.unpack('<I',m.mem_read(stack,4))[0]);m.reg_write(UC_X86_REG_ESP,stack+4)
wr(0x5c0ba0,h['CALLBACK']+0x90)
u.hook_add(UC_HOOK_CODE,constructor_boundary,begin=h['CALLBACK']+0x90,end=h['CALLBACK']+0x90)
handle=u.hook_add(UC_HOOK_CODE,constructor_boundary,begin=0x4684a4,end=0x4684a4)
ex(0x46c1e3)
assert ur(role)==0x5c88c8 and ur(role+0x354)==0 and struct.unpack('<f',u.mem_read(role+0x350,4))[0]==0
four_constructor=dict(entry='0x46c1e3',vtable=hex(ur(role)),tick=hex(ur(ur(role)+0xc)),phaseUpdate=hex(ur(ur(role)+0x64)),elapsed=0,index=0)
ex(0x46880a)
assert ur(role)==0x5c8688 and ur(role+0x2c4)==0 and struct.unpack('<f',u.mem_read(role+0x2c0,4))[0]==0
constructor=dict(entry='0x46880a',vtable=hex(ur(role)),tick=hex(ur(ur(role)+0xc)),phaseUpdate=hex(ur(ur(role)+0x64)),elapsed=0,index=0)
allocations=[]
def allocate_actor(m,a,s,d):
    stack=m.reg_read(UC_X86_REG_ESP);allocations.append(ur(stack+4))
    m.reg_write(UC_X86_REG_EAX,role)
    m.reg_write(UC_X86_REG_EIP,ur(stack));m.reg_write(UC_X86_REG_ESP,stack+4)
allocation_hook=u.hook_add(UC_HOOK_CODE,allocate_actor,begin=0x578620,end=0x578620)
factory_rows=[]
for definition in [1,150,151,158]:
    allocations.clear();u.reg_write(UC_X86_REG_ESI,definition)
    u.reg_write(UC_X86_REG_ESP,h['STACK']+0x200);u.reg_write(UC_X86_REG_EBP,h['STACK']+0x500)
    u.emu_start(0x451ae9,0x451b34,count=30000)
    assert u.reg_read(UC_X86_REG_EIP)==0x451b34
    expected=0x5c8688 if definition>150 else 0x5c88c8
    assert ur(role)==expected and allocations==[0x2d8 if definition>150 else 0x378]
    factory_rows.append(dict(definitionId=definition,allocationSize=allocations[0],vtable=hex(ur(role))))
u.hook_del(allocation_hook);u.hook_del(handle)
# Retain concrete +64 while supplying unrelated visual hooks as in the four-part test.
u.mem_write(vtable,bytes(u.mem_read(0x5c8688,0x100)));wr(role,vtable)
for off,fn in [(0x60,h['CALLBACK']),(0x24,h['CALLBACK']+0x10),(0xc8,h['CALLBACK']+0x20),
               (0x70,h['CALLBACK']+0x30),(0x20,h['CALLBACK']+0x30)]:wr(vtable+off,fn)
# Render M/X/Y without attachment entries, using the real SetTexture and same graphics boundaries.
wr(role+0x2cc,0x201a000);wr(role+0x2d0,0x201b000)
wr(role+0x2a8,h['ACTORS'][0]);wr(role+0x2ac,h['ACTORS'][1]);wr(role+0x2b0,h['ACTORS'][2])
def phase():return dict(elapsed=struct.unpack('<f',u.mem_read(role+0x2c0,4))[0],index=ur(role+0x2c4))
type4_rows=[]
for label,d8,target,distance in [('pending',0,True,10),('stopped',1,True,10),('no-target',0,False,10),('arrived',0,True,0)]:
    u.mem_write(role+0xd8,bytes([d8]));wr(role+0x120,h['TARGET'] if target else 0)
    u.mem_write(h['POINT'],struct.pack('<3f',distance,0,0));u.mem_write(role+0x28,b'\0'*12)
    u.mem_write(role+0x2c0,struct.pack('<f',0));wr(role+0x2c4,0)
    steps=[]
    for delta in [0,.05,.05,1e-8,.1,.10001,.25,0]:
        before=phase();h['calls'].clear();h['renders'].clear();ex(0x468aed,[delta]);after=phase()
        gated=bool(d8 or not target or distance==0);total=before['elapsed']+f32(delta)
        expected=before if gated else dict(elapsed=0 if total>h['threshold'] else f32(total),index=(before['index']+1)%2 if total>h['threshold'] else before['index'])
        assert after==expected,(label,delta,after,expected)
        update_calls=list(h['calls']);ex(0x4695bf)
        assert len(h['renders'])==3
        assert [r['texture'] for r in h['renders'][1:]]==[hex(0x201a000+after['index']*0x1000)]*2
        steps.append(dict(delta=f32(delta),before=before,after=after,updateCalls=update_calls,renders=list(h['renders'])))
    type4_rows.append(dict(label=label,steps=steps))
u.mem_write(role+0x2c0,struct.pack('<f',.05));wr(role+0x2c4,1)
stop_before=phase();ex(0x46495d);assert phase()==stop_before
assert u.mem_read(role+0xd8,1)==b'\1' and bytes(u.mem_read(role+0xc0,12))==b'\0'*12
ex(0x468aed,[.25]);assert phase()==stop_before
output=dict(status='PASS',initialClock=initial,clock=clock_rows,scene=scene_rows,sceneDelta=scene_delta_rows,gameStage=stage_rows,
    actorFactory=factory_rows,fourComponentConstructor=four_constructor,type4Constructor=constructor,type4=type4_rows,type4StopPreservesPhase=stop_before,
    scope='Complete10028070/10035380 QPC wall time producer,10028030 getter,45004a scene actor dispatch,442ae7 initialized GameStage dispatch,46880a concrete constructor,468aed/46753f/4660a5/46aaef tick gate and4695bf render. QPC OS query, audio, effect/UI terminal callbacks, base actor construction, matrix construction, spatial and graphics boundaries supplied.')
(ROOT/'recovery/output/role-actor-global-clock-sol-native.json').write_text(json.dumps(output,indent=2)+'\n')
print(f'PASS {len(clock_rows)} clock cases, {len(scene_rows)} scene gates, {len(stage_rows)} GameStage gates, {sum(len(r["steps"]) for r in type4_rows)} Type4 tick/render steps')
