"""Execute selector1 text draw through the original Font service call boundary."""
import json
import struct
import sys
from pathlib import Path

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

u, _ = map_original_binaries([ROOT / 'CDTank' / 'CDTank.exe'])
u.mem_map(0, 4096)
u.mem_map(0x2000000, 0x10000)
RECORD, STACK, STOP, FONT, EXTENT = [0x2001000 + i * 0x1000 for i in range(5)]
calls = []


def word(address):
    return struct.unpack('<I', u.mem_read(address, 4))[0]


def floats(address, count=1):
    return list(struct.unpack('<' + 'f' * count, u.mem_read(address, count * 4)))


def finish(pop, value=0):
    stack = u.reg_read(UC_X86_REG_ESP)
    u.reg_write(UC_X86_REG_EAX, value)
    u.reg_write(UC_X86_REG_EIP, word(stack))
    u.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(machine, address, size, data):
    stack, context = u.reg_read(UC_X86_REG_ESP), u.reg_read(UC_X86_REG_ECX)
    kind = services[address]
    if kind == 'rect':
        u.mem_write(context, bytes(u.mem_read(stack + 4, 16)))
        finish(16, context)
    elif kind == 'colour':
        finish(4, context)
    elif kind == 'colourRect':
        finish(4, context)
    elif kind == 'alpha':
        calls.append(dict(kind='alpha', value=floats(stack + 4)[0]))
        finish(4)
    elif kind == 'string':
        value = bytes(u.mem_read(word(stack + 4), 32)).split(b'\0')[0].decode('ascii')
        calls.append(dict(kind='string', value=value))
        finish(4, context)
    elif kind == 'stringDispose':
        finish(0)
    elif kind == 'extent':
        calls.append(dict(kind='extent', font=context, scale=floats(stack + 8)[0]))
        # Actual x87 float return and callee stack cleanup; width is an external service input.
    elif kind == 'draw':
        calls.append(dict(kind='draw', font=context, area=floats(word(stack + 8), 4),
                          z=floats(stack + 12)[0], clip=floats(word(stack + 16), 4),
                          formatting=word(stack + 20),
                          scaleX=floats(stack + 28)[0], scaleY=floats(stack + 32)[0]))
        finish(32)


services = {}
for index, (iat, kind) in enumerate([
    (0x5c03d8, 'rect'), (0x5c02c4, 'colour'), (0x5c02c8, 'colourRect'),
    (0x5c02cc, 'alpha'), (0x5c03b8, 'string'), (0x5c02d0, 'extent'),
    (0x5c0330, 'stringDispose'), (0x5c02d8, 'draw'),
]):
    address = 0x200a000 + index * 0x100
    u.mem_write(iat, struct.pack('<I', address))
    services[address] = kind
    if kind == 'extent':
        u.mem_write(address, b'\xd9\x05' + struct.pack('<I', EXTENT) + b'\xc2\x08\x00')
    u.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)


def execute(alpha, scale, width):
    calls.clear()
    u.mem_write(RECORD, bytes(0x48))
    u.mem_write(RECORD, struct.pack('<2f', 320, 180))
    u.mem_write(RECORD + 0xc, b'43\0')
    u.mem_write(RECORD + 0x20, struct.pack('<I', 15))
    u.mem_write(RECORD + 0x24, struct.pack('<I3fI', 1, scale, alpha, 0, FONT))
    u.mem_write(EXTENT, struct.pack('<f', width))
    u.mem_write(0x635824, struct.pack('<2I', 800, 600))
    u.mem_write(STACK, struct.pack('<I', STOP))
    u.reg_write(UC_X86_REG_ESP, STACK)
    u.reg_write(UC_X86_REG_ECX, RECORD)
    u.emu_start(0x465196, STOP, count=10000)
    assert u.reg_read(UC_X86_REG_EIP) == STOP
    assert u.reg_read(UC_X86_REG_ESP) == STACK + 4
    return dict(alpha=alpha, scale=scale, suppliedTextExtent=width, calls=list(calls))


rows = [execute(*values) for values in [(1, 1, 44), (0.5, 0.75, 33), (0, 1, 44), (-0.5, 1, 44)]]
for row in rows[:2]:
    draw, = [c for c in row['calls'] if c['kind'] == 'draw']
    x = 320 - row['suppliedTextExtent'] / 2
    assert draw == dict(kind='draw', font=FONT, area=[x, 180, x, 180], z=0,
                        clip=[0, 0, 800, 600], formatting=0,
                        scaleX=row['scale'], scaleY=row['scale'])
    assert [c['value'] for c in row['calls'] if c['kind'] == 'alpha'] == [row['alpha']]
    assert [c['value'] for c in row['calls'] if c['kind'] == 'string'] == ['43', '43']
assert all(not row['calls'] for row in rows[2:])
out = dict(status='PASS_SELECTOR1_FONT_SERVICE_BOUNDARY', entry='0x465196', rows=rows,
           scope='Original selector1 branch executes with supplied record, viewport and Font extent. CEGUI constructors, extent and draw are recording services; no glyph pixels, full Font initialization, camera projection, ordinary battle or GPU output is established.')
(ROOT / 'recovery/output/castle-damage-text-draw-native.json').write_text(json.dumps(out, indent=2) + '\n')
print('PASS: selector1 original centering/scale/alpha/clip and nonpositive-alpha draw rejection')
