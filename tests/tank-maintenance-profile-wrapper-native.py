"""Execute one successful receipt through the original profile virtual wrapper."""
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
        feedback.append({'kind': get(stack + 4), 'result': get(stack + 8)})
    uc.reg_write(UC_X86_REG_EAX, 2 if address == MODE_GETTER else 0)
    uc.reg_write(UC_X86_REG_EIP, get(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + (12 if address == NOTIFY else 4))

def watch(machine, access, address, size, value, data):
    if CONTAINER <= address < CONTAINER + 0x400:
        writes.append({'pc': hex(uc.reg_read(UC_X86_REG_EIP)),
                       'containerOffset': hex(address - CONTAINER), 'value': value, 'size': size})

put(0x633588, GAME)
put(GAME + 0xac, 0); put(GAME + 0xe0, MODES); put(GAME + 0x118, MANAGER)
put(MODES, MODE); put(MODE, VT); put(VT + 4, MODE_GETTER)
put(MANAGER + 0x40, CONTAINER); put(PROFILE, 0x5c4118)
assert get(0x5c4118 + 0x30) == 0x42fdea
put(CONTAINER + 8, SENTINEL, 1); put(SENTINEL, NODE, NODE, NODE)
uc.mem_write(SENTINEL + 0x14, bytes([1, 1]))
put(NODE, SENTINEL, SENTINEL, SENTINEL, 83, TANK)
uc.mem_write(NODE + 0x14, bytes([1, 0]))
put(TANK + 0x1c, 83); put(TANK + 0x24, 3); put(TANK + 0x34, 0)
put(CONTAINER + 0xb0, 1000000, 20000)
put(CALLBACK, CVT); put(CVT + 8, NOTIFY); put(SHOP + 0x68, CALLBACK)
put(PACKET + 0xc, 83, 19950, 975000, 7, 2, 4)
for address in (MODE_GETTER, NOTIFY, 0x42fdea, 0x420551):
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)
uc.hook_add(UC_HOOK_MEM_WRITE, watch)
put(STACK, STOP, PACKET, 0, 0)
uc.reg_write(UC_X86_REG_ECX, SHOP); uc.reg_write(UC_X86_REG_ESP, STACK)
uc.emu_start(0x495612, STOP, count=100000)
assert uc.reg_read(UC_X86_REG_EIP) == STOP
assert uc.reg_read(UC_X86_REG_ESP) == STACK + 16
assert [(row['pc'], row['thisOffset'], row['selector']) for row in calls] == [
    ('0x42fdea', '0x20', 7), ('0x420551', '0x40', 7),
    ('0x42fdea', '0x20', 26), ('0x420551', '0x40', 26)]
assert get(CONTAINER + 0xb4) == 19950 and get(CONTAINER + 0xb0) == 975000
assert get(TANK + 0x34) == 10080 and feedback == [{'kind': 2, 'result': 4}]
decoder = Cs(CS_ARCH_X86, CS_MODE_32)
image = images['cdtank.exe'].get_memory_mapped_image()
source = {hex(address): [{'va': hex(i.address), 'asm': i.mnemonic + ' ' + i.op_str}
    for i in decoder.disasm(image[address - 0x400000:address - 0x400000 + length], address)]
    for address, length in [(0x42fdea, 0x10), (0x4269c4, 0x16)]}
output = {'status': 'PASS_ORIGINAL_MEND_PROFILE_VIRTUAL_WRAPPER_SINGLE_SUCCESS',
          'calls': calls, 'writes': writes, 'feedback': feedback, 'source': source,
          'containerMoneyOffset': '0xb0', 'containerRawCoinOffset': '0xb4',
          'scope': 'One original495612 success through original5c4118+30/42fdea/420551. Mode and UI terminals supplied; no server transaction or repeated receipt matrix.'}
(ROOT / 'recovery/output/tank-maintenance-profile-wrapper-native.json').write_text(json.dumps(output, indent=2) + '\n')
print(output['status'])
