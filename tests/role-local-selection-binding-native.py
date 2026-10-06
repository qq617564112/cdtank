"""Observe original local-role selection and its camera/UI propagation."""
import json
import struct
import sys
from pathlib import Path

from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
GLOBAL, OWNER, ROLE, VISUAL, CAMERA, VIEW_MANAGER, VIEW_VTABLE, UI = [
    0x2001000 + i * 0x1000 for i in range(8)]
CALLBACK, CALLBACK_VTABLE, STACK, STOP, LOOKUP, NOTIFY = [
    0x2009000 + i * 0x1000 for i in range(6)]


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


trace, role_writes = [], []


def terminal(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == LOOKUP:
        assert machine.reg_read(UC_X86_REG_ECX) == VIEW_MANAGER
        assert read(stack + 4) == VISUAL
        trace.append({'kind': 'cameraLookup', 'visual': VISUAL})
        finish(CAMERA)
    else:
        assert machine.reg_read(UC_X86_REG_ECX) == CALLBACK
        assert read(stack + 4) == 123
        trace.append({'kind': 'uiCallback', 'argument': 123})
        finish(pop=4)


def watch(machine, access, address, size, value, data):
    if address < ROLE + 0x370 and address + size > ROLE:
        role_writes.append({'pc': hex(machine.reg_read(UC_X86_REG_EIP)),
                            'offset': hex(address - ROLE), 'size': size, 'value': value})


for address in (LOOKUP, NOTIFY):
    uc.hook_add(UC_HOOK_CODE, terminal, begin=address, end=address)
uc.hook_add(UC_HOOK_MEM_WRITE, watch)
write(0x633588, GLOBAL)
write(GLOBAL + 0x11c, UI)
write(0x635830, VIEW_MANAGER)
write(VIEW_MANAGER, VIEW_VTABLE)
write(VIEW_VTABLE + 0x28, LOOKUP)
write(CALLBACK, CALLBACK_VTABLE)
write(CALLBACK_VTABLE + 8, NOTIFY)
rows = []
for present, callback in ((False, False), (True, False), (True, True)):
    uc.mem_write(ROLE, bytes(0x370))
    write(ROLE, 0x5c2c28)
    write(ROLE + 0x310, VISUAL)
    write(OWNER + 0x3c, 99)
    write(CAMERA + 0xa0, 98)
    write(UI + 0x30, 123)
    write(UI + 0x58, CALLBACK if callback else 0)
    before = bytes(uc.mem_read(ROLE, 0x370))
    trace.clear()
    role_writes.clear()
    write(STACK, STOP, ROLE if present else 0)
    uc.reg_write(UC_X86_REG_ECX, OWNER)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x42300f, STOP, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert read(OWNER + 0x3c) == (ROLE if present else 99)
    assert read(CAMERA + 0xa0) == (VISUAL if present else 98)
    assert len(trace) == int(present) + int(present and callback)
    assert not role_writes and bytes(uc.mem_read(ROLE, 0x370)) == before
    rows.append({'rolePresent': present, 'uiCallbackPresent': callback,
                 'trace': list(trace), 'roleWrites': list(role_writes),
                 'roleBinding': [read(ROLE + 0xa0), read(ROLE + 0xa4)]})

result = {
    'status': 'PASS_ORIGINAL_LOCAL_SELECTION_CAMERA_UI_PROPAGATION_NO_ROLE_BINDING_WRITE',
    'entry': '0x42300f', 'cameraSetter': '0x455873', 'uiDispatch': '0x436444',
    'rows': rows,
    'scope': 'Complete original42300f,455873 and436444. Visual-manager virtual+28 '
             'lookup and optional UI virtual+8 terminal supplied. Role fixture has '
             'derived vtable and visual reference; full role range monitored. '
             'No rendering initialization, live client selection, server acceptance '
             'or binding absence outside this entry is claimed.',
}
(ROOT / 'recovery/output/role-local-selection-binding-native.json').write_text(
    json.dumps(result, indent=2) + '\n')
print('PASS: three original local-selection camera/UI branches, no role-record writes')
