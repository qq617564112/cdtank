"""Execute the original data-scale loader and its MaxHP bounds in recomputation."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
SOURCE, VALUE, ROLE, RECORD = 0x2001000, 0x2002000, 0x2003000, 0x2004000
STACK, RETURN = 0x2010000, 0x2011000
# Each address pair is the original lower/upper destination in43928a.
destinations = {
    1: (0x61e52c, 0x61e4a0, 'i'), 3: (0x635070, 0x61e4a8, 'f'),
    4: (0x635074, 0x61e4ac, 'f'), 5: (0x635078, 0x61e4b4, 'f'),
    6: (0x63507c, 0x61e4bc, 'f'), 7: (0x635080, 0x61e4c0, 'i'),
    8: (0x61e530, 0x61e4cc, 'f'), 9: (0x635084, 0x61e4c4, 'i'),
    10: (0x635088, 0x61e4d0, 'f'), 11: (0x63508c, 0x61e4e4, 'i'),
    12: (0x635090, 0x61e4d8, 'f'), 13: (0x635094, 0x61e4e0, 'f'),
    14: (0x61e534, 0x61e4f0, 'i'), 15: (0x61e538, 0x61e4f4, 'i'),
    16: (0x61e53c, 0x61e4fc, 'f'), 17: (0x61e540, 0x61e504, 'i'),
    19: (0x61e544, 0x61e548, 'f'), 20: (0x635098, 0x61e510, 'i'),
    22: (0x63509c, 0x61e514, 'f'), 27: (0x6350a0, 0x61e550, 'i'),
    28: (0x6350a4, 0x61e554, 'i'), 29: (0x6350a8, 0x61e558, 'i'),
    30: (0x6350ac, 0x61e55c, 'i'),
}
table = read_table(ROOT / 'CDTank/Data/table/datascale.dat')
current, columns = None, []


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value, pop):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x4391c4:
        column, mode = read(stack + 4), read(stack + 8)
        columns.append([column, mode])
        assert machine.reg_read(UC_X86_REG_ECX) == SOURCE
        if column == 1:
            assert mode == 5
            uc.mem_write(VALUE, current['Name'].encode() + b'\0')
        else:
            assert mode == 0
            uc.mem_write(VALUE, struct.pack('<i', int(current[table['columns'][column]])))
        finish(VALUE, 8)
    else:
        assert machine.reg_read(UC_X86_REG_ECX) == SOURCE + 0x10 and read(stack + 4) == VALUE
        finish(SOURCE + 0x10, 4)


for address in [0x4391c4, 0x401609]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)


def limits():
    return {str(index): dict(lower=struct.unpack('<' + kind, uc.mem_read(lower, 4))[0],
                            upper=struct.unpack('<' + kind, uc.mem_read(upper, 4))[0])
            for index, (lower, upper, kind) in destinations.items()}


initial = limits()
rows = []
for row in table['rows']:
    current = row['values']
    columns.clear()
    before = limits()
    uc.mem_write(STACK, struct.pack('<2I', RETURN, 0x2005000))
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, SOURCE)
    uc.emu_start(0x43928a, RETURN, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234
    assert columns == [[0, 0], [1, 5], [2, 0], [3, 0]]
    identifier = int(current['ID'])
    expected = dict(before)
    if identifier in destinations:
        expected[str(identifier)] = dict(lower=int(current['Min']), upper=int(current['Max']))
    assert limits() == expected
    assert read(SOURCE + 0xc) == identifier
    assert struct.unpack('<2i', uc.mem_read(SOURCE + 0x2c, 8)) == (int(current['Min']), int(current['Max']))
    rows.append(dict(id=identifier, name=current['Name'], minimum=int(current['Min']),
                     maximum=int(current['Max']), before=before, after=limits()))
uc.mem_write(ROLE + 0x2a0, struct.pack('<I', RECORD))
cap_rows = []
for value in [-1, 0, 100, 400, 999, 1000]:
    uc.mem_write(RECORD + 0x54, struct.pack('<2i', 777, value))
    uc.reg_write(UC_X86_REG_ESI, ROLE)
    uc.emu_start(0x4337d7, 0x4337ea, count=100)
    uc.emu_start(0x43393b, 0x43394e, count=100)
    hp, maximum = struct.unpack('<2i', uc.mem_read(RECORD + 0x54, 8))
    assert hp == 777 and maximum == max(0, min(999, value))
    cap_rows.append(dict(value=value, hp=hp, maxHp=maximum))
reload_rows = []
for base in [4, 5, 6, 30, 99, 100]:
    for factor in [0, 100, 123.456]:
        uc.mem_write(ROLE + 0x50, struct.pack('<2f', base, factor))
        for register, value in [(UC_X86_REG_ESI, ROLE), (UC_X86_REG_ESP, STACK),
                                (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0),
                                (UC_X86_REG_FPTAG, 0xffff)]:
            uc.reg_write(register, value)
        uc.emu_start(0x4338e7, 0x4338fe, count=100)
        uc.emu_start(0x433a4b, 0x433a62, count=100)
        uc.emu_start(0x433cc9, 0x433ce1, count=100)
        normal, special = struct.unpack('<2f', uc.mem_read(ROLE + 0x50, 8))
        reload_rows.append(dict(base=base, factor=struct.unpack('<f', struct.pack('<f', factor))[0],
                                normalSeconds=normal, type1Seconds=special))
(ROOT / 'recovery/output/role-data-scale-native.json').write_text(json.dumps(dict(
    status='PASS', initial=initial, rows=rows, final=limits(), caps=cap_rows, reloads=reload_rows,
    scope='Complete43928a numeric field loading and global writes for all53 source rows; '
          'parsed table getter and name string copy supplied. Actual4337d7/43393b MaxHP '
          'bounds execute after all source rows load. Table resource selection/full manager '
          'initialization and base health source remain outside this fixture.'), indent=2) + '\n')
print(f'PASS: {len(rows)} complete data-scale loads,23 combat global pairs and6 loaded MaxHP caps')
