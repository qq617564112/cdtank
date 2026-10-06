"""Execute original waiting MultiLine formatText with glyph/String/storage providers."""
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
OUT = ROOT / 'recovery/output/waiting-room-wrap-native.json'
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

FONT,VERT,HORZ,ROWS,ENTRY,IMAGE,SENTINEL=0x2010000,0x2011000,0x2012000,0x2020000,0x2030000,0x2031000,0x2032000
class NoProgress(Exception):pass
class Formatter(Engine):
 def __init__(self,width,page=102,ink_extra=0):
  super().__init__('CEGUIBase.dll');self.width=width;self.page=page;self.ink_extra=ink_extra;self.heap=0x2040000;self.rows=[];self.lookups=0;self.passes=0
  self.write(OBJ+0x40,FONT);self.fs(FONT+0xbc,16);self.write(FONT+4,SENTINEL);self.write(OBJ+0x35c,VERT,HORZ);self.uc.mem_write(OBJ+0x344,b'\x01');self.write(VTABLE+0x140,0x2095200);self.write(0x10111c58,0xffffffff)
  self.string(0x1018e740,'\n\t\r');self.string(0x10194218,'\n')
  self.callbacks[0x2095200]=self.area;self.callbacks[0x10031070]=self.show
  self.callbacks[0x10030d40]=lambda e:e.ret(value=e.read(e.uc.reg_read(UC_X86_REG_ECX)+0x11c))
  self.callbacks[0x10008aa0]=self.substring;self.callbacks[0x10005ff0]=self.assign
  self.callbacks[0x1002a740]=lambda e:e.ret();self.callbacks[0x100fde2e]=lambda e:e.ret()
  self.callbacks[0x1000dea0]=self.glyph;self.callbacks[0x1008fba0]=self.append
  self.callbacks[0x10087170]=lambda e:e.ret();self.callbacks[0x100315b0]=lambda e:e.ret()
 def chars(self,address):
  count=self.read(address);p=self.read(address+0x94) if self.read(address+4)>0x20 else address+0x14
  return ''.join(chr(self.read(p+4*i)) for i in range(count))
 def string(self,address,text):
  values=list(map(ord,text));count=len(values);self.write(address,count,max(0x20,count),0,0,0)
  p=address+0x14
  if count>0x20:p=self.heap;self.heap+=4*(count+1);self.write(address+0x94,p)
  self.write(p,*values,0)
 def substring(self,e):
  obj=e.uc.reg_read(UC_X86_REG_ECX);out,start,count=e.arg(),e.arg(1),e.arg(2);value=self.chars(obj)
  self.string(out,value[start:] if count==0xffffffff else value[start:start+count]);e.ret(12,out)
 def assign(self,e):
  obj=e.uc.reg_read(UC_X86_REG_ECX);value=self.chars(e.arg());start,count=e.arg(1),e.arg(2)
  self.string(obj,value[start:] if count==0xffffffff else value[start:start+count]);e.ret(12,obj)
 def show(self,e):
  obj=e.uc.reg_read(UC_X86_REG_ECX);e.write(obj+0x11c,e.arg());e.ret(4)
 def area(self,e):
  out=e.arg();w=self.width*(.95 if self.read(VERT+0x11c) else 1)
  for off,v in [(0,0),(4,self.page),(8,0),(12,w)]:e.fs(out+off,v)
  e.ret(4,out)
 def glyph(self,e):
  code=e.read(e.arg(1));advance=0 if code in [10,13] else 4 if code==9 else 6 if code<128 else 12
  self.write(ENTRY+0x10,IMAGE,advance);self.fs(IMAGE+0x20,0);self.fs(IMAGE+0x28,advance+(self.ink_extra if advance else 0));self.write(e.arg(),ENTRY);self.lookups+=1;e.ret(8,e.arg())
 def append(self,e):
  ptr=e.arg();start,count=e.read(ptr),e.read(ptr+4);extent=e.f(ptr+8)
  if count==0:
   self.stalled_row=dict(start=start,length=count,extent=extent)
   raise NoProgress(f'original row start={start}, length=0 cannot advance')
  row=dict(start=start,length=count,extent=extent,text=self.chars(OBJ+0x44)[start:start+count]);self.rows.append(row)
  self.write(ROWS+12*(len(self.rows)-1),start,count,bits(extent));self.write(OBJ+0x34c,ROWS,ROWS+12*len(self.rows));e.ret(4)
 def hook(self,uc,address,size,user):
  if address==0x1008feeb:self.rows=[];self.passes+=1
  super().hook(uc,address,size,user)
 def format(self,text):
  self.string(OBJ+0x44,text)
  try:self.invoke(0x1008fe70);status='PASS'
  except NoProgress as err:status='NO_PROGRESS'
  return dict(text=text,width=self.width,page=self.page,status=status,rows=self.rows,maximumExtent=self.f(OBJ+0x358),visible=bool(self.read(VERT+0x11c)),passes=self.passes,glyphLookups=self.lookups,stalledRow=getattr(self,'stalled_row',None))

vectors=[]
for name,text,width,expected in [
 ('Chinese','中文地图说明阅读',36,['中文地','图说明','阅读']),
 ('ASCII','abcdefghi',24,['abcd','efgh','i']),
 ('spaces stay in word','ab cd ef',24,['ab c','d ef']),
 ('paragraph newline belongs to row','甲乙\n丙丁',24,['甲乙\n','丙丁']),
 ('blank paragraphs','甲\n\n乙\n',24,['甲\n','\n','乙\n']),
 ('empty text','',24,[]),
 ('exact width','中文',24,['中文']),
 ('under exact width','中文',23,['中','文']),
 ('delimiter chunks','ab\tcd\ref',24,['ab\t','cd\ref']),
 ('source overflow reformat','中文说明阅读字符地图'*12,183,None),
 ('first glyph wider than area','中',11,None),
]:
 result=Formatter(width).format(text);result['name']=name
 if expected is not None:assert [r['text'] for r in result['rows']]==expected,result
 if name=='first glyph wider than area':assert result['status']=='NO_PROGRESS' and result['stalledRow']==dict(start=0,length=0,extent=0)
 else:assert result['status']=='PASS'
 if name=='source overflow reformat':assert result['passes']==2 and result['visible']
 vectors.append(result)
fraction=Formatter(16.500001,ink_extra=.25).format('ab\tcd');fraction['name']='fractional glyph image extent at float32 boundary';fraction['inkExtra']=.25;assert [r['text'] for r in fraction['rows']]==['ab\t','cd'];assert fraction['rows'][0]['extent']==16.5;vectors.append(fraction)
counter=Formatter(6,ink_extra=.25).format('ab');counter['name']='ink extent differs from fitting advance';counter['inkExtra']=.25;assert [r['text'] for r in counter['rows']]==['a','b'];assert counter['rows'][0]['extent']==0;vectors.append(counter)
md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32);binary=Formatter(183).binary
ranges=[(0x1008fe70,0x10090261),(0x10004c00,0x10004c98),(0x10011130,0x10011274),(0x1000e5a0,0x1000e658),(0x10104430,0x10104459),(0x10109420,0x10109449)]
out=dict(status='PASS',vectors=vectors,contract=dict(paragraphDelimiter='\n',wordDelimiters='\n\t\r',spaceIsDelimiter=False,newlineIncluded=True,trailingEmptyRow=False,zeroFittingPrefix='original emits zero length and cannot advance',overflow='show vertical scrollbar and re-enter the original formatting loop with narrower area'),providers=['CEGUI String substring/assignment storage and native global String values from verified initializers','line vector append/allocation/free storage','glyph map lookup, image width/offset and advance: Chinese12/ASCII6/tab4/newlineCR0','WL text area width/height and visibility setters','configureScrollbars and invalidate tail notifications, previously executed in DESC'],executed=['complete MultiLine formatText 0x1008fe70 through return','native String findFirstOf 0x10004c00','native Font getTextExtent 0x10011130','native Font getCharAtPixel 0x1000e5a0'],scope='Original paragraph/token selection, widths, fitting-prefix, line start/count/extent, maximum extent and overflow reformat execute. Glyph widths are providers; original Windows glyph pixels/editing are not claimed.',disassembly={hex(a):[f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(binary[a-0x10000000:z-0x10000000],a)] for a,z in ranges})
OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('PASS: original formatText/Font extent/fitting, 13 vectors including original overwide no-progress')
