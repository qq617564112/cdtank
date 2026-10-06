"""Execute original skill MaxHP accumulation and the recompute health tail."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
ROLE, RECORD, VTABLE, BASE, SOURCE, VALUE = [0x2001000 + index * 0x1000 for index in range(6)]
STACK, RETURN, NOTIFY, SCRATCH = 0x2010000, 0x2011000, 0x2012000, 0x2013000
skills = read_table(ROOT / 'CDTank/Data/table/skill.dat')
current_values, columns, events = None, [], []


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[value & 0xffffffff for value in values]))


def read(address):
    return struct.unpack('<i', uc.mem_read(address, 4))[0]


def health():
    return dict(hp=read(RECORD + 0x54), maxHp=read(RECORD + 0x58))


def finish(value, pop):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack) & 0xffffffff)
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x4391c4:
        column = read(stack + 4)
        assert read(stack + 8) == 0 and 19 <= column <= 61
        columns.append(column)
        write(VALUE, int(current_values[skills['columns'][column]]))
        finish(VALUE, 8)
    else:
        assert machine.reg_read(UC_X86_REG_ECX) == RECORD
        events.append(dict(index=read(stack + 4), health=health(),
                           dirty=bool(uc.mem_read(ROLE + 0x2b4, 1)[0])))
        finish(0, 4)


uc.hook_add(UC_HOOK_CODE, hook, begin=0x4391c4, end=0x4391c4)
uc.hook_add(UC_HOOK_CODE, hook, begin=NOTIFY, end=NOTIFY)
write(ROLE, VTABLE)
write(ROLE + 0x2a0, RECORD)
write(VTABLE + 0x14, 0x432417)
write(RECORD, VTABLE)
write(VTABLE + 0x24, NOTIFY)
rows = []
for skill in skills['rows']:
    current_values = skill['values']
    columns.clear()
    uc.mem_write(SOURCE, bytes(0x300))
    for register, value in [(UC_X86_REG_ESI, SOURCE), (UC_X86_REG_ESP, STACK),
                            (UC_X86_REG_EBX, 0), (UC_X86_REG_EDI, 19), (UC_X86_REG_EBP, STACK + 0x100)]:
        uc.reg_write(register, value)
    uc.emu_start(0x43acf2, 0x43af5c, count=1000)
    assert columns == list(range(19, 62))
    assert read(SOURCE + 0xe8) == int(current_values['MaxHP'])
    write(SOURCE + 0x2c, int(current_values['TriggerType']))
    for role_value in [1, 10, 50]:
        for base in [100, 200, 400]:
            write(BASE + 0x2c, base)
            write(ROLE + 0x24, role_value)
            write(RECORD + 0x54, 37, 0)
            for register, value in [(UC_X86_REG_EAX, BASE), (UC_X86_REG_ESI, ROLE),
                                    (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0),
                                    (UC_X86_REG_FPTAG, 0xffff)]:
                uc.reg_write(register, value)
            uc.emu_start(0x4334e8, 0x4334fd, count=100)
            assert health() == dict(hp=37, maxHp=base)
            write(STACK, RETURN, SOURCE, ROLE, SCRATCH, SCRATCH + 4,
                  SCRATCH + 8, SCRATCH + 12, SCRATCH + 16, SCRATCH + 20)
            uc.reg_write(UC_X86_REG_ESP, STACK)
            uc.reg_write(UC_X86_REG_FPCW, 0x27f)
            uc.reg_write(UC_X86_REG_FPSW, 0)
            uc.reg_write(UC_X86_REG_FPTAG, 0xffff)
            uc.emu_start(0x432951, RETURN, count=1000)
            assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 36
            rows.append(dict(skillId=int(current_values['SkillTableID']),
                triggerType=int(current_values['TriggerType']), funcZ1=int(current_values['FuncZ1']),
                roleValue9=role_value, maxHp=int(current_values['MaxHP']), base=base, result=health()))

limits = dict(upper=read(0x61e4a0), lower=read(0x61e52c))
tail_rows = []
for max_hp in [-20, 0, 99, 100, 200, 400, 401, 500]:
    for vip in [0, 1, 2]:
        for multiplier in [0, 1, 2, 3]:
            write(RECORD + 0x54, 777, max_hp)
            uc.mem_write(RECORD + 0x50, bytes([vip]))
            write(ROLE + 0x98, multiplier)
            uc.mem_write(ROLE + 0x2b4, b'\1')
            uc.reg_write(UC_X86_REG_ESI, ROLE)
            uc.reg_write(UC_X86_REG_ESP, STACK)
            uc.emu_start(0x4337d7, 0x4337ea, count=100)
            uc.emu_start(0x43393b, 0x43394e, count=100)
            events.clear()
            uc.reg_write(UC_X86_REG_EAX, RECORD)
            uc.emu_start(0x433ce1, 0x433d15, count=100)
            capped = max(limits['lower'], min(limits['upper'], max_hp))
            result = capped * multiplier if vip else capped
            assert health() == dict(hp=777, maxHp=result)
            assert events == [dict(index=index, health=health(), dirty=True) for index in [13, 5]]
            assert uc.mem_read(ROLE + 0x2b4, 1) == b'\0'
            tail_rows.append(dict(maxHp=max_hp, vip=vip, multiplier=multiplier,
                                 result=health(), events=list(events)))
(ROOT / 'recovery/output/role-max-hp-native.json').write_text(json.dumps(dict(
    status='PASS', additions=rows, limits=limits, tails=tail_rows,
    scope='342 actual19..61 field-loader blocks, complete432951 skill accumulation with actual '
          'role getter9 and prepared writable remaining fields, base MaxHP copy4334e8, '
          'actual upper/lower MaxHP blocks and433ce1..433d15 VIP/notify/dirty tail. '
          'Parsed table getter and final record observer supplied; intervening full stat '
          'composition and source ownership not covered. Bounds are initial executable '
          'global values; runtime configuration provenance remains unresolved.'), indent=2) + '\n')
print(f'PASS: {len(rows)} full original skill MaxHP additions and {len(tail_rows)} cap/VIP/notification tails')
