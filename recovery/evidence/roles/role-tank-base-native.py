"""Execute complete43b62a loader with actual parsed tank source values at getter/string boundaries."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
SOURCE, VALUE, TABLE, STACK, RETURN = 0x2001000, 0x2002000, 0x2003000, 0x2010000, 0x2011000
current, columns, strings = None, [], {}
table = read_table(ROOT / 'CDTank/Data/table/tank.dat')


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x4391c4:
        column, mode = struct.unpack('<II', uc.mem_read(stack + 4, 8))
        assert machine.reg_read(UC_X86_REG_ECX) == SOURCE
        assert mode == (5 if column in [1, 2] else 1 if column == 20 else 0)
        columns.append([column, mode])
        value = current[table['columns'][column]]
        uc.mem_write(VALUE, value.encode('utf8') + b'\0' if mode == 5 else
                     struct.pack('<f', float(value)) if mode == 1 else struct.pack('<i', int(value)))
        result, pop = VALUE, 8
    else:
        target = machine.reg_read(UC_X86_REG_ECX)
        assert target in [SOURCE + 0x10, SOURCE + 0x2c]
        assert struct.unpack('<I', uc.mem_read(stack + 4, 4))[0] == VALUE
        strings[target - SOURCE] = current['TankName' if target == SOURCE + 0x10 else 'TankInfo']
        result, pop = target, 4
    machine.reg_write(UC_X86_REG_EAX, result)
    machine.reg_write(UC_X86_REG_EIP, struct.unpack('<I', uc.mem_read(stack, 4))[0])
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


for address in [0x4391c4, 0x401609]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
rows = []
for row in table['rows']:
    current = row['values']
    columns.clear()
    strings.clear()
    uc.mem_write(SOURCE, b'\xaa' * 0xc0)
    uc.mem_write(STACK, struct.pack('<II', RETURN, TABLE))
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, SOURCE)
    uc.emu_start(0x43b62a, RETURN, count=2000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert columns == [[i, 5 if i in [1, 2] else 1 if i == 20 else 0] for i in range(30)]
    fields = {'id': 0xc, 'tankType': 0x50, 'field84': 0x84, 'field88': 0x88,
              'field90': 0x90, 'fieldA4': 0xa4, 'fieldA8': 0xa8}
    result = {key: struct.unpack('<i', uc.mem_read(SOURCE + offset, 4))[0] for key, offset in fields.items()}
    result['reloadDuration'] = struct.unpack('<f', uc.mem_read(SOURCE + 0x8c, 4))[0]
    assert struct.unpack('<I', uc.mem_read(SOURCE + 4, 4))[0] == TABLE
    rows.append(dict(values=current, result=result, columns=list(columns), strings=dict(strings)))
(ROOT / 'recovery/output/role-tank-base-native.json').write_text(json.dumps(dict(status='PASS', rows=rows,
    scope='Complete43b62a loader30 columns and field copies; parsed getter and string storage supplied. '
          'Resource manager initialization and role instance lookup not covered.'), indent=2) + '\n')
print(f'PASS: {len(rows)} complete source tank table loaders and recompute source mappings')
