"""Sample the original SIMSUN face for static text and all supported map descriptions."""
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
OUT = ROOT / 'recovery/output/waiting-room-font-native.json'
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
        self.uc.hook_add(UC_HOOK_CODE, self.hook, begin=0x2090000, end=0x20a0000)
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
        self.uc.emu_start(address, RETURN, count=20000000)
        assert self.uc.reg_read(UC_X86_REG_EIP) == RETURN
    def bind(self, iat, callback):
        target = 0x2094000 + len(self.callbacks) * 16
        self.write(iat, target)
        self.callbacks[target] = callback

from unicorn import UC_HOOK_MEM_INVALID
from PIL import Image, ImageDraw
class FreeType(Engine):
 def __init__(self):
  super().__init__('CEGUIBase.dll');self.uc.mem_map(0x3000000,0x1000000);self.uc.mem_map(0x4000000,0x4000000);self.heap=0x4000000;self.allocations={};self.free_blocks=[]
  self.uc.hook_add(UC_HOOK_MEM_INVALID,self.invalid)
  self.bind(0x1010f120,lambda e:e.ret(value=self.allocate(e.arg())))
  self.bind(0x1010f11c,self.free);self.bind(0x1010f154,self.realloc);self.bind(0x1010f0ec,self.memmove)
  self.bind(0x1010f148,lambda e:e.ret(value=0))
  self.bind(0x1010f128,self.strncpy);self.bind(0x1010f124,self.strncmp)
  self.bind(0x1010f110,self.strchr)
 def invalid(self,uc,access,address,size,value,user):
  raise RuntimeError(f'unmapped {address:x} at {uc.reg_read(UC_X86_REG_EIP):x}')
 def allocate(self,size):
  size=(size+15)&~15
  for i,(p,n) in enumerate(self.free_blocks):
   if n>=size:self.free_blocks.pop(i);self.allocations[p]=n;return p
  p=self.heap;self.heap+=size;self.allocations[p]=size;return p
 def free(self,e):
  p=e.arg()
  if p:self.free_blocks.append((p,self.allocations.pop(p)))
  e.ret()
 def realloc(self,e):
  old,size=e.arg(),e.arg(1);new=self.allocate(size)
  if old:
   n=self.allocations[old];self.uc.mem_write(new,bytes(self.uc.mem_read(old,min(n,size))));self.free_blocks.append((old,self.allocations.pop(old)))
  e.ret(value=new)
 def memmove(self,e):
  p,src,n=e.arg(),e.arg(1),e.arg(2)
  if n:self.uc.mem_write(p,bytes(self.uc.mem_read(src,n)))
  e.ret(value=p)
 def cstr(self,p):
  n=0
  while self.uc.mem_read(p+n,1)!=b'\x00':n+=1
  return bytes(self.uc.mem_read(p,n))
 def strncpy(self,e):
  p,src,n=e.arg(),e.arg(1),e.arg(2);s=self.cstr(src)[:n];self.uc.mem_write(p,s+b'\x00'*(n-len(s)));e.ret(value=p)
 def strncmp(self,e):
  a,b,n=e.arg(),e.arg(1),e.arg(2);aa,bb=self.cstr(a)[:n],self.cstr(b)[:n];e.ret(value=(aa>bb)-(aa<bb))
 def strchr(self,e):
  p,c=e.arg(),e.arg(1)&255;s=self.cstr(p)+b'\x00';i=s.find(bytes([c]));e.ret(value=0 if i<0 else p+i)
 def call(self,address,args):
  self.invoke(address,args);return self.uc.reg_read(UC_X86_REG_EAX)

e=FreeType();libout,faceout=0x2010000,0x2011000
assert e.call(0x100d0110,[libout])==0;library=e.read(libout);print('original FT_Init_FreeType',hex(library),flush=True)
font=(UI/'fonts/MINGLIU.TTC').read_bytes();e.uc.mem_write(0x3000000,font)
assert e.call(0x100cd940,[library,0x3000000,len(font),0,faceout])==0;face=e.read(faceout);print('original FT_New_Memory_Face',hex(face),flush=True)
assert e.call(0x100ce9c0,[face,0,9*64,96,96])==0
print('face metrics',[(hex(i),struct.unpack('<h',e.uc.mem_read(face+i,2))[0]) for i in [0x44,0x46,0x48,0x4a]],'ppem',struct.unpack('<2H',e.uc.mem_read(e.read(face+0x58)+0xc,4)),flush=True)
rows=[]
static_characters='中文地图说明阅读字符ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
map_descriptions=[dict(mode=mode,mapId=int(row['values']['MapID']),name=row['values']['MapName'],text=row['values']['MapInfo']) for mode in range(1,6) for row in json.loads((ROOT/f'recovery/output/verified/tables/m00{mode}.json').read_text())['rows']]
characters=''.join(sorted(set(static_characters).union(*(set(row['text']+row['name']) for row in map_descriptions)),key=ord))
assert len(characters)==454
print('supported map descriptions',len(map_descriptions),'finite glyph union',len(characters),flush=True)
for dpi in [96,103,192]:
 assert e.call(0x100ce9c0,[face,0,9*64,dpi,dpi])==0
 glyphs=[]
 for c in characters:
  assert e.call(0x100cd900,[face,ord(c),0x1004])==0
  slot=e.read(face+0x54);bitmap=slot+0x4c
  width,height,pitch=[e.read(bitmap+i) for i in [4,0,8]]
  mode=bytes(e.uc.mem_read(bitmap+0x12,1))[0];buf=e.read(bitmap+0x0c)
  assert mode==1,(dpi,c,mode)
  raw=bytes(e.uc.mem_read(buf,abs(pitch)*height)) if buf and height else b''
  pixels=[]
  for y in range(height):
   for x in range(width): pixels.append(255 if (raw[y*abs(pitch)+(x>>3)]>>(7-(x&7)))&1 else 0)
  assert c==' ' or any(pixels),(dpi,c,'empty original bitmap')
  glyphs.append(dict(character=c,codepoint=ord(c),width=width,height=height,pitch=pitch,pixelMode=mode,advance=e.read(slot+0x40)>>6,inkX=struct.unpack('<i',e.uc.mem_read(slot+0x20,4))[0]>>6,inkY=-(struct.unpack('<i',e.uc.mem_read(slot+0x24,4))[0]>>6),pixels=pixels))
 atlasW=max(1,sum(max(1,g['width'])+1 for g in glyphs));atlasH=max(1,max((g['height'] for g in glyphs),default=1));atlas=Image.new('L',(atlasW,atlasH));x=0
 for g in glyphs:
  g['x']=x;g['y']=0
  if g['width'] and g['height']: atlas.putdata([0]* (atlasW*atlasH)) if False else None;
  if g['width'] and g['height']:
   atlas.paste(Image.frombytes('L',(g['width'],g['height']),bytes(g['pixels'])),(x,0))
  if g['width'] and g['height']:assert list(atlas.crop((x,0,x+g['width'],g['height'])).get_flattened_data())==g['pixels']
  del g['pixels'];x+=max(1,g['width'])+1
 atlasPath=ROOT/f'recovery/output/web-assets/ui/fonts/SIMSUN-mono-{dpi}.png';atlasPath.parent.mkdir(parents=True,exist_ok=True);rgba=Image.new('RGBA',atlas.size,(255,255,255,0));rgba.putalpha(atlas);rgba.save(atlasPath)
 assert set(rgba.getchannel('A').get_flattened_data())=={0,255}
 assert all(pixel[:3]==(255,255,255) for pixel in rgba.get_flattened_data())
 coverage=[dict(mode=row['mode'],mapId=row['mapId'],length=len(row['text']),missing=''.join(c for c in row['text'] if ord(c) not in {g['codepoint'] for g in glyphs})) for row in map_descriptions]
 assert all(not row['missing'] for row in coverage)
 name_coverage=[dict(mode=row['mode'],mapId=row['mapId'],name=row['name'],missing=''.join(c for c in row['name'] if ord(c) not in {g['codepoint'] for g in glyphs})) for row in map_descriptions]
 assert all(not row['missing'] for row in name_coverage)
 print('sampled DPI',dpi,'glyphs',len(glyphs),'all-map missing0','atlas',atlasW,atlasH,flush=True)
 e.write(OBJ+0xc8,0x2013000);e.write(0x2013004,face);e.uc.reg_write(UC_X86_REG_ESI,OBJ);e.uc.reg_write(UC_X86_REG_EBP,STACK+0x100);e.uc.reg_write(UC_X86_REG_ECX,0x2013000);e.uc.reg_write(UC_X86_REG_ESP,STACK)
 e.uc.emu_start(0x10010b1f,0x10010b4a,count=100)
 baseline=e.f(OBJ+0xc0)
 e.uc.reg_write(UC_X86_REG_ESI,OBJ);e.uc.reg_write(UC_X86_REG_EBP,STACK+0x100);e.uc.reg_write(UC_X86_REG_ECX,0x2013000);e.uc.reg_write(UC_X86_REG_ESP,STACK)
 e.uc.emu_start(0x10010b4a,0x10010b77,count=100)
 spacing=e.f(OBJ+0xbc)
 rows.append(dict(dpi=dpi,pointSize=9,nativeResolution=[800,600],lineSpacing=spacing,baseline=baseline,atlas=dict(asset=f'ui/fonts/SIMSUN-mono-{dpi}.png',width=atlasW,height=atlasH),glyphs=glyphs))
OUT.write_text(json.dumps(dict(status='PASS',font='SIMSUN',source='Data/ui/fonts/SIMSUN.font → MINGLIU.TTC',libraryVersion=[e.read(library+i) for i in [0xc,0x10,0x14]],faces=rows,descriptionCoverage=coverage,mapNameCoverage=name_coverage,finiteCharacters=characters,scope='Original statically linked FreeType Init/New_Memory_Face/Set_Char_Size/Load_Char from CEGUIBase.dll; CRT memory/String operations are providers. Raw original TTC face0, point9, DPI 96/103/192, loadFlags0x1004; mono atlas pixels are original FT bitmap bytes.'),ensure_ascii=False,indent=2)+'\n')
(ROOT/'recovery/output/web-assets/ui-font-raster.json').write_text(OUT.read_text())
print('PASS: 1362 original mono samples / 26 descriptions and names each DPI missing0',flush=True)
