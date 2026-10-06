"""Execute original room Ready/Cancel requests and confirmed readiness updates."""
import itertools
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
uc.mem_map(0, 0x1000)  # Original MSVC SEH prologue uses fs:[0].
uc.mem_map(0x2000000, 0x50000)
GLOBAL, SERVICE, ROLE, RECORD, ROOM_SERVICE, ROOM_OWNER, ROOM = [0x2001000 + i * 0x1000 for i in range(7)]
STATE, STATE_VTABLE, ROOM_LINK, SELECTION, TRANSPORT, SOCKET = [0x2008000 + i * 0x1000 for i in range(6)]
SOCKET_VTABLE, PROFILE, OWNER, OWNER_VTABLE, HEADER, NODE, OTHER_ROLE, OTHER_RECORD = [0x2012000 + i * 0x1000 for i in range(8)]
STACK, RETURN, STATE_QUERY, SOCKET_SEND, VISIBLE, ENABLED, NOTIFY = [0x2040000 + i * 0x100 for i in range(7)]

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def finish(pop=0, value=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

packets, events = [], []
role_found = True
TAG, TAG_VTABLE, TAG_QUERY, MESSAGE = 0x2020000, 0x2020100, 0x2020200, 0x2021000
active_state = 3

def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == STATE_QUERY:
        finish(value=active_state)
    elif address == TAG_QUERY:
        finish(value=0x1b)
    elif address == 0x48a226:
        events.append(dict(kind='resolve', roleId=read(stack + 4)))
        finish(4, ROLE if role_found else 0)
    elif address == 0x447249:
        active = read(stack + 4)
        events.append(dict(kind='stage', value=active))
        finish(4)
    elif address == SOCKET_SEND:
        data_pointer, length = read(stack + 4), read(stack + 8)
        packets.append(bytes(machine.mem_read(data_pointer, length)).hex())
        finish(12, 1)
    elif address == 0x4d650b:  # Button sound/event infrastructure.
        finish()
    elif address in [VISIBLE, ENABLED]:
        events.append(dict(kind='visible' if address == VISIBLE else 'enabled',
            control=machine.reg_read(UC_X86_REG_ECX), value=read(stack + 4),
            status=read(RECORD + 0x90)))
        finish(4)
    elif address == NOTIFY:
        events.append(dict(kind='observer', index=read(stack + 4),
            status=read(machine.reg_read(UC_X86_REG_ECX) + 0x90)))
        finish(4)
    elif address == 0x50ded9:
        events.append(dict(kind='refresh', room=read(stack + 4)))
        finish(4)

for address in [STATE_QUERY, SOCKET_SEND, VISIBLE, ENABLED, NOTIFY, 0x4d650b, 0x50ded9, TAG_QUERY, 0x48a226, 0x447249]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
write(0x633588, GLOBAL)
write(0x6357f8, ROOM_OWNER)
write(ROOM_OWNER + 0x20, ROOM_SERVICE)
write(GLOBAL + 0x118, SERVICE)
write(GLOBAL + 0x11c, ROOM_SERVICE)
write(GLOBAL + 0xac, 0)
write(GLOBAL + 0xe0, SELECTION)
write(SELECTION, STATE)
write(STATE, STATE_VTABLE)
write(STATE_VTABLE + 4, STATE_QUERY)
write(GLOBAL + 0xbc, TRANSPORT)
write(GLOBAL + 0xec, SOCKET)
write(GLOBAL + 0x114, PROFILE)
write(PROFILE + 0x74, 0x1234)
write(SOCKET, SOCKET_VTABLE)
write(SOCKET_VTABLE + 0x18, SOCKET_SEND)
write(0x5c0260, VISIBLE)
write(0x5c0138, ENABLED)
write(OWNER, OWNER_VTABLE)
write(OWNER_VTABLE + 8, 0x50e877)
write(RECORD, OWNER_VTABLE)
write(OTHER_RECORD, OWNER_VTABLE)
write(OWNER_VTABLE + 0x24, NOTIFY)
write(ROLE, 0x5c41b8)
write(OTHER_ROLE, 0x5c41b8)
write(OTHER_ROLE + 0x2a0, OTHER_RECORD)
write(ROOM_SERVICE + 0x30, ROOM)


def invoke(address, owner, *arguments):
    write(STACK, RETURN, *arguments)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, owner)
    uc.emu_start(address, RETURN, count=50000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN, hex(address)
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(arguments) * 4, hex(address)

requests = []
# Every original branch affecting request emission is varied. Ready and Cancel
# run from their registered complete UI callbacks through native packet encoding.
for active_state, has_role, configured, status, room_exists, mode, team in itertools.product(
        [2, 3, 4], [False, True], [False, True], [0, 1, 2], [False, True], [1, 3, 4], [0, 1, 2]):
    write(SERVICE + 0x3c, ROLE if has_role else 0)
    write(ROLE + 0x2a0, RECORD)
    write(ROLE + 0xa0, ROOM if configured else 0)
    write(ROLE + 0xa4, ROOM)
    write(RECORD + 0x90, status)
    write(RECORD + 0x5c, team)
    write(ROOM_SERVICE + 0x28, ROOM_LINK if room_exists else 0)
    write(ROOM_LINK + 4, ROOM)
    write(ROOM + 0x38, mode)
    for callback, kind, opcode in [(0x50c0cf, 'ready', 0x3aaf), (0x50c0fb, 'cancel', 0x3ab0)]:
        packets.clear()
        events.clear()
        invoke(callback, OWNER, 0)
        expected = active_state == 3 and has_role and (
            configured and status != 1 and room_exists and (mode == 3 or team > 0)
            if kind == 'ready' else status == 1)
        assert bool(packets) == expected, (kind, active_state, has_role, configured, status, room_exists, mode, team)
        assert packets == ([(struct.pack('<HH', opcode, 0x1234) + b'\x00').hex()] if expected else []), packets
        assert read(RECORD + 0x90) == status  # Request does not confirm itself.
        assert not events
        requests.append(dict(kind=kind, activeState=active_state, hasRole=has_role,
            configured=configured, status=status, roomExists=room_exists, mode=mode, team=team,
            packets=packets[:], statusAfter=read(RECORD + 0x90)))

confirmations = []
active_state = 3
write(SERVICE + 0x3c, ROLE)
write(SERVICE + 0x60, OWNER)
write(OWNER + 0x28, HEADER)
write(OWNER + 0x20, ROOM)
for offset in [0x90, 0x94, 0x50, 0x54]:
    write(OWNER + offset, OWNER + 0x500 + offset)
uc.mem_write(HEADER + 0x21, b'\x01')
write(NODE, HEADER, HEADER, HEADER)
for local, found, ready, mode, side in itertools.product([False, True], [False, True], [0, 1], [1, 3, 4], [0, 1]):
    candidate = ROLE if local else OTHER_ROLE
    record = RECORD if local else OTHER_RECORD
    write(HEADER, NODE if found else HEADER)
    write(NODE + 0x10, candidate)
    write(NODE + 0xc, 7)
    uc.mem_write(NODE + 0x1c, b'\x07')
    write(OWNER + 0x38, 99)
    write(OWNER + 0x40, side)
    write(ROOM + 0x38, mode)
    write(record + 0x90, 1 - ready)
    events.clear()
    invoke(0x4259ae, SERVICE, candidate, ready)
    assert read(record + 0x90) == ready
    assert uc.mem_read(NODE + 0x1c, 1)[0] == (ready if found else 7)
    assert read(OWNER + 0x38) == (7 if found and local else 99)
    visibility = [event for event in events if event['kind'] == 'visible']
    expected_visibility = [dict(kind='visible', control=read(OWNER + 0x90), value=1 - ready, status=ready),
                          dict(kind='visible', control=read(OWNER + 0x94), value=ready, status=ready)] if local else []
    assert visibility == expected_visibility
    controls = [event for event in events if event['kind'] == 'enabled']
    expected_enabled = []
    if local and (ready or mode not in [3, 4]):
        expected_enabled = [dict(kind='enabled', control=read(OWNER + (0x54 if side == 0 else 0x50)), value=1 - ready, status=ready)]
    assert controls == expected_enabled
    assert events[-1] == dict(kind='refresh', room=ROOM)
    confirmations.append(dict(local=local, found=found, ready=ready, mode=mode, side=side,
        statusAfter=read(record + 0x90), nodeReady=uc.mem_read(NODE + 0x1c, 1)[0], events=events[:]))

producers = []
write(TAG, TAG_VTABLE)
write(TAG_VTABLE, TAG_QUERY)
write(MESSAGE + 0xc, 71)
write(HEADER, NODE)
write(NODE + 0x10, ROLE)
for active_state, role_found, ready in itertools.product([1, 3, 4], [False, True], [0, 1]):
    write(RECORD + 0x90, ready)
    events.clear()
    invoke(0x42f385, SERVICE, MESSAGE, TAG, 0)
    expected = active_state != 1 and role_found
    assert any(event['kind'] == 'visible' for event in events) == expected
    assert any(event['kind'] == 'resolve' for event in events) == (active_state != 1)
    producers.append(dict(activeState=active_state, roleFound=role_found, attributeTag=0x1b,
        status=ready, events=events[:]))

battle_notifications = []
# Complete NotifyViewBattle handler with an empty native role list.
# This isolates server result->scene transition without supplying a battle world.
write(SERVICE + 0x14, 0)
write(SERVICE + 0x10, HEADER)
write(HEADER, HEADER)
for result in [0, 1, 2]:
    events.clear()
    uc.mem_write(SERVICE + 0x39, b'\x00')
    write(MESSAGE + 0xc, result)
    invoke(0x427189, SERVICE, MESSAGE, 0, 0)
    assert uc.mem_read(SERVICE + 0x39, 1)[0] == 1
    assert events == ([dict(kind='stage', value=4)] if result == 1 else [])
    battle_notifications.append(dict(result=result, events=events[:]))

output = ROOT / 'recovery/output/room-start-rules-sol-native.json'
output.write_text(json.dumps(dict(status='PASS', requests=requests, confirmations=confirmations, producers=producers, battleNotifications=battle_notifications,
    scope='Complete original Ready/Cancel callbacks50c0cf/50c0fb, services426e02/426e96, role vtable5c41b8 readiness43291e/status43293d/property432417, mode/team gate4353b4, constructors4255ce/425624, dispatcher413e8c, serializer402350/402090, complete confirmation4259ae->50e877, full role attribute observer42f385 tag1b routing, and NotifyViewBattle427189 with an empty role list. Active-state getter/setter, role lookup, attribute tag getter, socket send, record observers, UI imported visibility/enabled operations, button sound and final panel refresh supplied. Server acceptance/minimum players/host start policy not present in these client functions.'), indent=2) + '\n')
print(f'PASS: {len(requests)} original requests and {len(confirmations)} native confirmation chains, {len(producers)} attribute producers and {len(battle_notifications)} battle notifications')
