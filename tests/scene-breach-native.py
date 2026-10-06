"""Execute original Breach field loader against all supplied serialized tails.

Common placement loading, stream I/O and MSVC string storage are substitutes.
Branching, field destination offsets, scalar sizes and extension consumption
execute the original EXE. This does not execute renderers or server rules.
"""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from scene import read_scene
from scene_breach import decode_breach_tail, encode_breach_tail

exe = ROOT / 'CDTank/CDTank.exe'
pe = pefile.PE(str(exe))
uc = Uc(UC_ARCH_X86, UC_MODE_32)
uc.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
uc.mem_write(0x400000, pe.get_memory_mapped_image())
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x20000)
OBJ, DATA, STREAM, VTABLE, READ, STACK, STOP = (
    0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2014000, 0x2008000, 0x201f000)
payload = b''
cursor = 0
strings = {}
trace = []


def uint(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(pop):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EIP, uint(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def take(size):
    global cursor
    result = payload[cursor:cursor + size]
    assert len(result) == size
    cursor += size
    return result


def hook(machine, address, size, user):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x44ea18:
        # Header is tested separately by scene-placements.py; input begins at tail.
        finish(4)
    elif address == READ:
        destination, count = uint(stack + 4), uint(stack + 8)
        raw = take(count)
        machine.mem_write(destination, raw)
        trace.append({'offset': destination - DATA, 'size': count})
        finish(8)
    elif address == 0x57476c:
        destination = uint(stack + 4)
        length = struct.unpack('<I', take(4))[0]
        strings[destination - DATA] = take(length).decode('gbk')
        trace.append({'offset': destination - DATA, 'stringLength': length})
        finish(4)


uc.hook_add(UC_HOOK_CODE, hook)
uc.mem_write(STREAM, struct.pack('<I', VTABLE))
uc.mem_write(VTABLE + 0xc, struct.pack('<I', READ))
rows = []
for path in sorted((ROOT / 'recovery/output/verified/assets/data/Data/scn').rglob('*.obj')):
    for record in read_scene(path):
        if record['className'] != 'SYcScnObjBreach':
            continue
        payload = bytes.fromhex(record['tail'])
        fields = decode_breach_tail(payload)
        assert encode_breach_tail(fields) == payload
        uc.mem_write(OBJ, bytes(0x200))
        uc.mem_write(DATA, bytes(0x200))
        uc.mem_write(OBJ + 0xd8, struct.pack('<I', DATA))
        uc.mem_write(STACK, struct.pack('<II', STOP, STREAM))
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, OBJ)
        cursor = 0
        strings.clear()
        trace.clear()
        # Derived reader calls the Breach reader then consumes the shared extension stamp.
        uc.emu_start(0x45e50b, STOP, count=10000)
        assert cursor == len(payload)
        assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
        assert strings == {4: fields['field04'], 0x24: fields['field24'], 0x60: fields['field60']}
        assert bytes(uc.mem_read(DATA + 0x20, 1)) == bytes([fields['field20']])
        assert bytes(uc.mem_read(DATA + 0x5c, 4)) == struct.pack('<f', fields['field5c'])
        assert bytes(uc.mem_read(DATA + 0x88, 1)) == bytes([fields['field88']])
        rows.append({'map': path.stem, 'id': record['id'], 'offset': record['offset'],
                     'fields': fields, 'trace': list(trace)})
assert len(rows) == 1144
output = {'source': str(exe), 'sha256': sha256(exe.read_bytes()).hexdigest(),
          'reader': '0x45e50b -> 0x461f60',
          'substitutes': ['common placement header', 'stream I/O', 'MSVC string storage'],
          'rows': rows}
(ROOT / 'recovery/output/scene-breach-native.json').write_text(json.dumps(output) + '\n')
print(f'PASS: {len(rows)} supplied Breach payloads: original native branches/field offsets/scalar reads/extension consumption; byte roundtrip')
