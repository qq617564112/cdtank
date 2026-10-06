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
uc.mem_map(0,4096)

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
layout = next(layout for layout in ui['layouts'] if layout['path'].endswith('room_main.xml'))

def region(reference):
    if not reference:
        return None
    name, image = reference[4:].split(' image:')
    sets = [value for value in ui['imagesets'] if value['attributes']['Name'] == name]
    imageset = next((value for value in sets if 'imagesets_dds/' in value['path']), sets[0])
    return next(value for value in imageset['images'] if value['Name'] == image)

rows = []
frame_rows = []
centre_rows = []
window=next(window for window in layout['windows'] if window['name']=='zhongjianditu')
properties=window['properties']
assert 'FrameEnabled' not in properties
box=list(map(float,__import__('re').findall(r'-?\d+(?:\.\d+)?',properties['AbsoluteRect'])))
width,height=box[2]-box[0],box[3]-box[1]
for scale in [1,420/391,1.8,2]:
    uc.mem_write(OBJ,bytes(0x600))
    for index,position in enumerate(['TopLeft','TopRight','BottomLeft','BottomRight','Left','Top','Right','Bottom'],1):
        image=region(properties[position+'FrameImage']);pointer=0x2008000+index*0x100
        floats(pointer+8,0,float(image['Height']),0,float(image['Width']));floats(pointer+0x18,0,0)
        for entry in [0x10018640,0x100186e0]:
            uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,pointer)
            write(STACK,RETURN,struct.unpack('<I',struct.pack('<f',scale))[0]);uc.emu_start(entry,RETURN,count=10000)
        image_names[pointer]=position
        call(0x100ad840,index,pointer)
        uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OBJ)
        write(STACK,RETURN,index,pointer);uc.emu_start(0x1001f440,RETURN,count=10000)
    inset=read_floats(OBJ+0x494,4)
    expected=float(int(16*scale+.5));assert inset==[expected]*4,inset
    floats(RECT,0,height*scale,0,width*scale)
    for enabled in [False,True]:
        uc.mem_write(OBJ+0x328,bytes([int(enabled)]));call(0x100ad090,OUT)
        inner=read_floats(OUT,4)
        wanted=[expected,height*scale-expected,expected,width*scale-expected] if enabled else [0,height*scale,0,width*scale]
        assert all(abs(a-b)<.0001 for a,b in zip(inner,wanted)),inner
        rows.append({'control':'zhongjianditu','scale':scale,'enabled':enabled,'insets':inset,'inner':inner})
    floats(OBJ+0x68,0,height*scale,0,width*scale);floats(RECT,0,0,0);floats(OUT,0,height*scale,0,width*scale)
    draws.clear();call(0x1001e6b0,RECT,OUT);assert len(draws)==8
    frame_rows.append({'control':'zhongjianditu','scale':scale,'width':width*scale,'height':height*scale,'draws':list(draws)})
    image=region(properties['Image']);pointer=0x2009000;image_names[pointer]='Centre'
    floats(pointer+8,0,float(image['Height']),0,float(image['Width']));floats(pointer+0x18,0,0)
    for entry in [0x10018640,0x100186e0]:
        uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,pointer)
        write(STACK,RETURN,struct.unpack('<I',struct.pack('<f',scale))[0]);uc.emu_start(entry,RETURN,count=10000)
    write(OBJ+0x8c,pointer);write(OBJ+0x7c,3,3);uc.mem_write(OBJ+0x78,bytes([1]))
    floats(OBJ+0x68,0,height*scale-2*expected,0,width*scale-2*expected)
    floats(RECT,expected,expected,0);floats(OUT,0,height*scale,0,width*scale)
    draws.clear();call(0x1001f7e0,RECT,OUT);assert len(draws)==1
    draw=draws[0];assert all(abs(a-b)<.0001 for a,b in zip(draw['position'],[expected]*2))
    assert all(abs(a-b)<.0001 for a,b in zip(draw['size'],[width*scale-2*expected,height*scale-2*expected]))
    centre_rows.append({'control':'zhongjianditu','scale':scale,'draw':draw})
output={'status':'PASS','scope':'Original Image autoscale, Static setImageForFrameLocation/getUnclippedInnerRect and complete RenderableFrame/RenderableImage draw through Image::draw calls. Source image dimensions/zero offsets, window outer rectangle and final Image draw/GPU are providers.','rows':rows,'frameDraws':frame_rows,'centreDraws':centre_rows}
(ROOT/'recovery/output/waiting-room-frame-native.json').write_text(json.dumps(output,indent=2)+'\n')
print('PASS:',len(rows),'inner vectors,',sum(len(r['draws']) for r in frame_rows),'frame draws,',len(centre_rows),'centre draws')
