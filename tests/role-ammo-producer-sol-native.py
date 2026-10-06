"""Execute original entity-target firing through its request and reload notification."""
import json
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x30000)
OWNER, ROLE, RECORD, GLOBAL, STAGES, STAGE, STAGE_VTABLE, CONTROLS, CONTROLLER, SCENE, STACK, RETURN, GET_STAGE, CLOCK, TARGET, TARGET_RECORD, OBSERVER, OBSERVER_VTABLE, UPDATED, VISUAL, VISUAL_VTABLE, ASPECT, INVENTORY, VECTOR, ITEM = [0x2001000 + i * 0x1000 for i in range(25)]


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[value & 0xffffffff for value in values]))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


events = []
quantity_writes = []
aspect = 0


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x48a226:
        assert read(stack + 4) == 73
        finish(ROLE, 4)
    elif address == GET_STAGE:
        finish(4)
    elif address == 0x436078:
        assert read(stack + 4) == ROLE
        finish(TARGET, 4)
    elif address == 0x436fe0:
        write(read(stack + 4), 0)
        write(read(stack + 8), 0)
        finish(0, 12)
    elif address == 0x49cc05:
        finish()
    elif address == 0x422f0d:
        events.append(dict(kind='clock'))
        machine.reg_write(UC_X86_REG_EIP, CLOCK)
    elif address == 0x435745:
        assert read(stack + 4) == TARGET and read(stack + 8) == ROLE
        finish(aspect, 8)
    elif address == ASPECT:
        events.append(dict(kind='aspect', value=read(stack + 4)))
        finish(0, 4)
    elif address == 0x413e8c:
        packet = read(stack + 4)
        assert read(packet) == 0x5c3188
        events.append(dict(kind='send', type=0x3a9d, targetId=read(packet + 12),
                           actor=list(struct.unpack('<9I', machine.mem_read(packet + 16, 36))),
                           target=list(struct.unpack('<9I', machine.mem_read(packet + 52, 36)))))
        finish(1, 4)
    elif address == UPDATED:
        events.append(dict(kind='reload', seconds=struct.unpack('<f', machine.mem_read(stack + 4, 4))[0],
                           bulletCount=read(RECORD + 0x44), deadline=struct.unpack('<f', machine.mem_read(ROLE + 0x9c, 4))[0]))
        finish(0, 4)


for address in [0x48a226, GET_STAGE, 0x436078, 0x436fe0, 0x49cc05, 0x422f0d, 0x435745, ASPECT, 0x413e8c, UPDATED]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)


def quantity_write(machine, access, address, size, value, data):
    if any(address < end and address + size > begin for begin, end in [
            (RECORD + 0x44, RECORD + 0x48), (TARGET_RECORD + 0x44, TARGET_RECORD + 0x48),
            (ITEM + 0x10, ITEM + 0x14), (ITEM + 0x1c, ITEM + 0x24)]):
        quantity_writes.append(dict(instruction=hex(machine.reg_read(UC_X86_REG_EIP)), address=hex(address), size=size, value=value))


uc.hook_add(UC_HOOK_MEM_WRITE, quantity_write)
write(0x633588, GLOBAL)
write(GLOBAL + 0xe0, STAGES)
write(STAGES, STAGE)
write(STAGE, STAGE_VTABLE)
write(STAGE_VTABLE + 4, GET_STAGE)
write(0x6357f8, CONTROLS)
write(CONTROLS + 0x20, CONTROLLER)
write(GLOBAL + 0x124, SCENE)
write(SCENE + 0x60, 1)
write(OWNER + 0x3c, ROLE)
write(OWNER + 0x7c, OBSERVER)
write(OBSERVER, OBSERVER_VTABLE)
write(OBSERVER_VTABLE + 8, UPDATED)
write(VISUAL, VISUAL_VTABLE)
write(VISUAL_VTABLE + 0x88, ASPECT)
write(ROLE, 0x5c2c28)
write(TARGET, 0x5c2c28)
write(ROLE + 0x2a0, RECORD)
write(TARGET + 0x2a0, TARGET_RECORD)
write(RECORD + 0xc, 73)
write(TARGET_RECORD + 0xc, 91)
write(RECORD + 0x90, 2)
write(GLOBAL + 0x120, INVENTORY)
write(INVENTORY + 0x10, VECTOR, VECTOR + 4)
write(VECTOR, ITEM)
write(ITEM + 4, 77)
write(ITEM + 0xc, 2002)
write(ITEM + 0x10, 8)
write(ITEM + 0x1c, 5, 3)
uc.mem_write(CLOCK, b'\xdd\x05' + struct.pack('<I', CLOCK + 0x100) + b'\xc2\x04\x00')
current = 123.456789
uc.mem_write(CLOCK + 0x100, struct.pack('<d', current))
for role, position, velocity, identity in [(ROLE, [12.25, 9, -30], [2.5, 3.5], 0x11223344), (TARGET, [-25, 7, 45], [5.5, 6.5], 0x55667788)]:
    write(role + 0x258, identity)
    uc.mem_write(role + 0x25c, struct.pack('<3f', *position))
    uc.mem_write(role + 0x274, struct.pack('<3f', 0, 0, -1))
    uc.mem_write(role + 0x280, struct.pack('<3f', 0, 0, -1))
    record = RECORD if role == ROLE else TARGET_RECORD
    uc.mem_write(record + 0x48, struct.pack('<2f', *velocity))
uc.mem_write(ROLE + 0x50, struct.pack('<2f', .7, 1.25))
write(STACK, RETURN)
uc.reg_write(UC_X86_REG_ESP, STACK)
uc.emu_start(0x4240cd, RETURN, count=100)
assert uc.reg_read(UC_X86_REG_EAX) == 0x3a9d

rows = []
for inventory_present in [False, True]:
    for count in [0, 1, 2, 5, 0xffffffff]:
        for selection in [0, 1, 2, 8]:
            for visual in [False, True]:
                for aspect in ([0, 1, 2, 3, 4] if visual else [0]):
                    write(INVENTORY + 0x14, VECTOR + (4 if inventory_present else 0))
                    write(ITEM + 0x20, 0 if count == 0 else 3)
                    write(RECORD + 0x44, count)
                    write(RECORD + 0x3c, selection)
                    uc.mem_write(RECORD + 0x94, bytes(28))
                    write(RECORD + 0x94 + 4 * (max(2, selection) - 2), 77)
                    write(TARGET + 0x310, VISUAL if visual else 0)
                    uc.mem_write(ROLE + 0x308, b'\x07')
                    uc.mem_write(ROLE + 0x9c, struct.pack('<f', 9.25))
                    before = [bytes(uc.mem_read(address, size)) for address, size in [(RECORD, 0x140), (TARGET_RECORD, 0x140), (ITEM, 0x28)]]
                    events.clear()
                    quantity_writes.clear()
                    write(0, 0x12345678)
                    write(STACK, RETURN, 73)
                    uc.reg_write(UC_X86_REG_ECX, OWNER)
                    uc.reg_write(UC_X86_REG_ESP, STACK)
                    uc.reg_write(UC_X86_REG_EBP, 0x1234)
                    uc.emu_start(0x4288fe, RETURN, count=100000)
                    assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 8
                    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234 and read(0) == 0x12345678
                    after = [bytes(uc.mem_read(address, size)) for address, size in [(RECORD, 0x140), (TARGET_RECORD, 0x140), (ITEM, 0x28)]]
                    assert before == after and quantity_writes == []
                    assert uc.mem_read(ROLE + 0x308, 1) == b'\x00'
                    send = [event for event in events if event['kind'] == 'send']
                    assert len(send) == 1 and send[0]['targetId'] == 91
                    assert send[0]['actor'][0:2] == [0x11223344, 2]
                    assert send[0]['target'][0:2] == [0x55667788, 2]
                    for snapshot, position, velocity in [(send[0]['actor'], [12.25, -30], [2.5, 3.5]), (send[0]['target'], [-25, 45], [5.5, 6.5])]:
                        bits = lambda value: struct.unpack('<I', struct.pack('<f', value))[0]
                        assert snapshot[2:4] == list(map(bits, position))
                        assert snapshot[6] == bits(f32(current))
                        assert snapshot[7:9] == list(map(bits, velocity))
                    duration = f32(1.25 if count == 1 else .7)
                    reload = selection < 2 or inventory_present
                    if reload:
                        assert events[-1] == dict(kind='reload', seconds=duration, bulletCount=count, deadline=f32(current + duration))
                    else:
                        assert struct.unpack('<f', uc.mem_read(ROLE + 0x9c, 4))[0] == 9.25
                    kinds = ['clock'] + (['aspect'] if visual and aspect < 4 else []) + ['send'] + (['clock', 'reload'] if reload else [])
                    assert [event['kind'] for event in events] == kinds
                    if visual and aspect < 4:
                        assert events[1] == dict(kind='aspect', value=aspect + 1)
                    rows.append(dict(inventoryPresent=inventory_present, count=count, selection=selection, visual=visual, aspect=aspect,
                                     quantities=dict(owned=read(ITEM + 0x10), field1c=read(ITEM + 0x1c), battle=read(ITEM + 0x20)),
                                     quantityWrites=list(quantity_writes), events=list(events)))

STREAM, BUFFER, PACKET = 0x201a000, 0x201b000, 0x201c000
wire_rows = []
source = next(event for event in rows[0]['events'] if event['kind'] == 'send')
for offset in range(8):
    write(PACKET + 12, source['targetId'], *source['actor'], *source['target'])
    uc.mem_write(BUFFER, bytes(64))
    write(STREAM, offset, 0, BUFFER, 64)
    write(STACK, RETURN, STREAM)
    uc.reg_write(UC_X86_REG_ECX, PACKET)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x42531d, RETURN, count=10000)
    assert read(STREAM) + read(STREAM + 4) * 8 == offset + 352
    payload = bytes(uc.mem_read(BUFFER, (offset + 352 + 7) // 8))
    expected = source['targetId']
    bit = 32
    for snapshot in [source['actor'], source['target']]:
        for index, width in [(2, 32), (3, 32), (5, 16), (4, 16), (0, 16), (1, 16), (6, 32)]:
            expected |= (snapshot[index] & ((1 << width) - 1)) << bit
            bit += width
    assert int.from_bytes(payload, 'little') == expected << offset
    uc.mem_write(PACKET + 12, b'\xaa' * 76)
    write(STREAM, offset, 0, BUFFER, 64)
    write(STACK, RETURN, STREAM)
    uc.reg_write(UC_X86_REG_ECX, PACKET)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x425353, RETURN, count=10000)
    assert read(STREAM) + read(STREAM + 4) * 8 == offset + 352 and read(PACKET + 12) == source['targetId']
    decoded = []
    for address, snapshot in [(PACKET + 16, source['actor']), (PACKET + 52, source['target'])]:
        values = list(struct.unpack('<9I', uc.mem_read(address, 36)))
        expected_snapshot = [snapshot[0] & 0xffff, snapshot[1] & 0xffff, snapshot[2], snapshot[3],
                             snapshot[4] & 0xffff, snapshot[5] & 0xffff, snapshot[6], 0xaaaaaaaa, 0xaaaaaaaa]
        assert values == expected_snapshot
        decoded.append(values)
    wire_rows.append(dict(offset=offset, bitCount=352, payload=payload.hex(), decoded=decoded))

evidence = dict(status='PASS', entry='0x4288fe', messageType='0x3a9d', rows=rows, wireRows=wire_rows,
                scope='Complete entity-target branch with no scene-object target. Actual4252ea/42409a/402289 constructor,4240cd type getter, target integer getter18, both422d90 snapshots including41d9b1 direction quantization, request destructor425382 and full423092 reload notification/getters execute. Original42531d/41d8c9 writer and425353/41d84c reader execute352-bit codec at eight bit alignments. Role/target selection, stage, scene-target query, aspect classification, clock and final transport/observer/visual boundaries supplied. Record and inventory bytes remain unchanged and no emulated writes target quantity fields. This client entry emits3a9d independent of bulletCount or inventory battle quantity; special-slot inventory miss suppresses reload after sending. It does not produce3ab5 or numeric-property changes. Server acceptance, decrement/refill and3ab5 producer conditions remain unknown.')
(ROOT / 'recovery/output/role-ammo-producer-sol-native.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(f'PASS: {len(rows)} original entity requests, actual snapshots/reload, unchanged quantities; {len(wire_rows)} native352-bit codecs')
