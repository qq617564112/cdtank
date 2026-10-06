"""Execute original MultiLine normal read-only drawSelf and renderText."""
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
OUT = ROOT / 'recovery/output/waiting-room-description-draw-native.json'
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
        self.uc.emu_start(address, RETURN, count=200000)
        assert self.uc.reg_read(UC_X86_REG_EIP) == RETURN
    def bind(self, iat, callback):
        target = 0x2094000 + len(self.callbacks) * 16
        self.write(iat, target)
        self.callbacks[target] = callback


FONT,VERT,HORZ,ROWS,SYSTEM,RENDERER=0x2010000,0x2011000,0x2012000,0x2020000,0x2030000,0x2031000
base=Engine('CEGUIBase.dll')
base.write(OBJ+0x40,FONT);base.write(OBJ+0x35c,VERT,HORZ);base.write(OBJ+0x34c,ROWS,ROWS+36)
base.write(OBJ+0x334,0,0);base.uc.mem_write(OBJ+0x328,b'\x01')
base.write(SYSTEM+0x18,RENDERER);base.fs(RENDERER+0x14,1)
base.callbacks[0x1002ce10]=lambda e:e.ret(value=SYSTEM)
base.callbacks[0x10030e60]=lambda e:e.ret(floating=e.alpha)
base.callbacks[0x10030d70]=lambda e:e.ret(value=0)
base.callbacks[0x1002a740]=lambda e:e.ret()
base.write(VTABLE+0x140,0x2095200);base.write(VTABLE+4,0x2095300);base.write(VTABLE+0x150,0x2095400)
base.callbacks[0x2095400]=lambda e:e.ret(4)
def area(e):
 out=e.arg()
 for off,v in [(0,0),(4,102),(8,0),(12,183)]:e.fs(out+off,v)
 e.ret(4,out)
def outer(e):
 out=e.arg()
 for off,v in [(0,20),(4,122),(8,30),(12,213)]:e.fs(out+off,v)
 e.ret(4,out)
base.callbacks[0x2095200]=area;base.callbacks[0x2095300]=outer;base.callbacks[0x10034c50]=outer
strings={OBJ+0x44:'中文\n地图\n说明'}
def substring(e):
 obj=e.uc.reg_read(UC_X86_REG_ECX);out,start,count=e.arg(),e.arg(1),e.arg(2)
 strings[out]=strings[obj][start:start+count];e.ret(12,out)
base.callbacks[0x10008aa0]=substring
base.draws=[]
def draw(e):
 ptr=e.arg(1);clip=e.arg(3);colour=e.arg(5)
 e.draws.append(dict(text=strings[e.arg()],rect=[e.f(ptr+i) for i in [0,4,8,12]],clip=[e.f(clip+i) for i in [0,4,8,12]],format=e.arg(4),colour=[e.f(colour+i) for i in range(0,16,4)]))
 e.ret(32,1)
base.callbacks[0x10013030]=draw
for i,(start,length) in enumerate([(0,3),(3,3),(6,2)]):base.write(ROWS+12*i,start,length,bits(24))
# Packed colours are actual CEGUI cache fields, consumed by the original colour constructors.
for colour in [0x36c,0x384,0x39c,0x3b4]:
 base.write(OBJ+colour+0x10,0xffffffff);base.uc.mem_write(OBJ+colour+0x14,b'\x01')
vectors=[]
for spacing in [14.390625,15.58984375,28.78125]:
 for scroll in [0,13.25]:
  for alpha in [1,.5]:
   base.fs(FONT+0xbc,spacing);base.fs(VERT+0x338,scroll);base.fs(HORZ+0x338,2.5);base.alpha=alpha;base.draws=[]
   base.invoke(0x1008e1b0,[bits(.3)])
   assert len(base.draws)==3,base.draws
   for index,d in enumerate(base.draws):
    assert abs(d['rect'][0]-(20-scroll+index*spacing))<.0001,d
    assert abs(d['rect'][2]-27.5)<.0001,d
    assert d['clip']==[20,127,30,213] and d['format']==0,d
    assert all(abs(a-b)<.00001 for a,b in zip(d['colour'],[int(alpha*255)/255,1,1,1])),d
   vectors.append(dict(lineSpacing=spacing,verticalScroll=scroll,horizontalScroll=2.5,effectiveAlpha=alpha,draws=base.draws))
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
ranges=[(0x1008e1b0,0x1008e28c),(0x10087650,0x10087cc0)]
out=dict(status='PASS',vectors=vectors,normalClipBottomExpansion=base.f(0x1011e784),providers=['Window text render area/outer rectangle and external clip','System renderer z and effective alpha getter','CEGUI String substring storage/line vector','Font drawText call boundary; glyph raster from separately executed original FreeType'],executed=['complete MultiLine drawSelf 0x1008e1b0','complete MultiLine renderText 0x10087650 normal read-only branch','original Rect offset/intersection and colour/ColourRect constructors'],disassembly={hex(a):[f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(base.binary[a-0x10000000:z-0x10000000],a)] for a,z in ranges})
OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('PASS: 12 complete read-only draw vectors / 36 Font draws')
