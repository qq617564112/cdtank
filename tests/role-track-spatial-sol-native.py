"""Execute complete original actor spatial update and target-position getter."""
import json
import math
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,0x1000);uc.mem_map(0x2000000,0x30000)
ROLE,POINTS,TABLE=0x2000000,0x2001000,0x2002000
STACK,RETURN,SCRATCH=0x2020000,0x2021000,0x2022000
def f32(v):return struct.unpack('<f',struct.pack('<f',v))[0]
def w32(a,v):uc.mem_write(a,struct.pack('<I',v))
def u32(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def vector(a,v):uc.mem_write(a,struct.pack('<3f',*v))
def readvector(a):return list(struct.unpack('<3f',uc.mem_read(a,12)))
def sqrt_boundary(machine,address,size,data):
    s=machine.reg_read(UC_X86_REG_ESP)
    uc.mem_write(SCRATCH,struct.pack('<d',math.sqrt(struct.unpack('<d',uc.mem_read(s+4,8))[0])))
    uc.mem_write(SCRATCH+0x10,b'\xdd\x05'+struct.pack('<I',SCRATCH)+b'\xc3')
    machine.reg_write(UC_X86_REG_EIP,SCRATCH+0x10)
uc.hook_add(UC_HOOK_CODE,sqrt_boundary,begin=0x57b854,end=0x57b854)
def execute(address,this,args=(),words=False):
    uc.mem_write(STACK,struct.pack('<I',RETURN)+b''.join(struct.pack('<I' if words else '<f',v) for v in args))
    uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,this)
    uc.emu_start(address,RETURN,count=20000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN
    assert uc.reg_read(UC_X86_REG_ESP)==STACK+4+4*len(args)
# Original +120 getters traverse the actual two-point segmented container layout.
w32(ROLE+0x120,ROLE+0xdc);w32(ROLE+0xdc+4,TABLE);w32(ROLE+0xdc+8,0)
w32(ROLE+0xdc+0xc,0);w32(ROLE+0xdc+0x10,2)
w32(TABLE,POINTS);w32(TABLE+4,POINTS+0xc)
threshold=f32(.1);bias=f32(.05)
rows=[]
for label,current,target,sign in [('forward',[0,0,0],[10,0,0],1),('backward',[0,0,0],[-10,0,0],-1),
                                  ('same-position-turn',[3,2,4],[3,2,4],1),('idle',[0,0,0],[0,0,0],1),
                                  ('height',[2,3,4],[12,8,14],1)]:
    for elapsed in [0,.025,.05,.075,.095,.1,.2]:
        vector(ROLE+0x28,current);vector(ROLE+0x1bc,target);vector(POINTS,current);vector(POINTS+0xc,target)
        vector(ROLE+0x10,[0,1,0]);vector(ROLE+0x1c,[0,0,1]);vector(ROLE+0x88,[0,0,1])
        vector(ROLE+0xc0,[1,0,0]);vector(ROLE+0x1a4,[1,0,0]);vector(ROLE+0x1b0,[0,0,1])
        w32(ROLE+0x124,sign&0xffffffff)
        uc.mem_write(ROLE+0x198,struct.pack('<f',threshold));uc.mem_write(ROLE+0x1c8,struct.pack('<f',elapsed))
        execute(0x46ae9c,ROLE+0xdc);assert uc.reg_read(UC_X86_REG_EAX)==ROLE+0xdc
        execute(0x465c6e,ROLE+0xdc);assert uc.reg_read(UC_X86_REG_EAX)==POINTS+0xc
        getter=readvector(uc.reg_read(UC_X86_REG_EAX));assert getter==[f32(v) for v in target]
        execute(0x4654f1,ROLE,[.016])
        weight=min(1,max(0,f32(f32(elapsed)/threshold+bias)))
        inverse=f32(1-weight)
        expected=[f32(f32(f32(t)*weight)+f32(f32(c)*inverse)) for c,t in zip(current,target)]
        assert readvector(ROLE+0x28)==expected,(label,elapsed,readvector(ROLE+0x28),expected)
        assert readvector(ROLE+0xc0)==[0,0,0]
        rows.append(dict(label=label,current=current,target=target,direction=sign,elapsed=f32(elapsed),
                         delta=f32(.016),weight=weight,position=readvector(ROLE+0x28),
                         forward=readvector(ROLE+0x1c),look=readvector(ROLE+0x88),targetGetter=getter))
def finish(value=0,pop=0):
    stack=uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,u32(stack))
    uc.reg_write(UC_X86_REG_ESP,stack+4+pop)
def setup_boundary(machine,address,size,data):
    stack=machine.reg_read(UC_X86_REG_ESP);this=machine.reg_read(UC_X86_REG_ECX)
    if address==0x466ddc:
        assert u32(stack+4)==2
        w32(this+4,POINTS+0x100);finish(this,4)
    elif address==0x46c0d9:
        descriptor=u32(stack+8);source=u32(descriptor+4)
        setup_points.append([readvector(source),readvector(source+12)])
        uc.mem_write(POINTS,bytes(uc.mem_read(source,24)))
        w32(this+4,TABLE);w32(this+8,0);w32(this+12,0);w32(this+16,2)
        finish(0,8)
    elif address in [0x48569e,0x4593e5,0x2022400]:finish()
    else:raise AssertionError(hex(address))
for address in [0x466ddc,0x46c0d9,0x48569e,0x4593e5,0x2022400]:
    uc.hook_add(UC_HOOK_CODE,setup_boundary,begin=address,end=address)
w32(ROLE,ROLE+0x400);w32(ROLE+0x400+0x28,0x2022400)
uc.mem_write(ROLE+0x23c,b'\1')
setter_rows=[];setup_points=[]
for blocked in [False,True]:
    for label,target in [('forward',[0,0,10]),('backward',[0,0,-10]),('turn',[0,0,0])]:
        vector(ROLE+0x28,[0,0,0]);vector(ROLE+0x88,[0,0,1])
        vector(ROLE+0x1bc,[9,9,9]);uc.mem_write(ROLE+0x1c8,struct.pack('<f',.07))
        uc.mem_write(ROLE+0xd8,b'\1');w32(ROLE+0x120,0)
        uc.mem_write(ROLE+0x19c,bytes([int(blocked)]))
        vector(POINTS+0x200,target);vector(POINTS+0x220,[1,0,0]);vector(POINTS+0x240,[0,0,1])
        before=len(setup_points)
        execute(0x466efb,ROLE,[POINTS+0x200,POINTS+0x220,POINTS+0x240],words=True)
        target_result=readvector(ROLE+0x1bc)
        assert target_result==([9,9,9] if blocked else target)
        if not blocked:
            assert setup_points[-1]==[[0,0,0],target] and len(setup_points)==before+1
            assert u32(ROLE+0x120)==ROLE+0xdc and uc.mem_read(ROLE+0xd8,1)==b'\0'
            assert struct.unpack('<f',uc.mem_read(ROLE+0x1c8,4))[0]==0
            execute(0x465c6e,ROLE+0xdc);assert readvector(uc.reg_read(UC_X86_REG_EAX))==target
        else:assert len(setup_points)==before
        setter_rows.append(dict(label=label,blocked=blocked,target=target,targetResult=target_result,
            current=readvector(ROLE+0x28),elapsed=struct.unpack('<f',uc.mem_read(ROLE+0x1c8,4))[0],
            stopped=bool(uc.mem_read(ROLE+0xd8,1)[0]),targetPresent=bool(u32(ROLE+0x120)),
            direction=struct.unpack('<i',uc.mem_read(ROLE+0x124,4))[0]))
output=dict(setterRows=setter_rows,status='PASS',rows=rows,interpolationPeriod=threshold,bias=bias,
    scope='Complete4654f1,464fb3,464e83,464f1f,574f18 and vector math; complete46ae9c/465c6e/464c1d target getter. CRT sqrt supplied as x87 double return. Complete466efb pose setter with temporary allocation, curve construction and visual callbacks supplied at boundaries; original source-point copies and target-container pointer writes executed. Global clock and pose-message producer not executed.')
(ROOT/'recovery/output/role-track-spatial-sol-native.json').write_text(json.dumps(output,indent=2)+'\n')
print(f'PASS {len(rows)} complete spatial updates and target getters, {len(setter_rows)} complete pose setters')
