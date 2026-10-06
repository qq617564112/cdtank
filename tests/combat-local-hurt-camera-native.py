"""Execute original three/four-part hurt through local-role lookup and camera activation."""
import json
from pathlib import Path
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

u, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
u.mem_map(0x2000000, 0x20000)
ACTOR, ROLE, OWNER, GLOBAL, STATE, TABLE, GFX, CAMERA, STACK, STOP = [0x2001000 + i * 0x1000 for i in range(10)]

def write(address, *values):
    u.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def read(address):
    return struct.unpack('<I', u.mem_read(address, 4))[0]

def finish(value=0, pop=0):
    stack = u.reg_read(UC_X86_REG_ESP)
    u.reg_write(UC_X86_REG_EAX, value)
    u.reg_write(UC_X86_REG_EIP, read(stack))
    u.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

events = []
mode = 1

def hook(machine, address, size, data):
    stack = u.reg_read(UC_X86_REG_ESP)
    if address in (0x46888f, 0x46c2ab):
        events.append(dict(kind='action', index=read(stack + 4), flags=read(stack + 8)))
        finish(pop=8)
    elif address == STOP + 16:
        finish(mode)
    elif address == STOP + 32:
        events.append(dict(kind='cameraLookup'))
        finish(CAMERA)
    elif address == STOP + 48:
        finish(55, 4)
    elif address == 0x4556e2:
        parameter, duration, strength = struct.unpack('<Iff', u.mem_read(stack + 4, 12))
        events.append(dict(kind='shake', parameter=parameter, duration=duration, strength=strength))

u.hook_add(UC_HOOK_CODE, hook)
write(0x633588, GLOBAL)
write(GLOBAL + 0x118, OWNER)
write(GLOBAL + 0xac, 0)
write(GLOBAL + 0xe0, TABLE)
write(TABLE, STATE)
write(STATE, TABLE + 0x100)
write(TABLE + 0x104, STOP + 16)
write(OWNER + 0x3c, ROLE)
write(OWNER + 0x40, ROLE - 0x20)
write(ROLE, TABLE + 0x200)
write(TABLE + 0x214, STOP + 48)
write(0x635830, GFX)
write(GFX, TABLE + 0x300)
write(TABLE + 0x328, STOP + 32)
assert read(0x5c6dd0 + 0x18) == 0x4556e2

rows = []
for mode in (1, 2):
    for parts, entry in ((3, 0x46897a), (4, 0x46c396)):
        for local in (False, True):
            for selector in (1, 2, 3, 4):
                u.mem_write(CAMERA, bytes(0x200))
                write(CAMERA, 0x5c6dd0)
                u.mem_write(CAMERA + 0x18, struct.pack('<3f', 12, 20, -30))
                write(ACTOR + 0x258, ROLE if local else ROLE + 0x500)
                write(ROLE + 0x500, TABLE + 0x200)
                write(STACK, STOP, selector)
                u.reg_write(UC_X86_REG_ECX, ACTOR)
                u.reg_write(UC_X86_REG_ESP, STACK)
                u.reg_write(UC_X86_REG_FPCW, 0x27f)
                events.clear()
                u.emu_start(entry, STOP, count=100000)
                assert u.reg_read(UC_X86_REG_ESP) == STACK + 8
                expected = [dict(kind='action', index=selector + 3, flags=4)]
                if parts == 3 and local:
                    expected += [dict(kind='cameraLookup'), dict(kind='shake', parameter=1, duration=.5, strength=10)]
                assert events == expected, (parts, local, selector, events)
                active = bool(u.mem_read(CAMERA + 0xb4, 1)[0])
                assert active == (parts == 3 and local)
                state = dict(active=active, parameter=read(CAMERA + 0xc4),
                             duration=struct.unpack('<f', u.mem_read(CAMERA + 0xc8, 4))[0],
                             strength=struct.unpack('<f', u.mem_read(CAMERA + 0xd0, 4))[0])
                if active:
                    assert state == dict(active=True, parameter=1, duration=.5, strength=10)
                rows.append(dict(parts=parts, local=local, mode=mode, selector=selector, events=list(events), camera=state))

c = Cs(CS_ARCH_X86, CS_MODE_32)
source = {hex(a): [dict(address=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}'.strip())
                  for i in c.disasm(bytes(u.mem_read(a, b-a)), a)]
          for a, b in ((0x46897a, 0x468a03), (0x46c396, 0x46c3de), (0x4269c4, 0x4269f4), (0x4556e2, 0x45573f))}
out = dict(status='PASS', rows=rows, source=source,
           scope='Full derived hurt,46504f/464bed field cache,4269c4 local-role getter,real camera vtable+18/4556e2/45573f. Actor action application,role field15 service,current state mode and active camera selection are supplied boundaries; camera activation is executed, not substituted. Existing full camera update oracle reused.')
(ROOT / 'recovery/output/combat-local-hurt-camera-native.json').write_text(json.dumps(out, indent=2) + '\n')
print(f'PASS: {len(rows)} original hurt/local-role/camera sequences; three-part local only activates(1,.5,10)')
