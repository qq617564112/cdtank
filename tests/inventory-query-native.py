"""Original query-items callback with actual tree traversal and classification."""
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

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x40000)
GAME, ROLE, VTABLE, MANAGER = 0x2001000, 0x2002000, 0x2002100, 0x2003000
MESSAGE, TREE, HEAD = 0x2004000, 0x2004100, 0x2004200
NODES, RECORDS, VECTORS = 0x2005000, 0x2010000, 0x2020000
ARRAY1, ARRAY2, STACK, RETURN = 0x2030000, 0x2030100, 0x2038000, 0x2039000
GETTER, ARRAY_GETTER = 0x203a000, 0x203a100
LISTENER, ADAPTER = 0x203b000, 0x203b100
offsets = [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]
role_present = True
equipment = {}
cleared = []
warnings = []

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    this = machine.reg_read(UC_X86_REG_ECX)
    consumed = 4
    if address == 0x4269c4:
        machine.reg_write(UC_X86_REG_EAX, ROLE if role_present else 0)
    elif address == 0x4593e5:
        offset = this + 4 - MANAGER
        assert offset in offsets
        cleared.append(offset)
        base = VECTORS + offsets.index(offset) * 0x800
        write(this + 4, base, base, base + 0x800)
    elif address == 0x4387b7:
        end = read(this + 8)
        write(end, read(read(stack + 4)))
        write(this + 8, end + 4)
        consumed = 8
    elif address == 0x40bd28:
        pass  # external diagnostic logging, cdecl
    elif address == GETTER:
        machine.reg_write(UC_X86_REG_EAX, equipment.get(read(stack + 4), 0))
        consumed = 8
    elif address == ARRAY_GETTER:
        index = read(stack + 4)
        machine.reg_write(UC_X86_REG_EAX, ARRAY1 if index == 1 else ARRAY2)
        consumed = 8
    elif address == 0x401626:
        machine.reg_write(UC_X86_REG_EAX, this)
        consumed = 8
    elif address == 0x417e17:
        assert read(stack + 4) == 0x36c
        machine.reg_write(UC_X86_REG_EAX, MESSAGE)
    elif address == 0x48f9c4:
        assert all(read(RECORDS + index * 0x40 + 0x1c) == 0 for index in range(len(records)))
        assert len(cleared) == 8
        warnings.append(0x36c)
        consumed = 8
    elif address == 0x401171:
        consumed = 12
    elif address == 0x578620:
        assert read(stack + 4) == 0x10
        machine.reg_write(UC_X86_REG_EAX, ADAPTER)
    else:
        raise AssertionError(hex(address))
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + consumed)

for address in [0x4269c4, 0x4593e5, 0x4387b7, 0x40bd28, GETTER, ARRAY_GETTER,
                0x401626, 0x417e17, 0x48f9c4, 0x401171, 0x578620]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)

pe = images['cdtank.exe']
assert pe.get_data(0x4423e1 - 0x400000, 5) == b'\xb8\x18\xed\x43\x00'
assert pe.get_data(0x442406 - 0x400000, 10) == b'\xc7\x05\xf8\x56\x63\x00\xac\x57\x5c\x00'
name = b'UMsgQueryItemsResult\0'
assert pe.get_data(0x5c57ac - 0x400000, len(name)) == name

def call(address, this, *args):
    write(STACK, RETURN, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(address, RETURN, count=3000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    return uc.reg_read(UC_X86_REG_EAX)

item_ids = [int(row['values']['ItemTableID']) for row in read_table(ROOT / 'CDTank/Data/table/item.dat')['rows']]
ids = item_ids + [0, 1000, 1001, 2000, 2001, 4000, 4001, 10000, 10001, 12000,
                  12001, 13000, 13001, 18000, 18001, 20000, 20001, 22000, 22001,
                  30000, 30001, 33000, 33001, 0xffffffff]
records = [dict(instanceId=index + 1, itemTableId=item_id, ownedQuantity=index + 2,
                battleQuantity=17, state=99) for index, item_id in enumerate(ids)]

def execute(present, bindings, zero_owned):
    global role_present, equipment
    role_present, equipment = present, bindings
    uc.mem_write(GAME, bytes(0x30000))
    write(0x633588, GAME)
    write(GAME + 0x118, ROLE)
    write(ROLE, VTABLE)
    write(VTABLE + 0x18, GETTER)
    write(VTABLE + 0x20, ARRAY_GETTER)
    write(ARRAY1, *bindings['array1'])
    write(ARRAY2, *bindings['array2'])
    write(MESSAGE + 0x10, TREE)
    write(MESSAGE, 0x5c5328)
    call(0x43c0b4, LISTENER, 0x43ed18, 0)
    assert call(read(read(LISTENER) + 0xc), LISTENER) == 0x3c8f
    assert call(read(read(MESSAGE) + 4), MESSAGE) == 0x3c8f
    assert call(0x43ca58, LISTENER) == ADAPTER
    call(0x48daa3, ADAPTER, MANAGER)
    write(TREE + 4, HEAD)
    write(HEAD, NODES, NODES, NODES + (len(records) - 1) * 0x20)
    uc.mem_write(HEAD + 0x15, b'\x01')
    for index, record in enumerate(records):
        node, record_address = NODES + index * 0x20, RECORDS + index * 0x40
        write(node, HEAD, node - 0x20 if index else HEAD,
              node + 0x20 if index + 1 < len(records) else HEAD)
        write(node + 0x10, record_address)
        write(record_address + 4, record['instanceId'])
        owned = 0 if zero_owned and index < 2 else record['ownedQuantity']
        write(record_address + 0xc, record['itemTableId'], owned)
        write(record_address + 0x1c, record['state'], record['battleQuantity'])
    # Old inventory must remain untouched when no cached role exists.
    for offset in offsets:
        base = VECTORS + offsets.index(offset) * 0x800
        write(MANAGER + offset, base, base + 4, base + 0x800)
        write(base, RECORDS)
    write(STACK, RETURN, MESSAGE, 0, 0)
    write(0, 0x12345678)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, ADAPTER)
    cleared.clear()
    warnings.clear()
    uc.emu_start(0x48b28c, RETURN, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 16
    assert read(0) == 0x12345678 and uc.reg_read(UC_X86_REG_EBP) == 0x1234
    groups = []
    for offset in offsets:
        groups.append([read(read(a) + 4) for a in range(read(MANAGER + offset), read(MANAGER + offset + 4), 4)])
    states = [read(RECORDS + index * 0x40 + 0x1c) for index in range(len(records))]
    assert all(read(RECORDS + i * 0x40 + 0x10) == (0 if zero_owned and i < 2 else r['ownedQuantity'])
               and read(RECORDS + i * 0x40 + 0x20) == r['battleQuantity'] for i, r in enumerate(records))
    return dict(groups=groups, states=states, cleared=list(cleared), warnings=list(warnings))

def instance(item_id):
    return next(record['instanceId'] for record in records if record['itemTableId'] == item_id)

bindings = [dict(array1=[0, 0, 0], array2=[0, 0, 0, 0, 0]),
            {44: instance(10001), 45: instance(13001),
             'array1': [instance(12001), 0, instance(12001)],
             'array2': [instance(13001), 0, instance(13001), 0, 99999]},
            {44: instance(2001), 45: instance(12001),
             'array1': [instance(10001), instance(20001), 99999],
             'array2': [instance(10001), instance(12001), 99999, 0, 0]}]
rows = [dict(rolePresent=present, zeroOwned=zero_owned, bindings=binding,
             result=execute(present, binding, zero_owned))
        for present in [False, True] for binding in bindings for zero_owned in [False, True]]
out = ROOT / 'recovery/output/inventory-query-native.json'
out.write_text(json.dumps(dict(scope='Original3c8f listener43c0b4/type getter, callback clone43ca58/setter48daa3/forward48b28c to43ed18, SEH57a6a8, tree increment42de86, classification43bd09/4396e0 and equipment searches. Supplied callback allocation, vector storage/append, role getters, localized warning/text backend and logging; no socket transport.', messageType=0x3c8f, records=records, rows=rows), indent=2))
print(f'PASS: {len(rows)} complete original inventory queries, {len(records)} records each, source classification and equipped-state searches')
