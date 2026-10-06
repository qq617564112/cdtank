"""Execute original imageset resolution factors, real image-map traversal and frame geometry."""
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


SET, HEADER, NODE, SIZE, RENDER = 0x200b000, 0x200c000, 0x200d000, 0x2090500, 0x2015000
rows = []
for name in ['daditu', 'ditu2', 'ditu3', 'xiaoditu']:
    window = next(window for window in layout['windows'] if window['name'] == name)
    properties = window['properties']
    positions = ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight', 'Left', 'Top', 'Right', 'Bottom', 'Image']
    entries = [(position, region(properties.get(position + 'FrameImage') if position != 'Image' else properties['Image'])) for position in positions]
    entries = [(position, image) for position, image in entries if image]
    for window_width, window_height, kind in [(800,600,'sourceViewport'), (1920,1080,'sourceViewport'), (3840,2160,'sourceViewport'), (1920,1080,'fullWindowProvider')]:
        scale = min(window_width/800, window_height/600)
        width, height = (800*scale,600*scale) if kind == 'sourceViewport' else (window_width,window_height)
        uc.mem_write(SET, bytes(0x200))
        uc.mem_write(HEADER, bytes(0x200))
        write(SET + 0x9c, HEADER)
        floats(SET + 0xb4, 800, 600)
        uc.mem_write(SET + 0xa8, bytes([1]))
        nodes = [NODE + index * 0x300 for index in range(len(entries))]
        write(HEADER, nodes[0], nodes[0], nodes[-1])
        uc.mem_write(HEADER + 0x16d, bytes([1]))
        image_data = []
        for index, ((position,image), node) in enumerate(zip(entries,nodes)):
            uc.mem_write(node, bytes(0x300))
            write(node, HEADER, nodes[index-1] if index else HEADER, nodes[index+1] if index+1<len(nodes) else HEADER)
            pointer = node + 0xa4
            floats(pointer + 8, 0, float(image['Height']), 0, float(image['Width']))
            floats(pointer + 0x18, float(image.get('XOffset', 0)), float(image.get('YOffset', 0)))
            image_names[pointer] = position
            image_data.append((position,pointer,image))
        floats(SIZE, width, height)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, SET)
        write(STACK, RETURN, SIZE)
        uc.emu_start(0x10018de0, RETURN, count=100000)
        factors = read_floats(SET + 0xac, 2)
        scaled = {}
        for position,pointer,image in image_data:
            values = read_floats(pointer + 0x20, 4)
            expected = [float(int(float(image['Width'])*width/800+.5)), float(int(float(image['Height'])*height/600+.5)), 0, 0]
            assert values == expected, (name,width,position,values,expected)
            scaled[position] = values
        uc.mem_write(RENDER, bytes(0x600))
        uc.mem_write(OBJ, bytes(0x600))
        for position,pointer,image in image_data:
            if position == 'Image':continue
            enum = positions.index(position) + 1
            uc.reg_write(UC_X86_REG_ESP, STACK)
            uc.reg_write(UC_X86_REG_ECX, RENDER)
            write(STACK, RETURN, enum, pointer)
            uc.emu_start(0x1001f440, RETURN, count=10000)
            uc.reg_write(UC_X86_REG_ESP, STACK)
            uc.reg_write(UC_X86_REG_ECX, OBJ)
            write(STACK, RETURN, enum, pointer)
            uc.emu_start(0x100ad840, RETURN, count=10000)
        rectangle = [float(value) for value in __import__('re').findall(r'-?\d+(?:\.\d+)?', properties['AbsoluteRect'])]
        outer_width = (rectangle[2]-rectangle[0])*width/800
        outer_height = (rectangle[3]-rectangle[1])*height/600
        floats(RENDER+0x68,0,outer_height,0,outer_width)
        floats(RECT,0,0,0)
        floats(OUT,0,outer_height,0,outer_width)
        uc.reg_write(UC_X86_REG_ESP,STACK)
        uc.reg_write(UC_X86_REG_ECX,RENDER)
        write(STACK,RETURN,RECT,OUT)
        draws.clear()
        uc.emu_start(0x1001e6b0,RETURN,count=100000)
        rows.append({'control':name,'viewport':[window_width,window_height],'displayProvider':[width,height],'kind':kind,'factors':factors,'images':scaled,'insets':read_floats(OBJ+0x494,4),'draws':list(draws),'outer':[outer_width,outer_height]})
output={'status':'PASS','rows':rows,'scope':'Complete notifyScreenResolution, updateImageScalingFactors with real map iterator, Image width/height/offset round functions, frame setter and RenderableFrame draw consumer. Source image-map fixtures and display size are providers; GPU remains excluded.'}
(ROOT/'recovery/output/room-create-scale-native.json').write_text(json.dumps(output,indent=2)+'\n')
print('PASS:',len(rows),'original imageset/frame HD vectors')
