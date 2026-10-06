"""Execute owned-base record41e5f1 with original numeric/name bit reads and supplied string storage."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_ESI

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
RECORD, STREAM, BUFFER, ROLE = 0x2001000, 0x2002000, 0x2003000, 0x2004000
STACK, RETURN = 0x2010000, 0x2011000
fields = [(4, 32), (0, 32)] + [(offset, 16) for offset in
    [8, 0x84, 0x34, 0x38, 0x8c, 0x80, 0x88, 0x7c, 0x3c, 0x40, 0x2c, 0x30, 0x94, 0x28, 0x90]]
fields += [(offset, 32) for slot in range(6) for offset in [0x44 + slot * 4, 0x5c + slot * 4]]
fields += [(0x74, 32), (0x78, 32)]


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


name_bytes = bytearray()


def string_backend(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    target = machine.reg_read(UC_X86_REG_ECX)
    if not globals().get('batch_active', False):
        assert target == RECORD + 0xc
    if address == 0x401609:
        name_bytes.clear()
        pop = 4
    else:
        assert read(stack + 8) == 1
        name_bytes.extend(uc.mem_read(read(stack + 4), 1))
        pop = 8
    machine.reg_write(UC_X86_REG_EAX, target)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


for address in [0x401609, 0x401f16]:
    uc.hook_add(UC_HOOK_CODE, string_backend, begin=address, end=address)
write(ROLE + 0x2a0, RECORD + 0x200)
rows = []
for alignment, source_name in [(a, name) for a in range(8) for name in [b"", b"Tank A", bytes.fromhex("d0a1d3c2cabf")]]:
    for seed in [0, 37, 0x80000001, 0xffffffff]:
        values = [(seed + slot * 17) & ((1 << width) - 1) for slot, (_, width) in enumerate(fields)]
        packed, cursor = 0, alignment
        for position, (value, (_, width)) in enumerate(zip(values, fields)):
            if position == 17:
                packed |= len(source_name) << cursor
                cursor += 32
                for byte in source_name:
                    packed |= byte << cursor
                    cursor += 8
            packed |= value << cursor
            cursor += width
        raw = packed.to_bytes((cursor + 7) // 8, 'little')
        uc.mem_write(BUFFER, raw + bytes(128 - len(raw)))
        uc.mem_write(RECORD, b'\xaa' * 0x98)
        write(STREAM, alignment, 0, BUFFER, 128)
        write(STACK, RETURN, STREAM)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, RECORD)
        uc.emu_start(0x41e5f1, RETURN, count=20000)
        assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 8
        assert read(STREAM) + read(STREAM + 4) * 8 == cursor
        result = {str(offset): read(RECORD + offset) for offset, _ in fields}
        assert list(result.values()) == values
        assert name_bytes == source_name
        # The recovered source+2c is copied into role MaxHP by the actual recompute block.
        write(RECORD + 0x200 + 0x54, 777, 0)
        uc.reg_write(UC_X86_REG_EAX, RECORD)
        uc.reg_write(UC_X86_REG_ESI, ROLE)
        uc.emu_start(0x4334e8, 0x4334fd, count=100)
        assert read(RECORD + 0x200 + 0x58) == result[str(0x2c)]
        assert read(RECORD + 0x200 + 0x54) == 777
        rows.append(dict(alignment=alignment, raw=list(raw), result=result,
                         maxHp=result[str(0x2c)], nameBytes=list(name_bytes), finalBit=cursor))
# Actual41f23c batch read,41f0dd insertion and native tree clearing/balancing.
TABLE, SENTINEL, HEAP = 0x2005000, 0x2006000, 0x2007000
heap = HEAP
batch_active = True
allocations, releases = [], []


def allocator(machine, address, size, data):
    global heap
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x578620:
        count = read(stack + 4)
        value = heap
        heap += (count + 15) & ~15
        assert heap < 0x2010000
        uc.mem_write(value, bytes(count))
        allocations.append(dict(pointer=value, count=count))
    elif address == 0x57a6c7:
        releases.append(read(stack + 4))
        value = 0
    else:
        value = machine.reg_read(UC_X86_REG_ECX)
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4)


for address in [0x578620, 0x57a6c7, 0x405805]:
    uc.hook_add(UC_HOOK_CODE, allocator, begin=address, end=address)
write(TABLE + 8, SENTINEL, 0)
write(SENTINEL, SENTINEL, SENTINEL, SENTINEL)
uc.mem_write(SENTINEL + 0x14, bytes([1, 1]))


def table_records():
    records = []
    def visit(node):
        if uc.mem_read(node + 0x15, 1)[0]:
            return
        visit(read(node))
        record = read(node + 0x10)
        records.append(dict(key=read(node + 0xc), fields={str(offset): read(record + offset) for offset, _ in fields}))
        visit(read(node + 8))
    visit(read(SENTINEL + 4))
    assert len(records) == read(TABLE + 0xc)
    return records


batch_rows = []
# Repeated batches execute against the previous native tree, including duplicate keys.
for alignment, selected in [(0, [0, 12, 24]), (3, [1, 13, 1]), (7, []),
                            (1, [25, 37, 49, 61, 73]), (0, [2])]:
    packed, cursor = len(selected) << alignment, alignment + 32
    expected = {}
    for sequence, position in enumerate(selected):
        original = rows[position]
        row = dict(original, result=dict(original['result']), raw=list(original['raw']))
        row['result'][str(0x2c)] = 200 + sequence
        # Different payloads under a repeated key prove which record stays indexed.
        value_start = row['alignment'] + 64 + 10 * 16
        for bit in range(16):
            offset = value_start + bit
            row['raw'][offset >> 3] &= ~(1 << (offset & 7))
            row['raw'][offset >> 3] |= (((200 + sequence) >> bit) & 1) << (offset & 7)
        expected.setdefault(row['result']['0'], row['result'])
        for bit in range(row['alignment'], row['finalBit']):
            packed |= ((row['raw'][bit >> 3] >> (bit & 7)) & 1) << cursor
            cursor += 1
    raw = packed.to_bytes((cursor + 7) // 8, 'little')
    uc.mem_write(BUFFER, raw + bytes(1024 - len(raw)))
    before = table_records()
    allocations.clear()
    releases.clear()
    write(STREAM, alignment, 0, BUFFER, 1024)
    write(STACK, RETURN, STREAM)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, TABLE)
    uc.emu_start(0x41f23c, RETURN, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    result = table_records()
    assert result == [dict(key=key, fields=expected[key]) for key in sorted(expected)]
    assert read(STREAM) + read(STREAM + 4) * 8 == cursor
    assert len([allocation for allocation in allocations if allocation['count'] == 0x98]) == len(selected)
    batch_rows.append(dict(alignment=alignment, raw=list(raw), selected=selected, before=before,
                          result=result, finalBit=cursor, allocations=list(allocations), releases=list(releases)))

message_rows = []
write(STACK, RETURN)
uc.reg_write(UC_X86_REG_ESP, STACK)
uc.emu_start(0x52083e, RETURN, count=10)
assert uc.reg_read(UC_X86_REG_EAX) == 0x4078
for batch, tail in zip(batch_rows, [0, 0xffffffff, 0x80000001, 73, 1]):
    cursor = batch['finalBit']
    packed = int.from_bytes(bytes(batch['raw']), 'little') | (tail << cursor)
    raw = packed.to_bytes((cursor + 32 + 7) // 8, 'little')
    before = table_records()
    uc.mem_write(BUFFER, raw + bytes(1024 - len(raw)))
    write(TABLE + 0x10, 0xaaaaaaaa)
    write(STREAM, batch['alignment'], 0, BUFFER, 1024)
    write(STACK, RETURN, STREAM)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, TABLE - 0xc)
    uc.emu_start(0x520819, RETURN, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert table_records() == batch['result']
    assert read(TABLE + 0x10) == tail
    assert read(STREAM) + read(STREAM + 4) * 8 == cursor + 32
    message_rows.append(dict(type=0x4078, alignment=batch['alignment'], raw=list(raw),
                             before=before, result=table_records(), field1c=tail, finalBit=cursor + 32))

(ROOT / 'recovery/output/role-owned-base-native.json').write_text(json.dumps(dict(
    status='PASS', fields=[dict(offset=offset, width=width) for offset, width in fields], rows=rows, batches=batch_rows,
    messages=message_rows,
    scope='Complete41e5f1 and401fa6 name reader with actual401d58/401bd7 bit reads; '
          'only string reset/append storage supplied. Name32-bit byte count and byte reads '
          'execute, including non-ASCII source bytes without interpreting character encoding. '
          'Actual4334e8 MaxHP copy follows; outer message dispatch, inventory ownership '
          'and server generation not covered. Separate41f23c batches execute real41e90e '
          'record construction,41e852 node clearing,41f0dd/41edb2 balancing and duplicate '
          'gates with supplied allocation/free and string storage only. Type4078 getter52083e '
          'and complete520819 reader execute batch replacement followed by unsigned32 field1c; '
          'field semantics and transport dispatch are not covered.'), indent=2) + '\n')
print(f'PASS: {len(rows)} original owned-base numeric readers and direct MaxHP source copies')
print(f'PASS: {len(batch_rows)} native batch clears/reads/constructors and real duplicate/tree insertion')
print(f'PASS: {len(message_rows)} complete type4078 message readers and unsigned32 tails')
