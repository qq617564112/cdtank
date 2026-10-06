"""Retain original chat scrollbar resources and execute its minimal consumers."""
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
UI = ROOT / 'recovery/output/verified/assets/data/Data/ui'
OUT = ROOT / 'recovery/output/chat-scroll-source.json'
OBJ, VTABLE, STACK, RETURN, EVENT = 0x2001000, 0x2003000, 0x2080000, 0x2090000, 0x2005000
FLOAT, FLOAT_RETURN = 0x2091000, 0x2092000

def bits(value):
    return struct.unpack('<I', struct.pack('<f', value))[0]

class Engine:
    def __init__(self, name):
        self.uc, images = map_original_binaries([ROOT / 'CDTank' / name])
        self.pe = images[name.lower()]
        self.binary = self.pe.get_memory_mapped_image()
        self.uc.mem_map(0, 0x1000)
        self.uc.mem_map(0x2000000, 0x100000)
        self.callbacks = {}
        self.uc.hook_add(UC_HOOK_CODE, self.hook)
        self.events = []
        self.write(OBJ, VTABLE)
        for slot, cleanup in [(0x13c, 0), (0x148, 4), (0x154, 4)]:
            target = 0x2093000 + slot
            self.write(VTABLE + slot, target)
            self.callbacks[target] = lambda e, c=cleanup, s=slot: e.virtual(c, s)
    def write(self, address, *values):
        self.uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))
    def read(self, address):
        return struct.unpack('<I', self.uc.mem_read(address, 4))[0]
    def f(self, address):
        return struct.unpack('<f', self.uc.mem_read(address, 4))[0]
    def fs(self, address, value):
        self.write(address, bits(value))
    def arg(self, index=0):
        return self.read(self.uc.reg_read(UC_X86_REG_ESP) + 4 + index * 4)
    def ret(self, cleanup=0, value=None, floating=None):
        if value is not None:
            self.uc.reg_write(UC_X86_REG_EAX, value)
        if floating is not None:
            self.fs(FLOAT, floating)
            self.uc.mem_write(FLOAT_RETURN, b'\xd9\x05' + struct.pack('<I', FLOAT) + b'\xc2' + struct.pack('<H', cleanup))
            self.uc.reg_write(UC_X86_REG_EIP, FLOAT_RETURN)
        else:
            sp = self.uc.reg_read(UC_X86_REG_ESP)
            self.uc.reg_write(UC_X86_REG_EIP, self.read(sp))
            self.uc.reg_write(UC_X86_REG_ESP, sp + 4 + cleanup)
    def virtual(self, cleanup, slot):
        self.events.append(hex(slot))
        self.ret(cleanup)
    def hook(self, uc, address, size, user):
        if address in self.callbacks:
            self.callbacks[address](self)
    def invoke(self, address, args=(), obj=OBJ):
        self.write(STACK, RETURN, *args)
        self.uc.reg_write(UC_X86_REG_ESP, STACK)
        self.uc.reg_write(UC_X86_REG_ECX, obj)
        self.uc.emu_start(address, RETURN, count=10000)
        assert self.uc.reg_read(UC_X86_REG_EIP) == RETURN
    def bind(self, iat, callback):
        target = 0x2094000 + len(self.callbacks) * 16
        self.write(iat, target)
        self.callbacks[target] = callback

base = Engine('CEGUIBase.dll')
position_vectors = []
for doc, page, request, expected in [(300,94,-5,0),(300,94,75,75),(300,94,500,206),(94,94,10,0),(70,94,10,0)]:
    for offset, value in [(0x328,doc),(0x32c,page),(0x338,0)]:
        base.fs(OBJ+offset,value)
    base.events.clear()
    base.invoke(0x1009f340,[bits(request)])
    actual=base.f(OBJ+0x338)
    assert actual == expected
    position_vectors.append(dict(document=doc,page=page,request=request,position=actual,virtualCalls=base.events[:]))
button_vectors=[]
for address, name, initial, expected in [(0x1009f4f0,'increase',200,206),(0x1009f520,'decrease',8,0),(0x1009f4f0,'increase',0,18)]:
    for offset, value in [(0x328,300),(0x32c,94),(0x330,18),(0x338,initial)]:base.fs(OBJ+offset,value)
    base.write(EVENT+0x1c,0)
    base.invoke(address,[EVENT])
    assert base.f(OBJ+0x338)==expected
    button_vectors.append(dict(event=name,initial=initial,step=18,position=base.f(OBJ+0x338)))

# Original normal-image setters derive button size from RenderableImage's rectangle.
base.write(OBJ+0x344,0x2011000,0x2012000)
base.write(VTABLE+0x138,0x209313c)
base.callbacks[0x100991d0]=lambda e:e.ret(4)
setter_sizes=[]
def capture_size(e):
    ptr=e.arg(1)
    setter_sizes.append(dict(button=e.uc.reg_read(UC_X86_REG_ECX),metricsMode=e.arg(),width=e.f(ptr),height=e.f(ptr+4)))
    e.ret(8)
base.callbacks[0x10033b70]=capture_size
for address,height in [(0x1009ef20,26),(0x1009ede0,27)]:
    for offset,value in [(0x68,0),(0x6c,height),(0x70,0),(0x74,28)]:base.fs(EVENT+offset,value)
    base.invoke(address,[EVENT])
assert [(v['width'],v['height']) for v in setter_sizes]==[(28,26),(28,27)]

# Execute native frame destination selection at the Image::draw boundary.
FRAME,TOP,BOTTOM,ORIGIN,CLIP=0x2020000,0x2021000,0x2022000,0x2023000,0x2024000
base.invoke(0x1001e600,obj=FRAME)
for offset,value in [(0x68,0),(0x6c,40),(0x70,0),(0x74,28)]:base.fs(FRAME+offset,value)
base.write(FRAME+0x94,TOP,BOTTOM)
for image,width,height in [(TOP,20,28),(BOTTOM,20,17)]:
    base.fs(image+0x20,width);base.fs(image+0x24,height)
for offset,value in [(0,0),(4,40),(8,0),(12,28)]:base.fs(CLIP+offset,value)
frame_draws=[]
def capture_image(e):
    ptr=e.arg()
    frame_draws.append(dict(image='top' if e.uc.reg_read(UC_X86_REG_ECX)==TOP else 'bottom',rect=[e.f(ptr+i) for i in [0,4,8,12]]))
    e.ret(0x1c)
base.callbacks[0x10018780]=capture_image
base.invoke(0x1001e6b0,[ORIGIN,CLIP],obj=FRAME)
assert [v["rect"] for v in frame_draws] == [[0,28,0,20],[0,28,20,40],[23,40,0,20],[23,40,20,40]]

wl = Engine('CEGUIWindowsLook.dll')
THUMB,INC,DEC=0x2010000,0x2011000,0x2012000
wl.write(OBJ+0x340,THUMB,INC,DEC)
def rect(obj, x, y, width, height):
    for offset,value in [(0xe4,y),(0xe8,y+height),(0xec,x),(0xf0,x+width)]:wl.fs(obj+offset,value)
def size(obj):return wl.f(obj+0xf0)-wl.f(obj+0xec),wl.f(obj+0xe8)-wl.f(obj+0xe4)
def set_size(e):
    obj=e.uc.reg_read(UC_X86_REG_ECX);ptr=e.arg(1)
    width,height=e.f(ptr),e.f(ptr+4)
    rect(obj,e.f(obj+0xec),e.f(obj+0xe4),width,height);e.ret(8)
def set_position(e):
    obj=e.uc.reg_read(UC_X86_REG_ECX);ptr=e.arg(1)
    width,height=size(obj);rect(obj,e.f(ptr),e.f(ptr+4),width,height);e.ret(8)
def relative_y(e):e.ret(4,floating=e.f(e.uc.reg_read(UC_X86_REG_ESP)+4)/size(OBJ)[1])
wl.bind(0x1003d4f4,set_size)
wl.bind(0x1003d4dc,set_position)
wl.bind(0x1003dd3c,relative_y)
wl.bind(0x1003dd38,lambda e:e.ret(8))
thumb_vectors=[]
# Geometry providers use original XML image-setter dimensions; window arithmetic supplied.
for height,button,doc,page,pos in [(94,26,300,94,0),(94,26,300,94,103),(94,26,300,94,206),(50,26,300,50,125)]:
    rect(OBJ,0,0,14.3,height);rect(DEC,0,0,28,button);rect(INC,0,height-27,28,27);rect(THUMB,0,0,14.3,40)
    for offset,value in [(0x328,doc),(0x32c,page),(0x338,pos),(0x33c,40),(0x3f0,0),(0x3f4,0)]:wl.fs(OBJ+offset,value)
    wl.invoke(0x10034a20)
    thumb_height=size(THUMB)[1];top=wl.f(THUMB+0xe4)
    track=max(0,height-2*button);expected_height=max(40,track*page/doc)
    assert size(THUMB)[0] == 28
    assert abs(thumb_height-expected_height)<1e-4
    assert abs(top-(button+(track-expected_height)*pos/(doc-page)))<1e-4
    thumb_vectors.append(dict(provider=dict(scrollbarWidth=14.3,height=height,decrementHeight=button,incrementHeight=27,topFrameHeight=0,leftFrameWidth=0),document=doc,page=page,position=pos,track=track,thumbWidth=size(THUMB)[0],thumbHeight=thumb_height,thumbTop=top,travel=track-thumb_height))

# Original text-changed visibility consumer with explicit formatted-area/font providers.
VERT,HORZ,FONT=0x2030000,0x2031000,0x2032000
wl.write(OBJ+0x4b8,VERT,HORZ)
wl.fs(FONT+0xbc,16)
wl.bind(0x1003d12c,lambda e:e.ret(value=FONT))
def area_provider(e):
    ptr=e.arg()
    for offset,value in [(0,0),(4,94),(8,0),(12,271.7)]:e.fs(ptr+offset,value)
    e.ret(4,value=ptr)
wl.callbacks[wl.read(VTABLE+0x13c)]=area_provider
def original_position(e):
    obj=e.uc.reg_read(UC_X86_REG_ECX)
    for offset in [0x328,0x32c,0x338]:base.fs(OBJ+offset,e.f(obj+offset))
    base.invoke(0x1009f340,[e.arg()])
    e.fs(obj+0x338,base.f(OBJ+0x338));e.ret(4)
wl.bind(0x1003dbd0,original_position)
for obj,doc,page in [(VERT,300,94),(HORZ,271.7,271.7)]:
    for offset,value in [(0x328,doc),(0x32c,page),(0x338,0)]:wl.fs(obj+offset,value)
wl.invoke(0x10022110)
assert wl.f(VERT+0x338)==110
ensure_vector=dict(document=300,page=94,lineSpacing=16,initial=0,position=wl.f(VERT+0x338))

layout=ET.parse(UI/'layouts/game_main_chat_shrinked.xml').getroot()
display=next(w for w in layout.iter('Window') if w.get('Name')=='edtDisplayBox')
props={p.get('Name'):p.get('Value') for p in display.findall('Property')}
scroll_props={k:v for k,v in props.items() if k.startswith('VertScrollbar')}
web=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text())
assets=[]
for property_name,value in scroll_props.items():
    if not value.startswith('set:'):continue
    set_name,image_name=value[4:].split(' image:')
    imageset=next(s for s in web['imagesets'] if s['attributes']['Name']==set_name)
    image=next(i for i in imageset['images'] if i['Name']==image_name)
    assets.append(dict(property=property_name,resource=value,image=image))
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
ranges={'CEGUIBase.dll':[(0x1009f340,0x1009f41c),(0x1009f490,0x1009f550),(0x1009ede0,0x1009ee30),(0x1009ef20,0x1009ef70),(0x1003a060,0x1003a0ac),(0x10016160,0x10016167),(0x1001e600,0x1001e650),(0x1001e6b0,0x1001ebba)],'CEGUIWindowsLook.dll':[(0x10022750,0x10022840),(0x10022a70,0x10022be6),(0x10023380,0x10023639),(0x10022290,0x1002231f),(0x10022110,0x1002217a),(0x10027980,0x10027a10),(0x100343a0,0x10034441),(0x100344b0,0x100346c0),(0x10034e90,0x10035070),(0x10034a20,0x10034bf8),(0x100346c0,0x100347cc),(0x10022e60,0x10022f55),(0x100347d0,0x1003489d)]}
raw={'CEGUIBase.dll':base.binary,'CEGUIWindowsLook.dll':wl.binary}
result=dict(status='PASS',layout=dict(resource='Data/ui/layouts/game_main_chat_shrinked.xml',display=props,scrollProperties=scroll_props),assets=assets,
 contract=dict(document='formatted line count * Font+0xbc line spacing',page='current textRenderArea height',step='max(1, Font+0xbc)',visibility='document > textRenderArea.height OR forcedVertMode; horizontal visibility may change the area',range='0..max(0,document-page)',wheel='position - step * MouseEventArgs+0x24 wheelChange',buttons='left button only: decrease/increase by step then original clamp',thumb='track=max(0,height-2*(decrementHeight+topFrameHeight)); thumb=max(minExtent,track*page/document); travel=track-thumb; top=(decrementHeight+topFrameHeight)+travel*position/(document-page)',minimumThumb=40,richEditScrollbarRelativeSize=[0.05,1],richEditScrollbarRelativePosition=[0.95,0],displaySize=[286,94],nominalScrollbarSize=[14.3,94],decrementSize=[28,26],incrementSize=[28,27],scrollbarFrameExtents=[0,0,0,0],battleTrackExtent=42,thumbWidth=28,childrenClippedByParent=True,thumbFrameTopHeight=28,thumbFrameBottomHeight=17,thumbFrameTileWidth=20,textChanged='onTextChanged calls formatText then ensureCaratIsVisible; ensure increments vertical position by page+lineSpacing then clamps'),
 execution=dict(position=position_vectors,buttons=button_vectors,normalImageSetters=setter_sizes,thumbFrameDraws=frame_draws,ensureCarat=ensure_vector,thumb=thumb_vectors),
 boundaries=['Window size/position/relativeY and thumb range providers supplied; original scrollbar thumb arithmetic executed.', 'Font line spacing, formatted line count and textRenderArea supplied by RichEdit layout; complete XML/font/mixed-text layout not executed.', 'Original normal-image setters execute with exact resource dimensions; button image copy and Window size notification boundaries supplied.', 'Thumb frame destination rectangles execute at native Image::draw; background tiling and final image clipping retained as static consumers.', 'Web scrollHeight/clientHeight and unconditional arrival-to-bottom remain display adaptations; original onTextChanged advances page+lineSpacing.'],
 disassembly={name:{hex(a):[f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(raw[name][a-0x10000000:z-0x10000000],a)] for a,z in rs} for name,rs in ranges.items()})
OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('PASS: original position clamps, button step consumers, thumb extent/position and short-track overflow; exact XML/image resources retained')
