"""Original use/trap request gates, packet construction and trap-permission clear."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x30000)
GAME, MANAGER, ROLE, PROFILE = 0x2001000, 0x2002000, 0x2003000, 0x2004000
SCENE, VTABLE, MODE, ARRAY, VECTOR, RECORD = 0x2005000, 0x2006000, 0x2007000, 0x2008000, 0x2009000, 0x200a000
STACK, RETURN, ARRAY_GETTER, MODE_GETTER = 0x2010000, 0x2011000, 0x2012000, 0x2013000
has_role = True
has_array = True
mode = 4
sent = []
payload_seed = None
payload_samples = []
native_send = False
network_samples = []
TRANSPORT, SOCKET, SOCKET_VTABLE, NETWORK_SEND = 0x2015000, 0x2019000, 0x201a000, 0x201b000

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    pop = 0
    if address == 0x43c7bd:
        if payload_seed is not None:
            packet = machine.reg_read(UC_X86_REG_ECX)
            write(packet + 0x10, payload_seed[0])
            machine.mem_write(packet + 0x14, bytes([payload_seed[1]]))
        return
    if address == 0x4269c4:
        value = ROLE if has_role else 0
    elif address == ARRAY_GETTER:
        assert read(stack + 4) == 0
        pop, value = 4, ARRAY if has_array else 0
    elif address == MODE_GETTER:
        value = mode
    elif address == 0x413e8c:
        packet = read(stack + 4)
        assert read(packet) == 0x5c4f88
        if payload_seed is not None:
            payload_samples.append(dict(instanceId=read(packet+0xc), field10=read(packet+0x10),
                                        field14Byte=machine.mem_read(packet+0x14,1)[0]))
        sent.append(dict(instanceId=read(packet + 0xc), trapPermission=int(uc.mem_read(ROLE + 0x309, 1)[0])))
        if native_send:
            return
        pop, value = 4, 0
    elif address == NETWORK_SEND:
        assert machine.reg_read(UC_X86_REG_ECX) == SOCKET
        buffer, length, flag = [read(stack + offset) for offset in [4, 8, 12]]
        assert length == 13 and flag == 1
        network_samples.append(dict(bytes=bytes(machine.mem_read(buffer, length)).hex(),
                                    field10=payload_seed[0], field14Byte=payload_seed[1]))
        pop, value = 12, 1
    elif address == 0x40bc38:
        value = 0  # diagnostic logging; caller pops args
    else:
        raise AssertionError(hex(address))
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

for address in [0x43c7bd, 0x4269c4, ARRAY_GETTER, MODE_GETTER, 0x413e8c, 0x40bc38, NETWORK_SEND]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)

def execute(kind, item_id, quantity, status=2, permission=1, role=True, array=True,
            assigned=True, found=True, scene=True, game_mode=4, secondary=False):
    global has_role, has_array, mode
    has_role, has_array, mode = role, array, game_mode
    uc.mem_write(GAME, bytes(0xa000))
    write(0x633588, GAME)
    write(GAME + 0x118, ROLE)
    write(GAME + 0x124, SCENE)
    if native_send:
        uc.mem_write(TRANSPORT, bytes(0x3100))
        write(GAME + 0xbc, TRANSPORT - 4)
        write(GAME + 0xec, SOCKET)
        write(GAME + 0x114, MANAGER)
        write(MANAGER + 0x74, 0x1234)
        write(SOCKET, SOCKET_VTABLE)
        write(SOCKET_VTABLE + 0x18, NETWORK_SEND)
    write(GAME + 0xe0, GAME + 0x200)
    write(GAME + 0x200, MODE)
    write(MODE, VTABLE + 0x100)
    write(VTABLE + 0x104, MODE_GETTER)
    write(ROLE, VTABLE)
    write(VTABLE + 0x20, ARRAY_GETTER)
    write(ROLE + 0x2a0, PROFILE)
    write(PROFILE + 0x90, status)
    uc.mem_write(ROLE + 0x309, bytes([permission]))
    write(ARRAY, *([77 if assigned else 0] * 7))
    write(SCENE + 0x60, 1 if scene else 0)
    for offset in [0x10, 0x20]:
        write(MANAGER + offset, VECTOR, VECTOR + (4 if found and (offset == 0x20) == secondary else 0))
    write(VECTOR, RECORD)
    write(RECORD + 4, 77)
    write(RECORD + 0xc, item_id, 999)
    write(RECORD + 0x20, quantity)
    write(0, 0x12345678)
    write(STACK, RETURN, 77)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, MANAGER)
    sent.clear()
    uc.emu_start(0x43d4dc if kind == 'use' else 0x43d5f3, RETURN, count=5000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234 and read(0) == 0x12345678
    assert read(RECORD + 0x10) == 999 and read(RECORD + 0x20) == quantity
    result = dict(sent=list(sent), trapPermission=int(uc.mem_read(ROLE + 0x309, 1)[0]))
    if kind == 'use':
        result['accepted'] = bool(uc.reg_read(UC_X86_REG_EAX))
    return result

rows = []
ids = [int(row['values']['ItemTableID']) for row in read_table(ROOT / 'CDTank/Data/table/item.dat')['rows']]
for index, item_id in enumerate(ids):
    for kind in ['use', 'trap']:
        for quantity in [0, 1, 0xffffffff]:
            rows.append(dict(kind=kind, itemId=item_id, quantity=quantity, secondary=bool(index % 2),
                             result=execute(kind, item_id, quantity, secondary=bool(index % 2))))
for kind, item_id, status, permission in itertools.product(['use', 'trap'], [1, 2001, 3001], range(4), [0, 1, 255]):
    rows.append(dict(kind=kind, itemId=item_id, quantity=1, status=status, permission=permission,
                     result=execute(kind, item_id, 1, status=status, permission=permission)))
for kind in ['use', 'trap']:
    for key in ['role', 'array', 'assigned', 'found', 'scene']:
        rows.append(dict(kind=kind, itemId=3001, quantity=1, **{key: False},
                         result=execute(kind, 3001, 1, **{key: False})))
    rows.append(dict(kind=kind, itemId=3001, quantity=1, game_mode=1,
                     result=execute(kind, 3001, 1, game_mode=1)))
out = ROOT / 'recovery/output/item-use-native.json'
out.write_text(json.dumps(dict(scope='Original43d4dc/43d5f3, real status43293d, lookup43d186, classifier439762, permission clear432b78, packet ctor43c7bd/destructor43c887 and SEH. Supplied role/array/mode access and send/log callbacks. Only initialized packet instanceID claimed; other request fields unproven. No server execution or consumption.', rows=rows), indent=2))
print(f'PASS: {len(rows)} original use/trap request gates, pre-send permission clear and no quantity consumption')

# Execute constructors/callers with known preexisting stack bytes. No fields are fabricated as defaults.
for kind in ['use','trap']:
    for payload_seed in [(0,0),(0x11223344,1),(0xffffffff,255),(0x80000000,0xa5)]:
        execute(kind,3001,3)
        observed=payload_samples[-1]
        assert observed == dict(instanceId=77,field10=payload_seed[0],field14Byte=payload_seed[1])
payload_seed=None
write(STACK,RETURN)
uc.reg_write(UC_X86_REG_ESP,STACK)
uc.emu_start(0x44294f,RETURN,count=20)
assert uc.reg_read(UC_X86_REG_EAX)==4
assert bytes(uc.mem_read(0x5c57f0,4))==struct.pack('<I',0x44294f)
(ROOT/'recovery/output/item-use-request-fields-native.json').write_text(json.dumps(dict(status='PASS',
    samples=payload_samples,activeGameplayGetter='0x44294f',activeGameplayState=4,
    scope='Real request constructors and callers preserve preexisting packet+10/+14 stack bytes. They have no defined request defaults here; downstream meaning remains unproven. Active gameplay virtual+4 returns4.'),indent=2)+'\n')
print('PASS: 8 real outgoing requests preserve unknown preexisting fields; active gameplay engine state4')

# Only the terminal network I/O is supplied. Header, body and bitstream execute natively.
native_send = True
for kind in ['use', 'trap']:
    for payload_seed in [(0, 0), (0x11223344, 1), (0xffffffff, 255), (0x80000000, 0xa5)]:
        execute(kind, 3001, 3)
        sample = network_samples[-1]
        sample['kind'] = kind
        bits = int.from_bytes(bytes.fromhex(sample['bytes']), 'little')
        expected = 0x3c9e | (0x1234 << 16) | (77 << 32) | (payload_seed[0] << 64) | (bool(payload_seed[1]) << 96)
        assert bits & ((1 << 97) - 1) == expected
        assert read(TRANSPORT + 0x306c) == 1
native_send = False
payload_seed = None
(ROOT / 'recovery/output/item-use-send-native.json').write_text(json.dumps(dict(status='PASS',
    samples=network_samples, typeBits=16, identityBits=16, bodyBits=65,
    scope='Real use/trap caller, constructor,413e8c dispatcher,402350/402090 sender and43c7f0/401c7a writer. Terminal socket virtual+18 supplied. Unknown preexisting fields reach the socket unchanged except boolean normalization; no server semantics proven.'), indent=2) + '\n')
print('PASS: 8 full original outgoing envelopes preserve unknown32 and normalize boolean at terminal network send')
