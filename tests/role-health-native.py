"""Execute the original HP setter, integer getters and Life debug-format call."""
import json
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import (
    UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX,
    UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESP,
)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x30000)
ROLE, RECORD, VTABLE = 0x2001000, 0x2002000, 0x2003000
OBSERVER, OBSERVER_VTABLE = 0x2004000, 0x2004100
STACK, RETURN, NOTIFY, CHANGE, TEXT = (
    0x2010000, 0x2011000, 0x2012000, 0x2012100, 0x2013000,
)
events = []
formatted = []
present = True


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values),
                                     *[value & 0xffffffff for value in values]))


def unsigned(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def signed(address):
    return struct.unpack('<i', uc.mem_read(address, 4))[0]


def state():
    return dict(hp=signed(RECORD + 0x54), maxHp=signed(RECORD + 0x58)) if present else None


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == NOTIFY:
        assert machine.reg_read(UC_X86_REG_ECX) == RECORD
        assert unsigned(stack + 4) == 12
        events.append(dict(kind='notify', index=12, state=state()))
        pop = 4
    elif address == CHANGE:
        assert machine.reg_read(UC_X86_REG_ECX) == OBSERVER + 0x20
        assert unsigned(stack + 4) == ROLE
        events.append(dict(kind='changed', previousHp=signed(stack + 8), state=state()))
        pop = 8
    elif address == 0x57b70f:
        pattern = bytes(machine.mem_read(unsigned(stack + 8), 64)).split(b'\0')[0].decode()
        assert pattern == ' Life : %d / %d , Bullet : %d / %d \n'
        values = [signed(stack + offset) for offset in [12, 16, 20, 24]]
        formatted.append(pattern % tuple(values))
        pop = 0
    else:
        raise AssertionError(hex(address))
    machine.reg_write(UC_X86_REG_EAX, 0)
    machine.reg_write(UC_X86_REG_EIP, unsigned(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


for address in [NOTIFY, CHANGE, 0x57b70f]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)


def call(address, *args):
    write(STACK, RETURN, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, ROLE)
    uc.emu_start(address, RETURN, count=5000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234
    return uc.reg_read(UC_X86_REG_EAX)


pe = images['cdtank.exe']
assert pe.get_data(0x433412 + 15 * 4 - 0x400000, 4) == struct.pack('<I', 0x433336)
assert pe.get_data(0x4324d4 + 15 * 4 - 0x400000, 8) == struct.pack('<2I', 0x43248d, 0x432488)
assert pe.get_data(0x5c41b8 + 0x24 - 0x400000, 4) == struct.pack('<I', 0x433250)
assert pe.get_data(0x5c41b8 + 0x14 - 0x400000, 4) == struct.pack('<I', 0x432417)

write(ROLE, VTABLE)
write(VTABLE + 0x14, 0x432417)
write(RECORD, VTABLE)
write(VTABLE + 0x24, NOTIFY)
write(OBSERVER + 4, OBSERVER + 0x20)
write(OBSERVER + 0x20, OBSERVER_VTABLE)
write(OBSERVER_VTABLE + 8, CHANGE)
rows = []
for present in [True, False]:
    for observer in [True, False]:
        for maximum in [0, 1, 200]:
            for before in sorted({0, maximum // 2, maximum}):
                for value in sorted({-100, 0, before, maximum, maximum + 200, 0xffffffff}):
                    write(ROLE + 0x2a0, RECORD if present else 0)
                    write(ROLE + 0xb8, OBSERVER if observer else 0)
                    write(RECORD + 0x54, before, maximum)
                    events.clear()
                    accepted = bool(call(0x433250, 15, value) & 255)
                    getters = [call(0x432417, index) for index in [15, 16]]
                    getter_values = [struct.unpack('<i', struct.pack('<I', value))[0] for value in getters]
                    assert accepted == present
                    raw = struct.unpack('<i', struct.pack('<I', value & 0xffffffff))[0]
                    final = min(max(raw, 0), maximum)
                    assert getter_values == ([final, maximum] if present else [0, 0])
                    expected = [dict(kind='notify', index=12, state=dict(hp=raw, maxHp=maximum))] if present else []
                    if present and observer and final != before:
                        expected.append(dict(kind='changed', previousHp=before,
                                             state=dict(hp=final, maxHp=maximum)))
                    assert events == expected
                    rows.append(dict(present=present, observer=observer, before=before,
                                     maxHp=maximum, value=value, accepted=accepted,
                                     result=state(), getters=getter_values, events=list(events)))

# Execute the original Life formatting tail with real integer15/16 getters.
present = True
write(ROLE + 0x2a0, RECORD)
write(RECORD + 0x54, 37, 200)
write(STACK, 3, 5)
uc.reg_write(UC_X86_REG_ESP, STACK)
uc.reg_write(UC_X86_REG_EBP, ROLE)
uc.reg_write(UC_X86_REG_EAX, VTABLE)
uc.reg_write(UC_X86_REG_EDI, TEXT)
uc.emu_start(0x427e69, 0x427e89, count=1000)
assert uc.reg_read(UC_X86_REG_EIP) == 0x427e89
assert formatted == [' Life : 37 / 200 , Bullet : 3 / 5 \n']

(ROOT / 'recovery/output/role-health-native.json').write_text(json.dumps(dict(
    status='PASS', rows=rows, lifeDebugText=formatted[0],
    scope='Complete original433250 selector15 and432417 selectors15/16; '
          'supplied record/health observers. Original Life format tail427e69 proves '
          'HP then maximum HP names with real getters; formatting boundary supplied. '
          'No FuncType2 dispatch, server success, HP maximum composition or consumption proved.',
), indent=2) + '\n')
print(f'PASS: {len(rows)} original HP assignments/getters, pre-clamp notifications, '
      'post-clamp change callbacks and original Life format')
