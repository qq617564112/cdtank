"""Execute421afe/4225b4 and real tree lookup; supply allocation and string storage."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
RECORD, STREAM, BUFFER = 0x2001000, 0x2002000, 0x2003000
TABLE, SENTINEL, HEAP = 0x2005000, 0x2006000, 0x2007000
STACK, RETURN = 0x2010000, 0x2011000
fields = [(o, 32) for o in [0x68, 0x58, 0x5c, 0x60, 0x64, 0x20]]
fields += [(o, 16) for o in [0x3c, 0x40, 0x44, 0x4c, 0x50, 0x54]]
fields += [(o, 32) for o in [0x34, 0x1c, 0x24, 0x28, 0x2c, 0x30]]
fields += [(0x6c, 6), (0x38, 1), (0x48, 1)]
names, heap = {}, HEAP
allocations, releases = [], []


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def backend(machine, address, size, data):
    global heap
    stack = machine.reg_read(UC_X86_REG_ESP)
    target = machine.reg_read(UC_X86_REG_ECX)
    pop, value = 0, target
    if address == 0x401609:
        names[target] = bytearray()
        pop = 4
    elif address == 0x401f16:
        assert read(stack + 8) == 1
        names[target].extend(uc.mem_read(read(stack + 4), 1))
        pop = 8
    elif address == 0x578620:
        count = read(stack + 4)
        value = heap
        heap += (count + 15) & ~15
        assert heap < STACK
        uc.mem_write(value, bytes(count))
        allocations.append(count)
    elif address == 0x57a6c7:
        releases.append(read(stack + 4))
        value = 0
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


for address in [0x401609, 0x401f16, 0x578620, 0x57a6c7, 0x405805]:
    uc.hook_add(UC_HOOK_CODE, backend, begin=address, end=address)


def execute(address, target, *arguments):
    write(STACK, RETURN, *arguments)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, target)
    uc.emu_start(address, RETURN, count=150000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(arguments) * 4


def pack_record(seed, name, key=None):
    values = [(seed + slot * 17) & ((1 << width) - 1) for slot, (_, width) in enumerate(fields)]
    if key is not None:
        values[13] = key
    packed, cursor = len(name), 32
    for byte in name:
        packed |= byte << cursor
        cursor += 8
    for value, (_, width) in zip(values, fields):
        packed |= value << cursor
        cursor += width
    return packed, cursor, {str(offset): value for (offset, _), value in zip(fields, values)}


rows = []
for alignment in range(8):
    for name in [b'', b'Part A', bytes.fromhex('d0a1d3c2cabf')]:
        for seed in [0, 37, 0x80000001, 0xffffffff]:
            packed, length, expected = pack_record(seed, name)
            raw = (packed << alignment).to_bytes((length + alignment + 7) // 8, 'little')
            uc.mem_write(BUFFER, raw + bytes(1024 - len(raw)))
            uc.mem_write(RECORD, b'\xaa' * 0x70)
            write(STREAM, alignment, 0, BUFFER, 1024)
            execute(0x421afe, RECORD, STREAM)
            result = {str(o): read(RECORD + o) for o, _ in fields}
            assert result == expected and names[RECORD] == name
            assert read(STREAM) + read(STREAM + 4) * 8 == alignment + length
            rows.append(dict(alignment=alignment, raw=list(raw), nameBytes=list(name),
                             result=result, finalBit=alignment + length))

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
        records.append(dict(key=read(node + 0xc), fields={str(o): read(record + o) for o, _ in fields},
                            nameBytes=list(names[record])))
        visit(read(node + 8))
    visit(read(SENTINEL + 4))
    assert len(records) == read(TABLE + 0xc)
    return records


batches = []
for alignment, keys in [(0, [73, 0, 0xffffffff]), (3, [73, 0x80000001, 73]),
                         (7, []), (1, [5, 4, 3, 2, 1]), (0, [0])]:
    packed, cursor = len(keys) << alignment, alignment + 32
    expected = {}
    for sequence, key in enumerate(keys):
        name = [b'', b'Part A', bytes.fromhex('d0a1d3c2cabf')][sequence % 3]
        record_bits, length, values = pack_record(sequence * 37, name, key)
        packed |= record_bits << cursor
        cursor += length
        expected.setdefault(key, dict(key=key, fields=values, nameBytes=list(name)))
    raw = packed.to_bytes((cursor + 7) // 8, 'little')
    before = table_records()
    allocations.clear()
    releases.clear()
    uc.mem_write(BUFFER, raw + bytes(1024 - len(raw)))
    write(STREAM, alignment, 0, BUFFER, 1024)
    execute(0x4225b4, TABLE, STREAM)
    result = table_records()
    assert result == [expected[key] for key in sorted(expected)]
    assert read(STREAM) + read(STREAM + 4) * 8 == cursor
    assert allocations.count(0x70) == len(keys)
    # Actual421f36 invokes4501fa/486351 rather than a supplied map search.
    lookups = []
    for key in set(keys + [123456]):
        execute(0x421f36, TABLE, key)
        pointer = uc.reg_read(UC_X86_REG_EAX)
        assert bool(pointer) == (key in expected)
        if pointer:
            assert read(pointer + 0x1c) == key
        lookups.append(dict(key=key, found=bool(pointer)))
    batches.append(dict(alignment=alignment, raw=list(raw), before=before, result=result,
                        finalBit=cursor, lookups=lookups, allocations=list(allocations), releases=list(releases)))

(ROOT / 'recovery/output/role-owned-equipment-native.json').write_text(json.dumps(dict(
    status='PASS', fields=fields, rows=rows, batches=batches,
    scope='Complete421afe name/numeric/6bit/1bit reads; complete4225b4 batch replacement '
          'with actual421ec2 construction,421e06 clear,4221d8 insertion/balance and421f36 lookup. '
          'Allocation/free and string storage supplied; table sentinel prepared. '
          'Outer3aab message, field semantics, account ownership and World recompute not covered.'), indent=2) + '\n')
print(f'PASS: {len(rows)} complete original second-source readers and {len(batches)} batch/lookup contracts')

# Complete3aab reader chains both actual batch readers and the additional byte array.
base_evidence = json.loads((ROOT / 'recovery/output/role-owned-base-native.json').read_text())
base_fields = [(field['offset'], field['width']) for field in base_evidence['fields']]
uc.mem_map(0x2020000, 0x20000)
MESSAGE = 0x2020000
for table, sentinel in [(MESSAGE + 0xc, 0x2030000), (MESSAGE + 0x1c, 0x2030100)]:
    write(table + 8, sentinel, 0)
    write(sentinel, sentinel, sentinel, sentinel)
    uc.mem_write(sentinel + 0x14, bytes([1, 1]))


def indexed_fields(table, field_list):
    result = []
    sentinel = read(table + 8)
    def visit(node):
        if uc.mem_read(node + 0x15, 1)[0]:
            return
        visit(read(node))
        record = read(node + 0x10)
        result.append(dict(key=read(node + 0xc), fields={str(o): read(record + o) for o, _ in field_list}))
        visit(read(node + 8))
    visit(read(sentinel + 4))
    assert len(result) == read(table + 0xc)
    return result


execute(0x42d69f, MESSAGE)
assert uc.reg_read(UC_X86_REG_EAX) == 0x3aab
messages = []
for base, equipment, additional in zip(base_evidence['batches'], batches, [[], [0, 128, 255], [73], [1, 2, 3, 4], []]):
    alignment = equipment['alignment']
    packed, cursor = 0, alignment
    for batch in [base, equipment]:
        for bit in range(batch['alignment'], batch['finalBit']):
            packed |= ((batch['raw'][bit >> 3] >> (bit & 7)) & 1) << cursor
            cursor += 1
    packed |= len(additional) << cursor
    cursor += 32
    for byte in additional:
        packed |= byte << cursor
        cursor += 8
    raw = packed.to_bytes((cursor + 7) // 8, 'little')
    before_base = indexed_fields(MESSAGE + 0xc, base_fields)
    before_equipment = indexed_fields(MESSAGE + 0x1c, fields)
    uc.mem_write(BUFFER, raw + bytes(4096 - len(raw)))
    write(STREAM, alignment, 0, BUFFER, 4096)
    execute(0x42d6a5, MESSAGE, STREAM)
    assert indexed_fields(MESSAGE + 0xc, base_fields) == base['result']
    equipment_result = [dict(key=row['key'], fields=row['fields']) for row in equipment['result']]
    assert indexed_fields(MESSAGE + 0x1c, fields) == equipment_result
    assert read(MESSAGE + 0x102c) == len(additional)
    assert list(uc.mem_read(MESSAGE + 0x2c, len(additional))) == additional
    assert read(STREAM) + read(STREAM + 4) * 8 == cursor
    messages.append(dict(type=0x3aab, alignment=alignment, raw=list(raw), beforeBase=before_base,
                         beforeEquipment=before_equipment, base=base['result'], equipment=equipment_result,
                         additional=additional, finalBit=cursor))
# Preserve evidence from the single-record and batch contracts with the outer message rows.
output = ROOT / 'recovery/output/role-owned-equipment-native.json'
evidence = json.loads(output.read_text())
evidence['messages'] = messages
evidence['scope'] += ' Complete42d6a5 type3aab reads both owned tables and42d6cd byte array; prepared table sentinels.'
output.write_text(json.dumps(evidence, indent=2) + '\n')
print(f'PASS: {len(messages)} complete3aab first/second owned-table and byte-array readers')

# The original additional-array diagnostic leaves its existing storage untouched.
def diagnostic(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4)

uc.hook_add(UC_HOOK_CODE, diagnostic, begin=0x40bd28, end=0x40bd28)
array_gates = []
for declared, capacity in [(12, 12), (13, 12), (4096, 4096)]:
    raw = (declared << 64).to_bytes(12, 'little')
    before_base = indexed_fields(MESSAGE + 0xc, base_fields)
    before_equipment = indexed_fields(MESSAGE + 0x1c, fields)
    uc.mem_write(BUFFER, raw)
    uc.mem_write(MESSAGE + 0x2c, b'old')
    write(STREAM, 0, 0, BUFFER, capacity)
    execute(0x42d6a5, MESSAGE, STREAM)
    assert not indexed_fields(MESSAGE + 0xc, base_fields)
    assert not indexed_fields(MESSAGE + 0x1c, fields)
    assert read(MESSAGE + 0x102c) == declared
    assert bytes(uc.mem_read(MESSAGE + 0x2c, 3)) == b'old'
    assert read(STREAM) + read(STREAM + 4) * 8 == 96
    array_gates.append(dict(raw=list(raw), declared=declared, capacity=capacity,
                            beforeBase=before_base, beforeEquipment=before_equipment, finalBit=96))
evidence['arrayGates'] = array_gates
evidence['scope'] = evidence['scope'].replace('Outer3aab message, field semantics, account ownership and World recompute not covered.',
    'Field semantics, account ownership and World recompute not covered.')
output.write_text(json.dumps(evidence, indent=2) + '\n')
print(f'PASS: {len(array_gates)} original additional-array capacity gates preserve existing bytes')
