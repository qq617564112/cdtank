"""Execute the original room invite callback through packet serialization."""
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
ENTRY, ROLE, ROLE_VTABLE, CONTROLLER, BUTTON, ROOM_COUNT, ENABLED = [0x2021000 + i * 0x1000 for i in range(7)]
ROLE_ID = 0x2040500

def hook(machine, address, size, data):
    sp = machine.reg_read(UC_X86_REG_ESP)
    if address == STATE_QUERY:
        events.append(dict(kind='stateQuery', value=active_state))
        finish(value=active_state)
    elif address == ROLE_ID:
        finish(value=0x1234)
    elif address == 0x420ff8:
        events.append(dict(kind='lookup', container=machine.reg_read(UC_X86_REG_ECX), roleId=read(sp + 4)))
        finish(4, ENTRY)
    elif address == ENABLED:
        events.append(dict(kind='enabled', control=machine.reg_read(UC_X86_REG_ECX), value=read(sp + 4)))
        finish(4)
    elif address == SOCKET_SEND:
        packets.append(bytes(machine.mem_read(read(sp + 4), read(sp + 8))).hex())
        finish(12, 1)
    elif address == 0x4d650b:
        events.append(dict(kind='buttonEvent', argument=read(sp + 8)))
        finish()

for address in [STATE_QUERY, SOCKET_SEND, 0x4d650b, ROLE_ID, 0x420ff8, ENABLED]:
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

write(0x6350e4, ROOM_COUNT)
write(SERVICE + 0x3c, ROLE)
write(SERVICE + 0x40, 0x2031000)
write(ROLE, ROLE_VTABLE)
write(ROLE_VTABLE + 4, ROLE_ID)
write(CONTROLLER + 0x98, BUTTON)
write(0x5c0138, ENABLED)

rows = []
for active_state, count, entry_value in [(3, 1, 0), (3, 12, 0), (3, 1, 1), (2, 1, 0), (4, 1, 0)]:
    packets.clear()
    events.clear()
    write(ROOM_COUNT + 0x14, count)
    write(ENTRY + 8, entry_value)
    write(STACK, RETURN, 0)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, CONTROLLER)
    uc.emu_start(0x50c127, RETURN, count=50000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert uc.reg_read(UC_X86_REG_EAX) & 0xff == 1
    expected = active_state == 3 and count < 12 and entry_value == 0
    assert packets == (['943d341200'] if expected else [])
    assert events[-1] == dict(kind='enabled', control=BUTTON, value=0)
    rows.append(dict(activeState=active_state, countField=count, entryValue=entry_value,
        packets=packets[:], events=events[:]))

binary = images['cdtank.exe'].get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [(0x50a4e3, 0x50a51d), (0x50fb4b, 0x50fba6), (0x50c127, 0x50c165),
    (0x48b55c, 0x48b5ff), (0x4269c4, 0x4269f4), (0x48b1dd, 0x48b233),
    (0x48afbc, 0x48afc2), (0x420ff8, 0x421020), (0x413e8c, 0x413ec4)]
assert binary[0x5d6460 - 0x400000:].split(b'\0', 1)[0] == b'RoomPanel/btnInvite'
result = dict(status='PASS', binary='CDTank/CDTank.exe', control='RoomPanel/btnInvite',
    controlNameAddress='0x5d6460', controllerOffset='0x98', registration='0x50fb61',
    callback='0x50c127', service='0x48b55c', messageVtable='0x5ca5e4',
    messageType='0x3d94', requests=rows,
    gates=['Current scene virtual +4 equals 3',
        '[global 0x6350e4]+0x14 < [0x61e528] (initial limit 12)',
        'Lookup(service+0x40+0x190, current role virtual +4).record+8 equals 0'],
    conclusion='Invite directly requests 0x3d94 without a target identity or business payload, then disables its button.',
    execution='Complete original callback, service, message constructors and serializer. State getter, current role identity, record lookup, button event, GUI enabled import and socket send supplied.',
    unproven=['Meaning/producer of record+8', 'Server audience and response',
        'Response handling for 0x3d94 and any later target selection/layout'],
    disassembly={hex(a): [f'{i.address:08x} {i.mnemonic} {i.op_str}'
        for i in md.disasm(binary[a - 0x400000:z - 0x400000], a)] for a, z in ranges})
out = ROOT / 'recovery/output/waiting-room-invite-source.json'
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: room btnInvite callback, three gates and original serialized request 0x3d94')
