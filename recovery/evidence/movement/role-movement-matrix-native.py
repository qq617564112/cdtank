"""Run original433073 and engine Y rotation with original CRT imports."""
from pathlib import Path
import json
import math
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_ECX, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT/'CDTank/CDTank.exe', ROOT/'CDTank/gbengine.dll', ROOT/'CDTank/msvcr71.dll'])
uc.mem_map(0x2000000, 0x10000)
OUT, POSITION, FORWARD, STACK, STOP = 0x2001000, 0x2002000, 0x2003000, 0x200e000, 0x200f000

def values(address, count):
    return list(struct.unpack('<'+'f'*count, uc.mem_read(address, count*4)))

def put_floats(address, data):
    uc.mem_write(address, struct.pack('<'+'f'*len(data), *data))

constants = {hex(a): values(a,1)[0] for a in [0x61e478,0x61e47c,0x61e480,0x61e5e8,0x5c41a8,0x1003fcb0]}
assert list(constants.values()) == [0,0,1,6.283180236816406,57.295780181884766,0.01745329238474369]
rotations=[]
def observe(machine,address,size,data):
    if address == 0x10030220:
        esp=uc.reg_read(UC_X86_REG_ESP)
        rotations.append(dict(axis=struct.unpack('<I',uc.mem_read(esp+4,4))[0],degrees=values(esp+8,1)[0]))
uc.hook_add(UC_HOOK_CODE,observe,begin=0x10030220,end=0x10030220)
rows=[]
cases=[('north',(0,0,1)),('south',(0,0,-1)),('east',(1,0,0)),('west',(-1,0,0)),
       ('zero',(0,0,0)),('clamp-positive',(0.2,0,1.1)),('clamp-negative',(-.2,0,-1.1))]
for index, angle in enumerate([.0001,.025,.1,.7,1.2,2.4,3.14,3.2,4.7,5.9,6.28]):
    cases.append((f'heading-{index}',(math.sin(angle),0,math.cos(angle))))
for name,forward in cases:
    position=[123.25,7,-42.5]
    put_floats(OUT,[float(i+2) for i in range(16)]+[49,24,52])
    put_floats(POSITION,position)
    put_floats(FORWARD,forward)
    for reg,value in [(UC_X86_REG_FPCW,0x27f),(UC_X86_REG_FPSW,0),(UC_X86_REG_FPTAG,0xffff)]:
        uc.reg_write(reg,value)
    uc.mem_write(STACK,struct.pack('<IIII',STOP,OUT,POSITION,FORWARD))
    uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.reg_write(UC_X86_REG_ECX,0)
    uc.emu_start(0x433073,STOP,count=100000)
    assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+16
    result=values(OUT,19)
    assert result[12:15]==position and result[16:]==[49,24,52]
    assert rotations[-1]['axis']==1
    rows.append(dict(name=name,position=position,forward=values(FORWARD,3),degrees=rotations[-1]['degrees'],output_obb=result))
result=dict(status='PASS',entry='0x433073',engine_rotation='0x10030220',constants=constants,rows=rows,
            native_scope=['original433073 clamp/acos/negative-x branch/degrees conversion',
                          'original10030220 and10030190 Y rotation matrix reset',
                          'original bundled msvcr71.dll acos/cos/sin/memset'],
            limitations=['Explicit supplied position/forward and49/24/52 dimensions; role production and resizing are outside this evidence'])
output=ROOT/'recovery/output'
(output/'movement-obb-matrix-native.json').write_text(json.dumps(result,indent=2)+'\n')
lines=[f"PASS {r['name']}: degrees={r['degrees']} dimensions retained" for r in rows]
(output/'movement-obb-matrix-native.log').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines))
