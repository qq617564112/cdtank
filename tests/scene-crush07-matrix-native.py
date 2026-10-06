"""Execute the original base-object matrix allocation and placement update."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX,
                              UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESI,
                              UC_X86_REG_ESP, UC_X86_REG_EBX)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from scene import read_scene

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll',
                                  ROOT / 'CDTank/msvcr71.dll'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
OBJ, MATRIX, OWNER, STACK, STOP = [0x2001000 + i * 0x2000 for i in range(5)]
allocations = []


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def get(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def allocate(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    requested = get(stack + 4)
    assert requested in (0x40, 0x18)
    pointer = MATRIX if requested == 0x40 else OWNER
    allocations.append(dict(bytes=requested, pointer=pointer))
    machine.reg_write(UC_X86_REG_EAX, pointer)
    machine.reg_write(UC_X86_REG_EIP, get(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4)


uc.hook_add(UC_HOOK_CODE, allocate, begin=0x578620, end=0x578620)
# Execute the contiguous matrix-construction portion of the base constructor.
# String/identity bookkeeping outside this portion is not part of this sample.
uc.reg_write(UC_X86_REG_ESI, OBJ)
uc.reg_write(UC_X86_REG_EBX, 0)
uc.reg_write(UC_X86_REG_EBP, STACK + 0x100)
uc.reg_write(UC_X86_REG_ESP, STACK)
uc.emu_start(0x44ee10, 0x44ee62, count=10000)
assert uc.reg_read(UC_X86_REG_EIP) == 0x44ee62
assert uc.reg_read(UC_X86_REG_ESP) == STACK
assert [get(OBJ + 0x78), get(OBJ + 0x7c)] == [MATRIX, OWNER]
assert get(OWNER + 0x10) == MATRIX
assert [get(OWNER + 4), get(OWNER + 8)] == [1, 1]
initial = list(struct.unpack('<16f', uc.mem_read(MATRIX, 64)))
assert initial == [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

# Execute complete44de02 for original map7 Crush records. This detects using
# serialized bounding-box matrices instead of the object's position/angles.
rows = []
records = read_scene(ROOT / 'recovery/output/verified/assets/data/Data/scn/0007/0007.obj')
for record in (r for r in records if r['className'] == 'SYcScnObjCrush'):
    position = list(record['position'])
    rotation = list(record['rotation'])
    assert rotation == [0, 0, 0]
    uc.mem_write(OBJ + 0x58, struct.pack('<3f', *position))
    uc.mem_write(OBJ + 0x68, struct.pack('<3f', *rotation))
    put(STACK, STOP)
    uc.reg_write(UC_X86_REG_ECX, OBJ)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x44de02, STOP, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4
    matrix = list(struct.unpack('<16f', uc.mem_read(MATRIX, 64)))
    assert matrix[12:15] == position
    assert [get(OBJ + 0x78), get(OBJ + 0x7c)] == [MATRIX, OWNER]
    rows.append(dict(id=record['id'], model=record['model'], enabled=record['enabled'],
                     position=position, rotation=rotation, matrix=matrix))
reference = next(row for row in rows if row['id'] == '76')

pe = images['cdtank.exe']
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
sources = []
for start, end in [(0x44ee10, 0x44ee62), (0x44e3cf, 0x44e40c),
                   (0x44df55, 0x44dfb2), (0x44dc5f, 0x44dca2),
                   (0x44de02, 0x44deea), (0x44dd58, 0x44dd82)]:
    sources.append(dict(start=hex(start), end=hex(end), instructions=[
        dict(address=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}')
        for i in decoder.disasm(pe.get_data(start - 0x400000, end - start), start)]))
result = dict(status='PASS_MATRIX_PRODUCER', allocations=allocations,
              objectPair=[MATRIX, OWNER], ownerMatrix=get(OWNER + 0x10),
              initialMatrix=initial, placementPosition=reference['position'], matrix=reference['matrix'],
              placements=rows,
              sources=sources,
              scope='Original base constructor matrix portion and complete placement update execute with original gbengine. Heap allocation is a recording boundary. No full Crush loader, effect startup, nonnull pair-copy/release execution, authority or player claim.')
(ROOT / 'recovery/output/scene-crush07-matrix-native.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS_MATRIX_PRODUCER: original allocated gbMatrix4 and owning pair; original placement update')
