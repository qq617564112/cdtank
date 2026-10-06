"""Actual432658 movement branches, with record notification observer supplied."""
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
uc.mem_map(0x2000000, 0x20000)
ROLE, RECORD, VTABLE, STACK, RETURN, NOTIFY = 0x2001000, 0x2002000, 0x2003000, 0x2010000, 0x2011000, 0x2011200
source = json.loads((ROOT / 'recovery/output/role-recompute-mastery-native.json').read_text())
events = []


def state():
    move, turn = struct.unpack('<ff', uc.mem_read(RECORD + 0x48, 8))
    return dict(move=move, turn=turn)


def observer(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert machine.reg_read(UC_X86_REG_ECX) == RECORD
    target, index = struct.unpack('<II', uc.mem_read(stack, 8))
    events.append(dict(index=index, state=state(), dirty=uc.mem_read(ROLE + 0x2b4, 1)[0]))
    machine.reg_write(UC_X86_REG_EIP, target)
    machine.reg_write(UC_X86_REG_ESP, stack + 8)


uc.hook_add(UC_HOOK_CODE, observer, begin=NOTIFY, end=NOTIFY)
uc.mem_write(RECORD, struct.pack('<I', VTABLE))
uc.mem_write(VTABLE + 0x24, struct.pack('<I', NOTIFY))
rows = []
inputs = [event for row in source['rows'] for event in row['events']]
for present in [True, False]:
    for index, event in enumerate(inputs):
        uc.mem_write(ROLE + 0x2a0, struct.pack('<I', RECORD if present else 0))
        uc.mem_write(RECORD + 0x48, struct.pack('<ff', 17.25, 3.125))
        dirty = index % 2
        uc.mem_write(ROLE + 0x2b4, bytes([dirty]))
        events.clear()
        value = struct.unpack('<f', struct.pack('<f', event['value']))[0]
        uc.mem_write(STACK, struct.pack('<II f', RETURN, event['selector'], value))
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, ROLE)
        uc.emu_start(0x432658, RETURN, count=1000)
        assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 12
        assert uc.mem_read(ROLE + 0x2b4, 1)[0] == dirty
        rows.append(dict(present=present, selector=event['selector'], value=value, dirty=dirty,
                         returned=bool(uc.reg_read(UC_X86_REG_EAX) & 255), result=state(), events=list(events)))
(ROOT / 'recovery/output/role-movement-setter-native.json').write_text(json.dumps(dict(status='PASS', rows=rows,
    scope='Complete432658 selector10/11 with actual record writes; notification virtual boundary captured. '
          'Other setter selectors and property-manager notification business not covered.'), indent=2)+'\n')
print(f'PASS: {len(rows)} actual movement writes, notification order, absent-record and dirty contracts')
