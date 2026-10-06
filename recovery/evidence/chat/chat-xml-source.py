"""Execute embedded TinyXML and RichEdit XML traversal with value providers."""
import importlib.util
import json
from pathlib import Path
import struct
import capstone
import pefile
from unicorn.x86_const import UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_EDI
ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('rich', Path(__file__).with_name('chat-rich-layout-source.py'))
rich = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rich)

class Native(rich.Native):
    def __init__(self, text):
        super().__init__(10000)
        self.events = []
        self.receive = None
        if any(0x2581 <= ord(c) <= 0x259e for c in text):
            text = self.expand_receive(text)
        self.attribute_sets = {}
        self.bind(0x1003d484, lambda: self.ret(4))
        self.bind(0x1003db58, lambda: self.setstr(self.ecx(),self.s(self.ecx()) + chr(self.arg(1))*self.arg(),8))
        self.bind(0x1003dc60, self.attrinit)
        self.bind(0x1003dc5c, self.attradd)
        self.bind(0x1003dc58, lambda: self.ret())
        self.bind(0x1003dc50, lambda: self.ret(8,floating=float(self.attribute_sets[self.ecx()].get(self.s(self.arg()),self.f(self.uc.reg_read(UC_X86_REG_ESP)+8)))))
        self.bind(0x1003dd78, lambda: self.stdput(self.ecx(), self.cstr(self.arg())))
        self.bind(0x1003dd74, lambda: self.stdput(self.ecx(), self.stdget(self.arg())))
        self.bind(0x1003dd6c, lambda: self.stdput(self.ecx(), self.stdget(self.ecx()) + self.stdget(self.arg())))
        self.bind(0x1003dd7c, lambda: self.stdput(self.ecx(), self.stdget(self.ecx()) + self.cstr(self.arg())))
        self.bind(0x1003dd70, lambda: self.ret())
        self.bind(0x1003dde4, self.snprintf)
        self.bind(0x1003dd44, self.widebytes)
        self.bind(0x1003dd48, self.bytewide)
        self.bind(0x1003ddcc, lambda: self.ret(value=int(chr(self.arg() & 255).isascii() and chr(self.arg() & 255).isalnum())))
        self.bind(0x1003ddd0, lambda: self.ret(value=int(chr(self.arg() & 255).isascii() and chr(self.arg() & 255).isalpha())))
        self.bind(0x1003ddd4, lambda: self.ret(value=ord(chr(self.arg() & 255).lower())))
        self.bind(0x1003ddd8, lambda: self.ret(value=int(self.arg() in [9,10,11,12,13,32])))
        self.bind(0x1003ddc8, self.strncmp)
        self.bind(0x1003ddc4, self.strchr)
        self.callbacks[0x10036b50] = lambda: self.ret(value=0)
        self.callbacks[0x10036a5c] = self.ftol
        self.callbacks[0x1002778f] = lambda: self.uc.reg_write(UC_X86_REG_EIP,rich.END)
        self.callbacks[0x10027884] = self.parseerror
        self.callbacks[0x10027914] = self.parseerror
        # Providers expose the original String codepoint storage used by native conversion.
        self.putstr(rich.OBJ+0x44,text)
        cps=self.alloc((len(text)+1)*4)
        self.write(cps,*[ord(c) for c in text],0)
        self.write(rich.OBJ+0x44,len(text), max(33,len(text)))
        self.write(rich.OBJ+0x44+0x94,cps)
        # Static work buffers normally allocated on first format call.
        for flag,obj,unit in [(0x100770dc,0x100770cc,1),(0x100758a4,0x10075894,2),(0x100758b8,0x100758a8,2)]:
            p=self.alloc(0x4000)
            self.write(flag,1);self.write(obj+4,p,p+0x4000,p+0x4000)
        for d in [0,4,8,12]:self.fs(rich.OBJ+0x4c8+d,1)
    def expand_receive(self,text):
        image=pefile.PE(str(ROOT/'CDTank/CDTank.exe')).get_memory_mapped_image()
        self.uc.mem_map(0x400000,(len(image)+4095)&~4095)
        self.uc.mem_write(0x400000,image)
        frame=self.alloc(0x200)+0x100
        ptr=self.alloc(4)
        inp=self.alloc(0x100)
        prefix='<emote name='
        suffix=' red=255 green=255 blue=255 alpha=255/>'
        self.uc.mem_write(frame-0x70+4,prefix.encode()+b'\0');self.write(frame-0x58,len(prefix),15)
        q=self.alloc(len(suffix)+1);self.uc.mem_write(q,suffix.encode()+b'\0')
        self.write(frame-0x50,q);self.write(frame-0x3c,40)
        self.write(frame+8,inp);self.write(frame-0x18,len(prefix));self.write(frame-0x20,len(text)-1)
        values=[]
        def index():
            self.write(ptr,ord(text[self.arg()]));self.ret(4,value=ptr)
        def append():
            values.append(chr(self.read(self.arg())));self.ret(4)
        def number():
            raw=('%03d'%self.arg(3)).encode();self.uc.mem_write(self.arg(),raw+b'\0');self.ret(value=len(raw))
        self.callbacks[0x2090800]=index;self.write(0x5c034c,0x2090800)
        self.callbacks[0x4122f7]=append
        self.callbacks[0x57c0d6]=number
        self.callbacks[0x579ad0]=lambda:self.ret(value=len(self.cstr(self.arg())))
        self.uc.reg_write(UC_X86_REG_EBP,frame);self.uc.reg_write(UC_X86_REG_EBX,0);self.uc.reg_write(UC_X86_REG_EDI,len(suffix))
        self.uc.reg_write(UC_X86_REG_ESP,rich.STACK)
        self.uc.emu_start(0x4124ab,0x412589,count=100000)
        assert self.uc.reg_read(UC_X86_REG_EIP)==0x412589
        result=''.join(reversed(values))
        self.receive=dict(input=text,output=result,nativeRange=['0x004124ab','0x00412589'],provider='CEGUI indexing, vector prepend, CRT length/number formatting')
        return result
    def stdget(self,p): return self.cstr(self.read(p+4) if self.read(p+24)>=16 else p+4)
    def stdput(self,p,s):
        raw=s.encode();q=self.alloc(len(raw)+1);self.uc.mem_write(q,raw+b'\0')
        self.write(p+4,q);self.write(p+20,len(raw),max(16,len(raw)));self.ret(4,value=p)
    def attrinit(self): self.attribute_sets[self.ecx()]={};self.ret(value=self.ecx())
    def attradd(self): self.attribute_sets[self.ecx()][self.s(self.arg())]=self.s(self.arg(1));self.ret(8)
    def attrstring(self):
        values=self.attribute_sets.get(self.ecx(),{})
        p=self.alloc(0x98);self.putstr(p,values.get(self.s(self.arg()),self.s(self.arg(1))));self.ret(8,value=p)
    def snprintf(self):
        fmt=self.cstr(self.arg(2));vals=[self.arg(i) for i in range(3,7)]
        s=fmt%tuple(vals);self.uc.mem_write(self.arg(),s.encode()+b'\0');self.ret(value=len(s))
    def widebytes(self):
        p,n,out,cap=self.arg(2),self.arg(3),self.arg(4),self.arg(5)
        raw=bytes(self.uc.mem_read(p,n*2)).decode('utf-16le').encode('utf-8')
        assert len(raw)<=cap;self.uc.mem_write(out,raw);self.ret(32,value=len(raw))
    def bytewide(self):
        p,n,out,cap=self.arg(2),self.arg(3),self.arg(4),self.arg(5)
        raw=bytes(self.uc.mem_read(p,n)).decode('utf-8').encode('utf-16le')
        assert len(raw)//2<=cap;self.uc.mem_write(out,raw);self.ret(24,value=len(raw)//2)
    def strncmp(self):
        a=bytes(self.uc.mem_read(self.arg(),self.arg(2))).split(b'\0')[0]
        b=bytes(self.uc.mem_read(self.arg(1),self.arg(2))).split(b'\0')[0]
        self.ret(value=(a>b)-(a<b))
    def strchr(self):
        p=self.arg();raw=self.cstr(p).encode()+b'\0';idx=raw.find(bytes([self.arg(1)&255]));self.ret(value=p+idx if idx>=0 else 0)
    def parseerror(self): self.events.append(dict(kind='parse-error'));self.uc.reg_write(UC_X86_REG_EIP,rich.END)
    def hook(self,uc,p,size,user):
        if p==0x10003bd0:self.events.append(dict(kind='parse',xml=self.cstr(self.arg()),encoding=self.arg(2)))
        if p==0x100261a0:
            self.attrs=self.attribute_sets[self.arg(1)]
            self.events.append(dict(kind='element',name=self.s(self.arg()),attributes=dict(self.attrs)))
        if p==0x10026c10:self.events.append(dict(kind='text',text=self.s(self.arg()),argb=hex(self.read(rich.OBJ+0x528))))
        super().hook(uc,p,size,user)

def run():
    vectors=[]
    inputs=['你好','你好<emote name=001 red=255 green=255 blue=255 alpha=255/>中国','中文<emote name=001/>','你好&amp;中国','你好<tag>朋友</tag>中国','你好<tag/>中国','你好<中国','你好 & 中国','你好  中国','你好\n中国','你好▁中国','中文<emote name="001"/>','甲&#x41;&#65;乙','甲&bogus;乙','甲<tag','甲<tag>乙','  甲\t乙  ','<colour red=255 green=0 blue=0 alpha=255>甲</colour>乙','甲&lt;tag&gt;乙','A<colour red=255 green=0 blue=0 alpha=255>红</colour>B','A<colour>空</colour>B','A<emote name=001 red=255 green=255 blue=255 alpha=255>中</emote>B','A<colour red=255 green=0 blue=0 alpha=255>R<colour red=0 green=0 blue=255 alpha=255>U</colour>C</colour>D','A<image name=001/>B','A<emote/>B','A<emote name=999/>B']
    for text in inputs:
        n=Native(text)
        try:
            n.invoke(0x10027370)
            vectors.append(dict(input=text,receive=n.receive,events=n.events,lines=n.lines(),nativeEntriesExecuted=[hex(p) for p in [0x10027370,0x10003bd0,0x10001450,0x10027100,0x100261a0,0x10026c10,0x10026110] if p in n.visited]))
        except Exception as e:
            vectors.append(dict(input=text,status='BLOCKED',error=str(e),events=n.events))
    boundaries=[v for v in vectors if v.get('status')=='BLOCKED']
    vectors=[v for v in vectors if v.get('status')!='BLOCKED']
    assert len(vectors)==23
    assert vectors[10]['receive']['output']=='你好<emote name=001 red=255 green=255 blue=255 alpha=255/>中国'
    assert [i['kind'] for i in vectors[10]['lines'][0]['items']]==['text','emote','text']
    assert [e['text'] for e in vectors[12]['events'] if e['kind']=='text']==['甲AA乙']
    assert vectors[14]['lines']==[] and vectors[15]['lines']==[]
    assert [e['argb'] for e in vectors[19]['events'] if e['kind']=='text']==['0xffffffff','0xffff0000','0xffffffff']
    out=dict(status='PASS',vectors=vectors,boundaries=boundaries,providers=['CEGUI String and XMLAttributes values','MSVCP std::string values','CRT character/format/allocation operations','Windows UTF-8/UTF-16 conversion','font and sequence pointers from rich-layout source','colour fields alpha/red/green/blue and ARGB conversion'],nativeParser='CEGUIWindowsLook.dll embedded TinyXML document 0x10003bd0; native tree traversal 0x10027100',scope='formatText through final line commit; stop before scrollbar/OS window notifications')
    (ROOT/'recovery/output/chat-xml-source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
    (ROOT/'recovery/output/chat-xml-source.disasm.txt').write_text('\n'.join(f'{i.address:08x} {i.mnemonic} {i.op_str}' for a,z in [(0x10027370,0x1002778f),(0x10027100,0x10027367),(0x10003bd0,0x10003e50),(0x100183d0,0x100184c3)] for i in md.disasm(n.binary[a-0x10000000:z-0x10000000],a))+'\n')
    exe=pefile.PE(str(ROOT/'CDTank/CDTank.exe')).get_memory_mapped_image()
    with (ROOT/'recovery/output/chat-xml-source.disasm.txt').open('a') as stream:
        stream.write('\n'+ '\n'.join(f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(exe[0x124ab:0x12589],0x4124ab))+'\n')
    print(out['status'],len(vectors),'native XML vectors')
if __name__=='__main__':run()
