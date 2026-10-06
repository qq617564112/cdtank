"""Execute inventory listener registration and lookup in the original tree."""
import json
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import (
    UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX,
    UC_X86_REG_EIP, UC_X86_REG_ESP,
)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x40000)
MANAGER, HEAP = 0x2001000, 0x2005000
STACK, RETURN, RESULT, KEY = 0x2020000, 0x2021000, 0x2022000, 0x2022100
heap = HEAP
pending = 0
registrations = []
allocations = []


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4)


def hook(machine, address, size, data):
    global heap, pending
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x578620:
        count = read(stack + 4)
        pointer = heap
        heap += (count + 15) & ~15
        assert heap < STACK
        allocations.append(count)
        finish(pointer)
    elif address == 0x57aa66:
        # Process-exit destructor scheduling has no effect on registration.
        finish()
    elif address == 0x48baff:
        pending = read(stack + 4)
    elif address == 0x4152b6:
        pair = read(stack + 8)
        assert read(pair + 4) == pending
        name_pointer = read(pending + 0x10)
        registrations.append(dict(
            messageType=read(pair), listener=pending, vtable=read(pending),
            handler=read(pending + 8),
            name=bytes(machine.mem_read(name_pointer, 80)).split(b'\0')[0].decode(),
        ))
    # Observations do not replace registration, type getters, insertion or lookup.


for address in [0x578620, 0x57aa66, 0x48baff, 0x4152b6]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)


def call(address, this, *args):
    write(0, 0x12345678)
    write(STACK, RETURN, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(address, RETURN, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234
    assert read(0) == 0x12345678
    return uc.reg_read(UC_X86_REG_EAX)


expected_types = [
    0x3c8f, 0x3c92, 0x3c91, 0x3c9a, 0x3c96, 0x3ca9, 0x3c98, 0x3caa,
    0x3ca0, 0x3cab, 0x3c99, 0x3ca2, 0x3ca3, 0x3ca4, 0x3ca5, 0x3cac,
]
assert call(0x4423ae, MANAGER) == MANAGER
assert [row['messageType'] for row in registrations] == expected_types
assert read(MANAGER + 8) == 16
assert read(0x635700) == 0xffff
lookups = []
for message_type in range(0x3c8d, 0x3cae):
    write(KEY, message_type)
    assert call(0x4501fa, MANAGER, RESULT, KEY) == RESULT
    node = read(RESULT)
    found = node != read(MANAGER + 4)
    assert found == (message_type in expected_types)
    row = dict(messageType=message_type, found=found)
    if found:
        listener = read(node + 0x10)
        registration = registrations[expected_types.index(message_type)]
        assert read(node + 0xc) == message_type
        assert listener == registration['listener']
        row['listener'] = listener
    lookups.append(row)

# The initialized static-listener path must rebuild another manager's tree too.
second_manager = MANAGER + 0x100
assert call(0x4423ae, second_manager) == second_manager
assert registrations[:16] == registrations[16:]
assert read(second_manager + 8) == 16
before = len(registrations)
allocation_count = len(allocations)
for row in registrations[:16]:
    call(0x48baff, second_manager, row['listener'])
assert len(registrations) == before
assert len(allocations) == allocation_count
assert read(second_manager + 8) == 16

out = ROOT / 'recovery/output/item-listener-registration-native.json'
out.write_text(json.dumps(dict(
    status='PASS', constructor='0x4423ae', registration='0x48baff',
    lookup='0x4501fa', registrations=registrations[:16], lookups=lookups,
    initializedStaticPath=True, duplicateRegistrationIgnored=True,
    suppliedBoundaries=['allocation578620', 'exitDestructorScheduling57aa66'],
    scope='Original inventory-manager constructor, all sixteen listener constructors/type '
          'getters, real tree initialization/insertion/lookup. 3c9e is absent from this '
          'manager only; other managers, socket dispatch and server semantics are not proved.',
), indent=2) + '\n')
print('PASS: 16 original inventory listeners, 33 real tree lookups, initialized static path '
      'and duplicate rejection; no 3c9e listener in this manager')
