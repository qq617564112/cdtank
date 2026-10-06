"""Execute the full original42f385 property5/8 observer and actual role getters."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
ROLE, RECORD, VTABLE, OWNER, GLOBAL, STAGES, STAGE, STAGE_VTABLE, FIELD, OBSERVER, OBSERVER_VTABLE, STACK, RETURN, GET_STAGE, UPDATED = [0x2001000 + i * 0x1000 for i in range(15)]
def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))
def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]
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
        events.append(dict(kind='stage'))
        finish(stage_state)
    elif address == 0x48a226:
        assert machine.reg_read(UC_X86_REG_ECX) == OWNER and read(stack + 4) == 73
        events.append(dict(kind='lookup', objectId=73))
        finish(ROLE if role_present else 0, 4)
    else:
        assert machine.reg_read(UC_X86_REG_ECX) == OBSERVER
        events.append(dict(kind='updated', count=read(stack + 4), maximum=read(stack + 8)))
        finish(0, 8)
for address in [GET_STAGE, 0x48a226, UPDATED]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
write(0x633588, GLOBAL)
write(GLOBAL + 0xac, 0)
write(GLOBAL + 0xe0, STAGES)
write(STAGES, STAGE)
write(STAGE, STAGE_VTABLE)
write(STAGE_VTABLE + 4, GET_STAGE)
write(ROLE, VTABLE)
write(VTABLE + 0x18, 0x422b44)
write(ROLE + 0x2a0, RECORD)
write(RECORD + 0xc, 73)
write(FIELD, 0x5dc01c)
write(OBSERVER, OBSERVER_VTABLE)
write(OBSERVER_VTABLE + 8, UPDATED)
rows = []
for stage_state in [0, 1, 2, 3, 4, 5]:
    for role_present in [False, True]:
        for local in [False, True]:
            for observer in [False, True]:
                for index in [5, 8, 9]:
                    for count in [0, 1, 2, 99, 0x80000000, 0xffffffff]:
                        for maximum in [0, 3, 0xffffffff]:
                            write(OWNER + 0x3c, ROLE if local else 0)
                            write(OWNER + 0x68, OBSERVER if observer else 0)
                            write(RECORD + 0x44, count)
                            write(RECORD + 0x38, maximum)
                            uc.mem_write(FIELD + 8, bytes([index]))
                            uc.mem_write(ROLE + 0x2b4, bytes([count & 1]))
                            before_role = bytes(uc.mem_read(ROLE, 0x380))
                            before_record = bytes(uc.mem_read(RECORD, 0x140))
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
                            expected = [dict(kind='stage')]
                            if stage_state != 1:
                                expected.append(dict(kind='lookup', objectId=73))
                                if role_present and local and observer and index in [5, 8]:
                                    expected.append(dict(kind='updated', count=count, maximum=maximum))
                            assert events == expected
                            assert bytes(uc.mem_read(ROLE, 0x380)) == before_role
                            assert bytes(uc.mem_read(RECORD, 0x140)) == before_record
                            rows.append(dict(stage=stage_state, present=role_present, local=local,
                                             observer=observer, index=index, count=count, maximum=maximum,
                                             events=list(events)))
(ROOT / 'recovery/output/role-ammo-observer-native.json').write_text(json.dumps(dict(
    status='PASS', rows=rows,
    scope='Complete42f385, field getter53ff90 and actual422b44/432349 selectors24 and4. '
          'Stage, role lookup and final owner+68 virtual+8 observer supplied. No role/record writes; '
          'no decrement, refill, HUD rendering or server producer inferred.'), indent=2) + '\n')
print(f'PASS: {len(rows)} full ammo-property observer calls, stage/local gates, raw current/max getters and unchanged role/record')
