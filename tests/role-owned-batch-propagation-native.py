"""Execute original3aab receiver table propagation and selected-owned lookups."""
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
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x40000)
OWNER, CONTAINER, PACKET, PET, TANK, ROLE, CALLBACK, CALLBACK_VTABLE = [
    0x2001000 + i * 0x2000 for i in range(8)]
STACK, STOP, NOTIFY, HEAP = 0x2028000, 0x2029000, 0x202a000, 0x2030000
heap = HEAP
strings, trace, role_writes = {}, [], []


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def backend(machine, address, size, data):
    global heap
    stack = machine.reg_read(UC_X86_REG_ESP)
    target = machine.reg_read(UC_X86_REG_ECX)
    if address == 0x578620:
        count = read(stack + 4)
        pointer = heap
        heap += (count + 15) & ~15
        assert heap < 0x2040000
        machine.mem_write(pointer, bytes(count))
        trace.append({'kind': 'allocate', 'bytes': count, 'pointer': pointer})
        finish(pointer)
    elif address == 0x57a6c7:
        trace.append({'kind': 'free', 'pointer': read(stack + 4)})
        finish()
    elif address == 0x401609:
        strings[target] = bytearray()
        finish(target, 4)
    elif address == 0x401f16:
        assert read(stack + 8) == 1
        strings[target].extend(machine.mem_read(read(stack + 4), 1))
        finish(target, 8)
    else:
        assert target == CALLBACK
        trace.append({'kind': 'callback', 'petCount': read(CONTAINER + 0x1c),
                      'tankCount': read(CONTAINER + 0xc)})
        finish()


def watch(machine, access, address, size, value, data):
    if address < ROLE + 0x370 and address + size > ROLE:
        role_writes.append({'pc': hex(machine.reg_read(UC_X86_REG_EIP)),
                            'offset': hex(address - ROLE), 'size': size, 'value': value})


for address in (0x578620, 0x57a6c7, 0x401609, 0x401f16, NOTIFY):
    uc.hook_add(UC_HOOK_CODE, backend, begin=address, end=address)
uc.hook_add(UC_HOOK_MEM_WRITE, watch)


def call(address, target, *args):
    write(STACK, STOP, *args)
    uc.reg_write(UC_X86_REG_ECX, target)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(address, STOP, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    return uc.reg_read(UC_X86_REG_EAX)


def table(address, sentinel, node=0, key=0, record=0):
    # Original tree layout already qualified by the existing batch decoder.
    write(address + 8, sentinel, int(bool(node)))
    write(sentinel, node or sentinel, node or sentinel, node or sentinel)
    uc.mem_write(sentinel + 0x14, bytes([1, 1]))
    if node:
        write(node, sentinel, sentinel, sentinel, key, record)
        uc.mem_write(node + 0x14, bytes([1, 0]))


write(CALLBACK, CALLBACK_VTABLE)
write(CALLBACK_VTABLE + 8, NOTIFY)
write(OWNER + 0x40, CONTAINER)
write(OWNER + 0xe4, CALLBACK)
write(CONTAINER + 0x20, 0x5c4118)
# Original container initialization: profile+14 tank table, profile+18 pet table.
write(CONTAINER + 0x34, CONTAINER, CONTAINER + 0x10)
table(CONTAINER + 0x10, 0x2020000)
table(CONTAINER, 0x2020100)
table(PACKET + 0xc, 0x2020200, 0x2020300, 73, PET)
table(PACKET + 0x1c, 0x2020400, 0x2020500, 83, TANK)
write(PET, 73)
write(PET + 8, 2)
write(TANK + 0x1c, 83)
write(TANK + 0x24, 3)
write(TANK + 0x34, 1)
uc.mem_write(ROLE, bytes(0x370))
write(ROLE, 0x5c2c28)
write(ROLE + 0xa0, 0x12345678, 0x23456789)
write(OWNER + 0x3c, ROLE)

fixture = next(row for row in json.loads(
    (ROOT / 'recovery/output/role-profile-update-native.json').read_text())['readers']
    if row['alignment'] == 0 and row['strings'] == [[], []])
packed = int.from_bytes(bytes(fixture['raw']), 'little')
pet_bit = 64 + 32 + 1 + 32 + 8 * 32
for bit, value in ((pet_bit, 73), (pet_bit + 32, 83)):
    packed = (packed & ~(0xffffffff << bit)) | (value << bit)
raw = packed.to_bytes(len(fixture['raw']), 'little')
uc.mem_write(PACKET + 0x2c, raw + bytes(3000 - len(raw)))
write(PACKET + 0x102c, len(raw))
role_before = bytes(uc.mem_read(ROLE, 0x370))
role_writes.clear()
rows = []
for invocation in ('initial', 'repeat'):
    trace.clear()
    call(0x428ec5, OWNER, PACKET, 0, 0)
    selected_pet = call(0x42fcf0, CONTAINER + 0x20)
    selected_tank = call(0x42fd12, CONTAINER + 0x20)
    assert selected_pet == PET and selected_tank == TANK
    assert read(CONTAINER + 0x1c) == read(CONTAINER + 0xc) == 1
    assert trace[-1] == {'kind': 'callback', 'petCount': 1, 'tankCount': 1}
    pet_node = read(read(CONTAINER + 0x18) + 4)
    tank_node = read(read(CONTAINER + 8) + 4)
    assert pet_node != 0x2020300 and tank_node != 0x2020500
    assert read(pet_node + 0x10) == PET and read(tank_node + 0x10) == TANK
    assert not role_writes and bytes(uc.mem_read(ROLE, 0x370)) == role_before
    rows.append({'invocation': invocation, 'selectedPet': selected_pet,
                 'selectedTank': selected_tank, 'destinationNodes': [pet_node, tank_node],
                 'trace': list(trace), 'roleWrites': list(role_writes)})

# Missing profile container is the original receiver's early-return condition.
write(OWNER + 0x40, 0)
trace.clear()
call(0x428ec5, OWNER, PACKET, 0, 0)
assert not trace and not role_writes
result = {
    'status': 'PASS_ORIGINAL_3AAB_OWNED_TABLE_PROFILE_PROPAGATION_NO_BATTLE_BINDING_WRITE',
    'receiver': '0x428ec5', 'rows': rows, 'missingContainerTrace': trace,
    'scope': 'Complete428ec5 with actual41f2e6/41f0ae/41ea3a pet tree copy and '
             '422745/42269c/421fd1 tank tree copy,423f79/42fd34/41fa67 profile decode '
             'and42fcf0/42fd12 selected-record getters. Source single-node trees and '
             'empty destination sentinels prepared from qualified layout; allocation, '
             'free,string storage and optionalUI callback supplied. Received selected '
             'tank+34 is1, so zero-duration warning branch is not executed. Original '
             'node copies preserve owned-record pointers. No socket, server-selected '
             'profile producer or later battle binding is claimed.',
}
(ROOT / 'recovery/output/role-owned-batch-propagation-native.json').write_text(
    json.dumps(result, indent=2) + '\n')
print('PASS: original3aab table replacement, profile decode, selected pointers and repeat')
