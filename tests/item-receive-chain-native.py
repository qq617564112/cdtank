"""Execute original inventory registration and incoming envelope dispatch."""
import json
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import (
    UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX,
    UC_X86_REG_EIP, UC_X86_REG_ESP,
)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x200000)
TRANSPORTS = [0x2001000, 0x2005000]
MANAGER, GAME, BUFFER = 0x2009000, 0x200a000, 0x200b000
VECTOR, RECORD = 0x200c000, 0x200d000
STACK, RETURN = 0x2100000, 0x2101000
LOCK, CLOCK, HEAP = 0x2102000, 0x2102100, 0x2110000
heap = HEAP
events = []
freed = []
allocated = []
destructors = []
pool_returns = []
decoded_packets = []


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values),
                                     *[value & 0xffffffff for value in values]))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(machine, address, size, data):
    global heap
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x578620:
        count = read(stack + 4)
        pointer = heap
        heap += (count + 15) & ~15
        assert heap < 0x2200000
        allocated.append(pointer)
        finish(pointer)
    elif address == 0x57a6c7:
        freed.append(read(stack + 4))
        finish()
    elif address in [0x57aa66, LOCK, 0x40bd28]:
        finish()
    elif address == CLOCK:
        finish(100)
    elif address == 0x413c74:
        finish(MANAGER)
    elif address == 0x411068:
        # ItemTable lookup returns no optional description; quantity logic is real.
        finish(0, 4)
    elif address == 0x40266a:
        events.append(dict(kind='route', messageType=read(stack + 8),
                           identity=read(stack + 12)))
    elif address == 0x425ba6:
        packet = machine.reg_read(UC_X86_REG_ECX)
        decoded_packets.append(packet)
        events.append(dict(kind='deleteReader', metadata=read(packet + 4),
                           identity=read(packet + 8)))
    elif address == 0x440fd7:
        packet = read(stack + 4)
        events.append(dict(kind='deleteHandler', instanceId=read(packet + 12),
                           context=read(stack + 8), connection=read(stack + 12)))
    elif address == 0x43c83d:
        events.append(dict(kind='useReader'))
    elif address == 0x43f605:
        destructors.append(machine.reg_read(UC_X86_REG_ECX))
    elif address == 0x416f5e:
        pool_returns.append(dict(pointer=read(stack + 4), size=read(stack + 8)))


for address in [0x578620, 0x57a6c7, 0x57aa66, LOCK, CLOCK, 0x40bd28,
                0x413c74, 0x411068, 0x40266a, 0x425ba6, 0x440fd7, 0x43c83d,
                0x43f605, 0x416f5e]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
# Imported critical-section and timing boundaries; packet/factory/forwarding stay native.
write(0x5c0980, LOCK)
write(0x5c097c, LOCK)
write(0x5c0828, CLOCK)


def call(address, this, *args):
    write(0, 0x12345678)
    write(STACK, RETURN, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(address, RETURN, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234
    assert read(0) == 0x12345678


write(0x633588, GAME)
write(GAME + 0xbc, TRANSPORTS[0])
write(GAME + 0xd4, TRANSPORTS[1])
for transport in TRANSPORTS:
    call(0x403096, transport + 4)
# Original static maps and full inventory constructor register both transports.
call(0x43bead, 0x63552c)
call(0x4423ae, 0x635544)
call(0x43e8a1, MANAGER)
assert [read(transport + 0x10) for transport in TRANSPORTS] == [16, 16]
write(MANAGER + 0x10, VECTOR, VECTOR + 4)
write(VECTOR, RECORD)
write(RECORD + 4, 77)
write(RECORD + 12, 2001)


def receive(transport, payload, owned=5, battle=3):
    events.clear()
    freed.clear()
    allocated.clear()
    destructors.clear()
    pool_returns.clear()
    decoded_packets.clear()
    write(RECORD + 0x10, owned)
    write(RECORD + 0x20, battle)
    uc.mem_write(BUFFER, payload)
    context, connection, metadata = 0x11223344, 0x55667788, 0x99aabbcc
    # Original receive virtual wrapper4038d5 calls4027c3 with this+4.
    call(0x4038d5, transport, connection, context, BUFFER, len(payload), metadata)
    stream = transport + 0x14
    cursor = read(stream) + read(stream + 4) * 8
    return dict(events=list(events), ownedQuantity=read(RECORD + 0x10),
                battleQuantity=read(RECORD + 0x20), bitsRead=cursor,
                allocationCount=len(allocated), freeCount=len(freed),
                destructors=list(destructors), poolReturns=list(pool_returns),
                decodedPackets=list(decoded_packets))


outgoing = json.loads((ROOT / 'recovery/output/item-use-send-native.json').read_text())
unknown = []
for transport_index, transport in enumerate(TRANSPORTS):
    for sample in outgoing['samples']:
        payload = bytes.fromhex(sample['bytes'])
        assert len(payload) == 13
        result = receive(transport, payload)
        assert result == dict(events=[dict(kind='route', messageType=0x3c9e,
                                          identity=0x1234)],
                              ownedQuantity=5, battleQuantity=3, bitsRead=32,
                              allocationCount=0, freeCount=0, destructors=[],
                              poolReturns=[], decodedPackets=[])
        unknown.append(dict(transportIndex=transport_index, source=sample, result=result))

deletions = []
for transport_index, transport in enumerate(TRANSPORTS):
    for identity in [0, 0x1234, 0xffff]:
        for instance in [77, 88]:
            payload = struct.pack('<HHI', 0x3c92, identity, instance)
            result = receive(transport, payload)
            assert result['events'] == [
                dict(kind='route', messageType=0x3c92, identity=identity),
                dict(kind='deleteReader', metadata=0x99aabbcc, identity=identity),
                dict(kind='deleteHandler', instanceId=instance,
                     context=0x11223344, connection=0x55667788),
            ]
            assert (result['ownedQuantity'], result['battleQuantity']) == (
                (4, 2) if instance == 77 else (5, 3))
            assert result['bitsRead'] == 64
            assert len(result['decodedPackets']) == 1
            packet = result['decodedPackets'][0]
            assert result['destructors'] == [packet]
            assert result['poolReturns'] == [dict(pointer=packet, size=0x10)]
            deletions.append(dict(transportIndex=transport_index, identity=identity,
                                  instanceId=instance, result=result))
assert len({row['result']['decodedPackets'][0] for row in deletions}) == 1

(ROOT / 'recovery/output/item-receive-chain-native.json').write_text(json.dumps(dict(
    status='PASS', useRequests=unknown, deletionNotifications=deletions,
    suppliedBoundaries=['allocation/free', 'exitDestructorScheduling', 'diagnosticLogging',
                        'criticalSections', 'GetTickCount', 'optionalItemTableDescription'],
    originalChain=['4038d5', '4027c3', '401d58', '40266a', '40260b',
                   'listenerFactory', '425ba6', '48b28c', '440fd7', 'packetDestructor'],
    scope='Inventory constructor43e8a1 registers real callbacks through402ec8 into two '
          'real transport trees. Incoming3c9e stops after header lookup; incoming3c92 '
          'creates/reads/forwards/destructs/returns a real packet to its pool and updates quantities. No Winsock '
          'I/O, other managers or missing-server request-success semantics proved.',
), indent=2) + '\n')
print('PASS: 16 captured original use envelopes rejected after32 header bits; '
      '12 original deletion envelopes decoded/dispatched/returned to pool across two transports')
