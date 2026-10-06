"""Execute one original inventory/profile refresh callback and texture observer32."""
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
uc.mem_map(0, 4096); uc.mem_map(0x2000000, 0x40000)
GAME, OWNER, INVENTORY, PROFILE, MESSAGE, TREE, HEAD, NODE, SKIN, ROLE, RECORD, FIELD = [0x2001000 + i * 0x1000 for i in range(12)]
STACK, RETURN, CALLBACK, HEAP = 0x2020000, 0x2021000, 0x2022000, 0x2030000
heap = HEAP
logs = []


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))


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
    if address == 0x4269c4:
        finish(PROFILE)
    elif address == 0x578620:
        count = read(stack + 4)
        pointer = heap
        heap += (count + 15) & ~15
        assert heap < 0x2040000
        finish(pointer)
    elif address in [0x57a6c7, 0x40bd28]:
        if address == 0x40bd28:
            logs.append(address)
        finish()
    elif address == CALLBACK:
        finish(2)
    elif address == 0x48a226:
        assert read(stack + 4) == 71
        finish(ROLE, 4)
    elif address == CALLBACK + 0x10:
        finish(32)
    else:
        raise AssertionError(hex(address))


for address in [0x4269c4, 0x578620, 0x57a6c7, 0x40bd28, CALLBACK, CALLBACK + 0x10, 0x48a226]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)


def execute(address, this, *args):
    write(STACK, RETURN, *args)
    uc.reg_write(UC_X86_REG_ECX, this); uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(address, RETURN, count=50000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    return uc.reg_read(UC_X86_REG_EAX)


write(0x633588, GAME); write(GAME + 0x118, OWNER)
write(PROFILE, 0x5c4118)
# Single real std::map node containing an incoming skin inventory record.
write(MESSAGE + 0x10, TREE); write(TREE + 4, HEAD)
write(HEAD, NODE, NODE, NODE)
uc.mem_write(HEAD + 0x14, bytes([1, 1]))
write(NODE, HEAD, HEAD, HEAD, 71, SKIN)
uc.mem_write(NODE + 0x14, bytes([0, 0]))
write(SKIN, 0x5c4d10)
write(SKIN + 4, 71)
write(SKIN + 0xc, 10001)  # Actual inventory item definition classifier: owned skin group3.
write(SKIN + 0x10, 1)
write(SKIN + 0x1c, 1)
write(ROLE + 0x2a0, RECORD)
rows = []
for selection in [0, 71, 72, 0xffffffff]:
    # Fresh vector storage for the complete refresh's original clear/push paths.
    uc.mem_write(INVENTORY, bytes(0x90))
    uc.mem_write(PROFILE + 0x118, bytes(0x44))
    write(PROFILE + 0x118, selection)
    write(SKIN + 0x1c, 1)
    write(RECORD + 0x110, 0x80000000, 0xf1234567, 0xffffffff)
    before = bytes(uc.mem_read(SKIN, 0x30))
    texture_before = bytes(uc.mem_read(RECORD + 0x110, 12))
    execute(0x43ed18, INVENTORY, MESSAGE, 0, 0)
    begin, end = read(INVENTORY + 0x30), read(INVENTORY + 0x34)
    assert end == begin + 4 and read(begin) == SKIN
    assert execute(0x43ccf2, INVENTORY, 71) == SKIN
    state = read(SKIN + 0x1c)
    assert state == (2 if selection == 71 else 0)
    expected = bytearray(before); struct.pack_into('<I', expected, 0x1c, state)
    assert bytes(uc.mem_read(SKIN, 0x30)) == expected
    assert texture_before == bytes(uc.mem_read(RECORD + 0x110, 12))
    rows.append(dict(selectedInstanceId=selection, instanceId=71, definitionId=10001,
                     state=state, skinVectorContainsOriginalRecord=True,
                     roleTextureUnchanged=True, recordBytes=list(expected)))

# The actual gameplay property observer has no property32 branch.
write(GAME + 0xac, 0); write(GAME + 0xe0, GAME + 0x400)
write(GAME + 0x400, GAME + 0x500); write(GAME + 0x500, GAME + 0x600)
write(GAME + 0x600 + 4, CALLBACK)
write(RECORD + 0xc, 71)
write(FIELD, FIELD + 0x100); write(FIELD + 0x100, CALLBACK + 0x10)
before_role = bytes(uc.mem_read(ROLE, 0x370))
before_record = bytes(uc.mem_read(RECORD, 0x140))
execute(0x42f385, OWNER, RECORD, FIELD, 0)
assert before_role == bytes(uc.mem_read(ROLE, 0x370))
assert before_record == bytes(uc.mem_read(RECORD, 0x140))

tables = ROOT / 'recovery/output/verified/tables'
item = next(row for row in json.loads((tables / 'item.json').read_text())['rows']
            if int(row['values']['ItemTableID']) == 10001)
assert item['values']['ItemType'] == '5'
assert item['values']['Texture3D'] == '10001A'
shop = next(row for row in json.loads((tables / 'tankshop.json').read_text())['rows']
            if int(row['values']['坦克ID']) == 1)
texture_ids = [int(shop['values'][column]) for column in
               ['默认贴图(炮塔)', '默认贴图(车身)', '默认贴图(履带)']]
assert texture_ids == [10011, 10012, 10013]
texture_table = {row['recordId']: row['values'] for row in
                 json.loads((tables / 'tanktexture.json').read_text())['rows']}
default_definitions = [dict(recordId=value, filename=texture_table[value]['文件名称'])
                       for value in texture_ids]

output = dict(status='PASS', inventoryRefreshRows=rows, property32ObserverPreservesRoleAndRecord=True,
    inventoryDefinition=item, tankShopDefaultConfiguration=dict(values=shop['values'],
        textureDefinitions=default_definitions, accountGrantOrSelectionEstablished=False),
    scope='Complete43ed18 inventory refresh, original incoming tree iterator/classifier/vector insertion, original profile selector44 and43ccf2 skin lookup; complete42f385 property32 observer. Profile-provider, allocation, diagnostic, phase/object lookup/field index boundaries supplied. Incoming inventory record is an explicit fixture, not a server authorization or skin triple producer.')
(ROOT / 'recovery/output/role-skin-producer-sol-native.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS four original inventory/profile refresh selections and full property32 observer no-op')
