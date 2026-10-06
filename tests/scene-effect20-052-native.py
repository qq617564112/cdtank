"""Execute original map Effect headers, tails, startup traversal and shutdown."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from scene import read_scene

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x100000)
STACK, STOP, STREAM, STREAM_VT, MANAGER, NODE_VT, SLOTS, RESULT = [0x2008000 + 0x1000*i for i in range(8)]
READ, BIND, IDENTITY, MULTIPLY = [STOP + 0x100 + 0x100*i for i in range(4)]
heap = 0x2050000
raw = b''
cursor = 0
events = []

def put(a, *values):
    uc.mem_write(a, struct.pack('<'+'I'*len(values), *[v & 0xffffffff for v in values]))

def uint(a):
    return struct.unpack('<I', uc.mem_read(a, 4))[0]

def finish(value=0, pop=0):
    s = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, uint(s))
    uc.reg_write(UC_X86_REG_ESP, s+4+pop)

def call(a, this, *args, cdecl=False):
    put(STACK, STOP, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(a, STOP, count=200000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK+4+(0 if cdecl else 4*len(args))

def read(n):
    global cursor
    value = raw[cursor:cursor+n]
    assert len(value) == n
    cursor += n
    return value

def string(a):
    start = uint(a+4) if uint(a+0x18) >= 16 else a+4
    return bytes(uc.mem_read(start, uint(a+0x14))).decode('ascii')

def hook(machine, a, size, data):
    global heap
    s, c = machine.reg_read(UC_X86_REG_ESP), machine.reg_read(UC_X86_REG_ECX)
    if a == READ:
        target, n = uint(s+4), uint(s+8)
        uc.mem_write(target, read(n)); finish(n, 8)
    elif a == 0x57476c:
        target = uint(s+4)
        n = struct.unpack('<I', read(4))[0]
        value = read(n)
        if n < 16:
            uc.mem_write(target+4, value+b'\0'); put(target+0x14, n, 15)
        else:
            put(target+4, heap); uc.mem_write(heap, value+b'\0'); heap += 0x100
            put(target+0x14, n, n)
        finish(target, 4)
    elif a == 0x461cbe:
        # Common object allocation/initialization is a supplied boundary.
        uc.mem_write(uint(c+0xd8)+0x58, b'\1')
        finish(c)
    elif a == 0x4015e3:
        finish(c, 4)
    elif a == 0x44e6e1:
        finish(273)
    elif a == 0x44db88:
        uc.mem_write(c+0x64, bytes([uint(s+4)])); finish(0, 4)
    elif a in (0x461ded, 0x462846, 0x44de02):
        events.append(dict(kind={0x461ded:'nav-enable', 0x462846:'nav-disable', 0x44de02:'transform-update'}[a], object=c))
        finish()
    elif a == 0x48568d:
        uc.mem_write(uint(s+4), bytes(24)); finish()
    elif a == 0x485b1b:
        assert bytes(uc.mem_read(uint(s+8), 1)) == b'\0'
        events.append(dict(kind='empty-object-sound', selector=uint(s+16), spatial=True))
        uc.mem_write(uint(s+4), bytes(24)); finish(uint(s+4))
    elif a == 0x47b81b:
        finish(MANAGER)
    elif a == 0x47b484:
        name = string(uint(s+4))
        assert name == '_root\\online\\052'
        events.append(dict(kind='lookup', name=name)); finish(1634131803)
    elif a == 0x4795fa:
        assert c == MANAGER and uint(s+8) == 1
        node = heap; heap += 0x100
        put(node, NODE_VT)
        events.append(dict(kind='create', id=uint(s+4), retain=uint(s+8), node=node))
        finish(node, 8)
    elif a == 0x47a770:
        events.append(dict(kind='active', node=uint(s+4))); finish(0, 4)
    elif a == IDENTITY:
        uc.mem_write(c, struct.pack('<16f', 1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)); finish(c)
    elif a == MULTIPLY:
        uc.mem_write(c, bytes(uc.mem_read(uint(s+4), 64))); finish(c, 4)
    elif a == 0x45859f:
        events.append(dict(kind='retain-matrix-reference', reference=c)); finish()
    elif a == BIND:
        events.append(dict(kind='bind', node=c, matrix=list(struct.unpack('<16f', uc.mem_read(uint(s+4), 64))), reference=uint(s+8)))
        finish(0, 8)
    elif a in (0x47f3c4, 0x47f262):
        events.append(dict(kind='stop' if a == 0x47f3c4 else 'release', node=c)); finish()

uc.hook_add(UC_HOOK_CODE, hook)
put(STREAM, STREAM_VT); put(STREAM_VT+0xc, READ)
put(NODE_VT+0x34, BIND)
put(0x5c0b7c, IDENTITY); put(0x5c096c, MULTIPLY)
uc.mem_write(MANAGER+0x64, b'\1')
source = ROOT / 'recovery/output/verified/assets/data/Data/scn/0020/0020.obj'
data = source.read_bytes()
records = [r for r in read_scene(source) if r['className'] == 'SYcScnObjEffect']
assert [r['id'] for r in records] == ['269','270','271','272','273']
rows = []
for index, record in enumerate(records):
    obj, sub, matrix, reference = [0x2020000+index*0x1000+offset for offset in (0,0x200,0x400,0x500)]
    put(obj+0xd8, sub); put(obj+0x78, obj+0x600); put(sub+0x7c, matrix, reference)
    call(0x45eaf2, obj)
    assert uint(obj) == 0x5c75d8 and bytes(uc.mem_read(obj+0x64, 1)) == b'\0'
    offset = record['offset']+8+len(record['className'].encode())
    raw = data[offset:offset+4+4+len(record['id'])+4+len(record['model'])+12+1+12+64+12+42]
    cursor = 0
    call(0x45e50b, obj, STREAM)
    assert cursor == len(raw)
    assert string(obj+4) == record['id'] and string(sub+0x60) == '_root\\online\\052'
    assert uint(sub+0x24+0x14) == 0 and uint(sub+0x5c) == 0
    assert bytes(uc.mem_read(obj+0x64, 1)) == b'\1'
    uc.mem_write(obj+0x600, struct.pack('<16f', *record['matrix']))
    put(SLOTS+index*8, obj, 0)
    rows.append(dict(id=record['id'], object=obj, sub=sub, offset=record['offset'], enabled=record['enabled'], position=record['position'], matrix=record['matrix']))

# Original map late-load block dispatches this exact traversal/functor pair.
call(0x4489f8, 0, RESULT, SLOTS, SLOTS+8*len(rows), 0x4581b3, 0, cdecl=True)
startup = list(events)
assert len([e for e in events if e['kind']=='create']) == 5
assert len([e for e in events if e['kind']=='bind']) == 5
for row, bound in zip(rows, [e for e in events if e['kind']=='bind']):
    assert bound['matrix'] == list(row['matrix'])
    assert uint(row['sub']+0x84) == bound['node']
events.clear()
for row in rows:
    call(0x45795d, row['object'], 0x3dcccccd)
assert events == []
for row in rows:
    call(0x462934, row['object'], 0)
    assert uint(row['sub']+0x84) == 0
shutdown = list(events)
assert len([e for e in shutdown if e['kind']=='stop']) == 5
assert len([e for e in shutdown if e['kind']=='release']) == 5
library = json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
nodes = [n for n in library['nodes'] if n['name']=='_root\\online\\052' or n['name'].startswith('_root\\online\\052\\')]
assert [n['type'] for n in nodes] == [0,1,1]
timings = [r for r in library['nodeTimings'] if r['node'] in [n['index'] for n in nodes]]
assert all(r['delay']==0 and r['lifetime']==0 for r in timings)
out = dict(status='PASS', rows=rows, startup=startup, updateEvents=[], shutdown=shutdown,
    nodes=nodes, timings=timings,
    source=dict(mapProducer='0x45baa6–0x45bacc → 0x4489f8 → 0x4581b3', constructor='0x45eaf2', loader='0x45e50b → 0x461f60 → 0x44ea18', startup='0x46228f', manager='0x47b535 → 0x47aead', transform='0x4620e9 → 0x45bf6c', update='0x45795d', disable='0x462934 → 0x461e8f'),
    boundaries=['common object allocation/initialization', 'stream and string storage and header identifier registration', 'effect name-to-ID lookup and tree allocation/active registration', 'matrix arithmetic and reference increment', 'effect tree bind/stop/release callbacks', 'navigation and object transform callbacks', 'empty sound descriptor supplied; original empty lookup verified separately'])
(ROOT/'recovery/output/scene-effect20-052-native.json').write_text(json.dumps(out,indent=2)+'\n')
pe = images['cdtank.exe']; image = pe.get_memory_mapped_image(); base = pe.OPTIONAL_HEADER.ImageBase
disassembler = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
lines = []
for address, length in [(0x45baa6,38),(0x4489f8,40),(0x4581b3,5),(0x45eaf2,55),(0x45e50b,33),(0x46228f,201),(0x4620e9,38),(0x47aead,46),(0x45795d,5),(0x461e8f,56),(0x462934,105)]:
    lines.extend(f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in disassembler.disasm(image[address-base:address-base+length],address))
(ROOT/'recovery/output/scene-effect20-052-native.disasm.txt').write_text('\n'.join(lines)+'\n')
print('PASS: five original Effect headers/tails, map startup, retained matrix binding, no-op updates and disable/release')
