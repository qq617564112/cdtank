"""Complete42ccd9 paired records with actual constructors/readers; storage boundaries supplied."""
import json
from pathlib import Path
import runpy
from unicorn.x86_const import UC_X86_REG_EAX
ROOT = Path(__file__).resolve().parents[3]
g = runpy.run_path(str(ROOT / 'recovery/evidence/roles/role-owned-equipment-native.py'))
uc, write, read, execute = [g[key] for key in ['uc', 'write', 'read', 'execute']]
MESSAGE, STREAM, BUFFER = 0x2022000, g['STREAM'], g['BUFFER']
base_rows = g['base_evidence']['rows']
rows = []
execute(0x42cd5c, MESSAGE)
assert uc.reg_read(UC_X86_REG_EAX) == 0x3aa5
for index in range(16):
    equipment = g['rows'][index * 5 % len(g['rows'])]
    base = base_rows[index * 7 % len(base_rows)]
    alignment = index % 8
    packed, cursor = 0, alignment
    for source in [equipment, base]:
        for bit in range(source['alignment'], source['finalBit']):
            packed |= ((source['raw'][bit >> 3] >> (bit & 7)) & 1) << cursor
            cursor += 1
    raw = packed.to_bytes((cursor + 7) // 8, 'little')
    uc.mem_write(BUFFER, raw + bytes(1024 - len(raw)))
    write(STREAM, alignment, 0, BUFFER, 1024)
    execute(0x42ccd9, MESSAGE, STREAM)
    second, first = read(MESSAGE + 0xc), read(MESSAGE + 0x10)
    assert {str(o): read(second + o) for o, _ in g['fields']} == equipment['result']
    assert {str(o): read(first + o) for o, _ in g['base_fields']} == base['result']
    assert list(g['names'][second]) == equipment['nameBytes']
    assert list(g['names'][first + 0xc]) == base['nameBytes']
    assert read(STREAM) + read(STREAM + 4) * 8 == cursor
    rows.append(dict(alignment=alignment, raw=list(raw), equipment=equipment['result'], base=base['result'],
                     equipmentName=equipment['nameBytes'], baseName=base['nameBytes'], finalBit=cursor))
(ROOT / 'recovery/output/role-owned-pair-native.json').write_text(json.dumps(dict(status='PASS', rows=rows,
    scope='Complete42ccd9 type3aa5 allocates and constructs both owned records then reads equipment/base in order. '
          'Allocation/free/string storage supplied; receive-handler ownership transfer not covered.'), indent=2)+'\n')
print(f'PASS: {len(rows)} full3aa5 paired constructors/readers and cursor contracts')
