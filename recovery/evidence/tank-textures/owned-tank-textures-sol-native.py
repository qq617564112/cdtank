"""Execute owned texture packet, native tree getter and original UI field comparisons."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_ESI, UC_X86_REG_EBP, UC_X86_REG_EBX
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x50000)
TABLE, SENTINEL, STREAM, BUFFER, GAME, WORLD, UI, FRAME = [0x2001000 + i * 0x1000 for i in range(8)]
STACK, RETURN, HEAP, VECTOR, TEXTURE = 0x2010000, 0x2011000, 0x2020000, 0x2040000, 0x2041000
heap = HEAP
fields = [(o, 32) for o in [0x68, 0x58, 0x5c, 0x60, 0x64, 0x20]]
fields += [(o, 16) for o in [0x3c, 0x40, 0x44, 0x4c, 0x50, 0x54]]
fields += [(o, 32) for o in [0x34, 0x1c, 0x24, 0x28, 0x2c, 0x30]]
fields += [(0x6c, 6), (0x38, 1), (0x48, 1)]

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def boundary(machine, address, size, data):
    global heap
    stack = machine.reg_read(UC_X86_REG_ESP)
    value, pop = machine.reg_read(UC_X86_REG_ECX), 0
    if address == 0x578620:
        count = read(stack + 4)
        value = heap
        heap += (count + 15) & ~15
        assert heap < VECTOR
        uc.mem_write(value, bytes(count))
    elif address == 0x401609:
        pop = 4
    elif address == 0x57a6c7:
        value = 0
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

for address in [0x578620, 0x57a6c7, 0x405805, 0x401609, 0x4b6603]:
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)

def execute(entry, target, *arguments):
    write(STACK, RETURN, *arguments)
    uc.reg_write(UC_X86_REG_ECX, target)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(entry, RETURN, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(arguments) * 4

write(TABLE + 8, SENTINEL, 0)
write(SENTINEL, SENTINEL, SENTINEL, SENTINEL)
uc.mem_write(SENTINEL + 0x14, bytes([1, 1]))
write(0x633588, GAME)
write(GAME + 0x118, WORLD)
write(WORLD + 0x40, TABLE)
shop = json.loads((ROOT / 'recovery/output/verified/tables/tankshop.json').read_text())['rows']
cases = [(int(row['values']['坦克ID']), [int(row['values'][key]) for key in
          ['默认贴图(炮塔)', '默认贴图(车身)', '默认贴图(履带)']]) for row in shop]
cases += [(1, [0, 0, 0]), (0x80000001, [0x80000001, 0xffffffff, 0]),
          (0xffffffff, [0xffffffff, 0, 0x80000001])]
rows = []
stop_address = None

def stop_at_comparison(machine, address, size, data):
    if address == stop_address:
        machine.emu_stop()

uc.hook_add(UC_HOOK_CODE, stop_at_comparison, begin=0x4b67d3, end=0x4b6a1c)
for alignment in range(8):
    for case, (definition, selected) in enumerate(cases):
        instance = [0, 73, 0x80000001, 0xffffffff][case % 4]
        values = {offset: (index * 17) & ((1 << width) - 1) for index, (offset, width) in enumerate(fields)}
        values.update({0x1c: instance, 0x24: definition, 0x28: selected[0], 0x2c: selected[1], 0x30: selected[2]})
        packed, cursor = 1 << alignment, alignment + 32
        cursor += 32  # Empty name byte count.
        for offset, width in fields:
            packed |= values[offset] << cursor
            cursor += width
        raw = packed.to_bytes((cursor + 7) // 8, 'little')
        uc.mem_write(BUFFER, raw + bytes(1024 - len(raw)))
        write(STREAM, alignment, 0, BUFFER, 1024)
        execute(0x4225b4, TABLE, STREAM)
        assert read(STREAM) + 8 * read(STREAM + 4) == cursor
        execute(0x421f36, TABLE, instance)
        record = uc.reg_read(UC_X86_REG_EAX)
        assert record and read(record + 0x1c) == instance
        actual = [read(record + offset) for offset in [0x28, 0x2c, 0x30]]
        assert actual == selected and read(record + 0x24) == definition
        # Original owned-detail slice invokes actual421f36 and then loads record+24.
        write(FRAME + 8, instance)
        uc.reg_write(UC_X86_REG_ESI, UI)
        uc.reg_write(UC_X86_REG_EBP, FRAME)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.emu_start(0x4b73f5, 0x4b7427, count=1000)
        assert read(UI + 0x1a0) == instance and read(FRAME - 0x14) == definition
        assert read(FRAME + 8) == record
        comparisons = []
        for slot, (offset, start, matched, no_match) in enumerate([
                (0x1bc, 0x4b67d3, 0x4b6816, 0x4b6896),
                (0x1d0, 0x4b6896, 0x4b68d9, 0x4b6959),
                (0x1e4, 0x4b6959, 0x4b699c, 0x4b6a1c)]):
            # No actual texture row has ID0; unsigned stress IDs test raw equality.
            candidate = selected[slot] or 10011 + slot
            write(TEXTURE + 0xc, candidate)
            write(VECTOR, TEXTURE)
            write(UI + offset + 4, VECTOR, VECTOR + 4, VECTOR + 4)
            write(FRAME - 0x10, record)
            uc.reg_write(UC_X86_REG_ESI, UI)
            uc.reg_write(UC_X86_REG_EBP, FRAME)
            uc.reg_write(UC_X86_REG_ESP, STACK)
            destination = matched if selected[slot] else no_match
            stop_address = destination
            uc.emu_start(start, destination, count=1000)
            stop_address = None
            assert uc.reg_read(UC_X86_REG_EIP) == destination
            assert uc.reg_read(UC_X86_REG_EBX) == (0 if selected[slot] else 1)
            comparisons.append(dict(candidateId=candidate, matched=bool(selected[slot])))
        rows.append(dict(alignment=alignment, raw=list(raw), finalBit=cursor,
                         instanceId=instance, definitionId=definition, selectedIds=actual, comparisons=comparisons))
output = dict(status='PASS', fields=fields, rows=rows,
    scope='Complete4225b4/421afe owned batch/record read, original numeric bit readers, actual tree insertion/lookup421f36; allocation/free and empty string storage supplied. Actual4b73f5–4b7427 owned detail getter+24 read with list builder4b6603 supplied. Actual three selected-ID comparisons and vector count/index getters; vectors supplied. Original table defaults are numeric fixtures, not grants; unsigned stress IDs test wire preservation only. Transport, server grants, specialtank conversion, property32 production and actor file loading not covered.')
(ROOT / 'recovery/output/owned-tank-textures-sol-native.json').write_text(json.dumps(output, indent=2) + '\n')
print(f'PASS: {len(rows)} owned tank wire/storage/getter/selected-ID comparisons')
