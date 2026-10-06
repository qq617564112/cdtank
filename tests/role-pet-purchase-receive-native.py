"""Execute the original pet purchase receipt and owned-record insertion."""
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


rows = []
for result, callback in ((0, True), (2, True), (1, False)):
    write(PACKET + 0xc, RECORD, 12345, result)
    write(RECORD, 73)
    write(SHOP + 0x40, CALLBACK if callback else 0)
    trace.clear()
    writes.clear()
    watching = True
    call(0x4950d4, SHOP, PACKET, 0, 0)
    watching = False
    assert trace == ([{'kind': 'profileField', 'index': 7, 'value': 12345}] if result == 2 else []) + (
        [{'kind': 'callback', 'result': result, 'ownedCount': int(result != 0)}] if callback else [])
    assert read(PROFILE + 0x1c) == int(result != 0)
    if result != 0:
        node = read(SENTINEL + 4)
        assert read(node + 0xc) == 73 and read(node + 0x10) == RECORD
    assert not any(w['offset'] in ('0xc0', '0xc4') for w in writes)
    rows.append({'result': result, 'callback': callback, 'trace': list(trace), 'profileWrites': list(writes),
                 'ownedCount': read(PROFILE + 0x1c)})

pe = images['cdtank.exe']
cs = Cs(CS_ARCH_X86, CS_MODE_32)
source = []
for start, end in ((0x496cca, 0x496d31), (0x4919de, 0x491a1c),
                   (0x497c6a, 0x497d9b), (0x4950d4, 0x49514f),
                   (0x41f1cc, 0x41f23c), (0x4269c4, 0x4269f4)):
    source.append({'entry': hex(start), 'instructions': [
        {'address': hex(i.address), 'instruction': f'{i.mnemonic} {i.op_str}'.strip()}
        for i in cs.disasm(pe.get_data(start - 0x400000, end - start), start)]})
output = {'status': 'PASS_ORIGINAL_PET_PURCHASE_RECEIPT_PROFILE_INSERTION',
          'message': {'type': '0x3f7d', 'name': 'UMsgRecvPurchasePet',
                      'listener': '0x892ff8', 'listenerVtable': '0x5cadb8',
                      'handler': '0x4950d4', 'messageVtable': '0x5cb8a0'},
          'body': {'result': '+14 read8', 'successValue': 2,
                   'ownedRecord': '+c original41e90e/41e5f1, only on result2',
                   'profileField7Value': '+10 read32, only on result2'},
          'rows': rows, 'source': source,
          'scope': 'Complete4950d4,4269c4,41f1cc and native tree lookup/insertion execute. '
                   'Current mode, profile virtual field setter, UI callback and allocation/free are supplied. '
                   'Decoder is statically qualified, not reexecuted. Profile is not the battle role. '
                   'No GUI, real server purchase, skill learning, battle+a0 binding or formula claim.'}
(ROOT / 'recovery/output/role-pet-purchase-receive-native.json').write_text(
    json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print('PASS: original pet purchase receipt, profile field7 and owned-record insertion')
