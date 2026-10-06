"""Execute original mode-0 and world-position manager entries."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

exe = ROOT / 'CDTank/CDTank.exe'
machine, _ = map_original_binaries([exe])
machine.mem_map(0x2000000, 0x20000)
MANAGER, NODE, VTABLE, POSITION, STACK, STOP = (
    0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2008000, 0x201f000)
events = []
found = False
created = False


def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def finish(pop, result=None):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)
    if result is not None:
        machine.reg_write(UC_X86_REG_EAX, result)


def hook(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == 0x4792d8:
        assert uc.reg_read(UC_X86_REG_ECX) == MANAGER
        events.append({'event': 'find', 'id': uint(stack + 4)})
        finish(4, NODE if found else 0)
    elif address == 0x4795fa:
        assert uc.reg_read(UC_X86_REG_ECX) == MANAGER
        assert uint(stack + 8) == 0
        events.append({'event': 'create', 'id': uint(stack + 4)})
        finish(8, NODE if created else 0)
    elif address == 0x469ebd:
        assert uint(uint(stack + 4)) == NODE
        events.append({'event': 'addActive'})
        finish(4)
    elif address == STOP - 0x10:
        assert uc.reg_read(UC_X86_REG_ECX) == NODE
        position = list(struct.unpack('<3f', uc.mem_read(uint(stack + 4), 12)))
        events.append({'event': 'startWorld', 'position': position})
        finish(4)


machine.hook_add(UC_HOOK_CODE, hook)
machine.mem_write(NODE, struct.pack('<I', VTABLE))
machine.mem_write(VTABLE + 0x38, struct.pack('<I', STOP - 0x10))
rows = []
for origin in [False, True]:
    for enabled in [False, True]:
        for found in [False, True]:
            for created in [False, True]:
                events.clear()
                machine.mem_write(MANAGER + 0x64, bytes([enabled]))
                position = [1.25, -2.5, 37.75]
                machine.mem_write(POSITION, struct.pack('<3f', *position))
                machine.mem_write(STACK, struct.pack('<III', STOP, 0x12345678, POSITION))
                machine.reg_write(UC_X86_REG_ESP, STACK)
                machine.reg_write(UC_X86_REG_ECX, MANAGER)
                machine.emu_start(0x47b510 if origin else 0x47b1f0, STOP, count=1000)
                assert machine.reg_read(UC_X86_REG_ESP) == STACK + (8 if origin else 12)
                returned = machine.reg_read(UC_X86_REG_EAX) == NODE
                assert returned == (enabled and (found or created))
                if returned:
                    assert events[-1]['position'] == ([0, 0, 0] if origin else position)
                rows.append({'origin': origin, 'enabled': enabled, 'found': found,
                             'created': created, 'id': 0x12345678, 'position': position,
                             'returned': returned, 'events': list(events)})
(ROOT / 'recovery/output/effect-world-start-native.json').write_text(json.dumps({
    'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} original mode-0/world starts, lookup/create/add/start order and stack balance')
