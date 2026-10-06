"""Execute the original property31 observer, supplying role/table/effect boundaries."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x100000)
ROLE, RECORD, VTABLE, OWNER = 0x2001000, 0x2002000, 0x2003000, 0x2004000
GLOBAL, STAGES, STAGE, STAGE_VTABLE = 0x2005000, 0x2006000, 0x2006100, 0x2006200
FIELD, RESOURCES, SKILLS, EFFECTS = 0x2007000, 0x2008000, 0x2009000, 0x200a000
PREVIEW, SENTINEL, FIRST_NODE, SECOND_NODE = 0x200e000, 0x200f000, 0x200f100, 0x200f200
STACK, RETURN, GET_STAGE, RECOMPUTE = 0x2010000, 0x2011000, 0x2012000, 0x2013000
catalog = []
addresses = {}
for index, row in enumerate(read_table(ROOT / 'CDTank/Data/table/skill.dat')['rows']):
    values = row['values']
    skill = dict(skillId=int(values['SkillTableID']), triggerType=int(values['TriggerType']))
    catalog.append(skill)
    address = 0x2020000 + index * 0x80
    addresses[skill['skillId']] = address
    uc.mem_write(address + 0xc, struct.pack('<I', skill['skillId']))
    uc.mem_write(address + 0x2c, struct.pack('<i', skill['triggerType']))


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[value & 0xffffffff for value in values]))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def state():
    return dict(previous=list(struct.unpack('<16i', uc.mem_read(ROLE + 0x320, 64))),
                dirty=bool(uc.mem_read(ROLE + 0x2b4, 1)[0]))


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


events = []
stage_state, role_present = 3, True


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == GET_STAGE:
        finish(stage_state)
    elif address == 0x48a226:
        assert machine.reg_read(UC_X86_REG_ECX) == OWNER and read(stack + 4) == 73
        finish(ROLE if role_present else 0, 4)
    elif address == 0x411068:
        assert machine.reg_read(UC_X86_REG_ECX) == SKILLS + 0xc
        finish(addresses.get(read(stack + 4), 0), 4)
    elif address == 0x4501fa:
        assert machine.reg_read(UC_X86_REG_ECX) in [PREVIEW + 4, PREVIEW + 0x14]
        output, key = read(stack + 4), read(stack + 8)
        write(output, {73: FIRST_NODE, 74: SECOND_NODE}.get(read(key), SENTINEL))
        finish(output, 8)
    elif address == 0x486d6f:
        assert machine.reg_read(UC_X86_REG_ECX) == EFFECTS and read(stack + 4) == 73
        events.append(dict(kind='stop', skillId=read(stack + 8), state=state()))
        finish(0, 8)
    else:
        assert machine.reg_read(UC_X86_REG_ECX) == ROLE
        assert [read(stack + offset) for offset in [4, 8, 12, 16, 20]] == [
            0x200b000 if stage_state in [2, 3, 4] else 0,
            0x200c000 if stage_state in [2, 3, 4] else 0, SKILLS, 0x200d000, 0x422dfd]
        events.append(dict(kind='recompute', state=state()))
        finish(0, 20)


for address in [GET_STAGE, 0x48a226, 0x411068, 0x486d6f, 0x4501fa, RECOMPUTE]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
write(0x633588, GLOBAL)
write(GLOBAL + 0xac, 0)
write(GLOBAL + 0xe0, STAGES)
write(STAGES, STAGE)
write(STAGE, STAGE_VTABLE)
write(STAGE_VTABLE + 4, GET_STAGE)
write(GLOBAL + 0x114, RESOURCES)
write(GLOBAL + 0x128, EFFECTS)
write(RESOURCES + 0x78, SKILLS, 0x200d000)
write(OWNER + 0x20, 0x200b000, 0x200c000)
write(OWNER + 0x40, PREVIEW)
write(PREVIEW + 8, SENTINEL)
write(PREVIEW + 0x18, SENTINEL)
write(PREVIEW + 0x20, 0x5c4118)
write(PREVIEW + 0xc4, 73, 74)
write(FIRST_NODE + 0x10, 0x200b000)
write(SECOND_NODE + 0x10, 0x200c000)
write(ROLE, VTABLE)
write(VTABLE + 4, 0x431d4d)
write(VTABLE + 0x28, 0x432738)
write(VTABLE + 0x74, RECOMPUTE)
write(ROLE + 0x2a0, RECORD)
write(RECORD + 0xc, 73)
write(FIELD, 0x5dc01c)
uc.mem_write(FIELD + 8, bytes([31]))
rows = []
cases = []
for skill in catalog:
    for local in [False, True]:
        for kept in [False, True]:
            cases.append(dict(previous=[skill['skillId']] + [0] * 15,
                              current=[skill['skillId'] if kept else 0] + [0] * 15,
                              local=local, stage=3, present=True))
active = next(skill['skillId'] for skill in catalog if skill['triggerType'] in [2, 3])
for local in [False, True]:
    for stage in [0, 1, 2, 3, 4]:
        cases.append(dict(previous=[active, active, 0, 999999] + [0] * 12,
                          current=[0] * 16, local=local, stage=stage, present=True))
    cases.append(dict(previous=[active] + [0] * 15, current=[0] * 16,
                      local=local, stage=3, present=False))
for case in cases:
    stage_state, role_present = case['stage'], case['present']
    write(OWNER + 0x3c, ROLE if case['local'] else 0)
    write(ROLE + 0x320, *case['previous'])
    write(RECORD + 0xd0, *case['current'])
    uc.mem_write(ROLE + 0x2b4, b'\0')
    initial = state()
    events.clear()
    write(0, 0x12345678)
    write(STACK, RETURN, RECORD, FIELD, 0x11223344)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, OWNER)
    uc.emu_start(0x42f385, RETURN, count=20000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 16
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234 and read(0) == 0x12345678
    expected = dict(previous=case['previous'], dirty=False)
    expected_events = []
    if case['stage'] != 1 and case['present']:
        for skill_id in case['previous']:
            skill = next((skill for skill in catalog if skill['skillId'] == skill_id), None)
            if skill_id and skill_id not in case['current'] and skill and skill['triggerType'] in [2, 3]:
                expected_events.append(dict(kind='stop', skillId=skill_id, state=initial))
        expected = dict(previous=case['current'], dirty=case['local'])
        if case['local']:
            expected_events.append(dict(kind='recompute', state=expected))
    assert state() == expected and events == expected_events
    rows.append(dict(**case, result=state(), events=list(events)))
(ROOT / 'recovery/output/role-skill-observer-native.json').write_text(json.dumps(dict(
    status='PASS', catalog=catalog, rows=rows,
    scope='Complete42f385 observer with actual property getter53ff90, role getter431d4d, '
          'dirty setter432738, resources413c65/413c74 and source getters427ba2/427bf9. '
          'Stage getter, role lookup, skill-table lookup, preview map-node lookup4501fa, '
          'stop486d6f and full recompute supplied. Actual stage2 profile selectors28/29 and '
          '41e99c/421f36 result gates execute; recompute checks all5 arguments. '
          'Proves property31 observer order, not effect teardown or full stat recompute.'), indent=2) + '\n')
print(f'PASS: {len(rows)} original property31 observer cases across all342 source skills')
