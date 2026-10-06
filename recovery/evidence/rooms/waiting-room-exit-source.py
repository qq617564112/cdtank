"""Execute the original room close callback through packet serialization."""
import json
from pathlib import Path
import struct
import sys

import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x50000)
GLOBAL, SERVICE, SELECTION, STATE, VTABLE, TRANSPORT, SOCKET, SOCKET_VTABLE, PROFILE = [
    0x2001000 + i * 0x1000 for i in range(9)]
STACK, RETURN, STATE_QUERY, SOCKET_SEND = [0x2040000 + i * 0x100 for i in range(4)]

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def finish(pop=0, value=0):
    sp = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(sp))
    uc.reg_write(UC_X86_REG_ESP, sp + 4 + pop)

packets, events = [], []
active_state = 3

def hook(machine, address, size, data):
    sp = machine.reg_read(UC_X86_REG_ESP)
    if address == STATE_QUERY:
        events.append(dict(kind='stateQuery', value=active_state))
        finish(value=active_state)
    elif address == SOCKET_SEND:
        packets.append(bytes(machine.mem_read(read(sp + 4), read(sp + 8))).hex())
        finish(12, 1)
    elif address == 0x4d650b:
        events.append(dict(kind='buttonEvent', argument=read(sp + 8)))
        finish()

for address in [STATE_QUERY, SOCKET_SEND, 0x4d650b]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
write(0x633588, GLOBAL)
write(GLOBAL + 0x118, SERVICE)
write(GLOBAL + 0xac, 0)
write(GLOBAL + 0xe0, SELECTION)
write(SELECTION, STATE)
write(STATE, VTABLE)
write(VTABLE + 4, STATE_QUERY)
write(GLOBAL + 0xbc, TRANSPORT)
write(GLOBAL + 0xec, SOCKET)
write(GLOBAL + 0x114, PROFILE)
write(PROFILE + 0x74, 0x1234)
write(SOCKET, SOCKET_VTABLE)
write(SOCKET_VTABLE + 0x18, SOCKET_SEND)

rows = []
for active_state in [2, 3, 4]:
    packets.clear()
    events.clear()
    write(STACK, RETURN, 0)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, SERVICE)
    uc.emu_start(0x50c165, RETURN, count=50000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert uc.reg_read(UC_X86_REG_EAX) & 0xff == 1
    assert packets == (['9e3a341200'] if active_state == 3 else [])
    rows.append(dict(activeState=active_state, packets=packets[:], events=events[:]))

binary = images['cdtank.exe'].get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [(0x50a1cc, 0x50a209), (0x50f9b2, 0x50fa09), (0x50c165, 0x50c191),
    (0x42704e, 0x4270ae), (0x425774, 0x4257ca), (0x424557, 0x42455d),
    (0x413e8c, 0x413ec4)]
assert binary[0x5d65a4 - 0x400000:].split(b'\0', 1)[0] == b'RoomPanel/btnClose'
result = dict(status='PASS', binary='CDTank/CDTank.exe', control='RoomPanel/btnClose',
    controlNameAddress='0x5d65a4', controllerOffset='0x4c', registration='0x50f9bf',
    callback='0x50c165', service='0x42704e', messageVtable='0x5c3254',
    messageType='0x3a9e', requests=rows,
    conclusion='Close directly sends a state-3-gated network request; no confirmation dialog or local hide in the callback.',
    execution='Complete original callback, service, constructors and serializer. State getter, button event and socket send supplied.',
    unproven=['Server acceptance and response/UI teardown after this request'],
    disassembly={hex(a): [f'{i.address:08x} {i.mnemonic} {i.op_str}'
        for i in md.disasm(binary[a - 0x400000:z - 0x400000], a)] for a, z in ranges})
out = ROOT / 'recovery/output/waiting-room-exit-source.json'
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: room btnClose callback, state gate and original serialized request 0x3a9e')
