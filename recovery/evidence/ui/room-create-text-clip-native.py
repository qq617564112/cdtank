"""Execute the original StaticText draw prefix through clipping intersection."""
import json
import struct
import sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT / 'CDTank/CEGUIBase.dll'])
uc.mem_map(0x2000000, 0x100000)
OBJ, VTABLE, STACK, RETURN, AREA, CLIP = 0x2001000, 0x2003000, 0x2080000, 0x2090000, 0x2090100, 0x2090200

def write(address, *values): uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))
def floats(address, *values): uc.mem_write(address, struct.pack('<' + 'f' * len(values), *values))
def read(address): return struct.unpack('<I', uc.mem_read(address, 4))[0]
result = None

def hook(uc, address, size, user):
    global result
    if address in [0x100ad480, 0x2091000, 0x2091100]:
        stack = uc.reg_read(UC_X86_REG_ESP)
        if address != 0x100ad480:
            target = read(stack + 4)
            uc.mem_write(target, bytes(uc.mem_read(AREA if address == 0x2091000 else CLIP, 16)))
            uc.reg_write(UC_X86_REG_EAX, target)
        uc.reg_write(UC_X86_REG_EIP, read(stack)); uc.reg_write(UC_X86_REG_ESP, stack + 8)
    elif address == 0x100b0df2:
        result = list(struct.unpack('<4f', uc.mem_read(uc.reg_read(UC_X86_REG_ESP) + 0x48, 16)))
        uc.emu_stop()
uc.hook_add(UC_HOOK_CODE, hook)
write(OBJ, VTABLE); write(VTABLE + 0xe8, 0x2091000); write(VTABLE + 4, 0x2091100)
rows = []
for clip in [[0, 16, 0, 138], [2, 14, 8, 130], [-10, 40, -10, 200]]:
    floats(AREA, 0, 16, 0, 138); floats(CLIP, *clip)
    uc.reg_write(UC_X86_REG_ESP, STACK); uc.reg_write(UC_X86_REG_ECX, OBJ); write(STACK, RETURN, 0)
    uc.emu_start(0x100b0db0, RETURN, count=10000)
    expected = [max(0,clip[0]), min(16,clip[1]), max(0,clip[2]), min(138,clip[3])]
    assert result == expected, (result, expected)
    rows.append({'textArea': [0,16,0,138], 'windowClip': clip, 'intersection': result})
output = {'status': 'PASS', 'scope': 'Original StaticText::drawSelf prefix through Rect intersection only; static background and virtual text/window clip rectangles are providers. Font layout and final draw remain unexecuted.', 'address': '0x100b0db0..0x100b0df2', 'rows': rows}
(ROOT / 'recovery/output/room-create-text-clip-native.json').write_text(json.dumps(output, indent=2)+'\n')
print('PASS:',len(rows),'original StaticText clip intersections')
