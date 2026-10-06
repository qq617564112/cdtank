"""Trace decoded pet selection through the original owned-record getter."""
import json
import struct
import sys
from pathlib import Path
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x40000)
GAME, MODES, MODE, MODE_VTABLE, MANAGER, PROFILE, PACKET, RECORD, SHOP, CALLBACK = [
    0x2001000 + i * 0x1000 for i in range(10)]
SENTINEL, ROLE_VTABLE, CALLBACK_VTABLE = 0x200b000, 0x200c000, 0x200d000
STACK, STOP, MODE_GETTER, FIELD_SETTER, NOTIFY = [0x2020000 + i * 0x1000 for i in range(5)]
HEAP = 0x2030000
heap = HEAP
trace, writes = [], []
watching = False


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def boundary(machine, address, size, data):
    global heap
    stack = machine.reg_read(UC_X86_REG_ESP)
    this = machine.reg_read(UC_X86_REG_ECX)
    if address == MODE_GETTER:
        assert this == MODE
        finish(2)
    elif address == FIELD_SETTER:
        assert this == PROFILE + 0x20
        assert read(stack + 4) == 7
        trace.append({'kind': 'profileField', 'index': 7, 'value': read(stack + 8)})
        finish(pop=8)
    elif address == NOTIFY:
        assert this == CALLBACK
        trace.append({'kind': 'callback', 'result': read(stack + 4),
                      'ownedCount': read(PROFILE + 0x1c)})
        finish(pop=4)
    elif address == 0x578620:
        size = read(stack + 4)
        pointer = heap
        heap += (size + 15) & ~15
        assert heap < 0x2040000
        machine.mem_write(pointer, bytes(size))
        finish(pointer)
    else:
        assert address == 0x57a6c7
        finish()


def watch(machine, access, address, size, value, data):
    if watching and PROFILE <= address < PROFILE + 0x400:
        writes.append({'pc': hex(machine.reg_read(UC_X86_REG_EIP)),
                       'offset': hex(address - PROFILE), 'size': size, 'value': value})


for address in (MODE_GETTER, FIELD_SETTER, NOTIFY, 0x578620, 0x57a6c7):
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)
uc.hook_add(UC_HOOK_MEM_WRITE, watch)
write(0x633588, GAME)
write(GAME + 0xac, 0)
write(GAME + 0xe0, MODES)
write(GAME + 0x118, MANAGER)
write(MODES, MODE)
write(MODE, MODE_VTABLE)
write(MODE_VTABLE + 4, MODE_GETTER)
write(MANAGER + 0x40, PROFILE)
write(PROFILE + 0x20, ROLE_VTABLE)
write(ROLE_VTABLE + 0x30, FIELD_SETTER)
write(CALLBACK, CALLBACK_VTABLE)
write(CALLBACK_VTABLE + 8, NOTIFY)
write(PROFILE + 0x18, SENTINEL, 0)
write(SENTINEL, SENTINEL, SENTINEL, SENTINEL)
uc.mem_write(SENTINEL + 0x14, bytes([1, 1]))


def call(address, this, *args):
    write(STACK, STOP, *args)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(address, STOP, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4


PROFILE_ROLE = PROFILE + 0x20
STREAM = 0x200e000
BUFFER = 0x200f000
STRING_CLEAR, STRING_APPEND = 0x401609, 0x401f16
strings = {}
def string_storage(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    target = machine.reg_read(UC_X86_REG_ECX)
    if address == STRING_CLEAR:
        strings[target] = bytearray()
        finish(target, 4)
    else:
        assert read(stack + 8) == 1
        strings[target].extend(machine.mem_read(read(stack + 4), 1))
        finish(target, 8)
for address in (STRING_CLEAR, STRING_APPEND):
    uc.hook_add(UC_HOOK_CODE, string_storage, begin=address, end=address)
write(PROFILE_ROLE, 0x5c4118)
# Original42fcf0 uses profile-role+18 as its owned-base table provider.
write(PROFILE_ROLE + 0x18, PROFILE + 0x10)
base = json.loads((ROOT / 'recovery/output/role-profile-update-native.json').read_text())
fixture = next(r for r in base['readers'] if r['alignment'] == 0 and r['strings'] == [[], []])
# Original41fa67 field order: two DWORDs, empty name, boolean, empty name,
# then numeric[2:]. Raw scalar84 (selector28) is the ninth following DWORD.
selection_start = 64 + 32 + 1 + 32 + 8 * 32
rows = []
def get_current():
    call(0x42fcf0, PROFILE_ROLE)
    return uc.reg_read(UC_X86_REG_EAX)
for instance in (0, 73, 74):
    raw = bytearray(fixture['raw'])
    for bit in range(32):
        position = selection_start + bit
        raw[position >> 3] &= ~(1 << (position & 7))
        raw[position >> 3] |= ((instance >> bit) & 1) << (position & 7)
    uc.mem_write(BUFFER, bytes(raw) + bytes(3000 - len(raw)))
    write(STREAM, 0, 0, BUFFER, 3000)
    writes.clear()
    watching = True
    call(0x42fd34, PROFILE_ROLE, STREAM)
    watching = False
    assert read(PROFILE_ROLE + 0x20 + 0x84) == instance
    assert read(PROFILE_ROLE + 0x18) == PROFILE + 0x10
    before = get_current()
    assert before == 0
    if instance == 73:
        write(RECORD, 73)
        write(PACKET + 0xc, RECORD, 12345, 2)
        write(SHOP + 0x40, 0)
        # Original property setter executes through profile-role virtual+30.
        call(0x4950d4, SHOP, PACKET, 0, 0)
    after = get_current()
    assert after == (RECORD if instance == 73 else 0)
    rows.append({'selectedInstanceId': instance, 'beforeReceipt': before,
                 'afterReceipt': after, 'ownedCount': read(PROFILE + 0x1c),
                 'selectionWrite': [w for w in writes if w['offset'] == '0xc4']})
pe = images['cdtank.exe']
cs = Cs(CS_ARCH_X86, CS_MODE_32)
source = [{'entry': hex(start), 'instructions': [
    {'address': hex(i.address), 'instruction': f'{i.mnemonic} {i.op_str}'.strip()}
    for i in cs.disasm(pe.get_data(start - 0x400000, end - start), start)]}
    for start, end in ((0x42fcf0, 0x42fd12), (0x41e99c, 0x41e9c7))]
output = {'status': 'PASS_ORIGINAL_DECODED_PET_SELECTION_OWNED_RECORD_RESOLUTION',
          'rows': rows, 'source': source,
          'identity': 'Profile-role5c4118 virtual+3c42fcf0, not battle-role5c2c28 virtual+54+a0.',
          'scope': 'Original42fd34/41fa67 decode selected-instance scalar84, '
                   'original4950d4 purchase insertion with native property7 setter, '
                   'original42fcf0/42029e/41e99c and native owned-tree lookup execute. '
                   'Existing profile-wire fixture reused with only selector28 changed. '
                   'String storage, mode getter and allocation supplied. '
                   'No request/server pairing, real purchase or battle+a0 producer claim.'}
(ROOT / 'recovery/output/role-pet-selected-owned-resolution-native.json').write_text(
    json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print('PASS: decoded pet selection resolves newly purchased owned record by instance ID')
