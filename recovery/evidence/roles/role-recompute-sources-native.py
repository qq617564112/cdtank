"""Execute source getters, actual profile selectors and inventory lookup forwarding."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
OWNER, GLOBAL, STAGES, STAGE, VTABLE = 0x2001000, 0x2002000, 0x2003000, 0x2004000, 0x2005000
CONTAINER, SENTINEL, NODE, SOURCE = 0x2006000, 0x2007000, 0x2008000, 0x2009000
STACK, RETURN, GET_STAGE = 0x2010000, 0x2011000, 0x2012000
stage_state, available = 0, False
lookups = []


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[value & 0xffffffff for value in values]))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == GET_STAGE:
        finish(stage_state)
    else:
        assert machine.reg_read(UC_X86_REG_ECX) in [CONTAINER + 0x14, CONTAINER + 4]
        output, key = read(stack + 4), read(stack + 8)
        lookups.append(read(key))
        write(output, NODE if available else SENTINEL)
        finish(output, 8)


for address in [GET_STAGE, 0x4501fa]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
write(0x633588, GLOBAL)
write(GLOBAL + 0xac, 0)
write(GLOBAL + 0xe0, STAGES)
write(STAGES, STAGE)
write(STAGE, VTABLE)
write(VTABLE + 4, GET_STAGE)
write(OWNER + 0x40, CONTAINER)
write(CONTAINER + 0x18, SENTINEL)
write(CONTAINER + 8, SENTINEL)
write(CONTAINER + 0x20, 0x5c4118)
write(NODE + 0x10, SOURCE)
rows = []
selection_rows = []
PROFILE = CONTAINER + 0x20
for selector, offset in [(28, 0x84), (29, 0x88)]:
    for value in [0, 73, 0x80000001, 0xffffffff]:
        uc.mem_write(PROFILE + 0x20, b'\xaa' * 0x170)
        before = bytearray(uc.mem_read(PROFILE, 0x190))
        write(STACK, RETURN, selector, value)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, PROFILE)
        uc.emu_start(0x42fdea, RETURN, count=100)
        assert uc.reg_read(UC_X86_REG_EAX) & 255 == 1
        assert uc.reg_read(UC_X86_REG_ESP) == STACK + 12
        struct.pack_into('<I', before, 0x20 + offset, value)
        assert bytes(uc.mem_read(PROFILE, 0x190)) == bytes(before)
        write(STACK, RETURN, selector)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, PROFILE)
        uc.emu_start(0x42fdc5, RETURN, count=100)
        assert uc.reg_read(UC_X86_REG_EAX) == value
        selection_rows.append(dict(selector=selector, offset=offset, value=value))
for stage_state in [0, 1, 2, 3, 4, 5]:
    for selector, getter, offset in [(28, 0x427ba2, 0x20), (29, 0x427bf9, 0x24)]:
        for instance_id in [0, 73, 0x80000001, 0xffffffff]:
            for available in [False, True]:
                direct = SOURCE if available else 0
                write(OWNER + offset, direct)
                # SPrPlayer wrapper+20 contains its DB record; selectors28/29 read+84/+88.
                write(STACK, RETURN, selector, instance_id)
                uc.reg_write(UC_X86_REG_ESP, STACK)
                uc.reg_write(UC_X86_REG_ECX, PROFILE)
                uc.emu_start(0x42fdea, RETURN, count=100)
                lookups.clear()
                write(STACK, RETURN)
                uc.reg_write(UC_X86_REG_ESP, STACK)
                uc.reg_write(UC_X86_REG_EBP, 0x1234)
                uc.reg_write(UC_X86_REG_ECX, OWNER)
                uc.emu_start(getter, RETURN, count=1000)
                result = uc.reg_read(UC_X86_REG_EAX)
                assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 4
                assert uc.reg_read(UC_X86_REG_EBP) == 0x1234
                assert result == (direct if stage_state in [2, 3, 4] else 0)
                assert lookups == ([instance_id] if stage_state == 2 else [])
                rows.append(dict(stage=stage_state, selector=selector, instanceId=instance_id,
                                 direct=direct, available=available, result=result, lookups=list(lookups)))
(ROOT / 'recovery/output/role-recompute-sources-native.json').write_text(json.dumps(dict(
    status='PASS', rows=rows, selectionRows=selection_rows,
    scope='Complete427ba2/427bf9,4269c4,actual profile virtual getter42fdc5/42029e '
          'selectors28/29, and41e99c/421f36 lookup forwarding/result gates execute. Stage getter '
          'and map-node search4501fa supplied; wrapper vtable/pointers and instances prepared. '
          'Owned record payload loading and full profile initialization not covered.'), indent=2) + '\n')
print(f'PASS: {len(rows)} original stage/profile/owned-instance recompute source getters')
