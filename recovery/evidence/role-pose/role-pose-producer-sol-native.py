"""Execute original command-vector factory/codec and remote actor pose production."""
import json
import math
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x50000)
PACKET, STREAM, BUFFER, ELEMENT, ROLE, RECORD, ACTOR, OWNER, LOCAL, STACK, STOP, POOL, POINTS, TABLE, SCRATCH = [0x2001000 + i * 0x2000 for i in range(15)]
def put(a, *v): uc.mem_write(a, struct.pack('<' + 'I' * len(v), *[x & 0xffffffff for x in v]))
def get(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
def vec(a): return list(struct.unpack('<3f', uc.mem_read(a, 12)))
def setvec(a, v): uc.mem_write(a, struct.pack('<3f', *v))
def float_at(a): return struct.unpack('<f', uc.mem_read(a, 4))[0]
def finish(value=0, pop=0):
    s = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value); uc.reg_write(UC_X86_REG_EIP, get(s))
    uc.reg_write(UC_X86_REG_ESP, s + 4 + pop)
events = []
heap = POOL
present = True
def hook(machine, address, size, data):
    global heap
    s = machine.reg_read(UC_X86_REG_ESP); this = machine.reg_read(UC_X86_REG_ECX)
    if address == 0x4138e8:
        assert get(s + 4) == 28
        finish(PACKET, 4)
    elif address == 0x578620:
        n = get(s + 4); result = heap; heap += (n + 31) & ~31
        finish(result)
    elif address in [0x57a6c7, 0x48569e, 0x48568d, 0x4593e5]:
        if address == 0x4593e5:
            # Real vector cleanup writes its three allocation pointers to zero.
            put(this + 4, 0, 0, 0)
        finish()
    elif address in [0x40bd28, 0x40bc38]: finish()
    elif address == 0x48a226:
        events.append(dict(kind='lookup', id=get(s + 4)))
        finish(ROLE if present else 0, 4)
    elif address in [0x424be9, 0x465057]:
        events.append(dict(kind='stateBookkeeping', entry=hex(address))); finish(0, 4 if address == 0x424be9 else 0)
    elif address in [0x46c341, 0x49cc05, 0x46c2ab, 0x46c6df]:
        events.append(dict(kind='actorVisual', entry=hex(address))); finish(0, 8 if address == 0x46c2ab else 4 if address == 0x46c6df else 0)
    elif address == 0x4259ae:
        events.append(dict(kind='stateBookkeeping', entry=hex(address))); finish(0, 8)
    elif address == 0x433073:
        events.append(dict(kind='matrix', position=vec(get(s + 8)), forward=vec(get(s + 12))))
        finish(0, 12)
    elif address == 0x426b92:
        assert get(s + 4) == ROLE
        events.append(dict(kind='postPose')); finish(0, 12)
    elif address == 0x466ddc:
        assert get(s + 4) == 2; put(this + 4, POINTS + 0x100); finish(this, 4)
    elif address == 0x46c0d9:
        source = get(get(s + 8) + 4)
        events.append(dict(kind='curve', points=[vec(source), vec(source + 12)]))
        uc.mem_write(POINTS, bytes(uc.mem_read(source, 24)))
        put(this + 4, TABLE, 0, 0, 2); finish(0, 8)
    elif address == 0x57b854:
        number = struct.unpack('<d', uc.mem_read(s + 4, 8))[0]
        uc.mem_write(SCRATCH, struct.pack('<d', math.sqrt(number)))
        uc.mem_write(SCRATCH + 16, b'\xdd\x05' + struct.pack('<I', SCRATCH) + b'\xc3')
        machine.reg_write(UC_X86_REG_EIP, SCRATCH + 16)
    else: raise AssertionError(hex(address))
for a in [0x4138e8, 0x578620, 0x57a6c7, 0x48569e, 0x48568d, 0x4593e5, 0x40bd28,
          0x46c341, 0x49cc05, 0x46c2ab, 0x46c6df, 0x424be9, 0x465057, 0x4259ae, 0x40bc38, 0x48a226, 0x433073, 0x426b92, 0x466ddc, 0x46c0d9, 0x57b854]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=a, end=a)
def run(entry, this, *args):
    put(STACK, STOP, *args); uc.reg_write(UC_X86_REG_ECX, this); uc.reg_write(UC_X86_REG_ESP, STACK)
    
    uc.emu_start(entry, STOP, count=60000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP, hex(uc.reg_read(UC_X86_REG_EIP))
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
put(0x630a28, POOL)
run(0x42d1ec, PACKET)
assert get(PACKET) == 0x5c3d80 and get(PACKET + 16) == 0
run(0x42d282, PACKET); assert uc.reg_read(UC_X86_REG_EAX) == 0x3aa6
# 40-byte source element: ID followed by the original nine-word role command state.
wire_rows = []
for state in [0, 1, 2, 3, 4, 5]:
    for angles in [(0, 0), (180, 360), (90, 540), (719, 17)]:
        for offset in range(8):
            heap = POOL
            body = struct.pack('<III2f4I2f', 73, 5, state, 12.25, -9.75, angles[0], angles[1], 0x87654321, 0x12345678, .125, .75)
            uc.mem_write(ELEMENT, body)
            put(PACKET + 16, ELEMENT, ELEMENT + 40, ELEMENT + 40)
            put(STREAM, offset, 0, BUFFER, 1024); uc.mem_write(BUFFER, bytes(1024))
            run(0x41de69, PACKET, STREAM)
            # Count, object ID, X/Z float32, forward/look uint16, command/state uint16, trailing clock float32.
            raw = struct.pack('<II2f4Hf', 1, 73, 12.25, -9.75, angles[1], angles[0], 5, state, struct.unpack('<f', struct.pack('<I', 0x87654321))[0])
            payload = bytes(uc.mem_read(BUFFER, (offset + 224 + 7) // 8))
            assert int.from_bytes(payload, 'little') == int.from_bytes(raw, 'little') << offset
            put(STREAM, offset, 0, BUFFER, 1024)
            run(0x41e323, PACKET, STREAM)
            decoded = get(PACKET + 16)
            assert get(PACKET + 20) - decoded == 40
            assert bytes(uc.mem_read(decoded, 28)) == body[:28]
            wire_rows.append(dict(state=state, look=angles[0], forward=angles[1], offset=offset, payload=payload.hex()))
# Real role and actor vtables, all role getters/setters and both actor pose methods execute.
put(ROLE, 0x5c2c28); put(ROLE + 0x2a0, RECORD); put(ROLE + 0x310, ACTOR)
put(ACTOR, 0x5c88c8); put(TABLE, POINTS); put(TABLE + 4, POINTS + 12)
put(OWNER + 0x3c, LOCAL); put(LOCAL, 0x5c2c28); put(LOCAL + 0x2a0, RECORD + 0x400); put(RECORD + 0x400 + 12, 74)
put(RECORD + 12, 73)
uc.mem_write(RECORD + 0x48, struct.pack('<2f', 50, 1))
rows = []
for present in [False, True]:
    for role_state in [0, 1, 2, 3]:
        for message_state in [0, 1, 2, 3, 4]:
            for blocked in [False, True]:
                heap = POOL
                put(RECORD + 0x90, role_state)
                uc.mem_write(ACTOR + 0x19c, bytes([int(blocked)])); uc.mem_write(ACTOR + 0x23c, b'\1')
                setvec(ACTOR + 0x28, [3, 7, 4]); setvec(ACTOR + 0x88, [1, 0, 0]); setvec(ACTOR + 0x1c, [1, 0, 0])
                setvec(ACTOR + 0x1bc, [99, 98, 97]); setvec(ROLE + 0x25c, [3, 7, 4])
                uc.mem_write(ACTOR + 0x1c8, struct.pack('<f', .07)); uc.mem_write(ACTOR + 0xd8, b'\1')
                put(ACTOR + 0x120, 0)
                body = struct.pack('<III2f4I2f', 73, 5, message_state, 12.25, -9.75, 180, 360, 0, 0, 0, 0)
                uc.mem_write(ELEMENT, body); put(PACKET + 16, ELEMENT, ELEMENT + 40, ELEMENT + 40)
                put(STREAM, 0, 0, BUFFER, 1024); uc.mem_write(BUFFER, bytes(1024))
                run(0x41de69, PACKET, STREAM); put(STREAM, 0, 0, BUFFER, 1024)
                run(0x41e323, PACKET, STREAM)
                events.clear(); run(0x428348, OWNER, PACKET, 0, 0)
                if present:
                    assert vec(ROLE + 0x25c) == [12.25, 7, -9.75]
                    assert abs(vec(ROLE + 0x274)[0]) < 1e-6 and abs(vec(ROLE + 0x274)[2] - 1) < 1e-6
                    assert abs(vec(ROLE + 0x280)[0] + 1) < 1e-6 and abs(vec(ROLE + 0x280)[2]) < 1e-6
                should_target = present and role_state == 2 and message_state not in [0, 1] and not blocked
                assert any(e['kind'] == 'curve' for e in events) == should_target
                if should_target:
                    assert vec(ACTOR + 0x1bc) == [12.25, 7, -9.75]
                    assert vec(ACTOR + 0x28) == [3, 7, 4]
                    assert float_at(ACTOR + 0x1c8) == 0 and uc.mem_read(ACTOR + 0xd8, 1) == b'\0'
                if present and message_state in [0, 1]:
                    assert vec(ACTOR + 0x28) == [12.25, 7, -9.75]
                rows.append(dict(present=present, roleState=role_state, messageState=message_state, blocked=blocked,
                                 position=vec(ACTOR + 0x28), target=vec(ACTOR + 0x1bc), events=list(events)))
angle_pose_rows = []
present = True
for angle in [0, 1, 179, 180, 359, 360, 719, 720, 32768, 65535]:
    heap = POOL; put(RECORD + 0x90, 2)
    uc.mem_write(ACTOR + 0x19c, b'\0'); uc.mem_write(ACTOR + 0x23c, b'\1')
    setvec(ACTOR+0x28, [3,7,4]); setvec(ACTOR+0x88, [1,0,0]); setvec(ROLE+0x25c, [3,7,4])
    body = struct.pack('<III2f4I2f', 73, 0, 2, 12.25, -9.75, angle, angle, 0, 0, 0, 0)
    uc.mem_write(ELEMENT, body); put(PACKET + 16, ELEMENT, ELEMENT + 40, ELEMENT + 40)
    put(STREAM, 0, 0, BUFFER, 1024); uc.mem_write(BUFFER, bytes(1024))
    run(0x41de69, PACKET, STREAM); put(STREAM, 0, 0, BUFFER, 1024); run(0x41e323, PACKET, STREAM)
    events.clear(); run(0x428348, OWNER, PACKET, 0, 0)
    assert any(e['kind']=='curve' for e in events)
    angle_pose_rows.append(dict(angle=angle, forward=vec(ACTOR+0x1a4), look=vec(ACTOR+0x1b0)))
angle_rows = []
for angle in [0, 17, 90, 180, 360, 540, 719]:
    put(STACK, STOP, SCRATCH, angle); uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x41d7e3, STOP, count=10000)
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4
    angle_rows.append(dict(angle=angle, vector=vec(SCRATCH)))
actor_rows = []
for entry in [0x46c3de, 0x46c406, 0x46495d]:
    setvec(ACTOR + 0xc0, [4, 5, 6]); uc.mem_write(ACTOR + 0xd8, b'\0')
    put(ACTOR + 0x120, ACTOR + 0xdc); uc.mem_write(ACTOR + 0x1c8, struct.pack('<f', .075))
    events.clear(); run(entry, ACTOR)
    if entry == 0x46495d:
        assert vec(ACTOR + 0xc0) == [0, 0, 0] and uc.mem_read(ACTOR + 0xd8, 1) == b'\1'
        assert get(ACTOR + 0x120) == ACTOR + 0xdc and abs(float_at(ACTOR + 0x1c8)-.075) < 1e-8
    else: assert uc.mem_read(ACTOR + 0x19c, 1) == bytes([int(entry == 0x46c3de)])
    actor_rows.append(dict(entry=hex(entry), blocked=uc.mem_read(ACTOR + 0x19c, 1)[0], stopped=uc.mem_read(ACTOR + 0xd8, 1)[0], vector=vec(ACTOR + 0xc0), targetPresent=bool(get(ACTOR + 0x120)), elapsed=float_at(ACTOR+0x1c8), events=list(events)))
motion_rows = []
for entry in [0x4670de, 0x467175, 0x4645dc]:
    setvec(ACTOR + 0x28, [3, 7, 4]); setvec(ACTOR + 0x88, [1, 0, 0]); setvec(ACTOR + 0x1c, [1, 0, 0])
    setvec(ACTOR + 0x10, [0, 1, 0]); setvec(ACTOR + 0x1bc, [12.25, 7, -9.75]); setvec(ACTOR + 0x1a4, [-1, 0, 0])
    setvec(SCRATCH, [12.25, 7, -9.75] if entry != 0x4645dc else [1, 0, 0])
    uc.mem_write(ACTOR + 0x19c, b'\0'); uc.mem_write(ACTOR + 0xd8, bytes([int(entry == 0x4645dc)]))
    uc.mem_write(ACTOR + 0x1c8, struct.pack('<f', .075))
    events.clear(); run(entry, ACTOR, SCRATCH)
    assert any(e['kind'] == 'curve' for e in events) == (entry != 0x4645dc)
    if entry != 0x4645dc:
        assert get(ACTOR + 0x124) == (1 if entry == 0x4670de else 0xffffffff)
        assert abs(float_at(ACTOR + 0x1c8)-.075) < 1e-8
    else: assert float_at(ACTOR + 0x1c8) == 0
    motion_rows.append(dict(entry=hex(entry), events=list(events), position=vec(ACTOR+0x28), target=vec(ACTOR+0x1bc), elapsed=float_at(ACTOR+0x1c8), lookTarget=vec(ACTOR+0x1b0)))
output = dict(anglePoseRows=angle_pose_rows, angleRows=angle_rows, motionRows=motion_rows, actorRows=actor_rows, status='PASS', messageType='0x3aa6', wireRows=wire_rows, rows=rows,
              angleScale=float_at(0x5c286c), scope='Original factory42d1ec/type42d282, codecs41de69/41e323 into handler428348, remote42823e, role scalar/integer setters/getters, wrapper42298b/4229cd and actor466efb/464513 execute. Allocators, logging, object lookup, matrix side effect433073, curve construction, vector cleanup and post-pose426b92 supplied. Complete actor death/revive46c3de/46c406, stop46495d, forward4670de/back467175/look4645dc execute with visual callbacks supplied. Local correction428167 and outer message-state0/1 bookkeeping not executed; network socket/server producer not executed.')
(ROOT / 'recovery/output/role-pose-producer-sol-native.json').write_text(json.dumps(output, indent=2) + '\n')
print(f'PASS {len(wire_rows)} original command-vector codec cases and {len(rows)} full remote pose producer cases')
