"""Observe original destroy-info update and necessary local counter producer."""
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

DESTROY_INFO, MELEE_INFO = 0x2032000, 0x2032100
write(HUD + 0x670, DESTROY_INFO)
write(HUD + 0x634, MELEE_INFO)
rows = []
for mode, cats, dogs, has_input, has_hud in [(4, 9, 23, True, True), (4, 0, 12, True, True),
        (4, 9, 0, True, True), (4, 9, 23, False, True), (4, 9, 23, True, False),
        (3, 9, 23, True, True)]:
    writes.clear()
    formats.clear()
    write(HUD + 8, 1 if has_hud else 0)
    write(HUD + 0x80, mode)
    write(BULLETIN + 0xc, cats, dogs)
    write(STACK, RETURN, BULLETIN if has_input else 0)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, HUD)
    uc.emu_start(0x4cb6cb, RETURN, count=50000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    destroy_writes = [w for w in writes if w['control'] == DESTROY_INFO]
    assert destroy_writes == ([dict(control=DESTROY_INFO, text=str(cats + dogs))]
        if mode == 4 and has_input and has_hud else [])
    rows.append(dict(mode=mode, catsInfo=cats, dogsInfo=dogs, hasInput=has_input,
        hasHud=has_hud, writes=writes[:], formats=formats[:]))

# Initialize only the complete original destroy counter display block.
initial = []
for cats, dogs in [(9, 23), (0, 12)]:
    writes.clear()
    formats.clear()
    write(HUD + 0x38, cats, dogs)
    uc.reg_write(UC_X86_REG_EBP, FRAME)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ESI, HUD)
    uc.reg_write(UC_X86_REG_EDI, TEXT)
    uc.reg_write(UC_X86_REG_EBX, DESTROY)
    uc.emu_start(0x4d2e07, 0x4d2e4c, count=200)
    assert writes == [dict(control=DESTROY_INFO, text=str(cats))]
    initial.append(dict(catsInfo=cats, dogsInfo=dogs, writes=writes[:], formats=formats[:]))

ROOM_SERVICE, ROOM_LINK, ROOM, OBSERVER, OBSERVER_VTABLE, NOTIFY = [
    0x2024000 + i * 0x1000 for i in range(6)]
write(ROLE, VTABLE)
write(VTABLE + 0x14, 0x422b64)
write(ROOM_SERVICE + 0x28, ROOM_LINK)
write(ROOM_LINK + 4, ROOM)
write(ROOM + 0x38, 4)
write(ROOM_SERVICE + 0x30, BULLETIN)
write(ROOM_SERVICE + 0x54, OBSERVER)
write(OBSERVER, OBSERVER_VTABLE)
write(OBSERVER_VTABLE + 8, NOTIFY)
notifications = []
def notify_hook(machine, address, size, data):
    notifications.append(dict(catsInfo=read(BULLETIN + 0xc), dogsInfo=read(BULLETIN + 0x10)))
    finish(4)
uc.hook_add(UC_HOOK_CODE, notify_hook, begin=NOTIFY, end=NOTIFY)
producer = []
for current_cats, role_count in [(1, 7), (7, 7)]:
    notifications.clear()
    write(BULLETIN + 0xc, current_cats, 23)
    write(ROLE + 0x314, role_count)
    write(STACK, RETURN)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, ROOM_SERVICE)
    uc.emu_start(0x436307, RETURN, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert read(BULLETIN + 0xc) == role_count and read(BULLETIN + 0x10) == 23
    assert len(notifications) == int(current_cats != role_count)
    producer.append(dict(catsBefore=current_cats, roleCounter=role_count,
        catsAfter=read(BULLETIN + 0xc), dogsAfter=read(BULLETIN + 0x10), notifications=notifications[:]))

layout_path = ROOT / 'recovery/output/verified/assets/data/Data/ui/layouts/game_main_info_destroy.xml'
layout = ET.parse(layout_path).getroot()
controls = {w.get('Name'): {p.get('Name'): p.get('Value') for p in w.findall('Property')}
    for w in layout.iter('Window')}
binary = images['cdtank.exe'].get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [(0x4ca1fa, 0x4ca234), (0x4cb6cb, 0x4cb773), (0x4cbb19, 0x4cbb8d),
    (0x4d2e07, 0x4d2e4c), (0x436307, 0x43638f), (0x422b64, 0x422b88),
    (0x424807, 0x424813)]
result = dict(status='PASS', callback='0x4cb6cb', controls=controls, updates=rows,
    initialDisplay=initial, localCounterProducer=producer, controlOffset='0x670',
    sourceFields=dict(catsInfo='OdlBattlefieldBulletin +0xc (m_iCatsInfo)',
        dogsInfo='OdlBattlefieldBulletin +0x10 (m_iDogsInfo)'),
    schemaEvidence='recovery/output/bulletin-schema.json',
    conclusion='Destroy update displays CatsInfo + DogsInfo; initialization displays CatsInfo alone. Local role +0x314 / attribute 0x15 overwrites CatsInfo in mode 4.',
    execution='Complete original update callback and local bulletin updater/getter; exact initialization display block. Notification/GUI boundaries supplied; formatting hook consumes original %d and signed integer.',
    unproven=['DogsInfo mode-4 producer', 'Role+0x314 increment trigger/object type',
        'Original remaining-target or global destroyed-target meaning', 'Reconstructed destroy objectives to Info mapping'],
    disassembly={hex(a): [f'{i.address:08x} {i.mnemonic} {i.op_str}'
        for i in md.disasm(binary[a - 0x400000:z - 0x400000], a)] for a, z in ranges})
out = ROOT / 'recovery/output/destroy-info-source.json'
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: destroy sum consumer, CatsInfo-only initialization and local role counter producer')
