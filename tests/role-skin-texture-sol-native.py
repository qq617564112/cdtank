"""Execute original role001 skin dispatch and actor render texture override."""
import configparser
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from mv3 import read_mv3

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll'])
uc.mem_map(0x2000000, 0x30000)
uc.mem_map(0, 0x1000)
uc.mem_map(0x2040000, 0x400000)
ROLE, VIEW, VECTOR, ROW, STRING = 0x2000000, 0x2001000, 0x2002000, 0x2003000, 0x2004000
MANAGER, TEXMAN, TABLE = 0x2005000, 0x2006000, 0x2007000
ACTORS = [0x2008000 + i * 0x1000 for i in range(4)]
STACK, RETURN = 0x2020000, 0x2021000
CALLBACK = 0x2022000
paths, requests, uploads, submissions = [], [], [], []
texture_handles = {}
current = None
opened_dds = []
selected = {entry['key']: entry for entry in json.loads(
    (ROOT / 'recovery/output/catalog/inventory.json').read_text())}


def u32(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def write32(address, value):
    uc.mem_write(address, struct.pack('<I', value))


def cstring(address):
    result = bytearray()
    while uc.mem_read(address, 1) != b'\0':
        result.extend(uc.mem_read(address, 1))
        address += 1
    return result.decode('ascii')


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, u32(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def callback(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == CALLBACK:
        assert machine.reg_read(UC_X86_REG_ECX) == ROLE and u32(stack + 4) == 3
        finish(VECTOR, 4)
    elif address == CALLBACK + 0x10:
        assert machine.reg_read(UC_X86_REG_ECX) == VIEW
        finish(0)  # Source role001 has four M/U/X/Y INI actors.
    elif address == 0x411068:
        requests.append(u32(stack + 4))
        assert u32(stack + 4) == current['recordId']
        assert machine.reg_read(UC_X86_REG_ECX) == TABLE + 0xc
        finish(ROW, 4)
    elif address == 0x57c0d6:
        dest, capacity, fmt, directory, filename = struct.unpack('<5I', uc.mem_read(stack + 4, 20))
        assert cstring(fmt) == 'data\\role\\%s\\%s' and cstring(directory) == '001'
        text = cstring(fmt) % (cstring(directory), cstring(filename))
        assert len(text) + 1 < capacity
        uc.mem_write(dest, text.encode() + b'\0')
        finish(len(text))
    elif address == CALLBACK + 0x20:
        assert machine.reg_read(UC_X86_REG_ECX) == TEXMAN
        path = cstring(u32(stack + 4))
        paths.append(path)
        if path not in texture_handles:
            texture_handles[path] = 0x2010000 + len(texture_handles) * 0x100
            handle = texture_handles[path]
            write32(handle, handle + 0x80)
            write32(handle + 0x80 + 0x10, CALLBACK + 0x60)
            name_address = 0x2018000 + len(texture_handles) * 0x100
            uc.mem_write(name_address, path.encode() + b'\0')
            write32(handle + 0x50, name_address)
        uc.mem_write(texture_handles[path] + 0xc, b'\0')
        finish(texture_handles[path], 4)
    elif address == 0x1002b160:
        uploads.append(dict(texture=machine.reg_read(UC_X86_REG_ECX), flag=u32(stack + 4)))
        assert u32(stack + 4) == 1
        # Run the complete original texture loader, including its .dds lookup.
    elif address == CALLBACK + 0x40:
        finish(u32(machine.reg_read(UC_X86_REG_ECX)))
    elif address == CALLBACK + 0x50:
        text, char = struct.unpack('<2I', uc.mem_read(stack + 4, 8))
        index = cstring(text).rfind(chr(char))
        finish(text + index if index >= 0 else 0)
    elif address == 0x1003c170:
        destination, source = struct.unpack('<2I', uc.mem_read(stack + 4, 8))
        uc.mem_write(destination, cstring(source).encode() + b'\0')
        finish(destination)
    elif address == 0x10035810:
        name, flags = struct.unpack('<2I', uc.mem_read(stack + 4, 8))
        assert flags == 0x201
        key = cstring(name).replace('\\', '/').lower().removeprefix('data/')
        assert key.endswith('.dds') and key in selected
        payload = (ROOT / selected[key]['selected']['source']).read_bytes()
        assert payload[:4] == b'DDS '
        opened_dds.append(dict(key=key, bytes=len(payload)))
        uc.mem_write(0x2040000, payload)
        write32(0x200f000 + 0x130, 0x2040000)
        finish(0x200f000, 8)
    elif address == 0x10035e00:
        finish(opened_dds[-1]['bytes'], 4)
    elif address == 0x100359f0:
        finish(0, 4)
    elif address == CALLBACK + 0x60:
        memory, size = struct.unpack('<2I', uc.mem_read(stack + 4, 8))
        assert memory == 0x2040000 and size == opened_dds[-1]['bytes']
        finish(0, 8)
    elif address in [0x10031350, 0x10031380]:
        finish()
    elif address == 0x100313c0:
        finish(0, 4)
    elif address == CALLBACK + 0x30:
        actor, scene, texture = struct.unpack('<3I', uc.mem_read(stack + 4, 12))
        submissions.append(dict(actor=actor, scene=scene, texture=texture))
        finish(0, 12)
    else:
        raise AssertionError(hex(address))


for address in [CALLBACK, CALLBACK + 0x10, CALLBACK + 0x20, CALLBACK + 0x30,
                CALLBACK + 0x40, CALLBACK + 0x50, CALLBACK + 0x60,
                0x1003c170, 0x10035810, 0x10035e00, 0x100359f0,
                0x411068, 0x57c0d6, 0x1002b160, 0x10031350, 0x10031380, 0x100313c0]:
    uc.hook_add(UC_HOOK_CODE, callback, begin=address, end=address)
write32(0x1003f140, CALLBACK + 0x40)
write32(0x1003f2d4, CALLBACK + 0x50)
# Original manager getter 413ccb remains executable.
write32(0x633588, MANAGER)
write32(MANAGER + 0x114, MANAGER + 0x400)
write32(MANAGER + 0x400 + 0x88, TABLE)
write32(0x635830, MANAGER)
write32(MANAGER + 8, TEXMAN)
write32(TEXMAN, TEXMAN + 0x100)
write32(TEXMAN + 0x100 + 8, CALLBACK + 0x20)
write32(ROLE, ROLE + 0x400)
write32(ROLE + 0x400 + 0x20, CALLBACK)
write32(ROLE + 0x310, VIEW)
write32(VIEW, VIEW + 0x400)
write32(VIEW + 0x400 + 0x54, CALLBACK + 0x10)
uc.mem_write(VIEW + 0x70, b'001\0')
write32(VIEW + 0x84, 15)
for index, actor in enumerate(ACTORS):
    write32(VIEW + 0x2a8 + index * 4, actor)
# Minimal gfx and actor source render interface, with original actor render code.
write32(0x10055d14, MANAGER)
write32(MANAGER + 0xd4, MANAGER + 0x800)
for actor in ACTORS:
    write32(actor + 0x7c, actor + 0x200)
    write32(actor + 0x200, actor + 0x300)
    write32(actor + 0x300 + 0x18, CALLBACK + 0x30)


def execute(address, this, argument):
    uc.mem_write(STACK, struct.pack('<II', RETURN, argument))
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(address, RETURN, count=20000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8


inventory = json.loads((ROOT / 'recovery/output/catalog/inventory.json').read_text())
selected = {entry['key']: entry for entry in inventory}
table = json.loads((ROOT / 'recovery/output/verified/tables/tanktexture.json').read_text())
rows = [row for row in table['rows'] if row['values']['文件名称'].startswith('001')]
evidence = []
for current in rows:
    filename = current['values']['文件名称']
    lane = 1 if filename.startswith('001M_') else 0 if filename.startswith('001U_') else 2
    uc.mem_write(VECTOR, struct.pack('<3I', *[current['recordId'] if i == lane else 0 for i in range(3)]))
    uc.mem_write(STRING, filename.encode() + b'\0')
    if len(filename) < 16:
        uc.mem_write(ROW + 0x30, filename.encode() + b'\0')
        write32(ROW + 0x44, 15)
    else:
        write32(ROW + 0x30, STRING)
        write32(ROW + 0x44, len(filename))
    # Fresh resource handles avoid exercising backend release in this scoped test.
    for offset in [0x358, 0x35c, 0x360, 0x364]:
        write32(VIEW + offset, 0)
    for actor in ACTORS:
        write32(actor + 0xa8, 0)
    paths.clear(); requests.clear(); uploads.clear(); submissions.clear(); opened_dds.clear()
    execute(0x43c8aa, 0, ROLE)
    assert requests == [current['recordId']]
    expected = 'data\\role\\001\\' + filename
    assert paths == ([expected] if lane != 2 else [expected, expected[:-5] + 'B.tga'])
    component_indexes = [0] if lane == 1 else [1] if lane == 0 else [2, 3]
    for index in component_indexes:
        assert u32(ACTORS[index] + 0xa8) == texture_handles[expected]
        execute(0x10009f80, ACTORS[index], ROLE)
    assert [s['texture'] for s in submissions] == [texture_handles[expected]] * len(component_indexes)
    resolved = []
    for path in paths:
        key = path.replace('\\', '/').lower().removeprefix('data/')
        key = str(Path(key).with_suffix('.dds'))
        assert key in selected and Path(ROOT / selected[key]['selected']['source']).is_file()
        resolved.append(key)
    assert [opened['key'] for opened in opened_dds] == resolved
    evidence.append(dict(recordId=current['recordId'], filename=filename, lane=lane,
                         paths=list(paths), selectedTextures=resolved,
                         originalDdsLookups=list(opened_dds),
                         actors=['M', 'U', 'X', 'Y'], appliedComponents=[['M', 'U', 'X', 'Y'][i] for i in component_indexes],
                         renderSubmissions=list(submissions)))

uc.mem_write(VECTOR, b'\0' * 12)
for actor in ACTORS:
    write32(actor + 0xa8, 0x12345678)
paths.clear(); requests.clear(); opened_dds.clear()
execute(0x43c8aa, 0, ROLE)
assert not paths and not requests and not opened_dds
assert all(u32(actor + 0xa8) == 0x12345678 for actor in ACTORS)

# Associate confirmed component overrides to legacy names through the actual INIs.
legacy = []
source_root = ROOT / 'recovery/output/verified/assets/data/Data/role/001'
for part, old_name in [('M', 'dipan.TGA'), ('U', 'pao.TGA'), ('X', 'lvdai.TGA'), ('Y', 'lvdai.TGA')]:
    ini = source_root / f'001{part}.ini'
    config = configparser.ConfigParser()
    config.read(ini, encoding='gbk')
    for section in config.sections():
        filename = config[section]['file']
        source = next(path for path in source_root.iterdir() if path.name.lower() == filename.lower())
        model = read_mv3(source)
        for index, material in enumerate(model['materials']):
            if material['textures'][0] == old_name:
                legacy.append(dict(component=part, ini=ini.relative_to(ROOT).as_posix(),
                    section=section, model=source.relative_to(source_root).as_posix(), material=index,
                    sourceTexture=old_name, overrideScope='actor-component-selected-skin',
                    confirmedSelectionRecordId=10012 if part == 'M' else 10011 if part == 'U' else 10013))
assert len(legacy) == 20
output = dict(status='PASS', scope='Complete43c8aa dispatch, original413ccb getter, original component path/load/setter, complete1002b160 DDS filename replacement/load and actor render to source virtual submission; table lookup, CRT/string, selected file bytes, D3D upload and gfx stack supplied at boundaries.',
              skinRows=evidence, legacyReferences=legacy,
              emptySelectionPreservesActorTextures=True,
              runtimeAcceptance='not-established-by-native-contract')
(ROOT / 'recovery/output/role-skin-texture-sol-native.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(f'PASS {len(rows)} role001 selected skin rows, {sum(len(row["paths"]) for row in evidence)} texture paths, {len(legacy)} legacy references and actor render override submissions')
