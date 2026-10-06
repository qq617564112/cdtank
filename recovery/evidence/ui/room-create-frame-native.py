"""Execute original Static frame setters and inner rectangle consumption."""
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
BASE, OBJ, STACK, RETURN, RECT, OUT = 0x2000000, 0x2001000, 0x2080000, 0x2090000, 0x2090100, 0x2090200
uc.mem_map(BASE, 0x100000)

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def floats(address, *values):
    uc.mem_write(address, struct.pack('<' + 'f' * len(values), *values))

def read_floats(address, count):
    return list(struct.unpack('<' + 'f' * count, uc.mem_read(address, count * 4)))

draws = []
image_names = {}

def hook(uc, address, size, user):
    if address == 0x10018780:
        stack = uc.reg_read(UC_X86_REG_ESP)
        target = struct.unpack('<I', uc.mem_read(stack + 4, 4))[0]
        rect = read_floats(target, 4)
        draws.append({'part': image_names[uc.reg_read(UC_X86_REG_ECX)], 'position': [rect[2], rect[0]], 'size': [rect[3] - rect[2], rect[1] - rect[0]]})
        uc.reg_write(UC_X86_REG_EIP, struct.unpack('<I', uc.mem_read(stack, 4))[0])
        uc.reg_write(UC_X86_REG_ESP, stack + 32)
        return
    if address == 0x1000cbc0:
        stack = uc.reg_read(UC_X86_REG_ESP)
        args = struct.unpack('<6I', uc.mem_read(stack + 4, 24))
        draws.append({'part': image_names[uc.reg_read(UC_X86_REG_ECX)], 'position': read_floats(args[0], 2), 'size': read_floats(args[1], 2)})
        uc.reg_write(UC_X86_REG_EIP, struct.unpack('<I', uc.mem_read(stack, 4))[0])
        uc.reg_write(UC_X86_REG_ESP, stack + 28)
        return
    if address == 0x10034cd0:
        # Browser-independent provider supplies the window's unclipped outer rectangle.
        stack = uc.reg_read(UC_X86_REG_ESP)
        target = struct.unpack('<I', uc.mem_read(stack + 4, 4))[0]
        uc.mem_write(target, bytes(uc.mem_read(RECT, 16)))
        uc.reg_write(UC_X86_REG_EAX, target)
        uc.reg_write(UC_X86_REG_EIP, struct.unpack('<I', uc.mem_read(stack, 4))[0])
        uc.reg_write(UC_X86_REG_ESP, stack + 8)

uc.hook_add(UC_HOOK_CODE, hook)

def call(address, *args):
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, OBJ)
    write(STACK, RETURN, *args)
    uc.emu_start(address, RETURN, count=10000)

ui = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
layout = next(layout for layout in ui['layouts'] if layout['path'].endswith('createroom.xml'))

def region(reference):
    if not reference:
        return None
    name, image = reference[4:].split(' image:')
    sets = [value for value in ui['imagesets'] if value['attributes']['Name'] == name]
    imageset = next((value for value in sets if 'imagesets_dds/' in value['path']), sets[0])
    return next(value for value in imageset['images'] if value['Name'] == image)

rows = []
for name in ['daditu', 'ditu2', 'ditu3', 'xiaoditu', 'tiao1']:
    window = next(window for window in layout['windows'] if window['name'] == name)
    properties = window['properties']
    uc.mem_write(OBJ, bytes(0x600))
    expected = []
    for index, position in enumerate(['Left', 'Top', 'Right', 'Bottom'], 5):
        image = region(properties.get(position + 'FrameImage'))
        pointer = 0x2005000 + index * 0x100 if image else 0
        if image:
            floats(pointer + 0x20, float(image['Width']), float(image['Height']))
        call(0x100ad840, index, pointer)
        expected.append(float(image['Width' if position in ['Left', 'Right'] else 'Height']) if image else 0)
    expected = [expected[0], expected[2], expected[1], expected[3]]
    actual = read_floats(OBJ + 0x494, 4)
    assert actual == expected, (name, actual, expected)
    for enabled in [False, True]:
        uc.mem_write(OBJ + 0x328, bytes([int(enabled)]))
        floats(RECT, 20, 305, 10, 310)
        call(0x100ad090, OUT)
        raw_inner = read_floats(OUT, 4)
        inner = [raw_inner[2], raw_inner[0], raw_inner[3], raw_inner[1]]
        expected_inner = [10 + expected[0], 20 + expected[2], 310 - expected[1], 305 - expected[3]] if enabled else [10, 20, 310, 305]
        assert inner == expected_inner, (name, enabled, inner, expected_inner)
        rows.append({'control': name, 'enabled': enabled, 'insets': actual, 'outer': [10, 20, 310, 305], 'inner': inner})
draw_rows = []
for name in ['daditu', 'ditu2', 'ditu3', 'xiaoditu']:
    window = next(window for window in layout['windows'] if window['name'] == name)
    properties = window['properties']
    uc.mem_write(OBJ, bytes(0x600))
    rectangle = [float(value) for value in __import__('re').findall(r'-?\d+(?:\.\d+)?', properties['AbsoluteRect'])]
    width, height = rectangle[2] - rectangle[0], rectangle[3] - rectangle[1]
    # RenderableFrame stores its rectangle in top,bottom,left,right order.
    floats(OBJ + 0x68, 0, height, 0, width)
    for index, position in enumerate(['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight', 'Left', 'Top', 'Right', 'Bottom'], 1):
        image = region(properties.get(position + 'FrameImage'))
        pointer = 0x2008000 + index * 0x100 if image else 0
        if image:
            floats(pointer + 0x20, float(image['Width']), float(image['Height']), 0, 0)
            image_names[pointer] = position
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, OBJ)
        write(STACK, RETURN, index, pointer)
        uc.emu_start(0x1001f440, RETURN, count=10000)
    floats(RECT, 0, 0, 0)
    floats(OUT, 0, height, 0, width)
    draws.clear()
    call(0x1001e6b0, RECT, OUT)
    assert len(draws) == (2 if name == 'xiaoditu' else 8), (name, draws)
    draw_rows.append({'control': name, 'width': width, 'height': height, 'draws': list(draws)})
output = {'status': 'PASS', 'scope': 'Original complete setImageForFrameLocation and getUnclippedInnerRect; source image dimensions and outer window rectangle are providers. RenderableFrame::drawImpl executes to Image::draw call boundaries; source dimensions and zero image offsets are providers. Image autoscaling, centre formatting and GPU output are not executed.', 'addresses': {'setter': '0x100ad840', 'innerRect': '0x100ad090', 'frameDraw': '0x1001e6b0'}, 'rows': rows, 'frameDraws': draw_rows}
(ROOT / 'recovery/output/room-create-frame-native.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS:', len(rows), 'original frame inset/inner-rectangle vectors')
