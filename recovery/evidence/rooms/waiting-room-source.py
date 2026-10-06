"""Observe original waiting-room roster loads, tank images and readiness display."""
import json
from pathlib import Path
import re
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
uc.mem_map(0x2000000, 0x50000)
CONTROLLER, ROOM, ROLE, DEFINITION, FRAME, STACK = [0x2001000 + i * 0x2000 for i in range(6)]
strings, calls = {}, []

def write(address, value):
    uc.mem_write(address, struct.pack('<I', value & 0xffffffff))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def cstring(address):
    return bytes(uc.mem_read(address, 256)).split(b'\0')[0].decode('ascii')

def finish(pop=0, value=0):
    sp = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(sp))
    uc.reg_write(UC_X86_REG_ESP, sp + 4 + pop)

stubs = {0x2030000 + i * 0x100: a for i, a in enumerate([0x5c03b8, 0x5c0330, 0x5c0134])}
for stub, address in stubs.items():
    write(address, stub)
    uc.mem_write(stub, b'\xc3')

def hook(machine, address, size, data):
    sp = machine.reg_read(UC_X86_REG_ESP)
    this = machine.reg_read(UC_X86_REG_ECX)
    if address == 0x48a226:
        calls.append(dict(kind='roleLookup', roleId=read(sp + 4)))
        machine.emu_stop()
    elif address == 0x43293d:
        calls.append(dict(kind='roleStatus', value=read(ROLE + 0x90)))
        finish(value=read(ROLE + 0x90))
    elif address == 0x57c0d6:
        dest, capacity, fmt, raw = [read(sp + n * 4) for n in range(1, 5)]
        value = cstring(fmt).replace('%.3d', '%03d') % raw
        assert len(value) < capacity
        machine.mem_write(dest, value.encode() + b'\0')
        calls.append(dict(kind='format', definitionId=raw, image=value))
        finish(value=len(value))
    elif address in stubs:
        imported = stubs[address]
        if imported == 0x5c03b8:
            strings[this] = cstring(read(sp + 4))
            finish(4, this)
        elif imported == 0x5c0134:
            calls.append(dict(kind='setImage', control=this,
                imageset=strings[read(sp + 4)], image=strings[read(sp + 8)]))
            finish(8)
        else:
            finish()

uc.hook_add(UC_HOOK_CODE, hook)

def prepare(slot):
    calls.clear()
    strings.clear()
    write(FRAME + 8, ROOM)
    write(FRAME - 0x14, ROLE)
    write(FRAME - 0x40, 0x5cdde0)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, FRAME)
    uc.reg_write(UC_X86_REG_EBX, CONTROLLER)
    uc.reg_write(UC_X86_REG_ESI, ROLE)
    uc.reg_write(UC_X86_REG_EDI, slot % 6)

roster = []
for slot in range(12):
    prepare(slot)
    offset = 0x1c + slot * 4
    write(ROOM + offset, 100 + slot)
    uc.emu_start(0x50df51 if slot < 6 else 0x50e3cd, 0x50e850, count=30)
    assert calls == [dict(kind='roleLookup', roleId=100 + slot)]
    roster.append(dict(slot=slot, side='left' if slot < 6 else 'right',
        roomOffset=hex(offset), calls=list(calls)))

ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
tankset = next(s for s in ui['imagesets'] if s['attributes']['Name'] == 'tanke0')
tank_assets = []
for entry in tankset['images']:
    match = re.search(r'\\(\d+)\.tga$', entry['Name'])
    if match:
        tank_assets.append(dict(definitionId=int(match.group(1)), image=entry['Name'], asset=entry['asset']))
assert tank_assets
icons = []
for slot in range(12):
    for asset in tank_assets:
        prepare(slot)
        write(ROLE + 0x2a8, DEFINITION)
        write(DEFINITION + 0xc, asset['definitionId'])
        target = CONTROLLER + 0x800 + slot * 0x40
        write(CONTROLLER + 0xfc + slot * 4, target)
        uc.emu_start(0x50e14d if slot < 6 else 0x50e5cc,
                     0x50e1dc if slot < 6 else 0x50e65e, count=150)
        assert calls[-1] == dict(kind='setImage', control=target, imageset='tanke0', image=asset['image'])
        icons.append(dict(slot=slot, definitionId=asset['definitionId'], calls=list(calls), asset=asset['asset']))

ready = []
for status in [0, 1, 2]:
    prepare(0)
    write(ROLE + 0x90, status)
    uc.emu_start(0x50e23a, 0x50e248, count=30)
    assert uc.reg_read(UC_X86_REG_EAX) & 0xff == int(status == 1)
    ready.append(dict(status=status, visible=bool(status == 1), calls=list(calls)))

layout_path = ROOT / 'recovery/output/verified/assets/data/Data/ui/layouts/room_main.xml'
layout = ET.parse(layout_path).getroot()
controls = {w.get('Name'): {p.get('Name'): p.get('Value') for p in w.findall('Property')}
    for w in layout.iter('Window')}
selected = {n: p for n, p in controls.items() if re.fullmatch(r'(PlayerPanel|picReady|picPlayerTank|txtPlayerName)\d+', n)
    or n in ['btnReady', 'btnCancel', 'btnCatTeam', 'btnDogTeam']}
assert len([n for n in selected if n.startswith('PlayerPanel')]) == 12
pe = images['cdtank.exe']
binary = pe.get_memory_mapped_image()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [(0x50a209, 0x50a277), (0x50a6a7, 0x50a6e1), (0x50ac17, 0x50ac51),
    (0x50b6f7, 0x50b731), (0x50df45, 0x50df65), (0x50e14d, 0x50e1dc),
    (0x50e21f, 0x50e24e), (0x50e304, 0x50e321), (0x50e3cd, 0x50e3e3),
    (0x50e67c, 0x50e6d2), (0x50e786, 0x50e799), (0x50e877, 0x50e954)]
result = dict(status='PASS', layout=str(layout_path.relative_to(ROOT)), controls=selected,
    roster=roster, tankImages=icons, readyFallback=ready,
    controlOffsets=dict(PlayerPanel='0x9c + 4*N', picPlayerIcon='0xcc + 4*N',
        picPlayerTank='0xfc + 4*N', txtPlayerName='0x15c + 4*N', picReady='0x1bc + 4*N',
        btnCatTeam='0x50', btnDogTeam='0x54', btnReady='0x90', btnCancel='0x94'),
    readinessConfirmationEvidence='recovery/output/room-start-rules-sol-native.json',
    execution='Bounded original instructions; role lookup observed then stopped; string and GUI imports hooked. No full CEGUI execution.',
    unproven=['Upstream construction/order of room +0x1c/+0x34 roster arrays and their numeric team encoding',
        'Upstream role +0x2a8 tank-definition binding for reconstructed network players'],
    disassembly={hex(a): [f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(binary[a-0x400000:z-0x400000], a)] for a,z in ranges})
out = ROOT / 'recovery/output/waiting-room-source.json'
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: 12 roster positions, {len(icons)} original tank-image selections, three readiness predicates')
