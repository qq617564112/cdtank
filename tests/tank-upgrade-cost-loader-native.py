"""Execute the original TankUp loader on one distinct cost/outcome row."""
import json
import struct
import sys
from pathlib import Path

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

machine, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x6000)
RECORD, VALUE, TABLE, STACK, STOP = [0x2001000 + i * 0x1000 for i in range(5)]
table = read_table(ROOT / 'CDTank/Data/table/tankup.dat')
row = next(row['values'] for row in table['rows'] if int(row['values'][table['columns'][0]]) == 3)
columns = []

def get(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]

def terminal(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    assert uc.reg_read(UC_X86_REG_ECX) == RECORD
    column, mode = get(stack + 4), get(stack + 8)
    assert mode == 0
    columns.append(column)
    uc.mem_write(VALUE, struct.pack('<i', int(row[table['columns'][column]])))
    uc.reg_write(UC_X86_REG_EAX, VALUE)
    uc.reg_write(UC_X86_REG_EIP, get(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 12)

machine.hook_add(UC_HOOK_CODE, terminal, begin=0x4391c4, end=0x4391c4)
machine.mem_write(RECORD, bytes([0xaa]) * 0x20)
machine.mem_write(STACK, struct.pack('<II', STOP, TABLE))
machine.reg_write(UC_X86_REG_ECX, RECORD)
machine.reg_write(UC_X86_REG_ESP, STACK)
machine.emu_start(0x43b911, STOP, count=1000)
assert machine.reg_read(UC_X86_REG_EIP) == STOP
assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
assert columns == [0, 1, 2, 3, 4] and get(RECORD + 4) == TABLE
mapping = [{'column': name, 'offset': hex(offset), 'value': get(RECORD + offset)}
           for name, offset in zip(table['columns'], [0xc, 0x10, 0x14, 0x18, 0x1c])]
assert [entry['value'] for entry in mapping] == [3, 5, 30, 10, 89]
result = {'status': 'PASS_ORIGINAL_TANK_UP_COST_AND_RATE_FIELD_LOADER',
          'loader': '0x43b911', 'vtable': '0x5c4cec', 'mapping': mapping,
          'scope': 'One original rank3 row through complete original loader with parsed numeric getter terminal. Rates identify source fields only; no original server outcome sampler or upgrade attribute producer is claimed.'}
(ROOT / 'recovery/output/tank-upgrade-cost-loader-native.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
