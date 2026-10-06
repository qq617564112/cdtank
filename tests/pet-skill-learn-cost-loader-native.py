"""Execute the concrete PetSkill record loader against one original next-level row."""
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
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x6000)
RECORD, VALUE, TABLE, STACK, STOP = [0x2001000 + i * 0x1000 for i in range(5)]
table = read_table(ROOT / 'CDTank/Data/table/petskill.dat')
row = next(row['values'] for row in table['rows'] if int(row['values'][table['columns'][0]]) == 10212)
columns = []
def get(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
def terminal(machine, address, size, data):
    s = uc.reg_read(UC_X86_REG_ESP)
    assert uc.reg_read(UC_X86_REG_ECX) == RECORD
    column, mode = get(s + 4), get(s + 8)
    assert mode == 0
    columns.append(column)
    uc.mem_write(VALUE, struct.pack('<i', int(row[table['columns'][column]])))
    uc.reg_write(UC_X86_REG_EAX, VALUE); uc.reg_write(UC_X86_REG_EIP, get(s)); uc.reg_write(UC_X86_REG_ESP, s + 12)
uc.hook_add(UC_HOOK_CODE, terminal, begin=0x4391c4, end=0x4391c4)
uc.mem_write(RECORD, bytes([0xaa]) * 0x1c)
uc.mem_write(STACK, struct.pack('<II', STOP, TABLE))
uc.reg_write(UC_X86_REG_ECX, RECORD); uc.reg_write(UC_X86_REG_ESP, STACK)
uc.emu_start(0x43a747, STOP, count=1000)
assert uc.reg_read(UC_X86_REG_EIP) == STOP and uc.reg_read(UC_X86_REG_ESP) == STACK + 8
assert columns == [0, 1, 2, 3] and get(RECORD + 4) == TABLE
mapping = [{'column': name, 'offset': hex(offset), 'value': get(RECORD + offset)}
           for name, offset in zip(table['columns'], [0xc, 0x10, 0x14, 0x18])]
assert [m['value'] for m in mapping] == [int(row[name]) for name in table['columns']]
output = {'status': 'PASS_ORIGINAL_PET_SKILL_NEXT_LEVEL_COST_LOADER', 'loader': '0x43a747',
          'recordVtable': '0x5c4ca8', 'mapping': mapping,
          'scope': 'One real10212 source row through complete original loader with parsed getter terminal; factory/manager identity is separately static-qualified. No learning server transaction.'}
(ROOT / 'recovery/output/pet-skill-learn-cost-loader-native.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(output['status'])
