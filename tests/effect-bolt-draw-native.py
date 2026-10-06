"""Execute original type2 ribbon builder and DLL triangle-strip vertex writer."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0x2000000, 0x100000)
OBJECT, DEFINITION, RESOURCE, WORLD, GEOMETRY = 0x2010000, 0x2011000, 0x2012000, 0x2020000, 0x2030000
GFX, VTABLE, DEVICE, MATRIX, CAMERA, EYE = 0x2040000, 0x2041000, 0x2042000, 0x2043000, 0x2044000, 0x2045000
BUFFER, VERTICES, GET_CAMERA, ALLOCATE, SUBMIT = 0x2046000, 0x2050000, 0x2048000, 0x2048010, 0x2048020
STACK, STOP = 0x2008000, 0x204f000

def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]

def write_uint(address, value):
    machine.mem_write(address, struct.pack('<I', value))

allocated = 0
submitted = []
script = 0
stack_calls = []

def hook(uc, address, size, data):
    global allocated, script
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == GET_CAMERA:
        value, cleanup = CAMERA, 0
    elif address == 0x44ef01:
        value, cleanup = EYE, 0
    elif address == uint(0x5c09ec):
        value, cleanup = MATRIX, 0
    elif address == ALLOCATE:
        allocated = uint(stack + 4)
        value, cleanup = VERTICES, 4
    elif address == SUBMIT:
        submitted.append([uint(stack + offset) for offset in [4, 8, 12]])
        value, cleanup = 0, 12
    elif address == 0x47b81b:
        value, cleanup = 0x2049000, 0
    elif address == 0x4794c2:
        script = uint(stack + 4)
        value, cleanup = 0x7000 + script, 4
    elif address == uint(0x5c0b54):
        assert uint(stack + 4) == 0x15
        value, cleanup = BUFFER, 4
    elif address in [uint(0x5c0a78), uint(0x5c0aa0), uint(0x5c0a7c)]:
        stack_calls.append(address)
        value, cleanup = 0, 0
    else:
        return
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, uint(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + cleanup)

machine.hook_add(UC_HOOK_CODE, hook)
for address, value in [(0x635830, GFX), (GFX, VTABLE), (GFX + 8, DEVICE),
                       (DEVICE + 0xd4, MATRIX), (VTABLE + 0x28, GET_CAMERA),
                       (BUFFER, VTABLE), (VTABLE + 0xc, ALLOCATE), (VTABLE + 0x14, SUBMIT),
                       (OBJECT + 12, DEFINITION), (DEFINITION + 0x150, RESOURCE),
                       (OBJECT + 0x80, WORLD), (OBJECT + 0x90, GEOMETRY)]:
    write_uint(address, value)

library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
sources = json.loads((ROOT / 'recovery/output/effect-bolt-segments-native.json').read_text())['rows']
identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
matrices = [identity, [0, 0, -1, 0, 0, 1.25, 0, 0, .75, 0, 0, 0, 5, -2, 7, 1]]
rows = []
for node in library['nodes']:
    if node['type'] != 2:
        continue
    source = next(row for row in sources if row['node'] == node['index'])
    segments = source['worldSegments']
    raw = bytes.fromhex(node['resource'])
    machine.mem_write(RESOURCE + 0x148, raw[324:])
    machine.mem_write(WORLD, b''.join(struct.pack('<10f', *segment) for segment in segments))
    write_uint(OBJECT + 0x68, len(segments))
    for matrix in matrices:
        machine.mem_write(MATRIX, struct.pack('<16f', *matrix))
        for eye in [[20, 10, -15], [0, 2, 60], [-40, -12, 5]]:
            machine.mem_write(EYE, struct.pack('<3f', *eye))
            machine.mem_write(GEOMETRY, bytes((len(segments) + 1) * 68))
            machine.mem_write(STACK, struct.pack('<I', STOP))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.reg_write(UC_X86_REG_FPCW, 0x27f)
            machine.emu_start(0x47d56e, STOP, count=1000000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4
            slices = [dict(left=list(struct.unpack('<3f', machine.mem_read(GEOMETRY + index * 68, 12))),
                           right=list(struct.unpack('<3f', machine.mem_read(GEOMETRY + index * 68 + 36, 12))))
                      for index in range(len(segments) + 1)]
            submitted.clear()
            machine.mem_write(STACK, struct.pack('<5I', STOP, GEOMETRY, len(segments) + 1, 0x1234, 0x5678))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, BUFFER)
            machine.emu_start(0x10025dc0, STOP, count=1000000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 20
            assert allocated == 2 * (len(segments) + 1)
            assert submitted == [[3, 0x1234, 0x5678]]
            vertices = []
            for index in range(allocated):
                position = list(struct.unpack('<3f', machine.mem_read(VERTICES + index * 24, 12)))
                vertices.append(dict(position=position, color=uint(VERTICES + index * 24 + 12),
                                     uv=list(struct.unpack('<2f', machine.mem_read(VERTICES + index * 24 + 16, 8)))))
            rows.append(dict(node=node['index'], segments=segments, matrix=matrix, eye=eye,
                             width=struct.unpack_from('<f', raw, 352)[0], color=struct.unpack_from('<I', raw, 372)[0],
                             slices=slices, vertices=vertices))
    submitted.clear()
    stack_calls.clear()
    write_uint(OBJECT + 0x60, 0x87654321)
    machine.mem_write(STACK, struct.pack('<II', STOP, 0))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, OBJECT)
    machine.emu_start(0x47d935, STOP, count=1000000)
    assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert script == (7 if raw[380] == 1 else 6)
    assert len(submitted) == 1 and submitted[0][:2] == [3, 0x7000 + script]
    assert uint(submitted[0][2]) == 0x87654321
    assert stack_calls == [uint(0x5c0a78), uint(0x5c0aa0), uint(0x5c0a7c)]
(ROOT / 'recovery/output/effect-bolt-draw-native.json').write_text(json.dumps(dict(rows=rows)) + '\n')
(ROOT / 'recovery/output/web-assets/effect-bolt-browser-native.json').write_text(json.dumps(dict(rows=[row for row in rows if row['node'] == 131])) + '\n')
print(f'PASS: {len(rows)} original type2 camera ribbon / DLL vertex submissions; 101 complete draw-entry script/material dispatches')
