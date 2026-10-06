"""Execute original seven-slot UI cache mappings and inspect exported base layout."""
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_EDI
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x10000)
UI, ARRAY, STACK = 0x2001000, 0x2002000, 0x2008000
ids = [0xf1234567, 2, 3, 4, 5, 6, 7]
uc.mem_write(ARRAY, struct.pack('<7I', *ids))
rows = []
for start, end, offset, slots in [(0x4e0dfa, 0x4e0e1b, 0xd0, [1,2,3]),
                                (0x4e11c0, 0x4e11df, 0xe8, [4,5,6,7])]:
    uc.reg_write(UC_X86_REG_EAX, ARRAY)
    uc.reg_write(UC_X86_REG_EBX, UI)
    uc.reg_write(UC_X86_REG_EDI, 4)
    uc.reg_write(UC_X86_REG_EBP, STACK)
    uc.reg_write(UC_X86_REG_ESP, STACK - 0x100)
    uc.emu_start(start, end)
    cache = [struct.unpack('<2I', uc.mem_read(UI+offset+i*8,8)) for i in range(len(slots))]
    assert cache == [(ids[slot-1], slot) for slot in slots]
    rows.append(dict(start=hex(start), cache=cache))
u=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text())
l=next(x for x in u['layouts'] if x['path'].endswith('myhome_playerpage.xml'))
controls={x['name']:x for x in l['windows']}
for i in range(4):
    assert controls[f'picWeapon{i}']['properties']['AbsoluteRect'] == controls[f'picItem{i}']['properties']['AbsoluteRect']
assert uc.mem_read(0x5cee40, 11).split(b'\0')[0] == b'%s%.5d.tga'
assert uc.mem_read(0x5cee4c, 32).split(b'\0')[0] == b'data\\ui\\daoju\\'
out=dict(status='PASS', rows=rows, sourceLayout=l['path'], weaponSlots=[0,1,2,3], itemSlots=[4,5,6,7],
         scope='Real source UI seven-array cache blocks; four overlapping icon rectangles; base layout still patch pending.')
(ROOT/'recovery/output/shortcut-ui-source.json').write_text(json.dumps(out,indent=2)+'\n')
print('PASS: original three weapon / four item cache mappings and overlapping four-cell layout')
