"""Execute the original SelectMode preview producer and resolve published assets."""
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET

import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EBX
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x40000)
CONTROLLER, VECTOR, RECORD, FRAME, STACK = [0x2001000 + n * 0x2000 for n in range(5)]
strings, captured = {}, []


def write(address, value):
    uc.mem_write(address, struct.pack('<I', value))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def cstring(address):
    return bytes(uc.mem_read(address, 256)).split(b'\0')[0].decode('ascii')


def finish(pop=0, value=0):
    sp = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(sp))
    uc.reg_write(UC_X86_REG_ESP, sp + 4 + pop)


stubs = {0x2030000: 0x5c0340, 0x2030100: 0x5c0134}
for stub, imported in stubs.items():
    write(imported, stub)
    uc.mem_write(stub, b'\xc3')


def hook(machine, address, size, data):
    sp = machine.reg_read(UC_X86_REG_ESP)
    this = machine.reg_read(UC_X86_REG_ECX)
    if address == 0x43c0a1:
        finish(value=16)
    elif address == 0x57c0d6:
        dest, capacity, fmt, raw = [read(sp + n * 4) for n in range(1, 5)]
        value = cstring(fmt).replace('%.4d', '%04d') % raw
        assert len(value) < capacity
        machine.mem_write(dest, value.encode() + b'\0')
        captured.append({'kind': 'format', 'mapId': raw, 'image': value})
        finish(value=len(value))
    elif address in stubs:
        if stubs[address] == 0x5c0340:
            strings[this] = cstring(read(sp + 4))
            finish(4, this)
        else:
            captured.append({'kind': 'setImage', 'target': this,
                             'imageset': strings[read(sp + 4)],
                             'image': strings[read(sp + 8)]})
            finish(8)


uc.hook_add(UC_HOOK_CODE, hook)
ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
source_root = ROOT / 'recovery/output/verified/assets/data/Data'
layouts = []
resources = []
for name in ['selectgamemode.xml', 'selectgamemode_icon.xml']:
    xml = ET.parse(source_root / 'ui/layouts' / name)
    published = next(layout for layout in ui['layouts'] if layout['path'] == f'ui/layouts/{name}')
    windows = []
    for window in xml.iter('Window'):
        props = {prop.attrib['Name']: prop.attrib['Value'] for prop in window.findall('Property')}
        counterpart = next(w for w in published['windows'] if w['name'] == window.attrib['Name'])
        assert counterpart['properties'] == props
        windows.append({'name': window.attrib['Name'], 'type': window.attrib['Type'],
                        'rect': props.get('AbsoluteRect'), 'image': props.get('Image')})
        for prop, ref in props.items():
            if ref.startswith('set:'):
                set_name, image_name = ref[4:].split(' image:', 1)
                matches = [{'imagesetPath': s['path'], **image} for s in ui['imagesets']
                           if s['attributes']['Name'] == set_name for image in s['images']
                           if image['Name'] == image_name]
                assert matches and all((ROOT / 'recovery/output/web-assets' / m['asset']).is_file() for m in matches)
                resources.append({'window': window.attrib['Name'], 'property': prop,
                                  'reference': ref, 'matches': matches})
    layouts.append({'path': f'ui/layouts/{name}', 'windows': windows})

previews, executions = [], []
for mode in range(1, 6):
    table = json.loads((ROOT / f'recovery/output/verified/tables/m00{mode}.json').read_text())
    for row in table['rows']:
        map_id = int(row['values']['MapID'])
        image_name = f'data\\ui\\xiaoditu\\{map_id:04d}.tga'
        matches = [{'imagesetPath': s['path'], **image} for s in ui['imagesets']
                   if s['attributes']['Name'] == 'xiaoditu0' for image in s['images']
                   if image['Name'] == image_name]
        assert matches and all((ROOT / 'recovery/output/web-assets' / m['asset']).is_file() for m in matches)
        assert all((m['Width'], m['Height']) == ('106', '86') for m in matches)
        previews.append({'mode': mode, 'mapId': map_id, 'mapName': row['values']['MapName'],
                         'imageset': 'xiaoditu0', 'image': image_name, 'matches': matches})
        for slot in range(8):
            strings.clear()
            captured.clear()
            write(CONTROLLER + 0x20, 1)
            write(CONTROLLER + 0x24, mode - 1)
            write(CONTROLLER + 0x2c + 16 * (mode - 1), VECTOR)
            for index in range(16):
                write(VECTOR + 4 * index, RECORD)
            write(RECORD + 0xc, map_id)
            target = 0x2020000 + 0x100 * slot
            write(CONTROLLER + 0xbc + 4 * slot, target)
            write(FRAME - 0x34, 0x5cce10)
            for reg, value in [(UC_X86_REG_ESI, CONTROLLER), (UC_X86_REG_EBX, slot),
                               (UC_X86_REG_EBP, FRAME), (UC_X86_REG_ESP, STACK)]:
                uc.reg_write(reg, value)
            uc.emu_start(0x4a5c6e, 0x4a5d04, count=500)
            assert uc.reg_read(UC_X86_REG_ESP) == STACK
            assert read(FRAME - 0x20) == 8 + slot
            assert captured == [{'kind': 'format', 'mapId': map_id, 'image': image_name},
                                {'kind': 'setImage', 'target': target, 'imageset': 'xiaoditu0',
                                 'image': image_name}]
            executions.append({'mode': mode, 'mapId': map_id, 'slot': slot, 'page': 1,
                               'vectorIndex': read(FRAME - 0x20), 'calls': list(captured)})

md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
disassembly = {}
for label, start, end in [('producer', 0x4a5c6e, 0x4a5d04),
                           ('slot0Binding', 0x4a4b60, 0x4a4b94),
                           ('slot7Binding', 0x4a4cfc, 0x4a4d2a)]:
    disassembly[label] = [f'{i.address:08x} {i.mnemonic} {i.op_str}'
                          for i in md.disasm(bytes(uc.mem_read(start, end - start)), start)]
output = {'result': 'PASS', 'source': 'CDTank/CDTank.exe', 'producer': '0x4a5c12',
          'executedRange': ['0x4a5c6e', '0x4a5d04'],
          'formatAddress': '0x5ccdf4', 'format': cstring(0x5ccdf4),
          'imagesetAddress': '0x5cce10', 'layouts': layouts, 'staticResources': resources,
          'previews': previews, 'executions': executions, 'disassembly': disassembly,
          'limitations': ['Map records and mode vectors are supplied at the producer input; '
                          'the upstream table loader and complete selection callback are not executed.',
                          'Formatting and CEGUI string/setImage imports are hooked.']}
path = ROOT / 'recovery/output/room-map-selector-source.json'
path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: {len(previews)} mode/map previews, {len(executions)} native producer executions, '
      f'{len(resources)} static resource references; {path}')
