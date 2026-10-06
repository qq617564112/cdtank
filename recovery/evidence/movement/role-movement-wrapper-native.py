"""Execute original movement wrapper and collision sampling on explicit cell-grid fixtures."""
from pathlib import Path
import json
import math
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x80000)
STACK, STOP, POS, LOOK, FORWARD, MATRIX, CENTER, OUT, MAP = [0x2001000+i*0x1000 for i in range(9)]
CELLS = 0x2020000
WIDTH = 100
queries, attempts = [], []
def u32(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
def put(a,*values): uc.mem_write(a,struct.pack('<'+'I'*len(values),*values))
def f32(v): return struct.unpack('<f',struct.pack('<f',v))[0]
def vec(a, v=None):
    if v is not None: uc.mem_write(a, struct.pack('<3f',*v))
    return list(struct.unpack('<3f',uc.mem_read(a,12)))
def observe(m,a,n,d):
    s=uc.reg_read(UC_X86_REG_ESP)
    if a == 0x45758f: queries.append([u32(s+4),u32(s+8)])
    elif a == 0x434cee: attempts.append(dict(command=u32(s+0xc), delta=struct.unpack('<f',uc.mem_read(s+0x8c,4))[0], queryStart=len(queries)))
    elif a == 0x435106:
        accepted=bool(uc.reg_read(UC_X86_REG_EAX)&255)
        attempts[-1].update(accepted=accepted, code=None if accepted else u32(u32(s)),
            queries=list(queries[attempts[-1]['queryStart']:]))
for address in [0x45758f,0x434cee,0x435106]:uc.hook_add(UC_HOOK_CODE,observe,begin=address,end=address)
def reset():
    vec(POS,[200,0,200]);vec(LOOK,[1,0,0]);vec(FORWARD,[1,0,0]);vec(CENTER,[987,654,321])
    uc.mem_write(MATRIX,struct.pack('<19f',1,0,0,0,0,1,0,0,0,0,1,0,200,0,200,1,48,7,48))
    put(MAP,1);uc.mem_write(MAP+4,bytes(0xa4));put(MAP+4+0x98,WIDTH,WIDTH,CELLS)
    uc.mem_write(MAP+4+0x80,struct.pack('<3f',0,0,0))
    uc.mem_write(CELLS,b'\0\0\0\0\2\0\0\0'*(WIDTH*WIDTH))
    for reg,val in [(UC_X86_REG_FPCW,0x27f),(UC_X86_REG_FPSW,0),(UC_X86_REG_FPTAG,0xffff)]:uc.reg_write(reg,val)
    queries.clear();attempts.clear()
def run(command,delta,map_pointer=MAP):
    matrix_before=bytes(uc.mem_read(MATRIX,76))
    uc.mem_write(STACK,struct.pack('<6I',STOP,POS,LOOK,FORWARD,command,1)+struct.pack('<3f',30,.5,delta)+struct.pack('<3I',MATRIX,CENTER,map_pointer))
    uc.reg_write(UC_X86_REG_ESP,STACK)
    try:uc.emu_start(0x435088,STOP,count=1000000)
    except Exception:
        print('BLOCKED',command,delta,hex(uc.reg_read(UC_X86_REG_EIP)));raise
    assert uc.reg_read(UC_X86_REG_EIP)==STOP
    assert uc.reg_read(UC_X86_REG_ESP)==STACK+4
    assert bytes(uc.mem_read(MATRIX,76)) == matrix_before
    assert vec(CENTER) == [987,654,321]
    return dict(command=command,delta=delta,result=bool(uc.reg_read(UC_X86_REG_EAX)&255),position=vec(POS),look=vec(LOOK),forward=vec(FORWARD),center=vec(CENTER),attempts=list(attempts),queries=list(queries))
def direction(angle): return [math.cos(angle),0,math.sin(angle)]
def expected(command,delta):
    a=f32(.5*delta); distance=f32(30*delta); b=f32(distance/80)
    position=[200,0,200];look=[1,0,0];forward=[1,0,0]
    if command in [1,2]:
        position[0]+=distance if command==1 else -distance
        if a<0:forward=direction(a)
    elif command in [3,4]:look=direction(-a if command==3 else a)
    elif command in [5,6,7,8]:
        position=[200+(1 if command in [5,6] else -1)*80*math.sin(b),0,
            200+(1 if command in [5,7] else -1)*80*(1-math.cos(b))]
        sign=1 if command in [5,8] else -1
        look=direction(sign*b)
        if a>=0:forward=direction(sign*2*a)
    return position,look,forward

def assert_vector(found,wanted,label):
    for x,y in zip(found,wanted):assert abs(x-y)<.00004,(label,found,wanted)

def block(cell):
    x,z=cell
    assert 0<=x<WIDTH and 0<=z<WIDTH
    uc.mem_write(CELLS+(z*WIDTH+x)*8+4,b'\0')

def check(row):
    dt=min(f32(row['delta']),f32(.2))
    assert all(a['delta']==dt for a in row['attempts'])
    commands=[a['command'] for a in row['attempts']]
    assert commands[0]==row['command']
    if len(commands)>1:
        assert commands==[row['command'],4 if row['command'] in [5,8] else 3]
    assert row['result']==row['attempts'][-1]['accepted']
    if row['result']:
        wanted=expected(commands[-1],dt)
    else:
        position,look,forward=[200,0,200],[1,0,0],[1,0,0]
        if commands[-1] in [1,2] and row['attempts'][-1]['code'] in [0,1]:
            angle=f32(.5*dt)*(1 if row['attempts'][-1]['code']==1 else -1)
            look=direction(angle);forward=direction(angle)
        wanted=position,look,forward
    for label,found,target in zip(['position','look','forward'],[row['position'],row['look'],row['forward']],wanted):
        assert_vector(found,target,(label,row['command'],row['delta'],row['mapMode']))
    if row['mapMode']=='none':
        assert row['result'] and not row['queries']
    else:
        for attempt in row['attempts']:
            points=attempt['queries']
            assert len(points)>=4
            clear=[uc.mem_read(CELLS+(z*WIDTH+x)*8+4,1)[0]>1 for x,z in points]
            assert attempt['accepted']==all(clear)
            if not attempt['accepted'] and (not clear[0] or not clear[2]):
                first,last=clear[0],clear[2]
                if attempt['command'] in [0,2,7,8]: first,last=last,first
                code=2 if not first and not last else 0 if not first else 1
                assert attempt['code']==code,(attempt,clear)
    assert row['center']==[987,654,321]

rows=[]
for command in range(9):
    for delta in [-.05,0,.05,.2,.4]:
        reset(); baseline=run(command,delta)
        probe=baseline['attempts'][0]['queries']
        for mode in ['none','clear','blocked','first-side','second-side','interior']:
            reset()
            blocked=[]
            if mode=='blocked':uc.mem_write(CELLS,bytes(WIDTH*WIDTH*8))
            elif mode in ['first-side','second-side']:
                blocked=[probe[0 if mode=='first-side' else 2]]
                block(blocked[0])
            elif mode=='interior':
                candidates=[cell for cell in probe[4:] if cell not in [probe[0],probe[2]]]
                if not candidates: continue
                blocked=[candidates[len(candidates)//2]]
                block(blocked[0])
            row=run(command,delta,0 if mode=='none' else MAP)
            row.update(mapMode=mode,blockedCells=blocked)
            check(row)
            rows.append(row)
assert len(rows)==255
assert any(len(row['attempts'])==2 and row['result'] for row in rows)
assert any(not row['result'] and row['look']!=[1,0,0] for row in rows)
result=dict(status='PASS',entry='0x435088',rows=rows,
    scope='Complete wrapper, collision footprint sampling, original cell-coordinate conversion and cell predicate; '
        'synthetic100x100 grid, 48x48 footprint, aligned initial directions, TankType1. '
        'No mathematical or map-service hooks; original map loading and upstream controller/clock not executed.')
(ROOT/'recovery/output/movement-wrapper-native.json').write_text(json.dumps(result,indent=2)+'\n')
print(f'PASS: {len(rows)} original wrappers; upper time clamp, static grid collision, command retry and partial direction fallback')
print('PASS: position/look/forward formulas, return/stack, unchanged matrix and center; original map predicates and mathematics')
