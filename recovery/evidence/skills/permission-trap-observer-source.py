"""Execute original flag10/11 observer branches for skills4002/4003."""
import json
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import (
    UC_X86_REG_EAX, UC_X86_REG_ESI, UC_X86_REG_EIP, UC_X86_REG_ESP,
)

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

machine, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x10000)
ROLE, RECORD, VTABLE, GAME, STACK = [0x2001000 + i * 0x1000 for i in range(5)]
HP, ID = 0x2008000, 0x2008100


def write(address, value):
    machine.mem_write(address, struct.pack('<I', value & 0xffffffff))


def read(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


write(ROLE, VTABLE)
write(ROLE + 0x2a0, RECORD)
write(VTABLE + 0x14, HP)
write(VTABLE + 4, ID)
write(0x633588, GAME)
write(GAME + 0x128, 0x2007000)
observed = []
health = 100


def finish(value, pop):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EAX, value & 0xffffffff)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def boundary(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == HP:
        assert read(stack + 4) == 15
        finish(health, 4)
    elif address == ID:
        finish(73, 0)
    elif address == 0x4886aa:
        observed.append(dict(roleId=read(stack + 4), skillId=read(stack + 8),
                             duration=read(stack + 12)))
        finish(0, 12)


for address in [HP, ID, 0x4886aa]:
    machine.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)

rows = []
for flag, skill, start, end in [(11, 4003, 0x42f68d, 0x42f6ed),
                                (10, 4002, 0x42f6ed, 0x42f74d)]:
    for old, new in [(1, 0), (2, 1), (3, 2), (255, 254), (255, 0),
                     (0, 255), (0, 1), (1, 2), (0, 0), (1, 1)]:
        for flag6 in [0, 1]:
            for health in [-1, 0, 100]:
                machine.mem_write(RECORD + 0x11c + flag, bytes([new]))
                machine.mem_write(RECORD + 0x122, bytes([flag6]))
                machine.mem_write(ROLE + 0x360 + flag, bytes([old]))
                observed.clear()
                machine.reg_write(UC_X86_REG_ESI, ROLE)
                machine.reg_write(UC_X86_REG_ESP, STACK)
                machine.emu_start(start, end, count=100)
                assert machine.reg_read(UC_X86_REG_EIP) == end
                assert machine.reg_read(UC_X86_REG_ESP) == STACK
                expected = old != new and health > 0 and (new == 0 or old == new + 1)
                assert observed == ([dict(roleId=73, skillId=skill, duration=0)] if expected else [])
                rows.append(dict(flag=flag, skillId=skill, old=old, new=new, flag6=flag6,
                                 hp=health, effectRequests=list(observed)))

result = dict(status='PASS_ORIGINAL_PERMISSION_OBSERVER_ONLY', tasks=['FUNC-04', 'FUNC-05'],
    cases=rows,
    fields=[dict(flag=10, recordOffset='0x126', cacheOffset='0x36a', skillId=4002,
                 entry='0x42f6ed', end='0x42f74d'),
            dict(flag=11, recordOffset='0x127', cacheOffset='0x36b', skillId=4003,
                 entry='0x42f68d', end='0x42f6ed')],
    executionBoundary='Original complete observer branches; supplied HP/id getters and recording4886aa. No placement, expiry, inventory or network execution.',
    confirmed='Changed count plus signed HP>0 plus (new0 or old=new+1) invokes skill4002/4003 duration0. Neither branch checks flag6. Count increase including0->255 does not invoke.',
    missingProducer=dict(fields='record+126/+127 uint8 permission count decrease and restoration; skill4002/4003 FuncT1=5',
        nextEntrances=['Attribute33 sender of permission array10/11',
                       'Func12 ground item3004/3005 authoritative trigger and skill4002/4003 executor'],
        originalUnits='FuncT1=5 time consumer and server producer are unconfirmed; effect duration0 is the actual observer argument'))
(ROOT / 'recovery/output/permission-trap-observer-source.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: {len(rows)} original flag10/11 observer cases; no ground authority claim')
