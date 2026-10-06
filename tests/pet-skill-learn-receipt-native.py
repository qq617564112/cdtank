"""Execute one original pet learning success through the profile wrapper."""
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
uc.mem_map(0x2000000, 0x20000)
GAME, MODES, MODE, VT, MANAGER, CONTAINER, PACKET, TANK, SHOP, CALLBACK, CVT, SENTINEL, NODE, STACK, STOP, MODE_GETTER, NOTIFY = [0x2001000 + i * 0x1000 for i in range(17)]
PROFILE = CONTAINER + 0x20
writes, calls, feedback = [], [], []

def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def get(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def boundary(machine, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address in (0x42fdea, 0x420551):
        calls.append({'pc': hex(address), 'thisOffset': hex(uc.reg_read(UC_X86_REG_ECX) - CONTAINER),
                      'selector': get(stack + 4), 'value': get(stack + 8)})
        return
    if address == NOTIFY:
        feedback.append({'result': get(stack + 4)})
    uc.reg_write(UC_X86_REG_EAX, 2 if address == MODE_GETTER else 0)
    uc.reg_write(UC_X86_REG_EIP, get(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + (8 if address == NOTIFY else 4))

def watch(machine, access, address, size, value, data):
    if CONTAINER <= address < CONTAINER + 0x400:
        writes.append({'pc': hex(uc.reg_read(UC_X86_REG_EIP)),
                       'containerOffset': hex(address - CONTAINER), 'value': value, 'size': size})

put(0x633588, GAME)
put(GAME + 0xac, 0); put(GAME + 0xe0, MODES); put(GAME + 0x118, MANAGER)
put(MODES, MODE); put(MODE, VT); put(VT + 4, MODE_GETTER)
put(MANAGER + 0x40, CONTAINER); put(PROFILE, 0x5c4118)
assert get(0x5c4118 + 0x30) == 0x42fdea
put(CONTAINER + 0x18, SENTINEL, 1); put(SENTINEL, NODE, NODE, NODE)
uc.mem_write(SENTINEL + 0x14, bytes([1, 1]))
put(NODE, SENTINEL, SENTINEL, SENTINEL, 83, TANK)
uc.mem_write(NODE + 0x14, bytes([1, 0]))
put(TANK, 83); put(TANK + 8, 2); put(TANK + 0x6c, 1)
put(CONTAINER + 0xb0, 1000000, 20000)
put(CALLBACK, CVT); put(CVT + 8, NOTIFY); put(SHOP + 0x6c, CALLBACK)
put(PACKET + 0xc, 83, 4, 123, 3)
for address in (MODE_GETTER, NOTIFY, 0x42fdea, 0x420551):
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)
uc.hook_add(UC_HOOK_MEM_WRITE, watch)
put(STACK, STOP, PACKET, 0, 0)
uc.reg_write(UC_X86_REG_ECX, SHOP); uc.reg_write(UC_X86_REG_ESP, STACK)
uc.emu_start(0x4958cb, STOP, count=100000)
assert uc.reg_read(UC_X86_REG_EIP) == STOP
assert uc.reg_read(UC_X86_REG_ESP) == STACK + 16
assert len(calls) == 2 and calls[0]['pc'] == '0x42fdea' and calls[1]['pc'] == '0x420551'
assert calls[0]['selector'] == calls[1]['selector'] == 0x26
assert calls[0]['thisOffset'] == '0x20' and calls[1]['thisOffset'] == '0x40'
assert get(TANK + 0x6c) == 2 and feedback == [{'result': 3}]
assert len(writes) == 1 and writes[0]['value'] == 123
decoder = Cs(CS_ARCH_X86, CS_MODE_32)
image = images['cdtank.exe'].get_memory_mapped_image()
source = {hex(address): [{'va': hex(i.address), 'asm': i.mnemonic + ' ' + i.op_str}
    for i in decoder.disasm(image[address - 0x400000:address - 0x400000 + length], address)]
    for address, length in [(0x42fdea, 0x10), (0x4269c4, 0x16)]}
output = {'status': 'PASS_ORIGINAL_PET_LEARN_RECEIPT_PROFILE_AND_RANK_SINGLE_SUCCESS',
          'calls': calls, 'profileWrites': writes, 'feedback': feedback,
          'ownedSlot': 4, 'ownedRankOffset': '0x6c', 'rankBefore': 1, 'rankAfter': get(TANK + 0x6c),
          'scope': 'One original4958cb success with actual4269c4/41e99c and original5c4118+30/42fdea/420551; mode/UI supplied. No server rank authorization, cost debit or persistence.'}
(ROOT / 'recovery/output/pet-skill-learn-receipt-native.json').write_text(json.dumps(output, indent=2) + '\n')
print(output['status'])
