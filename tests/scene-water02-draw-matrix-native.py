"""Execute water Attach matrix scopes and the original render-priority comparison."""
import json
from pathlib import Path
import struct
import sys

import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll'])
uc.mem_map(0x2000000, 0x20000)
OBJ, WATER, WAVES, VT, ATTACH, GFX, HOLDER, STACK, STOP, UVSTACK, WORLDSTACK, UVDATA, WORLDDATA, QUEUE = [
    0x2000000 + i * 0x1000 for i in range(14)]


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def get(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def matrix(address):
    return list(struct.unpack('<16f', uc.mem_read(address, 64)))


def finish(pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EIP, get(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


observed = []


def cstring(address):
    value = bytearray()
    while uc.mem_read(address, 1) != b'\0':
        value.extend(uc.mem_read(address, 1))
        address += 1
    return bytes(value)


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x1003c106:
        # memcpy endpoint; native Push and Translate execute unchanged.
        target, source, length = [get(stack + offset) for offset in [4, 8, 12]]
        machine.mem_write(target, bytes(machine.mem_read(source, length)))
        machine.reg_write(UC_X86_REG_EAX, target)
        finish()
    elif address == ATTACH:
        observed.append(dict(node='water' if machine.reg_read(UC_X86_REG_ECX) == WATER else 'waves',
                             effect=get(stack + 4),
                             world=matrix(WORLDDATA + get(WORLDSTACK + 8) * 64),
                             matex0=matrix(UVDATA + get(UVSTACK + 8) * 64)))
        finish(4)
    elif address == 0x10037140:
        # Profiling endpoint does not participate in material selection.
        finish()
    elif address == 0x1001d970:
        machine.reg_write(UC_X86_REG_EAX, 0)
        finish(4)
    elif address == STOP + 0x10:
        string_pointer, needle_pointer = get(stack + 4), get(stack + 8)
        index = cstring(string_pointer).find(cstring(needle_pointer))
        machine.reg_write(UC_X86_REG_EAX, string_pointer + index if index >= 0 else 0)
        finish()


for endpoint in [0x1003c106, ATTACH]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=endpoint, end=endpoint)
identity = [1.0 if i % 5 == 0 else 0.0 for i in range(16)]
put(0x635830, HOLDER)
put(HOLDER + 8, GFX)
put(GFX + 0xd4, WORLDSTACK, UVSTACK)
put(UVSTACK, UVDATA, 4, 0, 0)
put(WORLDSTACK, WORLDDATA, 4, 0, 0)
uc.mem_write(UVDATA, struct.pack('<16f', *identity))
uc.mem_write(WORLDDATA, struct.pack('<16f', *identity))
put(WATER, VT)
put(WAVES, VT)
put(VT + 0x10, ATTACH)
put(OBJ + 0x80, WATER, WAVES)
uc.mem_write(OBJ + 0x88, b'\1')
uc.mem_write(OBJ + 0x8c, struct.pack('<f', 1.25))
put(OBJ + 0x90, 0)
put(STACK, STOP)
uc.reg_write(UC_X86_REG_ESP, STACK)
uc.reg_write(UC_X86_REG_ECX, OBJ)
uc.emu_start(0x462dc6, STOP, count=10000)
assert uc.reg_read(UC_X86_REG_EIP) == STOP
assert [entry['node'] for entry in observed] == ['water', 'waves']
expected_uv = identity.copy()
expected_uv[13] = 1.25
assert observed[0]['matex0'] == expected_uv
assert observed[1]['matex0'] == identity
assert all(entry['world'] == identity and entry['effect'] == 0 for entry in observed)
assert get(UVSTACK + 8) == 0 and matrix(UVDATA) == identity

put(0x10055404, QUEUE)
put(QUEUE + 0x14, 0)
put(QUEUE + 0xf4 + 0x14, (-101) & 0xffffffff)
put(HOLDER, 0, 1)
put(STACK, STOP, HOLDER, HOLDER + 4)
uc.reg_write(UC_X86_REG_ESP, STACK)
uc.emu_start(0x1001a5a0, STOP, count=10000)
comparison = struct.unpack('<i', struct.pack('<I', uc.reg_read(UC_X86_REG_EAX)))[0]
assert comparison == -101

# Execute the original FVF/name selector up to the assembled effect flags.
for endpoint in [0x10037140, 0x1001d970, STOP + 0x10]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=endpoint, end=endpoint)
put(0x1003f308, STOP + 0x10)
put(0x10055d14, GFX)
put(GFX + 0x590, 0)
put(0x100534b4, 0)
put(WATER + 0x128, WORLDDATA)
put(WORLDDATA + 0x38, 21)
put(UVDATA, 1, 0)
selectors = []
for name in ['_water', '_waves']:
    uc.mem_write(WORLDDATA + 0x18, name.encode() + b'\0')
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ESI, WATER)
    uc.reg_write(UC_X86_REG_EDI, UVDATA)
    uc.emu_start(0x1001206d, 0x10012164, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == 0x10012164
    selectors.append(dict(name=name, fvf=21, kind=1, fogMode=0,
                          flags=hex(uc.reg_read(UC_X86_REG_EBX))))
assert [row['flags'] for row in selectors] == ['0x8881', '0x881']

pe = images['gbengine.dll']
binary = pe.get_memory_mapped_image()
parameters = []
for index in range(11):
    pointer = struct.unpack_from('<I', binary, 0x531ac + index * 4)[0]
    name = binary[pointer - 0x10000000:].split(b'\0')[0].decode('ascii')
    parameters.append(dict(index=index, name=name))
assert parameters[9]['name'] == 'matex0'
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [(0x10026260, 0x100262f2), (0x1001bea9, 0x1001bebc),
          (0x10012142, 0x10012164), (0x1002734b, 0x1002738f),
          (0x10027290, 0x100272a1)]
sources = []
for start, end in ranges:
    sources.append(dict(start=hex(start), end=hex(end), instructions=[
        dict(address=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}')
        for i in decoder.disasm(binary[start - 0x10000000:end - 0x10000000], start)]))
result = dict(status='PASS_DRAW_MATRIX_NATIVE_ONLY', attaches=observed,
              priorityComparison=dict(lhs=0, rhs=-101, result=comparison),
              effectParameters=parameters, effectSelectors=selectors, sources=sources,
              sourceShader='Data/gfxscript/water_effect.gbf',
              scope='Original462dc6 and DLL Push/Translate/Pop execute; Attach and memcpy recorded endpoints. '
                    'Original comparator executes. Parameter table and named water shader selection are source evidence. '
                    'No original GPU execution, corrected browser output, or terrain-depth acceptance.')
target = ROOT / 'recovery/output/scene-water02-draw-matrix-native.json'
target.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
