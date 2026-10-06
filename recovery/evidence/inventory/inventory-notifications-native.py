"""Execute the original inventory deletion notification and real vector search."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x1000)  # original SEH helper reads and restores fs:[0]
uc.mem_map(0x2000000, 0x20000)
MANAGER, MESSAGE, VECTOR, RECORDS = 0x2001000, 0x2002000, 0x2003000, 0x2004000
OBSERVER, VTABLE, CALLBACK = 0x2005000, 0x2005100, 0x2012000
LISTENER, ADAPTER, STREAM, BUFFER = 0x2009000, 0x2009100, 0x2009200, 0x2009300
STACK, RETURN = 0x2010000, 0x2011000
callbacks = []

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == CALLBACK:
        assert machine.reg_read(UC_X86_REG_ECX) == OBSERVER
        callbacks.append(dict(instanceId=read(stack + 4), battleQuantity=read(stack + 8)))
        consumed = 12
    elif address == 0x578620:
        assert read(stack + 4) == 0x10
        machine.reg_write(UC_X86_REG_EAX, ADAPTER)
        consumed = 4  # original caller releases the cdecl argument
    else:
        # Supply unavailable ItemTable storage; optional message UI is disabled.
        machine.reg_write(UC_X86_REG_EAX, MANAGER if address == 0x413c74 else 0)
        consumed = 4 if address == 0x413c74 else 8
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + consumed)

for address in [0x413c74, 0x411068, CALLBACK, 0x578620]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)

pe = images['cdtank.exe']
assert pe.get_data(0x44242c - 0x400000, 5) == b'\xb8\xd7\x0f\x44\x00'
assert pe.get_data(0x442451 - 0x400000, 10) == b'\xc7\x05\xe0\x56\x63\x00\x98\x57\x5c\x00'
name = b'UMsgDeleteInKitbag\0'
assert pe.get_data(0x5c5798 - 0x400000, len(name)) == name

def call(address, this, *args):
    write(STACK, RETURN, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(address, RETURN, count=3000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    return uc.reg_read(UC_X86_REG_EAX)

def execute(vectors, instance_id, observer, extra):
    uc.mem_write(MANAGER, bytes(0x5000))
    write(0, 0x12345678)
    write(MESSAGE + 0xc, instance_id, extra, extra ^ 0xffffffff)
    write(MESSAGE, 0x5c5350)
    bit_offset = extra % 8
    payload = ((instance_id & 0xffffffff) << bit_offset).to_bytes(5, 'little')
    uc.mem_write(BUFFER, payload)
    write(STREAM, bit_offset, 0, BUFFER, 5)
    call(0x425ba6, MESSAGE, STREAM)
    assert read(MESSAGE + 0xc) == instance_id
    call(0x43c0f2, LISTENER, 0x440fd7, 0)
    listener_type = read(read(LISTENER) + 0xc)
    packet_type = read(read(MESSAGE) + 4)
    assert call(listener_type, LISTENER) == call(packet_type, MESSAGE) == 0x3c92
    assert call(0x43ca58, LISTENER) == ADAPTER
    call(0x48daa3, ADAPTER, MANAGER)
    write(OBSERVER, VTABLE)
    write(VTABLE + 8, CALLBACK)
    write(MANAGER + 0xb4, OBSERVER if observer else 0)
    addresses = []
    for vector_index, records in enumerate(vectors):
        base = VECTOR + vector_index * 0x100
        write(MANAGER + 0x10 + vector_index * 0x10, base, base + len(records) * 4)
        row_addresses = []
        for index, record in enumerate(records):
            address = RECORDS + vector_index * 0x400 + index * 0x40
            row_addresses.append(address)
            write(base + index * 4, address)
            write(address + 4, record['instanceId'])
            write(address + 0xc, record['itemTableId'], record['ownedQuantity'])
            write(address + 0x1c, 93, record['battleQuantity'])
        addresses.append(row_addresses)
    write(STACK, RETURN, MESSAGE, 0, 0)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, MANAGER)
    callbacks.clear()
    uc.reg_write(UC_X86_REG_ECX, ADAPTER)
    uc.emu_start(0x48b28c, RETURN, count=3000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 16
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234 and read(0) == 0x12345678
    result = [[dict(instanceId=read(a + 4), itemTableId=read(a + 0xc),
                    ownedQuantity=read(a + 0x10), battleQuantity=read(a + 0x20))
               for a in group] for group in addresses]
    assert all(read(a + 0x1c) == 93 for group in addresses for a in group)
    return dict(vectors=result, callbacks=list(callbacks))

rows = []
for owned, usable, placement, observer, extra, instance_id in itertools.product(
        [0, 1, 2, 255, 0xffffffff], [0, 1, 5, 0xffffffff], range(5), [False, True], [0, 2, 0xffffffff], [0, 77, 0xffffffff]):
    target = dict(instanceId=instance_id, itemTableId=2001, ownedQuantity=owned, battleQuantity=usable)
    other = dict(instanceId=88, itemTableId=3001, ownedQuantity=9, battleQuantity=3)
    duplicate = dict(instanceId=instance_id, itemTableId=12501, ownedQuantity=7, battleQuantity=2)
    vectors = [[other], [other]]
    if placement == 0:
        vectors[0].append(target)
    elif placement == 1:
        vectors[1].append(target)
    elif placement == 2:
        vectors[0].extend([target, duplicate])
        vectors[1].append(duplicate)
    elif placement == 3:
        vectors[1].extend([target, duplicate])
    result = execute(vectors, instance_id, observer, extra)
    # Check the real packet writer as well as the earlier packet reader.
    uc.mem_write(BUFFER, bytes(5))
    write(STREAM, extra % 8, 0, BUFFER, 5)
    call(0x42571f, MESSAGE, STREAM)
    payload = bytes(uc.mem_read(BUFFER, (extra % 8 + 32 + 7) // 8)).hex()
    rows.append(dict(vectors=vectors, instanceId=instance_id, observer=observer, extra=extra,
                     payload=payload, bitOffset=extra % 8, result=result))
out = ROOT / 'recovery/output/inventory-notifications-native.json'
out.write_text(json.dumps(dict(scope='Original3c92 packet425ba6 with real bitstream, listener43c0f2/type getter, callback clone43ca58/setter48daa3/forward48b28c, handler440fd7, SEH57a6a8 and search43bd3a; supplied callback allocation and ItemTable storage, disabled optional text UI, observed quantity callback. Registration bytes checked. No socket transport or use-success claim.', messageType=0x3c92, rows=rows), indent=2))
print(f'PASS: {len(rows)} original inventory notifications, vector precedence, wrapping quantities, callbacks and SEH restore')
