"""Observe original team-info update and self-side selection instructions."""
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET

import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x50000)
HUD, BULLETIN, ROLE, ATTR, VTABLE, FRAME, STACK, RETURN = [
    0x2001000 + i * 0x2000 for i in range(8)]
GETTER = 0x2030000
STR, TEXT, DESTROY = 0x2030100, 0x2030200, 0x2030300
SELF, ENEMY, OTHER_SELF, OTHER_ENEMY = [0x2031000 + i * 0x100 for i in range(4)]
strings, writes, formats = {}, [], []

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def cstring(address):
    return bytes(uc.mem_read(address, 256)).split(b'\0')[0].decode('ascii')

def finish(pop=0, value=0):
    sp = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(sp))
    uc.reg_write(UC_X86_REG_ESP, sp + 4 + pop)

def hook(machine, address, size, data):
    sp, this = machine.reg_read(UC_X86_REG_ESP), machine.reg_read(UC_X86_REG_ECX)
    if address == 0x4269c4:
        finish(value=ROLE)
    elif address == GETTER:
        finish(4)
    elif address == 0x4d6541:
        finish()
    elif address == 0x57c0d6:
        dest, capacity, fmt, raw = [read(sp + n * 4) for n in range(1, 5)]
        template = cstring(fmt)
        value = struct.unpack('<i', struct.pack('<I', raw))[0]
        formatted = template % value
        assert len(formatted) < capacity
        machine.mem_write(dest, formatted.encode() + b'\0')
        formats.append(dict(address=hex(fmt), template=template, value=value, text=formatted))
        finish(value=len(formatted))
    elif address == STR:
        strings[this] = cstring(read(sp + 4))
        finish(4, this)
    elif address == TEXT:
        writes.append(dict(control=this, text=strings[read(sp + 4)]))
        finish(4)
    elif address == DESTROY:
        finish()

for address in [0x4269c4, GETTER, 0x4d6541, 0x57c0d6, STR, TEXT, DESTROY]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
write(0x633588, 0x2021000)
write(0x2021000 + 0x118, 0x2022000)
write(ROLE + 0x310, ATTR)
write(ATTR, VTABLE)
write(VTABLE + 0x1c, GETTER)
for address, stub in [(0x5c03b8, STR), (0x5c0240, TEXT), (0x5c0330, DESTROY)]:
    write(address, stub)
for offset, control in [(0x640, SELF), (0x644, ENEMY), (0x660, OTHER_SELF), (0x664, OTHER_ENEMY)]:
    write(HUD + offset, control)

rows = []
cases = [(0, flag, cats, dogs, True, True) for flag in [0, 1] for cats, dogs in [(9, 23), (0, 12)]]
cases += [(0, 1, 9, 23, False, True), (0, 1, 9, 23, True, False), (1, 1, 9, 23, True, True)]
for mode, flag, cats, dogs, has_input, has_hud in cases:
    writes.clear()
    formats.clear()
    write(HUD + 8, 1 if has_hud else 0)
    write(HUD + 0x80, mode)
    uc.mem_write(HUD + 0x932, bytes([flag]))
    write(BULLETIN + 0xc, cats, dogs)
    write(STACK, RETURN, BULLETIN if has_input else 0)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, HUD)
    uc.emu_start(0x4cb6cb, RETURN, count=50000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    team_writes = [w for w in writes if w['control'] in [SELF, ENEMY]]
    expected = []
    if mode == 0 and has_input and has_hud:
        expected = [dict(control=SELF if flag else ENEMY, text=str(cats)),
            dict(control=ENEMY if flag else SELF, text=str(dogs))]
        assert read(HUD + 0x38) == cats and read(HUD + 0x3c) == dogs
    assert team_writes == expected
    rows.append(dict(mode=mode, selfSideFlag=flag, catsInfo=cats, dogsInfo=dogs,
        hasInput=has_input, hasHud=has_hud, writes=writes[:], formats=formats[:]))

sides = []
for team_attribute, side_offset in [(1, 0x40), (2, 0x58)]:
    write(HUD + 0x40, 100, 101, 0x1234, 103, 104, 105)
    write(HUD + 0x58, 200, 201, 0x1234, 203, 204, 205)
    write(FRAME - 0x34, team_attribute)
    uc.reg_write(UC_X86_REG_EBP, FRAME)
    uc.reg_write(UC_X86_REG_ESI, HUD)
    uc.reg_write(UC_X86_REG_EAX, 0x1234)
    uc.emu_start(0x4d0618, 0x4d0670, count=100)
    flag = bytes(uc.mem_read(HUD + 0x932, 1))[0]
    assert flag == (1 if team_attribute == 1 else 0)
    assert read(HUD + side_offset) == 0x1234
    sides.append(dict(roleTeamAttribute=team_attribute, selectedRosterOffset=hex(side_offset), selfSideFlag=flag))

layout_path = ROOT / 'recovery/output/verified/assets/data/Data/ui/layouts/game_main_info_team.xml'
layout = ET.parse(layout_path).getroot()
controls = {w.get('Name'): {p.get('Name'): p.get('Value') for p in w.findall('Property')}
    for w in layout.iter('Window')}
binary = images['cdtank.exe'].get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [(0x4c9e3a, 0x4c9eae), (0x4cb6cb, 0x4cb88b), (0x4cbb5d, 0x4cbb8d),
    (0x4d05bd, 0x4d0670), (0x4d25f9, 0x4d271f)]
result = dict(status='PASS', callback='0x4cb6cb', controls=controls, requests=rows, sideSelection=sides,
    controlOffsets=dict(txtSelfInfo='0x640', txtEnemyInfo='0x644'),
    sourceFields=dict(catsInfo='OdlBattlefieldBulletin +0xc (m_iCatsInfo)',
        dogsInfo='OdlBattlefieldBulletin +0x10 (m_iDogsInfo)'),
    schemaEvidence='recovery/output/bulletin-schema.json',
    execution='Complete original update callback. Role/attribute notification and CEGUI boundaries supplied; formatting hook consumes the original %d template and signed integer argument. Side-selection block executed separately.',
    unproven=['Team-mode Info upstream production, life-count meaning and exhaustion/settlement rule',
        'Reconstructed teamLives to original CatsInfo/DogsInfo binding'],
    disassembly={hex(a): [f'{i.address:08x} {i.mnemonic} {i.op_str}'
        for i in md.disasm(binary[a - 0x400000:z - 0x400000], a)] for a, z in ranges})
out = ROOT / 'recovery/output/team-info-source.json'
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: complete team-info callback, %d formatting, self/enemy mapping and gates')
