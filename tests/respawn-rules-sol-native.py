"""Execute original lifecycle dispatcher and base-role lifecycle methods."""
import json
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x30000)
OWNER, ROLE, RECORD, GLOBAL, SERVICE = [0x2001000 + i * 0x1000 for i in range(5)]
VTABLE, CALLBACK, CALLBACK_VTABLE = 0x2006000, 0x2007000, 0x2007100
STACK, RETURN, NOTIFY, OBSERVE = 0x2020000, 0x2021000, 0x2021100, 0x2021200

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def snapshot():
    return dict(status=read(RECORD + 0x90) if has_record else None,
        flags=list(uc.mem_read(RECORD + 0x11c, 16)),
        action=read(ROLE + 0x258), special12=uc.mem_read(ROLE + 0x308, 1)[0],
        deadline=struct.unpack('<f', uc.mem_read(ROLE + 0x9c, 4))[0],
        flag8Seconds=struct.unpack('<f', uc.mem_read(ROLE + 0x304, 4))[0],
        dirty=uc.mem_read(ROLE + 0x2b4, 1)[0])

def finish(pop=0, value=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

events = []

def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == NOTIFY:
        events.append(dict(kind='notify', index=read(stack + 4), state=snapshot()))
        finish(4)
    elif address == OBSERVE:
        source = read(stack)
        kind = {0x4259f9: 'death', 0x425a5f: 'respawn',
                0x425aa7: 'status', 0x425a1d: 'localRelation'}[source]
        arguments = [read(stack + 4)]
        if kind == 'status': arguments.append(read(stack + 8))
        events.append(dict(kind=kind, arguments=arguments, state=snapshot()))
        finish(8 if kind == 'status' else 4)
    else:
        kinds = {0x488f73: ('activateId', 4), 0x436464: ('activateRole', 4),
                 0x424be9: ('refreshRole', 4), 0x423157: ('deathFollowup', 8),
                 0x42410c: ('queryLocalRelation', 4)}
        kind, pop = kinds[address]
        events.append(dict(kind=kind, arguments=[read(stack + 4 + i) for i in range(0, pop, 4)], state=snapshot()))
        finish(pop, relation if address == 0x42410c else 0)

for address in [NOTIFY, OBSERVE, 0x488f73, 0x436464, 0x424be9, 0x423157, 0x42410c]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
write(0x633588, GLOBAL)
write(GLOBAL + 0x128, SERVICE)
write(GLOBAL + 0x11c, SERVICE)
write(RECORD, VTABLE)
write(VTABLE + 0x24, NOTIFY)
write(CALLBACK, CALLBACK_VTABLE)
write(CALLBACK_VTABLE + 8, OBSERVE)
rows = []
for has_record in [False, True]:
    for has_role in [False, True]:
        for status in range(4):
            for callbacks in range(4):
                for relation in [0, 1]:
                    uc.mem_write(OWNER, bytes(0x200))
                    uc.mem_write(ROLE, bytes(0x400))
                    write(ROLE, 0x5c41b8)
                    write(ROLE + 0x2a0, RECORD if has_record else 0)
                    write(ROLE + 0x2ac, 71)
                    write(ROLE + 0x258, 77)
                    write(RECORD + 0xc, 71)
                    write(RECORD + 0x90, 1)
                    uc.mem_write(RECORD + 0x11c, bytes(range(16)))
                    uc.mem_write(ROLE + 0x308, b'\x07')
                    uc.mem_write(ROLE + 0x2b4, b'\x01')
                    uc.mem_write(ROLE + 0x9c, struct.pack('<f', 4.375))
                    uc.mem_write(ROLE + 0x304, struct.pack('<f', .125))
                    write(OWNER + 0x3c, ROLE + 0x800)
                    for offset in [0x60, 0x84, 0x88]:
                        write(OWNER + offset, CALLBACK if callbacks & 1 else 0)
                    write(OWNER + 0xcc, CALLBACK if callbacks & 2 else 0)
                    events.clear()
                    initial = snapshot()
                    write(STACK, RETURN, ROLE if has_role else 0, status)
                    uc.reg_write(UC_X86_REG_ECX, OWNER)
                    uc.reg_write(UC_X86_REG_ESP, STACK)
                    uc.emu_start(0x4259ae, RETURN, count=10000)
                    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
                    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 12
                    result = snapshot()
                    assert result['status'] == (status if has_record and has_role else initial['status'])
                    assert result['flag8Seconds'] == initial['flag8Seconds']
                    assert result['dirty'] == initial['dirty']
                    rows.append(dict(hasRecord=has_record, hasRole=has_role, status=status,
                        callbacks=callbacks, relation=relation, initial=initial, result=result, events=events[:]))
output = ROOT / 'recovery/output/respawn-rules-sol-native.json'
output.write_text(json.dumps(dict(status='PASS', rows=rows, scope='Complete4259ae dispatcher, original base-role vtable5c41b8, status methods432e2a/432e76/432ecc/432f50, flag setter431dbf, action setter4320c7, ID getter431d4d and CRT memset. Record observers, callbacks and five downstream services supplied. Native input fixtures; no player acceptance, server respawn interval, HP restoration or spawn selection proof.'), indent=2) + '\n')
print(f'PASS: {len(rows)} original lifecycle dispatches, observer order and reset snapshots')
