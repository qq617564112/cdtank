"""Execute native RichEdit text/emote layout with explicit string/font providers."""
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import *
ROOT = Path(__file__).resolve().parents[3]
OBJ, VT, FONT, STACK, END = 0x2001000, 0x2002000, 0x2003000, 0x2080000, 0x2090000

class Native:
    def __init__(self, width):
        self.uc = Uc(UC_ARCH_X86, UC_MODE_32)
        self.binary = pefile.PE(str(ROOT/'CDTank/CEGUIWindowsLook.dll')).get_memory_mapped_image()
        self.uc.mem_map(0x10000000, (len(self.binary)+4095)&~4095)
        self.uc.mem_write(0x10000000, self.binary)
        self.uc.mem_map(0, 4096)
        self.uc.mem_map(0x2000000, 0x100000)
        self.heap = 0x2010000
        self.callbacks, self.strings, self.attrs = {}, {}, {}
        self.draws = []
        self.visited = set()
        self.width = width
        for dest, source in [(0x1007f3b8,0x10045b04),(0x1007bd20,0x10045b0c),(0x1007d610,0x10045b14),(0x1007a3b0,0x10045b1c),(0x1007e5d8,0x1003de40)]:
            self.putstr(dest,self.cstr(source))
        self.write(OBJ, VT)
        self.write(VT+0x13c, 0x2090100)
        self.callbacks[0x2090100] = self.area
        self.fs(FONT+0xbc, 16)
        self.write(OBJ+0x528, 0xffffffff)
        self.bind(0x1003d12c, lambda: self.ret(value=FONT))
        self.bind(0x1003d10c, lambda: self.ret())
        self.bind(0x1003d3e8, lambda: self.setstr(self.ecx(), ''))
        self.bind(0x1003dbc4, lambda: self.setstr(self.ecx(), self.cstr(self.arg()), 4))
        self.bind(0x1003d310, self.copystr)
        self.bind(0x1003d3e0, self.copystr)
        self.bind(0x1003dc54, self.appendstr)
        self.bind(0x1003db5c, lambda: self.setstr(self.ecx(), ''))
        self.bind(0x1003dc38, lambda: self.setstr(self.ecx(), self.cstr(self.arg())[:self.arg(1)], 8))
        self.bind(0x1003d3dc, self.substr)
        self.bind(0x1003dbd4, self.find)
        self.bind(0x1003d3d8, lambda: self.ret(8, floating=self.extent(self.s(self.arg()))))
        self.bind(0x1003d3f0, self.charpixel)
        self.bind(0x1003d630, self.colour)
        self.bind(0x1003d48c, self.copycolour)
        self.bind(0x1003d5ec, self.argbcolour)
        self.bind(0x1003dc4c, self.colourargb)
        self.bind(0x1003d11c, lambda: self.ret(value=int(self.s(self.arg()) == self.s(self.arg(1)))))
        self.bind(0x1003dc50, lambda: self.ret(8, floating=float(self.attrs.get(self.s(self.arg()), 0))))
        self.bind(0x1003dc44, lambda: self.ret(8, value=int(self.attrs.get(self.s(self.arg()), 'false') == 'true')))
        self.bind(0x1003dc48, self.attrstring)
        self.bind(0x1003dc40, lambda: self.ret(value=0x2004000))
        self.bind(0x1003dc3c, lambda: self.ret(4, value=self.sequences[self.s(self.arg())]))
        self.bind(0x1003ddf8, lambda: self.ret(value=self.alloc(self.arg())))
        self.bind(0x1003ddf4, lambda: self.ret())
        self.bind(0x1003ddec, self.memmove)
        # Native vector destruction still executes; String destructor supplied above.
        self.uc.hook_add(UC_HOOK_CODE, self.hook)
        self.sequences = {}
        sequences = json.loads((ROOT/'recovery/output/chat-emote-render-source.json').read_text())['sequences']
        for row in sequences:
            ptr = self.alloc(0xc0)
            rect = row['frames'][0]['rectangle']
            self.fs(ptr+0xb8, float(rect['Width']))
            self.fs(ptr+0xbc, float(rect['Height']))
            self.sequences[row['name']] = ptr
        # Imported String::npos object: provider address, not a layout decision.
        self.write(0x1003d408, 0x2090200)
        self.write(0x2090200, 0xffffffff)
    def alloc(self, size):
        p = self.heap
        self.heap += (size+15)&~15
        assert self.heap < 0x2070000
        return p
    def write(self, p, *v): self.uc.mem_write(p, struct.pack('<'+'I'*len(v), *[x&0xffffffff for x in v]))
    def read(self, p): return struct.unpack('<I', self.uc.mem_read(p, 4))[0]
    def fs(self,p,v): self.uc.mem_write(p, struct.pack('<f',v))
    def f(self,p): return struct.unpack('<f', self.uc.mem_read(p,4))[0]
    def ecx(self): return self.uc.reg_read(UC_X86_REG_ECX)
    def arg(self,n=0): return self.read(self.uc.reg_read(UC_X86_REG_ESP)+4+n*4)
    def cstr(self,p):
        data=bytearray()
        while self.uc.mem_read(p+len(data),1) != b'\0': data += self.uc.mem_read(p+len(data),1)
        return data.decode('utf-8')
    def s(self,p): return self.strings[p] if p in self.strings else self.cstr(p)
    def putstr(self,p,s): self.strings[p]=s; self.write(p,len(s))
    def setstr(self,p,s,cleanup=0): self.putstr(p,s); self.ret(cleanup,value=p)
    def ret(self,cleanup=0,value=None,floating=None):
        if value is not None: self.uc.reg_write(UC_X86_REG_EAX,value)
        if floating is not None:
            self.fs(0x2090300,floating)
            trampoline=0x2090400+cleanup*16
            self.uc.mem_write(trampoline,b'\xd9\x05'+struct.pack('<I',0x2090300)+b'\xc2'+struct.pack('<H',cleanup))
            self.uc.reg_write(UC_X86_REG_EIP,trampoline)
        else:
            sp=self.uc.reg_read(UC_X86_REG_ESP)
            self.uc.reg_write(UC_X86_REG_EIP,self.read(sp)); self.uc.reg_write(UC_X86_REG_ESP,sp+4+cleanup)
    def bind(self,iat,callback):
        p=0x2091000+16*len(self.callbacks);self.callbacks[p]=callback;self.write(iat,p)
    def hook(self,uc,p,size,user):
        self.visited.add(p)
        if p in self.callbacks:self.callbacks[p]()
    def invoke(self,p,args=(),obj=OBJ):
        self.write(STACK,END,*args)
        self.uc.reg_write(UC_X86_REG_ESP,STACK);self.uc.reg_write(UC_X86_REG_ECX,obj)
        try:self.uc.emu_start(p,END,count=1000000)
        except Exception as e:raise RuntimeError(f'{e}; EIP={self.uc.reg_read(UC_X86_REG_EIP):08x}') from e
        assert self.uc.reg_read(UC_X86_REG_EIP)==END
    def area(self):
        p=self.arg()
        for d,v in [(0,0),(4,94),(8,0),(12,self.width)]:self.fs(p+d,v)
        self.ret(4,value=p)
    def copystr(self): self.setstr(self.ecx(),self.s(self.arg()),4)
    def appendstr(self):self.setstr(self.ecx(),self.s(self.ecx())+self.s(self.arg()),4)
    def substr(self):
        out,start,count=self.arg(),self.arg(1),self.arg(2)
        self.setstr(out,self.s(self.ecx())[start:start+count],12)
    def find(self):
        s=self.s(self.ecx());i=s.find('\n',self.arg(1));self.ret(8,value=i if i>=0 else 0xffffffff)
    def extent(self,s):return sum(14 if ord(c)>127 else 7 for c in s if c!='\n')
    def charpixel(self):
        s=self.s(self.arg());start=self.arg(1);limit=self.f(self.uc.reg_read(UC_X86_REG_ESP)+12)
        x=0;i=start
        for c in s[start:]:
            x+=self.extent(c)
            if x>limit:break
            i+=1
        self.ret(16,value=i)
    def colour(self):
        for d in [0,4,8,12]:self.fs(self.ecx()+d,1)
        self.write(self.ecx()+16,0xffffffff);self.uc.mem_write(self.ecx()+20,b'\1');self.ret(value=self.ecx())
    def copycolour(self): self.uc.mem_write(self.ecx(),bytes(self.uc.mem_read(self.arg(),24)));self.ret(4,value=self.ecx())
    def argbcolour(self):
        v=self.arg()
        for d,shift in [(0,24),(4,16),(8,8),(12,0)]:self.fs(self.ecx()+d,((v>>shift)&255)/255)
        self.write(self.ecx()+16,v);self.uc.mem_write(self.ecx()+20,b'\1');self.ret(4,value=self.ecx())
    def colourargb(self):
        c=self.ecx();v=sum(round(self.f(c+d)*255)<<shift for d,shift in [(0,24),(4,16),(8,8),(12,0)])
        self.ret(value=v)
    def attrstring(self):
        p=self.alloc(0x98);self.putstr(p,self.attrs[self.s(self.arg())]);self.ret(8,value=p)
    def memmove(self):
        dest,src,n=self.arg(),self.arg(1),self.arg(2)
        self.uc.mem_write(dest,bytes(self.uc.mem_read(src,n)));self.ret(value=dest)
    def text(self,s):
        p=self.alloc(0x98);self.putstr(p,s);self.invoke(0x10026c10,[p])
    def emote(self,name):
        p=self.alloc(0x98);self.putstr(p,'emote')
        self.attrs=dict(name=name,red='255',green='255',blue='255',alpha='255')
        self.invoke(0x100261a0,[p,0x2005000])
    def render(self):
        self.bind(0x1003d138,lambda:self.ret(value=0x2006000))
        self.write(0x2006000+0x18,0x2007000)
        self.fs(0x2007000+0x14,0)
        self.write(0x1003d134,0x2008000)
        self.fs(0x2008000,0)
        self.bind(0x1003d150,lambda:self.ret(floating=1))
        self.bind(0x1003d490,lambda:self.ret(value=0))
        self.bind(0x1003d498,self.colourargb)
        self.bind(0x1003d17c,self.argbcolour)
        self.bind(0x1003d1a0,self.rectctor)
        self.bind(0x1003d1a4,self.colourrect)
        self.bind(0x1003dc2c,self.drawseq)
        self.bind(0x1003d128,self.drawtext)
        # Original CRT float-to-integer conversion returns the integer from ST0.
        self.callbacks[0x10036a5c]=self.ftol
        for off in [0x4c8,0x4e0,0x4f8,0x510]:
            for d in [0,4,8,12]:self.fs(OBJ+off+d,1)
            self.write(OBJ+off+16,0xffffffff)
            self.uc.mem_write(OBJ+off+20,b'\1')
        p=self.alloc(16)
        for d,v in [(0,10),(4,104),(8,20),(12,20+self.width)]:self.fs(p+d,v)
        self.invoke(0x100243e0,[p,p])
        return self.draws
    def ftol(self):
        # fstp + fistp at supplied CRT boundary preserves x87 stack discipline.
        self.uc.mem_write(0x2090500,b'\xdb\x1d'+struct.pack('<I',0x2090600)+b'\xa1'+struct.pack('<I',0x2090600)+b'\xc3')
        self.uc.reg_write(UC_X86_REG_EIP,0x2090500)
    def rectctor(self):
        # CEGUI stores top,bottom,left,right; ctor args left,top,right,bottom.
        vals=[self.f(self.uc.reg_read(UC_X86_REG_ESP)+4+i*4) for i in range(4)]
        for d,v in zip([8,0,12,4],vals):self.fs(self.ecx()+d,v)
        self.ret(16,value=self.ecx())
    def colourrect(self):
        for i in range(4):self.uc.mem_write(self.ecx()+i*24,bytes(self.uc.mem_read(self.arg(),24)))
        self.ret(4,value=self.ecx())
    def drawseq(self):
        p=self.arg();self.draws.append(dict(kind='emote',name=next(n for n,v in self.sequences.items() if v==self.ecx()),rect=[self.f(p+d) for d in [8,0,12,4]]))
        self.ret(28)
    def drawtext(self):
        p=self.arg(1);self.draws.append(dict(kind='text',text=self.s(self.arg()),rect=[self.f(p+d) for d in [8,0,12,4]]))
        self.ret(32,value=1)
    def finish(self):
        self.invoke(0x10026110,[OBJ+0x32c],OBJ+0x4a4)
    def lines(self):
        result=[]
        for p in range(self.read(OBJ+0x4a8),self.read(OBJ+0x4ac),0x14):
            items=[]
            for q in range(self.read(p+8),self.read(p+12),0xc4):
                t=self.read(q)
                items.append(dict(kind='text' if t==0 else 'emote',text=self.s(q+0x24) if t==0 else None,
                  name=next((n for n,s in self.sequences.items() if s==self.read(q+4)),None) if t==1 else None,
                  width=self.f(q+0xbc),height=self.f(q+0xc0),colour=[self.f(q+0xc+d) for d in [0,4,8,12]]))
            result.append(dict(width=self.f(p),items=items))
        return result

def run():
    vectors=[]
    for width,chunks in [(286,[('text','收到消息：你好'),('emote','001'),('text','一起开火'),('emote','002'),('emote','030')]),(80,[('text','你好'),('emote','001'),('text','中国朋友'),('emote','002')]),(42,[('text','你好中国'),('emote','001')]),(80,[('text','你好\n中国'),('emote','001')]),(16,[('emote','001')]),(42,[('emote','026')]),(42,[('text','你好'),('emote','001'),('text','中国')]),(42,[('text','你好中国\n')]),(42,[('text','AB CDEF')]),(42,[('emote','024'),('text','中文')])]:
        n=Native(width)
        for kind,value in chunks:getattr(n,kind)(value)
        n.finish()
        vectors.append(dict(width=width,chunks=chunks,lines=n.lines(),draws=n.render(),nativeEntriesExecuted=[hex(p) for p in [0x100261a0,0x10026c10,0x10026110,0x10025470,0x10024c00,0x100243e0] if p in n.visited]))
    assert [[line['width'] for line in v['lines']] for v in vectors] == [[202],[72,44],[42,30],[28,44],[16],[0,50],[28,30,14],[42,14,0],[42,7],[62,0]]
    assert vectors[0]['draws'][1]['rect'] == [119,10,134,24]
    assert vectors[1]['draws'][3]['rect'][1] == 26
    assert vectors[8]['lines'][0]['items'][0]['text'] == 'AB CDE'
    out=dict(status='PASS',providers=dict(font='Explicit 14 Chinese / 7 ASCII advance; 16 font line spacing. Metrics are supplied, not claimed as native font measurements.',strings='CEGUI String/XMLAttributes value provider; native layout/vector code executes.',sequence='Original seqimage image rectangle dimensions'),vectors=vectors)
    (ROOT/'recovery/output/chat-rich-layout-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print('PASS: native text/emote layout and native formatted-line vectors')
if __name__=='__main__':run()
