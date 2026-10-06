"""Execute original centre image formatting, scaling and clipping consumption."""
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
uc.mem_map(0, 0x1000)

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
        draws.append({'part': image_names[uc.reg_read(UC_X86_REG_ECX)], 'position': [rect[2], rect[0]], 'size': [rect[3] - rect[2], rect[1] - rect[0]], 'clip': read_floats(struct.unpack('<I', uc.mem_read(stack + 12, 4))[0], 4)})
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
layout = next(layout for layout in ui['layouts'] if layout['path'].endswith('roomlist.xml'))

def region(reference):
    if not reference:
        return None
    name, image = reference[4:].split(' image:')
    sets = [value for value in ui['imagesets'] if value['attributes']['Name'] == name]
    imageset = next((value for value in sets if 'imagesets_dds/' in value['path']), sets[0])
    return next(value for value in imageset['images'] if value['Name'] == image)


rows=[]
window=next(c for c in layout['windows']if c['name']=='ditu');image=region(window['properties']['Image']);assert window['properties']['FrameEnabled']=='False'and window['properties']['HorzFormatting']=='HorzStretched'
for scale in [1,1.8,3]:
 uc.mem_write(OBJ,bytes(0x600));pointer=0x2008000;uc.mem_write(pointer,bytes(0x100));image_names[pointer]='ditu';floats(pointer+8,0,float(image['Height']),0,float(image['Width']));floats(pointer+0x18,0,0)
 for entry in [0x10018640,0x100186e0]:
  uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,pointer);write(STACK,RETURN,struct.unpack('<I',struct.pack('<f',scale))[0]);uc.emu_start(entry,RETURN,count=10000)
 write(OBJ+0x8c,pointer);write(OBJ+0x7c,3,3);uc.mem_write(OBJ+0x78,b'\1');floats(OBJ+0x68,0,316*scale,0,615*scale);floats(RECT,0,0,0)
 for margin in [0,4]:
  floats(OUT,margin,316*scale-margin,margin,615*scale-margin);draws.clear();call(0x1001f7e0,RECT,OUT);d=draws[0];assert d['position']==[0,0];assert all(abs(a-b)<.001 for a,b in zip(d['size'],[615*scale,316*scale]));assert all(abs(a-b)<.001 for a,b in zip(d['clip'],[margin,316*scale-margin,margin,615*scale-margin]));rows.append({'scale':scale,'margin':margin,'draw':dict(d),'scaledImage':read_floats(pointer+0x20,4)})
output={'status':'PASS','control':window,'image':image,'rows':rows,'scope':'Original complete RenderableImage draw and Image size scaling using native source615x317 stretched into615x316 source window, full/narrow clip. Image draw/GPU and window/colour endpoints providers; prior Static defaults/effective alpha source reused.'}
(ROOT/'recovery/output/room-card-background-native.json').write_text(json.dumps(output,indent=2)+'\n');print('PASS6 original background stretched image/clip consumers')
