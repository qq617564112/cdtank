"""Verify GBF registration, explicit states, and executed native selectors."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_ESI

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_rendering import parse_gbf, sprite_selector

library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
rendering = library['rendering']
scripts = rendering['scripts']
names = ['AlphaBlend', 'AlphaAdd', 'AlphaBlend_Z', 'AlphaAdd_Z', 'ScreenBlend',
         'ScreenAdd', 'AlphaAdd_NoCull', 'AlphaAdd_Z_NoCull', 'AlphaBlend_NoCull',
         'AlphaBlend_Z_NoCull', 'AlphaBlend_Z_NoCull_Cylinder']
assert [Path(s['source']).stem for s in scripts] == names
assert [s['index'] for s in scripts] == list(range(11))
for script in scripts:
    source = ROOT / 'recovery/output/verified/assets/data' / script['source']
    raw = source.read_bytes()
    assert sha256(raw).hexdigest() == script['sourceSha256']
    assert parse_gbf(raw.decode('ascii')) == script['techniques']
    assert len(script['techniques']) == 1
    passes = script['techniques'][0]['passes']
    assert len(passes) == (2 if script['index'] == 10 else 1)
    for entry in passes:
        states = {s['name']: s['value'] for s in entry['states']}
        assert states['Lighting'] == 'FALSE'
        assert states['ColorOp[0]'] == states['AlphaOp[0]'] == 'MODULATE'
        assert states['ColorArg1[0]'] == states['AlphaArg1[0]'] == 'TEXTURE'
        assert states['ColorArg2[0]'] == states['AlphaArg2[0]'] == 'DIFFUSE'
        assert states['MinFilter[0]'] == states['MagFilter[0]'] == (
            'LINEAR' if script['index'] in [0, 4, 5] else 'POINT')
        assert states['AddressU[0]'] == states['AddressV[0]'] == (
            'CLAMP' if script['index'] in [4, 5] else 'WRAP')
        if script['index'] < 10:
            assert states['ZWriteEnable'] == 'FALSE'
            assert states['ZEnable'] == ('TRUE' if script['index'] in [2, 3, 7, 9] else 'FALSE')
            assert states['SrcBlend'] == 'SRCALPHA'
            assert states['DestBlend'] == ('ONE' if script['index'] in [1, 3, 5, 6, 7] else 'INVSRCALPHA')
        else:
            assert states['ZWriteEnable'] == states['ZEnable'] == 'TRUE'
            assert 'SrcBlend' not in states and 'DestBlend' not in states
    if script['index'] == 10:
        states = [{s['name']: s['value'] for s in p['states']} for p in passes]
        assert [s['CullMode'] for s in states] == ['CW', 'CCW']
        assert [s['AlphaRef'] for s in states] == ['100', '0']
        assert [s['AlphaFunc'] for s in states] == ['GREATEREQUAL', 'GREATER']
assert rendering['implicitStatesResolved'] is False
for bad in ['', 'technique t0 {}', 'technique t0 { pass p0 { FVF = X; }',
            'technique t0 { pass p0 { FVF = X; } } garbage']:
    try:
        parse_gbf(bad)
    except ValueError:
        pass
    else:
        raise AssertionError('malformed GBF accepted')

exe = ROOT / 'CDTank/CDTank.exe'
overlay_pe = pefile.PE(str(exe))
for script, store in zip(rendering['overlayScripts'], [0x447c79, 0x447ca3]):
    assert overlay_pe.get_data(int(script['pushVa'], 16) - 0x400000, 5) == b'\x68' + struct.pack('<I', int(script['pathVa'], 16))
    assert overlay_pe.get_data(store - 0x400000, 3) == b'\x89\x43' + bytes([script['gfxOffset']])
    source = ROOT / 'recovery/output/verified/assets/data' / script['source']
    assert parse_gbf(source.read_text()) == script['techniques']
assert [(row['textured'], row['gfxOffset'], Path(row['source']).stem) for row in rendering['overlayScripts']] == [
    (True, 0x24, 'ui_TL'), (False, 0x20, 'ui_notex_TL')]
print('PASS: original gfx overlay script paths, destination fields and explicit GBF states')
pe = pefile.PE(str(exe))
machine = Uc(UC_ARCH_X86, UC_MODE_32)
machine.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
machine.mem_write(0x400000, pe.get_memory_mapped_image())
machine.mem_map(0x2000000, 0x20000)
FRAME, RESOURCE, CONTROL, STACK = 0x2009000, 0x2010000, 0x2011000, 0x2008000
machine.mem_write(FRAME - 0x40, struct.pack('<I', CONTROL))


def native_selector(flags, screen):
    machine.mem_write(CONTROL + 0xac, struct.pack('<I', flags))
    machine.mem_write(RESOURCE + 0x2a4, bytes([int(screen)]))
    machine.reg_write(UC_X86_REG_EBP, FRAME)
    machine.reg_write(UC_X86_REG_ESI, RESOURCE)
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.emu_start(0x481a0b, 0x481a72, count=100)
    selector = machine.reg_read(UC_X86_REG_ESI)
    fvf = struct.unpack('<I', machine.mem_read(STACK - 4, 4))[0]
    assert fvf == (0x114 if screen else 0x15)
    assert selector == sprite_selector(flags, screen)
    return selector


cases = []
for flags in list(range(256)) + [0x100, 0x7fffffff, 0x80000000, 0xffffffff]:
    for screen in [False, True]:
        cases.append({'flags': flags, 'screenSpace': screen,
                      'selector': native_selector(flags, screen)})
for row in rendering['spriteSelections']:
    node = library['nodes'][row['node']]
    raw = bytes.fromhex(node['modifiers'][row['modifier']]['payload'])
    assert row['flags'] == struct.unpack_from('<I', raw, 154)[0]
    assert row['screenSpace'] == bool(bytes.fromhex(node['resource'])[669])
    assert row['selector'] == native_selector(row['flags'], row['screenSpace'])
assert len(rendering['spriteSelections']) == 1088
(ROOT / 'recovery/output/effect-render-native.json').write_text(json.dumps({
    'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'cases': cases}) + '\n')
print(f'PASS: 11 original GBF scripts / 12 ordered passes, {len(cases)} native flag cases, 1088 source selections')
from unicorn.x86_const import UC_X86_REG_EAX
particle_cases = []
for flags in list(range(256)) + [0x100, 0x7fffffff, 0x80000000, 0xffffffff]:
    machine.reg_write(UC_X86_REG_EAX, flags)
    machine.emu_start(0x480fde, 0x481016, count=100)
    selector = machine.reg_read(UC_X86_REG_EAX)
    assert selector == sprite_selector(flags, False)
    particle_cases.append({'flags': flags, 'screenSpace': False, 'selector': selector})
for row in rendering['particleSelections']:
    raw = bytes.fromhex(library['nodes'][row['node']]['modifiers'][row['modifier']]['payload'])
    assert row['flags'] == struct.unpack_from('<I', raw, 581)[0]
    assert row['selector'] == sprite_selector(row['flags'], False)
assert len(rendering['particleSelections']) == 985
(ROOT / 'recovery/output/effect-particle-render-native.json').write_text(json.dumps({
    'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'cases': particle_cases}) + '\n')
print(f'PASS: {len(particle_cases)} original particle GBF flag cases and 985 source selections')
