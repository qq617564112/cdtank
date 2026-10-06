"""Execute the original Item loader's four Shop fields from parsed table columns."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

table = read_table(ROOT / 'CDTank/Data/table/item.dat')
assert table['columns'][20:24] == ['ItemMoney', 'ItemCoin', 'GGet', 'Durable']
machine, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x10000)
RECORD, VALUE, STACK, FRAME, RETURN = [0x2001000 + index * 0x1000 for index in range(5)]
current, calls = None, []


def read(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def provide_column(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    destination, column, mode = struct.unpack('<3I', uc.mem_read(stack, 12))
    assert uc.reg_read(UC_X86_REG_ECX) == RECORD
    assert mode == 0 and 20 <= column <= 23
    value = int(current[table['columns'][column]])
    calls.append(dict(column=column, name=table['columns'][column], value=value))
    uc.mem_write(VALUE, struct.pack('<I', value))
    uc.reg_write(UC_X86_REG_EAX, VALUE)
    uc.reg_write(UC_X86_REG_ESP, stack + 12)
    uc.reg_write(UC_X86_REG_EIP, destination)


machine.hook_add(UC_HOOK_CODE, provide_column, begin=0x4391c4, end=0x4391c4)
rows = []
seen = set()
for source in table['rows']:
    current = source['values']
    key = (int(current['GGet']), int(current['Durable']))
    if key in seen:
        continue
    seen.add(key)
    calls.clear()
    machine.mem_write(RECORD, b'\xaa' * 0x180)
    for register, value in [(UC_X86_REG_ESI, RECORD), (UC_X86_REG_EDI, 20),
                            (UC_X86_REG_EBX, 0), (UC_X86_REG_EBP, FRAME),
                            (UC_X86_REG_ESP, STACK)]:
        machine.reg_write(register, value)
    # Start immediately before column20; stop after the +f8 store. The original
    # loop above this point advances EDI through three four-column groups to20.
    machine.emu_start(0x439c5c, 0x439ca8, count=100)
    assert [call['column'] for call in calls] == [20, 21, 22, 23]
    stored = {hex(offset): read(RECORD + offset) for offset in [0xec, 0xf0, 0xf4, 0xf8]}
    assert list(stored.values()) == [call['value'] for call in calls]
    assert machine.reg_read(UC_X86_REG_EDI) == 24
    assert machine.reg_read(UC_X86_REG_ESP) == STACK - 8
    rows.append(dict(itemTableId=int(current['ItemTableID']), columns=list(calls), stored=stored))

result = dict(status='PASS_SOURCE_FIELD_MAPPING_ONLY', loader='0x439b55',
    executedRange=['0x439c5c', '0x439ca8'],
    mapping={'0xec': 'ItemMoney/column20', '0xf0': 'ItemCoin/column21',
             '0xf4': 'GGet/column22', '0xf8': 'Durable/column23'}, rows=rows,
    supplyBoundary='0x439950 first calls 0x4396c2: unsigned ItemTableID<=4000 or20001..21000; only these records use nonzero Durable/+f8, otherwise1.',
    scope='Original four integer column loads/stores; parsed getter supplied. No server price/payment/quantity policy, purchase authority or complete Shop string formatting claim.')
(ROOT / 'recovery/output/shop-item-price-count-loader-native.json').write_text(
    json.dumps(result, indent=2) + '\n')
print(f'PASS: original Item loader columns20–23 map ec/f0/f4/f8 across {len(rows)} actual GGet/Durable pairs')
