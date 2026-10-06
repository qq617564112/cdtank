"""Execute original Sound initialization, three loaders, enable/update/disable."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from scene_sound import decode_sound_tail
uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x40000)
OBJ, SUB, STREAM, VT, STACK, STOP, MANAGER, AUDIO, SOURCE, OUTPUT = [0x2001000 + 0x1000*i for i in range(10)]
READ, NODE, SINK = STOP+0x100, STOP+0x200, STOP+0x300
events = []
raw = b''
cursor = 0

def put(a, *values): uc.mem_write(a, struct.pack('<'+'I'*len(values), *[v & 0xffffffff for v in values]))
def uint(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
def vector(a): return list(struct.unpack('<3f', uc.mem_read(a, 12)))
def finish(value=0, pop=0):
    s = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, uint(s))
    uc.reg_write(UC_X86_REG_ESP, s+4+pop)
def call(a, this, *args):
    put(STACK, STOP, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(a, STOP, count=200000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK+4+4*len(args)
def read(n):
    global cursor
    result=raw[cursor:cursor+n]
    assert len(result)==n
    cursor+=n
    return result

def hook(machine, a, size, data):
    s=machine.reg_read(UC_X86_REG_ESP); c=machine.reg_read(UC_X86_REG_ECX)
    if a==0x405805: finish(c)
    elif a==0x578620: finish(NODE)
    elif a==SINK: finish(c)
    elif a==0x44e3cf: finish(c, 4)
    elif a==0x44ea18: finish(0, 4)
    elif a==READ:
        target,n=uint(s+4),uint(s+8)
        uc.mem_write(target,read(n));finish(n,8)
    elif a==0x57476c:
        target=uint(s+4); n=struct.unpack('<I',read(4))[0]; value=read(n)
        assert n<16
        uc.mem_write(target+4,value+b'\0');put(target+0x14,n,15)
        finish(target,4)
    elif a==0x44db88:
        uc.mem_write(c+0x64,bytes([uint(s+4)]));finish(0,4)
    elif a in (0x461ded,0x461e8f,0x462846): finish()
    elif a==0x48568d:
        descriptor=uint(s+4)
        if uc.mem_read(descriptor,1)!=b'\0': events.append({'kind':'stop'})
        uc.mem_write(descriptor,b'\0'*24);finish()
    elif a==0x485b1b:
        result,name,position,selector,direction=[uint(s+i) for i in (4,8,12,16,20)]
        events.append(dict(kind='play',name=bytes(uc.mem_read(name,16)).split(b'\0')[0].decode(),
            position=vector(position),selector=struct.unpack('<i',struct.pack('<I',selector))[0],direction=vector(direction)))
        put(result,1,0,0,77,1,0);finish(result)
    elif a==0x571bd4: finish(MANAGER)
    elif a==0x571de5:
        events.append(dict(kind='gain',value=struct.unpack('<f',uc.mem_read(s+8,4))[0]));finish(0,8)
uc.hook_add(UC_HOOK_CODE, hook)
put(0x5c0ba0,SINK);put(STREAM,VT);put(VT+0xc,READ)
rows=[]
placements=json.loads((ROOT/'recovery/output/web-assets/scene-placements.json').read_text())
records=[r for scene in placements if scene['id']=='0021' for r in scene['records'] if r['className']=='SYcScnObjSound']
for record in records:
    uc.mem_write(SUB,b'\0'*0x100)
    call(0x462b6c,SUB)
    assert uc.mem_read(SUB+0x58,1)==b'\x01'
    put(OBJ,0x5c7558);put(OBJ+0xd8,SUB)
    uc.mem_write(OBJ+0x58,struct.pack('<3f',*record['position']))
    raw=bytes.fromhex(record['tail']);cursor=0
    call(0x45eaab,OBJ,STREAM)
    assert cursor==len(raw)==35
    fields=decode_sound_tail(raw)
    assert uint(OBJ+0xf0)==fields['intervalMs']==0
    assert uc.mem_read(OBJ+0xf4,1)==bytes([fields['randomGate']])==b'\0'
    assert struct.unpack('<f',uc.mem_read(SUB+0x5c,4))[0]==fields['field5c']==1
    events.clear()
    call(0x462934,OBJ,1)
    assert events==[dict(kind='play',name=fields['field24'],position=record['position'],selector=-1,direction=[0,0,-1]),dict(kind='gain',value=1)]
    call(0x45f07e,OBJ,0x3dcccccd)
    assert len(events)==2
    call(0x462934,OBJ,0)
    assert events[-1]=={'kind':'stop'}
    rows.append(dict(id=record['id'],fields=fields,spatial=True,events=list(events)))
# The original Sound path uses the common manager initialized by 0x416a93.
pe=images['cdtank.exe'];image=pe.get_memory_mapped_image();base=pe.OPTIONAL_HEADER.ImageBase
spatial=[struct.unpack_from('<f',image,a-base)[0] for a in (0x5c1540,0x5ccff8,0x5c1da4)]
assert spatial==[100,2,1600]
assert bytes(uc.mem_read(0x416ab3,12))==bytes.fromhex('e81cb115008bc8e8e0b31500')
prior=json.loads((ROOT/'recovery/output/skill-effect-actor-native.json').read_text())
loop=next(r for r in prior['audio'] if r['selector']==-1)
assert [e['value'] for e in loop['events'] if e['kind']=='sourcef' and e['parameter'] in (0x1020,0x1021,0x1023)]==spatial
out=dict(status='PASS',rows=rows,spatial=dict(referenceDistance=100,rolloffFactor=2,maxDistance=1600,distanceModel='linear-clamped'),
    source=dict(constructor='0x462b6c',loader='0x45eaab → 0x461f60',enable='0x462934 → 0x462160 → 0x485b1b',update='0x45f07e',disable='0x462934 → 0x48568d',managerOverride='0x416a93 → 0x571e9f'),
    boundaries=['common placement header', 'stream and string IO', 'navigation/effect callbacks', 'WAV manager play/gain/stop'],
    sharedOpenALExecution='skill-effect-actor-native.json selector -1')
(ROOT/'recovery/output/scene-environment-sound21-native.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS: three original Sound loaders / spatial defaults / enable-loop / zero interval / disable-stop')
