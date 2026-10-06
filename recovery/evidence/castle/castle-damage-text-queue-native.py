"""Execute Castle text queue update/removal and queue destruction."""
import json
import struct
import sys
from pathlib import Path

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

u, _ = map_original_binaries([ROOT / 'CDTank' / 'CDTank.exe'])
u.mem_map(0, 4096)
u.mem_map(0x2000000, 0x20000)
OBJ, TABLE, RECORD, STACK, STOP, SERVICE, MATRIX = [0x2001000 + i * 0x1000 for i in range(7)]
QUEUE = OBJ + 0x1c8
depth = 500
events = []


def words(address, *values):
    u.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def word(address):
    return struct.unpack('<I', u.mem_read(address, 4))[0]


def value(address):
    return struct.unpack('<f', u.mem_read(address, 4))[0]


def finish(pop=0, result=0):
    stack = u.reg_read(UC_X86_REG_ESP)
    u.reg_write(UC_X86_REG_EAX, result)
    u.reg_write(UC_X86_REG_EIP, word(stack))
    u.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(machine, address, size, data):
    stack, context = u.reg_read(UC_X86_REG_ESP), u.reg_read(UC_X86_REG_ECX)
    if address == 0x200a000:
        finish(result=MATRIX)
    elif address == 0x44ef01:
        finish(result=word(stack + 4))
    elif address == 0x200a100:
        vector = word(stack + 4)
        u.mem_write(vector, struct.pack('<3f', 0, 0, depth))
        events.append(dict(kind='cameraTransform', suppliedDepth=depth))
        finish(8)
    elif address == 0x401171:
        events.append(dict(kind='stringRelease', context=context))
        finish(8)
    elif address == 0x57a6c7:
        events.append(dict(kind='free', address=word(stack + 4)))
        finish()


words(0x63582c, SERVICE)
words(SERVICE + 0xd4, SERVICE)
words(0x5c09ec, 0x200a000)
words(0x5c0b68, 0x200a100)
for address in [0x200a000, 0x44ef01, 0x200a100, 0x401171, 0x57a6c7]:
    u.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)


def call(entry, context, delta=None):
    words(STACK, STOP)
    if delta is not None:
        u.mem_write(STACK + 4, struct.pack('<f', delta))
    u.reg_write(UC_X86_REG_ECX, context)
    u.reg_write(UC_X86_REG_ESP, STACK)
    u.emu_start(entry, STOP, count=100000)
    assert u.reg_read(UC_X86_REG_EIP) == STOP
    assert u.reg_read(UC_X86_REG_ESP) == STACK + (8 if delta is not None else 4)


rows = []
for depth, elapsed, delta in [(250, 0, 0.25), (500, 0.5, 0.25),
                               (-500, 0.75, 0.25), (1000, 0.75, 0.5)]:
    events.clear()
    u.mem_write(OBJ, bytes(0x300))
    u.mem_write(TABLE, bytes(32))
    u.mem_write(RECORD, bytes(0x48))
    words(QUEUE + 4, TABLE, 8, 0, 1)
    words(TABLE, RECORD)
    for offset, field in [(4, 100), (0x2c, 1), (0x30, elapsed),
                          (0x3c, 0.5), (0x40, 1), (0x44, 40)]:
        u.mem_write(RECORD + offset, struct.pack('<f', field))
    call(0x45dbff, OBJ, delta)
    row = dict(depth=depth, elapsedBefore=elapsed, delta=delta,
               scale=value(RECORD + 0x28), elapsed=value(RECORD + 0x30),
               alpha=value(RECORD + 0x2c), y=value(RECORD + 4),
               countAfterUpdate=word(QUEUE + 0x10), updateEvents=list(events))
    assert abs(row['scale'] - (250 / abs(depth) + 0.2)) < 1e-6
    assert row['countAfterUpdate'] == (0 if elapsed + delta >= 1 else 1)
    assert len([e for e in events if e['kind'] == 'stringRelease']) == (0 if row['countAfterUpdate'] else 1)
    assert not [e for e in events if e['kind'] == 'free']
    events.clear()
    call(0x45caa0, QUEUE)
    assert word(QUEUE + 0x10) == word(QUEUE + 8) == word(QUEUE + 4) == 0
    assert [e['address'] for e in events if e['kind'] == 'free'] == [RECORD, TABLE]
    row['disposeEvents'] = list(events)
    rows.append(row)
out = dict(status='PASS_CASTLE_TEXT_QUEUE_SERVICE_BOUNDARY', update='0x45dbff',
           remove='0x45db55', dispose='0x45caa0', rows=rows,
           scope='Original queue iteration, finite CRT absolute value, scale calculation, record update, removal and destruction execute. Camera stack/transform and CEGUI string release/allocator are recording services. Supplied single-record original ring layout; no actual font GPU draw, full Castle construction or ordinary battle.')
(ROOT / 'recovery/output/castle-damage-text-queue-native.json').write_text(json.dumps(out, indent=2) + '\n')
print('PASS: original camera-depth scale, queue expiry removal, retained storage and disposal releases')
