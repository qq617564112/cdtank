"""Execute original hurt direction classifier and remote actor dispatch."""
import json
import math
from pathlib import Path
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
TARGET, INCOMING, ACTOR, RECORD, GLOBAL, STACK, STOP, VTABLE, FIELD = [0x2001000 + i * 0x1000 for i in range(9)]
def put(a, *values): uc.mem_write(a, struct.pack('<'+'I'*len(values), *[v & 0xffffffff for v in values]))
def get(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
def returned(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, get(stack))
    uc.reg_write(UC_X86_REG_ESP, stack+4+pop)
events=[]
def hook(m, a, n, d):
    stack=uc.reg_read(UC_X86_REG_ESP)
    if a == 0x40bd28:
        events.append(dict(kind='normalizationDiagnostic'))
        returned()
    elif a == 0x467209:
        events.append(dict(kind='healthDisplay', value=struct.unpack('<i',uc.mem_read(stack+4,4))[0], flags=get(stack+8)))
        returned(pop=8)
    elif a in [0x46888f, 0x46c2ab]:
        events.append(dict(kind='action', index=get(stack+4), flags=get(stack+8)))
        returned(pop=8)
    elif a == FIELD:
        events.append(dict(kind='roleField', field=get(stack+4)))
        returned(55,4)
    elif a == 0x4269c4: returned()
for a in [0x40bd28, 0x467209, 0x46888f, 0x46c2ab, FIELD, 0x4269c4]: uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
def run(entry, this, *args):
    put(STACK,STOP,*args)
    for reg,value in [(UC_X86_REG_ECX,this),(UC_X86_REG_ESP,STACK),(UC_X86_REG_FPCW,0x27f),(UC_X86_REG_FPSW,0),(UC_X86_REG_FPTAG,0xffff)]: uc.reg_write(reg,value)
    uc.emu_start(entry,STOP,count=100000)
    assert uc.reg_read(UC_X86_REG_EIP)==STOP
    return uc.reg_read(UC_X86_REG_EAX)
def direction(role, angle): uc.mem_write(role+0x274,struct.pack('<3f',math.cos(angle),0,math.sin(angle)))
rows=[]
for heading in [0,.71,-2.1]:
    for gap in [0,.3,math.pi/4-0.00001,math.pi/4,math.pi/4+0.00001,1.5,3*math.pi/4-0.00001,3*math.pi/4,3*math.pi/4+0.00001,math.pi]:
        for sign in [-1,1]:
            if heading != 0 and gap == math.pi: continue
            direction(TARGET,heading); direction(INCOMING,heading+sign*gap)
            events.clear(); quadrant=run(0x435745,0,TARGET,INCOMING)
            assert quadrant in range(4) and not events
            if gap < math.pi/4-0.000001: assert quadrant == 1
            elif math.pi/4+0.000001 < gap < 3*math.pi/4-0.000001: assert quadrant == (2 if sign>0 else 3)
            elif gap>3*math.pi/4+0.000001: assert quadrant == 0
            rows.append(dict(target=list(struct.unpack('<3f',uc.mem_read(TARGET+0x274,12))), incoming=list(struct.unpack('<3f',uc.mem_read(INCOMING+0x274,12))),gap=sign*gap,quadrant=quadrant,selector=quadrant+1))
put(TARGET,VTABLE); put(VTABLE+0x14,FIELD); put(TARGET+0x2a0,RECORD); put(ACTOR+0x258,TARGET); put(0x633588,GLOBAL)
dispatch=[]
for vtable in [0x5c8688,0x5c88c8]:
    assert get(vtable+0x88)==0x464e72
    for status in [2,3]:
        for blocked in [0,1]:
            for quadrant in [0,1,2,3,4]:
                put(ACTOR,vtable); put(TARGET+0x310,ACTOR); put(RECORD+0x90,status)
                uc.mem_write(ACTOR+0x19c,bytes([blocked]))
                events.clear(); run(0x422877,TARGET,17,quadrant)
                expected=[dict(kind='healthDisplay',value=-17,flags=1)]
                if status==2 and not blocked and quadrant<4:
                    expected += [dict(kind='roleField',field=15),dict(kind='action',index=quadrant+4,flags=4)]
                    assert get(ACTOR+0x29c)==55
                assert events==expected,(status,blocked,quadrant,events)
                dispatch.append(dict(vtable=hex(vtable),status=status,blocked=bool(blocked),quadrant=quadrant,events=list(events)))
c=Cs(CS_ARCH_X86,CS_MODE_32)
source={hex(a):[dict(address=hex(i.address),instruction=f'{i.mnemonic} {i.op_str}'.rstrip()) for i in c.disasm(bytes(uc.mem_read(a,b-a)),a)] for a,b in [(0x4288fe,0x42894f),(0x428b0f,0x428b4d),(0x435745,0x4357f4),(0x431fe7,0x431fff),(0x422877,0x4228d9),(0x464bed,0x464c05),(0x46897a,0x468a03),(0x46c396,0x46c42e)]}
output=dict(status='PASS',classifications=rows,dispatch=dispatch,source=source,scope='Full435745,431fe7,4059de and original CRT acos execute. Full422877,464e72,derived hurt and role field15 cache execute. Health display, actor action application, role field service and local camera lookup are supplied boundaries. Local producer4288fe requires incoming EBX equal current local player role; horizontal +274/+27c is look, distinct from forward+280.')
(ROOT/'recovery/output/combat-hit-native.json').write_text(json.dumps(output,indent=2)+'\n')
print(f'PASS: {len(rows)} original classifications, {len(dispatch)} original hurt dispatches')
