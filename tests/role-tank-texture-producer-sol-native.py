"""Execute the original tankshop preview's default texture selection slice."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_EBX, UC_X86_REG_ESI, UC_X86_REG_EBP, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x50000)
GAME, RESOURCES, SHOP, TEXTURES, UI, PREVIEW, ACTOR, TANK, SHOPROW, STACK, FRAME = [0x2001000 + i * 0x1000 for i in range(11)]
TABLES = ROOT / 'recovery/output/verified/tables'
shop_rows = json.loads((TABLES / 'tankshop.json').read_text())['rows']
tanks = {row['recordId']: row['values'] for row in json.loads((TABLES / 'tank.json').read_text())['rows']}
textures = {row['recordId']: row['values'] for row in json.loads((TABLES / 'tanktexture.json').read_text())['rows']}
lookups, calls, classified = [], [], []
current = None

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def cstring(address):
    result = bytearray()
    while uc.mem_read(address, 1) != b'\0':
        result.extend(uc.mem_read(address, 1)); address += 1
    return result.decode('ascii')

def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

def boundary(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    this, key = machine.reg_read(UC_X86_REG_ECX), read(stack + 4)
    if address == 0x4b5bb8:
        pointer = read(key)
        classified.append(dict(vectorOffset=this - UI, textureId=read(pointer + 0xc)))
        end = read(this + 8)
        write(end, pointer); write(this + 8, end + 4)
        finish(0, 4)
    elif address == 0x411068:
        if this == SHOP + 0xc:
            assert key == current['recordId']
            lookups.append(dict(table='tankshop', id=key)); finish(SHOPROW, 4)
        else:
            assert this == TEXTURES + 0xc
            lookups.append(dict(table='tanktexture', id=key))
            if key not in textures:
                finish(0, 4); return
            pointer = 0x2010000 + len(lookups) * 0x100
            filename = textures[key]['文件名称'].encode('ascii')
            # Real table string layout: +30 buffer/pointer, +40 length, +44 capacity.
            if len(filename) < 16:
                uc.mem_write(pointer + 0x30, filename + b'\0'); write(pointer + 0x44, 15)
            else:
                write(pointer + 0x30, pointer + 0x80); write(pointer + 0x44, len(filename))
                uc.mem_write(pointer + 0x80, filename + b'\0')
            finish(pointer, 4)
    else:
        assert this == ACTOR
        calls.append(dict(entry=hex(address), filename=cstring(key)))
        finish(0, 4)

for address in [0x4b5bb8, 0x411068, 0x46cc73, 0x46cd15, 0x46cdb7, 0x46926a, 0x46930c]:
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)
write(0x633588, GAME); write(GAME + 0x114, RESOURCES)
write(RESOURCES + 0x98, SHOP); write(RESOURCES + 0x88, TEXTURES)
write(UI + 0x30, PREVIEW); write(PREVIEW + 0x30, ACTOR)
results = []
for current in shop_rows:
    values = current['values']; tank_id = int(values['坦克ID'])
    ids = [int(values[name]) for name in ['默认贴图(炮塔)', '默认贴图(车身)', '默认贴图(履带)']]
    tank_type = int(tanks[tank_id]['TankType'])
    write(UI + 0x1a4, tank_id); write(SHOPROW + 0x10, *ids); write(TANK + 0x50, tank_type)
    lookups.clear(); calls.clear()
    uc.reg_write(UC_X86_REG_ESI, UI); uc.reg_write(UC_X86_REG_EDI, TANK)
    uc.reg_write(UC_X86_REG_EBP, FRAME); uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x4b6db6, 0x4b6eef, count=2000)
    assert uc.reg_read(UC_X86_REG_EIP) == 0x4b6eef
    assert uc.reg_read(UC_X86_REG_ESP) == STACK
    expected_ids = ids[1:] if tank_type == 4 else ids
    assert lookups == [dict(table='tankshop', id=tank_id)] + [dict(table='tanktexture', id=value) for value in expected_ids]
    entries = [0x46926a, 0x46930c] if tank_type == 4 else [0x46cc73, 0x46cd15, 0x46cdb7]
    assert calls == [dict(entry=hex(entry), filename=textures[value]['文件名称']) for entry, value in zip(entries, expected_ids) if value in textures]
    results.append(dict(tankId=tank_id, tankType=tank_type, defaultIds=ids, lookups=list(lookups), textureCalls=list(calls)))
# Original owned-tank definition filtering and U/M/XY vector classification.
texture_pointers = []
for index, (texture_id, value) in enumerate(textures.items()):
    pointer = 0x2020000 + index * 0x80
    write(pointer + 0xc, texture_id); write(pointer + 0x48, int(value['稀有度']))
    texture_pointers.append(pointer)
write(0x2040000, *texture_pointers)
write(UI + 0x1b0, 0x2040000, 0x2040000 + len(texture_pointers) * 4)
owned_filter_results, owned_selected_results = [], []
for tank_id in tanks:
    for offset, storage in [(0x1bc, 0x2041000), (0x1d0, 0x2042000), (0x1e4, 0x2043000)]:
        write(UI + offset + 4, storage, storage, storage + 0x1000)
    write(TANK + 0x24, tank_id); write(FRAME - 0x10, TANK)
    uc.reg_write(UC_X86_REG_EAX, TANK); uc.reg_write(UC_X86_REG_ESI, UI)
    uc.reg_write(UC_X86_REG_EBP, FRAME); uc.reg_write(UC_X86_REG_ESP, STACK)
    classified.clear()
    uc.emu_start(0x4b6748, 0x4b67c0, count=20000)
    assert uc.reg_read(UC_X86_REG_EIP) == 0x4b67c0 and uc.reg_read(UC_X86_REG_ESP) == STACK
    offsets = {1: 0x1bc, 2: 0x1d0, 3: 0x1e4}
    expected = [dict(vectorOffset=offsets[texture_id % 10], textureId=texture_id)
                for texture_id, value in textures.items()
                if int(value['稀有度']) != 0 and texture_id // 10000 == tank_id and texture_id % 10 in offsets]
    assert classified == expected
    owned_filter_results.append(dict(tankDefinitionId=tank_id, classified=list(classified)))
    # Real count/index getters and comparisons against owned tank's selected IDs.
    for offset, field, start, matched in [(0x1bc, 0x28, 0x4b67d3, 0x4b6816),
                                         (0x1d0, 0x2c, 0x4b6896, 0x4b68d9),
                                         (0x1e4, 0x30, 0x4b6959, 0x4b699c)]:
        candidates = [row['textureId'] for row in classified if row['vectorOffset'] == offset]
        for index, texture_id in enumerate(candidates):
            write(TANK + field, texture_id)
            uc.reg_write(UC_X86_REG_ESI, UI); uc.reg_write(UC_X86_REG_EBP, FRAME)
            uc.reg_write(UC_X86_REG_ESP, STACK)
            uc.emu_start(start, matched, count=2000)
            assert uc.reg_read(UC_X86_REG_EIP) == matched
            assert uc.reg_read(UC_X86_REG_EBX) == index
            assert uc.reg_read(UC_X86_REG_ESP) == STACK
            owned_selected_results.append(dict(tankDefinitionId=tank_id, ownedRecordField=hex(field), textureId=texture_id, matchedIndex=index))
output = dict(status='PASS', rows=results, ownedDefinitionTextureFilters=owned_filter_results, ownedSelectedTextures=owned_selected_results,
    scope='Actual4b6748–4b67c0 owned-tank texture classification with vector insertion boundary supplied. Actual4b6db6–4b6eef tankshop preview selection; actual413d01 and413ccb resource getters. Parsed table lookup and terminal actor texture setter boundaries supplied. UI tank definition and tank-type record supplied; account grant, ownership, specialtank mapping and property32 producer not established.')
(ROOT / 'recovery/output/role-tank-texture-producer-sol-native.json').write_text(json.dumps(output, indent=2) + '\n')
print(f'PASS {len(results)} tankshop defaults, {len(owned_filter_results)} owned-definition filters, {len(owned_selected_results)} owned selected texture matches')
