"""Complete original inventory-query packet with real red-black tree insertion."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x400000)
PACKET, STREAM, BUFFER, STACK, RETURN = 0x2001000, 0x2002000, 0x2020000, 0x2010000, 0x2011000
heap = 0x2040000

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def allocate(machine, address, size, data):
    global heap
    stack = machine.reg_read(UC_X86_REG_ESP)
    count = read(stack + 4)
    assert 0 < count <= 0x30
    machine.reg_write(UC_X86_REG_EAX, heap)
    heap += (count + 15) & ~15
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4)

uc.hook_add(UC_HOOK_CODE, allocate, begin=0x578620, end=0x578620)

def call(address):
    write(STACK, RETURN, STREAM)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, PACKET)
    uc.emu_start(address, RETURN, count=1000000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234 and read(0) == 0x12345678

def fields(record):
    return (record['instanceId'], record['field8'], record['itemTableId'],
            record['ownedQuantity'], record['float24Bits'], record['float28Bits'],
            record['float2cBits'], record['battleQuantity'])

def execute(records, field_c, bit_offset):
    global heap
    heap = 0x2040000
    uc.mem_write(heap, bytes(0x40000))
    data = struct.pack('<IH', field_c, len(records))
    widths = [4, 4, 2, 3, 4, 4, 4, 3]
    for record in records:
        data += b''.join((value & ((1 << (width * 8)) - 1)).to_bytes(width, 'little')
                         for value, width in zip(fields(record), widths))
    payload = (int.from_bytes(data, 'little') << bit_offset).to_bytes(len(data) + bool(bit_offset), 'little')
    uc.mem_write(BUFFER, bytes(0x10000))
    uc.mem_write(BUFFER, payload)
    write(STREAM, bit_offset, 0, BUFFER, 0x10000)
    write(0, 0x12345678)
    call(0x43f42d)
    assert read(PACKET + 0xc) == field_c
    assert read(STREAM) == bit_offset and read(STREAM + 4) == len(data)
    tree = read(PACKET + 0x10)
    head = read(tree + 4)
    result = []
    def visit(node):
        if node == head:
            return
        visit(read(node))
        record = read(node + 0x10)
        result.append(dict(instanceId=read(record + 4), field8=read(record + 8),
            itemTableId=read(record + 0xc), ownedQuantity=read(record + 0x10),
            battleQuantity=read(record + 0x20), state=read(record + 0x1c),
            float24Bits=read(record + 0x24), float28Bits=read(record + 0x28),
            float2cBits=read(record + 0x2c)))
        visit(read(node + 8))
    visit(read(head + 4))
    assert len(result) == read(tree + 8)
    uc.mem_write(BUFFER, bytes(0x10000))
    write(STREAM, bit_offset, 0, BUFFER, 0x10000)
    call(0x43f3cf)
    normalized = bytes(uc.mem_read(BUFFER, (bit_offset + 48 + len(result) * 224 + 7) // 8))
    return dict(payload=payload.hex(), encoded=normalized.hex(), fieldC=field_c, records=result)

ids = [int(row['values']['ItemTableID']) for row in read_table(ROOT / 'CDTank/Data/table/item.dat')['rows']]
source = [dict(instanceId=index + 1, field8=0xabcdef01, itemTableId=item_id,
               ownedQuantity=index + 2, battleQuantity=17, state=99,
               float24Bits=0x7fc12345, float28Bits=0x80000000, float2cBits=0x3f800000)
          for index, item_id in enumerate(ids)]
duplicates = [dict(source[1], instanceId=0xffffffff), dict(source[0], instanceId=0),
              dict(source[2], instanceId=0xffffffff), dict(source[3], instanceId=0)]
cases = [[], source[:1], source, list(reversed(source)), duplicates]
rows = []
for index, records in enumerate(cases):
    for bit_offset in range(8):
        field_c = [0, 77, 0xffffffff][index % 3]
        rows.append(dict(input=records, bitOffset=bit_offset, **execute(records, field_c, bit_offset)))
out = ROOT / 'recovery/output/inventory-packet-native.json'
out.write_text(json.dumps(dict(scope='Complete43f42d/43f3cf packet, real record/bitstream routines,42e793 tree construction,42e702 insertion/rebalancing and42de86 traversal. Only raw memory allocation supplied; no container or business callbacks replaced. No socket envelope.', rows=rows), indent=2))
print(f'PASS: {len(rows)} original full query packets, actual tree sort/duplicate handling and byte-exact normalized output')
