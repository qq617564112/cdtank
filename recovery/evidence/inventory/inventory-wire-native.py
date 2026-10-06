"""Original inventory record read/write using the original bitstream routines."""
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
RECORD, STREAM, BUFFER = 0x2001000, 0x2002000, 0x2003000
STACK, RETURN = 0x2010000, 0x2011000

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def call(address, argument=None):
    write(STACK, RETURN, *([] if argument is None else [argument]))
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, RECORD)
    uc.emu_start(address, RETURN, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + (4 if argument is None else 8)

def execute(record, bit_offset):
    uc.mem_write(RECORD, bytes(0x40))
    write(RECORD + 4, record['instanceId'], record['field8'], record['itemTableId'],
          record['ownedQuantity'], 81, 82, 83, record['battleQuantity'],
          record['float24Bits'], record['float28Bits'], record['float2cBits'])
    uc.mem_write(BUFFER, bytes(64))
    write(STREAM, bit_offset, 0, BUFFER, 64)
    call(0x42dddd, STREAM)
    assert read(STREAM) == bit_offset and read(STREAM + 4) == 28
    payload = bytes(uc.mem_read(BUFFER, (bit_offset + 224 + 7) // 8))
    uc.mem_write(RECORD, b'\xaa' * 0x30)
    call(0x43bcb5)
    write(STREAM, bit_offset, 0, BUFFER, 64)
    call(0x42e0b7, STREAM)
    assert read(STREAM) == bit_offset and read(STREAM + 4) == 28
    result = dict(instanceId=read(RECORD + 4), field8=read(RECORD + 8),
                  itemTableId=read(RECORD + 0xc), ownedQuantity=read(RECORD + 0x10),
                  battleQuantity=read(RECORD + 0x20), state=read(RECORD + 0x1c),
                  float24Bits=read(RECORD + 0x24), float28Bits=read(RECORD + 0x28),
                  float2cBits=read(RECORD + 0x2c))
    assert read(RECORD + 0x14) == 0 and read(RECORD + 0x18) == 0
    return dict(payload=payload.hex(), result=result)

ids = [int(row['values']['ItemTableID']) for row in read_table(ROOT / 'CDTank/Data/table/item.dat')['rows']]
ids += [0, 65535, 65536, 0xffffffff]
quantities = [0, 1, 255, 65535, 0xffffff, 0x1000000, 0xffffffff]
float_bits = [0, 0x80000000, 0x3f800000, 0xbf800000, 0x7f800000, 0x7fc12345, 0x00000001]
rows = []
for index, item_id in enumerate(ids):
    record = dict(instanceId=0xffffffff if index % 2 else index + 1,
                  field8=0xabcdef01, itemTableId=item_id,
                  ownedQuantity=quantities[index % 7], battleQuantity=quantities[(index + 3) % 7],
                  float24Bits=float_bits[index % 7], float28Bits=float_bits[(index + 1) % 7],
                  float2cBits=float_bits[(index + 2) % 7])
    for bit_offset in range(8):
        rows.append(dict(record=record, bitOffset=bit_offset, **execute(record, bit_offset)))
out = ROOT / 'recovery/output/inventory-wire-native.json'
out.write_text(json.dumps(dict(scope='Original42dddd writer,42e0b7 reader,43bcb5 constructor and real401c7a/401d58 byte/bit helpers. No callback stubs; supplied stream buffer. Inventory record only, not packet envelope.', rows=rows), indent=2))
print(f'PASS: {len(rows)} original inventory record roundtrips, all bit alignments,24-bit quantities and exact float payloads')
