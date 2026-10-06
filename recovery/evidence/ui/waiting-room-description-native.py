"""Execute waiting MultiLine reading rectangle and scrollbar consumers."""
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
OUT = ROOT / 'recovery/output/waiting-room-description-native.json'
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

base=Engine('CEGUIBase.dll');wl=Engine('CEGUIWindowsLook.dll')
VERT,HORZ,FONT,AREA,THUMB,INC,DEC=0x2010000,0x2011000,0x2012000,0x2013000,0x2014000,0x2015000,0x2016000
wl.write(OBJ+0x35c,VERT,HORZ)
def rect(e,obj,x,y,width,height):
 for offset,value in [(0xe4,y),(0xe8,y+height),(0xec,x),(0xf0,x+width)]:e.fs(obj+offset,value)
def size(e,obj):return e.f(obj+0xf0)-e.f(obj+0xec),e.f(obj+0xe8)-e.f(obj+0xe4)
def visible(e):e.ret(value=e.read(e.uc.reg_read(UC_X86_REG_ECX)+0x11c))
wl.bind(0x1003d36c,visible)
wl.bind(0x1003d370,lambda e:e.ret())
def setter_size(e):
 obj=e.uc.reg_read(UC_X86_REG_ECX);ptr=e.arg(1);w,h=e.f(ptr),e.f(ptr+4)
 if e.arg()==0:w*=183;h*=102
 rect(e,obj,e.f(obj+0xec),e.f(obj+0xe4),w,h);e.ret(8)
def setter_position(e):
 obj=e.uc.reg_read(UC_X86_REG_ECX);ptr=e.arg(1);x,y=e.f(ptr),e.f(ptr+4)
 if e.arg()==0:x*=183;y*=102
 rect(e,obj,x,y,*size(e,obj));e.ret(8)
def relative(e):
 out=e.arg();ptr=e.arg(1);e.fs(out,e.f(ptr)/183);e.fs(out+4,e.f(ptr+4)/102);e.ret(8,out)
wl.bind(0x1003d4f4,setter_size);wl.bind(0x1003d4dc,setter_position);wl.bind(0x1003d37c,relative)
rect(wl,OBJ,0,0,183,102);layout=[];areas=[]
for shown in [False,True]:
 wl.write(VERT+0x11c,int(shown));wl.write(HORZ+0x11c,0)
 wl.invoke(0x1001a750)
 actual=[wl.f(VERT+0xec),wl.f(VERT+0xe4),*size(wl,VERT)]
 assert all(abs(a-b)<.0001 for a,b in zip(actual,[173.85,0,9.15,102])),actual
 layout.append(dict(visible=shown,rect=actual))
 wl.invoke(0x1001a430,[AREA]);area=[wl.f(AREA+i) for i in [0,4,8,12]]
 assert all(abs(a-b)<.0001 for a,b in zip(area,[0,102,0,173.85 if shown else 183])),area
 areas.append(dict(visible=shown,area=area))
# MultiLine configureScrollbars dispatches its own text-area slot and common Scrollbar setters.
base.write(OBJ+0x35c,VERT,HORZ);base.write(VTABLE+0x140,0x2095200)
base.write(OBJ+0x40,FONT);base.fs(FONT+0xbc,16)
visibility=[]
def show(e):
 obj=e.uc.reg_read(UC_X86_REG_ECX);e.write(obj+0x11c,e.arg());e.ret(4)
def text_area(e):
 ptr=e.arg();right=173.85 if e.read(VERT+0x11c) else 183
 for i,v in [(0,0),(4,102),(8,0),(12,right)]:e.fs(ptr+i,v)
 e.ret(4,ptr)
base.callbacks[0x2095200]=text_area;base.callbacks[0x10031070]=show
base.callbacks[0x10030d40]=visible;base.callbacks[0x1009eb50]=lambda e:e.ret(value=AREA)
base.write(AREA+0x8c,0)
for addr,offset in [(0x1009e530,0x328),(0x1009e5b0,0x32c),(0x1009e630,0x330)]:
 def store(e,off=offset):e.fs(e.uc.reg_read(UC_X86_REG_ECX)+off,e.f(e.uc.reg_read(UC_X86_REG_ESP)+4));e.ret(4)
 base.callbacks[addr]=store
base.callbacks[0x1009f340]=lambda e:e.ret(4)
base.callbacks[0x10034790]=lambda e:e.ret(8)
base.callbacks[0x10034800]=lambda e:e.ret(8)
for lines in [1,6,7,32]:
 base.write(OBJ+0x34c,AREA+0x1000,AREA+0x1000+lines*12);base.fs(OBJ+0x358,150)
 base.write(VERT+0x11c,0);base.write(HORZ+0x11c,0);base.invoke(0x10087170)
 row=dict(lines=lines,visible=bool(base.read(VERT+0x11c)),document=base.f(VERT+0x328),page=base.f(VERT+0x32c),step=base.f(VERT+0x330));assert row['visible']==(lines*16>102) and row['document']==lines*16 and row['page']==102 and row['step']==16,row
 visibility.append(row)
# Execute actual MultiLine wheel -> original shared clamp.
del base.callbacks[0x1009f340]
base.callbacks[0x10032880]=lambda e:e.ret(4)
base.write(VERT,VTABLE)
wheel=[]
for initial,change,expected in [(0,-1,16),(16,1,0),(180,-2,206)]:
 for offset,value in [(0x328,308),(0x32c,102),(0x330,16),(0x338,initial)]:base.fs(VERT+offset,value)
 base.fs(EVENT+0x24,change);base.invoke(0x100869b0,[EVENT]);actual=base.f(VERT+0x338);assert actual==expected
 wheel.append(dict(initial=initial,wheelChange=change,position=actual))
# The same WLVertScrollbar is created by MultiLine's original component factory.
wl.write(OBJ+0x340,THUMB,INC,DEC)
wl.bind(0x1003d4f4,lambda e:(rect(e,e.uc.reg_read(UC_X86_REG_ECX),0,0,e.f(e.arg(1)),e.f(e.arg(1)+4)),e.ret(8)))
wl.bind(0x1003d4dc,lambda e:(rect(e,e.uc.reg_read(UC_X86_REG_ECX),e.f(e.arg(1)),e.f(e.arg(1)+4),*size(e,e.uc.reg_read(UC_X86_REG_ECX))),e.ret(8)))
wl.bind(0x1003dd3c,lambda e:e.ret(4,floating=e.f(e.uc.reg_read(UC_X86_REG_ESP)+4)/size(e,OBJ)[1]));wl.bind(0x1003dd38,lambda e:e.ret(8))
thumb=[]
for scale in [1,420/391,2]:
 height=102*scale;button=round(26*scale);inc=round(27*scale);doc=512*scale;page=height
 for pos in [0,(doc-page)/2,doc-page]:
  rect(wl,OBJ,0,0,9.15*scale,height);rect(wl,DEC,0,0,round(28*scale),button);rect(wl,INC,0,height-inc,round(28*scale),inc);rect(wl,THUMB,0,0,1,10)
  for off,val in [(0x328,doc),(0x32c,page),(0x338,pos),(0x33c,10),(0x3f0,0),(0x3f4,0)]:wl.fs(OBJ+off,val)
  wl.invoke(0x10034a20);track=max(0,height-2*button);want=max(10,track*page/doc);top=button+(track-want)*pos/(doc-page)
  actualheight=size(wl,THUMB)[1];actualtop=wl.f(THUMB+0xe4);assert abs(actualheight-want)<.0001 and abs(actualtop-top)<.0001
  thumb.append(dict(scale=scale,height=height,document=doc,page=page,position=pos,thumbHeight=actualheight,thumbTop=actualtop,thumbWidth=size(wl,THUMB)[0],minimum=10))
# Original fitting-prefix counts characters using glyph advances, including exact-boundary inclusion.
STR,GLYPH,NODE=0x2030000,0x2031000,0x2032000
base.callbacks[0x1000dea0]=lambda e:(base.write(e.arg(),GLYPH),e.ret(8,value=e.arg()))
base.write(FONT+4,NODE);base.write(GLYPH+0x14,12)
base.write(STR,8,0x20);base.uc.mem_write(STR+0x14,struct.pack('<8I',*map(ord,'中文说明阅读字符')))
fitting=[]
for width,expected in [(11,0),(12,1),(24,2),(47,3),(96,8),(100,8)]:
 base.invoke(0x1000e5a0,[STR,0,bits(width),bits(1)],FONT);actual=base.uc.reg_read(UC_X86_REG_EAX);assert actual==expected
 fitting.append(dict(width=width,advance=12,count=actual))
# Source base defaults: word wrap true and minimum thumb 10.
base.uc.reg_write(UC_X86_REG_ESI,OBJ);base.uc.reg_write(UC_X86_REG_ESP,STACK)
base.uc.emu_start(0x1008ea2d,0x1008ea78,count=1000);assert bytes(base.uc.mem_read(OBJ+0x344,1))==b'\x01'
base.uc.reg_write(UC_X86_REG_ESI,OBJ);base.uc.reg_write(UC_X86_REG_ESP,STACK)
base.uc.emu_start(0x1009f2dc,0x1009f2f8,count=1000);assert base.f(OBJ+0x33c)==10
web=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text());control=next(c for l in web['layouts'] if l['path'].endswith('room_main.xml') for c in l['windows'] if c['name']=='edtMapDesc')
props=control['properties'];assert props['NormalTextColour']=='FFFFFFFF' and all(not v for k,v in props.items() if ('Thumb' in k or k.endswith('FrameImage')))
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);ranges={'CEGUIBase.dll':[(0x10087170,0x1008741a),(0x100869b0,0x10086a3d),(0x1008e9f0,0x1008eafe),(0x1008fe70,0x10090250),(0x1000e5a0,0x1000e658),(0x1009f280,0x1009f33b),(0x10087650,0x1008777a)],'CEGUIWindowsLook.dll':[(0x1001a430,0x1001a522),(0x1001a750,0x1001a8ce),(0x10034a20,0x10034bf8)]}
raw={'CEGUIBase.dll':base.binary,'CEGUIWindowsLook.dll':wl.binary}
output=dict(status='PASS',source=control,layout=layout,areas=areas,configure=visibility,wheel=wheel,thumb=thumb,fitting=fitting,defaults=dict(wordWrap=True,minimumThumb=10),scope='Original MultiLine layout/getTextRenderArea/configureScrollbars/wheel and original WLVertScrollbar geometry plus Font fitting-prefix. Window size/relative conversion/visibility notifications, font line spacing and glyph advances, formatted line vector and final glyph draw are providers. Full MultiLine formatText/OS/GPU is retained as disassembly, not executed.',disassembly={name:{hex(a):[f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(raw[name][a-0x10000000:z-0x10000000],a)] for a,z in rs} for name,rs in ranges.items()})
OUT.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n');print('PASS: 2 layout/areas, 4 configure, 3 wheel, 9 thumb, 6 fitting-prefix vectors')
