"""Execute original engine quad writer, stubbing only allocation/draw/memcpy."""
from hashlib import sha256
import json
from pathlib import Path
import struct

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'CDTank/gbengine.dll'
pe = pefile.PE(str(source))
machine = Uc(UC_ARCH_X86, UC_MODE_32)
base = pe.OPTIONAL_HEADER.ImageBase
machine.mem_map(base, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
machine.mem_write(base, pe.get_memory_mapped_image())
machine.mem_map(0x2000000, 0x30000)
STACK, OBJECT, VTABLE, QUAD, BUFFER = 0x2008000, 0x2010000, 0x2011000, 0x2012000, 0x2020000
ALLOC, DRAW, STOP = 0x2014000, 0x2015000, 0x2016000
EFFECT_WRAPPER, EFFECT, EFFECT_VTABLE = 0x2017000, 0x2018000, 0x2019000
BEGIN, BEGIN_PASS, END_PASS, END = 0x201a000, 0x201b000, 0x201c000, 0x201d000


def read_int(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def return_call(args):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, read_int(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + args * 4)


calls = []


def hook(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == ALLOC:
        calls.append({'allocateVertices': read_int(stack + 4)})
        uc.reg_write(UC_X86_REG_EAX, BUFFER)
        return_call(1)
    elif address == DRAW:
        calls.append({'drawArgs': [read_int(stack + offset) for offset in [4, 8, 12]]})
        return_call(3)
    elif address == 0x1003c106:
        dest, src, length = [read_int(stack + offset) for offset in [4, 8, 12]]
        uc.mem_write(dest, bytes(uc.mem_read(src, length)))
        uc.reg_write(UC_X86_REG_EAX, dest)
        return_call(0)  # cdecl: caller pops memcpy args
    elif address == BEGIN:
        effect, count_pointer, flags = [read_int(stack + o) for o in [4, 8, 12]]
        assert effect == EFFECT
        calls.append({'beginFlags': flags})
        uc.mem_write(count_pointer, struct.pack('<I', 2))
        return_call(3)
    elif address == BEGIN_PASS:
        assert read_int(stack + 4) == EFFECT
        calls.append({'beginPass': read_int(stack + 8)})
        return_call(2)
    elif address in [END_PASS, END]:
        assert read_int(stack + 4) == EFFECT
        calls.append({'endPass' if address == END_PASS else 'end': True})
        return_call(1)


machine.hook_add(UC_HOOK_CODE, hook)
machine.mem_write(OBJECT, struct.pack('<I', VTABLE))
machine.mem_write(VTABLE + 12, struct.pack('<I', ALLOC))
machine.mem_write(VTABLE + 20, struct.pack('<I', DRAW))
corners = [[-2, -3, 5], [7, -11, 13], [17, 19, 23], [-29, 31, 37]]
rows = []
for screen in [False, True]:
    for uv in [[0, 0, .25, .25], [.75, .75, 1, 1], [.6, 0, 1.2, 1 / 3]]:
        for color in [0, 0xff00ffff, 0x12ab34cd]:
            calls.clear()
            machine.mem_write(OBJECT + 12, struct.pack('<I', 0x114 if screen else 0x15))
            machine.mem_write(QUAD, struct.pack('<16fI', *[v for c in corners for v in c], *uv, color))
            machine.mem_write(STACK, struct.pack('<5I', STOP, QUAD, 1, 0x12345678, 0x87654321))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.emu_start(0x100258a0, STOP, count=4000)
            assert calls == [{'allocateVertices': 6}, {'drawArgs': [1, 0x12345678, 0x87654321]}]
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 20
            stride = 28 if screen else 24
            vertices = []
            for index in range(6):
                raw = bytes(machine.mem_read(BUFFER + stride * index, stride))
                position = list(struct.unpack_from('<3f', raw))
                offset = 16 if screen else 12
                vertex = {'position': position, 'color': struct.unpack_from('<I', raw, offset)[0],
                          'uv': list(struct.unpack_from('<2f', raw, offset + 4))}
                if screen:
                    vertex['rhw'] = struct.unpack_from('<f', raw, 12)[0]
                vertices.append(vertex)
            rows.append({'screenSpace': screen, 'corners': corners, 'uv': uv,
                         'color': color, 'vertices': vertices})
(ROOT / 'recovery/output/effect-quad-native.json').write_text(json.dumps({
    'sourceSha256': sha256(source.read_bytes()).hexdigest(), 'rows': rows}) + '\n')
print(f'PASS: original engine quad writer executed for {len(rows)} geometry/UV/color/FVF cases')

# Verify wrapper COM call arguments by executing the original engine functions.
machine.mem_write(EFFECT_WRAPPER + 0x14, struct.pack('<I', EFFECT))
machine.mem_write(EFFECT, struct.pack('<I', EFFECT_VTABLE))
for offset, target in [(0xfc, BEGIN), (0x100, BEGIN_PASS), (0x108, END_PASS), (0x10c, END)]:
    machine.mem_write(EFFECT_VTABLE + offset, struct.pack('<I', target))


def wrapper_call(address, *args):
    machine.mem_write(STACK, struct.pack('<' + 'I' * (len(args) + 1), STOP, *args))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, EFFECT_WRAPPER)
    machine.emu_start(address, STOP, count=2000)


calls.clear()
wrapper_call(0x10026400)
assert calls == [{'beginFlags': 0}]
assert machine.reg_read(UC_X86_REG_EAX) == 2
wrapper_call(0x10026890, 0)
wrapper_call(0x10026420)
wrapper_call(0x10026890, 1)
wrapper_call(0x10026420)
machine.mem_write(EFFECT_WRAPPER + 0x1c, struct.pack('<I', 0x12345678))
wrapper_call(0x10026430)
assert read_int(EFFECT_WRAPPER + 0x1c) == 0
expected = [{'beginFlags': 0}, {'beginPass': 0}, {'endPass': True},
            {'beginPass': 1}, {'endPass': True}, {'end': True}]
assert calls == expected
calls.clear()
wrapper_call(0x10026450)
assert calls == [{'beginFlags': 3}, *expected[1:]]
print('PASS: native effect Begin(flags=0), ordered passes/End and Apply(flags=3) COM calls')
