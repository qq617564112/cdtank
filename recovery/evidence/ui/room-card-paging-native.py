"""Execute original paging button images and enabled-boundary producer."""
import json
from pathlib import Path
import runpy
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
ns = runpy.run_path(str(ROOT / 'recovery/evidence/ui/source-button-native.py'))
controls = next(l['windows'] for l in ns['ui']['layouts'] if l['path'].endswith('roomlist.xml'))
Native = ns['Native']
Native.setup.__globals__['controls'] = controls
rows = []
for name in ['btnPageUp', 'btnPageDown']:
    control = next(c for c in controls if c['name'] == name)
    assert control['type'] == 'WindowsLook/Button'
    assert control['properties']['StateColorBlend'] == 'False'
    assert control['properties']['UseStandardImagery'] == 'False'
    for state, entry in [('Normal', 0x10004d70), ('Hover', 0x10005070), ('Pushed', 0x10005370), ('Disabled', 0x10005670)]:
        for alpha in [1, .5]:
            n = Native(98)
            n.setup(name, alpha)
            n.invoke(entry, [0])
            assert [image['property'] for image in n.images] == [state + 'Image']
            assert all(image['alpha'] == [alpha] * 4 for image in n.images)
            rows.append({'control': name, 'state': state, 'effectiveAlpha': alpha, 'images': n.images})
text = next(c for c in controls if c['name'] == 'yeshu')
assert text['type'] == 'WindowsLook/StaticText' and 'Font' not in text['properties']
assert text['properties']['HorzFormatting'] == 'HorzCentred'
assert text['properties']['TextColours'] == 'tl:FFFFFFFF tr:FFFFFFFF bl:FFFFFFFF br:FFFFFFFF'
assert 'VertFormatting' not in text['properties']
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x10000)
controller, container, previous, next_button, stack, end, setter = [0x2001000 + i * 0x1000 for i in range(7)]
calls = []
count = 0
def write(address, value): uc.mem_write(address, struct.pack('<I', value))
def read(address): return struct.unpack('<I', uc.mem_read(address, 4))[0]
def ret(pop=0, value=0):
    sp = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(sp))
    uc.reg_write(UC_X86_REG_ESP, sp + 4 + pop)
def hook(machine, address, size, user):
    if address == 0x43c0a1:
        assert machine.reg_read(UC_X86_REG_ECX) == container
        ret(value=count)
    elif address == setter:
        calls.append({'control': 'btnPageUp' if machine.reg_read(UC_X86_REG_ECX) == previous else 'btnPageDown',
                      'enabled': bool(read(machine.reg_read(UC_X86_REG_ESP) + 4))})
        ret(4)
uc.hook_add(UC_HOOK_CODE, hook)
write(0x5c0138, setter)
write(controller + 0x24, container)
write(controller + 0x54, previous)
write(controller + 0x58, next_button)
boundaries = []
for count, page in [(0,0),(1,0),(10,0),(11,0),(11,1),(20,0),(20,1),(21,0),(21,1),(21,2),(30,1),(30,2)]:
    calls.clear()
    write(controller + 0x20, page)
    write(stack, end)
    uc.reg_write(UC_X86_REG_ECX, controller)
    uc.reg_write(UC_X86_REG_ESP, stack)
    uc.emu_start(0x5056b3, end, count=1000)
    assert calls == [{'control': 'btnPageUp', 'enabled': page > 0}, {'control': 'btnPageDown', 'enabled': count > (page + 1) * 10}]
    boundaries.append({'count': count, 'page': page, 'calls': list(calls)})
result = {'status': 'PASS', 'controls': [c for c in controls if c['name'] in ['all','ditu','btnPageUp','btnPageDown','yeshu']],
          'imageVectors': rows, 'pointerVectors': ns['pointerRows'], 'boundaryVectors': boundaries,
          'textDefaultsReused': 'waiting-room-static-text-native.json and ui-font-raster.json',
          'producer': '0x5056b3..0x5056f0 original current-page/list-count enabled arithmetic',
          'providers': 'Image draw endpoints/effective alpha and source windows via shared harness; list count and CEGUI setEnabled endpoint for original page arithmetic.',
          'scope': 'Three source paging controls and sheet offset; directory RPC/refresh/selection lifecycle and yeshu page string remain explicit Web projection.'}
(ROOT / 'recovery/output/room-card-paging-native.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: 16 original button images, 5 captured states, 12 original enabled boundaries and source page-text defaults')
