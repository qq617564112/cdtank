"""Execute original type8 rectangle initialization and full draw dispatch."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_ESI, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0x2000000, 0x40000)
OBJECT, DEFINITION, RESOURCE, UV, GFX, DRAW, STACK, STOP = 0x2010000, 0x2011000, 0x2015000, 0x2016000, 0x2017000, 0x2018000, 0x2008000, 0x203f000
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
frames = next(row['uvFrames'] for row in library['textureGrids'] if row['type'] == 8)
steps = json.loads((ROOT / 'recovery/output/effect-overlay-lifecycle-native.json').read_text())['rows'][0]['steps']
events = []
VERTICES, VTABLE, ALLOCATE, SUBMIT = 0x2020000, 0x2019000, 0x201a000, 0x201a100
submitted = []
def uint(address): return struct.unpack('<I', machine.mem_read(address, 4))[0]
def finish(pop=0):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)
get_draw, material_init, render = (uint(address) for address in [0x5c0b54, 0x5c0a80, 0x5c0b2c])
def hook(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == get_draw:
        assert uint(stack + 4) == 0x114
        uc.reg_write(UC_X86_REG_EAX, DRAW)
        finish(4)
    elif address == material_init:
        uc.mem_write(uc.reg_read(UC_X86_REG_ECX), bytes(0x44))
        finish()
    elif address == render:
        rectangle, count, script, material = (uint(stack + offset) for offset in [4, 8, 12, 16])
        assert count == 1
        events.append(dict(rectangle=list(struct.unpack('<8f', uc.mem_read(rectangle, 32))),
            z=struct.unpack('<f', uc.mem_read(rectangle + 32, 4))[0], color=uint(rectangle + 36),
            script=script, texture=uint(material) if material else None))
    elif address == ALLOCATE:
        assert uint(stack + 4) == 6
        uc.reg_write(UC_X86_REG_EAX, VERTICES)
        finish(4)
    elif address == SUBMIT:
        submitted.append([uint(stack + offset) for offset in [4, 8, 12]])
        finish(12)
machine.hook_add(UC_HOOK_CODE, hook)
machine.mem_write(0x635830, struct.pack('<I', GFX))
machine.mem_write(GFX + 0x1c, struct.pack('<3I', DRAW, 17, 23))
machine.mem_write(DRAW, struct.pack('<I', VTABLE))
machine.mem_write(DRAW + 12, struct.pack('<I', 0x114))
machine.mem_write(VTABLE + 12, struct.pack('<I', ALLOCATE))
machine.mem_write(VTABLE + 20, struct.pack('<I', SUBMIT))
rows=[]
for width, height in [(800, 600), (1920, 1080)]:
    machine.mem_write(OBJECT, bytes(0x100))
    machine.mem_write(OBJECT + 12, struct.pack('<I', DEFINITION))
    machine.mem_write(DEFINITION + 0x150, struct.pack('<I', RESOURCE))
    machine.mem_write(OBJECT + 0x80, struct.pack('<I', 1234))
    machine.mem_write(OBJECT + 0x88, struct.pack('<I', UV))
    machine.mem_write(UV, b''.join(struct.pack('<4f', *uv) for uv in frames))
    machine.mem_write(0x635824, struct.pack('<2I', width, height))
    machine.reg_write(UC_X86_REG_ESI, OBJECT)
    machine.reg_write(UC_X86_REG_FPCW, 0x27f)
    machine.emu_start(0x483674, 0x4836a8, count=1000)
    for textured in [True, False]:
        machine.mem_write(RESOURCE + 4, bytes([textured]))
        for step in steps:
            machine.mem_write(OBJECT + 0x40, struct.pack('<4fIf', *step['color'], step['frame'], step['frameRemainder']))
            events.clear()
            submitted.clear()
            machine.mem_write(STACK, struct.pack('<II', STOP, 0))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.emu_start(0x48349c, STOP, count=100000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
            assert submitted == [[1, events[0]['script'], submitted[0][2]]]
            vertices = []
            for index in range(6):
                address = VERTICES + index * 28
                vertices.append(dict(position=list(struct.unpack('<3f', machine.mem_read(address, 12))),
                    rhw=struct.unpack('<f', machine.mem_read(address + 12, 4))[0], color=uint(address + 16),
                    uv=list(struct.unpack('<2f', machine.mem_read(address + 20, 8)))))
            rows.append(dict(width=width, height=height, textured=textured,
                frame=step['frame'], inputColor=step['color'], draw=events[0], vertices=vertices))
(ROOT / 'recovery/output/effect-overlay-draw-native.json').write_text(json.dumps(dict(frames=frames, rows=rows)) + '\n')
(ROOT / 'recovery/output/web-assets/effect-overlay-browser-native.json').write_text(json.dumps(dict(rows=[row for row in rows if row['width'] == 800 and row['textured']])) + '\n')
print(f'PASS: {len(rows)} original type8 rectangle/color/UV/render dispatch and DLL XYZRHW vertex samples')
