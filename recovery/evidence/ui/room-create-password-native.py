"""Execute original masked Editbox text, selection and caret consumers."""
import importlib.util
import json
import struct
from pathlib import Path
import capstone
import pefile
from unicorn.x86_const import *
from unicorn import UC_HOOK_CODE
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('rich',ROOT/'recovery/evidence/chat/chat-rich-layout-source.py')
rich=importlib.util.module_from_spec(spec);spec.loader.exec_module(rich)
OBJ,FONT,LOCAL,END=rich.OBJ,rich.FONT,0x2084000,rich.END
class Native(rich.Native):
    def putstr(self,p,s):
        self.strings[p]=s;self.write(p,len(s),32 if len(s)<=32 else len(s))
        target=p+0x14 if len(s)<=32 else self.alloc((len(s)+1)*4)
        if len(s)>32:self.write(p+0x94,target)
        self.uc.mem_write(target,struct.pack('<'+'I'*(len(s)+1),*[ord(c) for c in s],0))
    def extent(self,s):
        self.extents.append(s)
        return len(s)*7
    def setup(self,text,selected,focused):
        self.extents=[];self.brushes=[]
        self.putstr(OBJ+0x44,text)
        self.uc.mem_write(OBJ+0x329,b'\1');self.write(OBJ+0x32c,0x2a)
        self.write(OBJ+0x334,selected[1] if selected[1]>selected[0] else len(text),selected[0],selected[1]);self.write(OBJ+0x3e4,0)
        self.bind(0x1003d3e4,self.insert)
        self.bind(0x1003d3ec,lambda:self.ret(value=focused))
        self.bind(0x1003d138,lambda:self.ret(value=0x2006000))
        self.bind(0x1003d154,self.area)
        self.bind(0x1003d150,lambda:self.ret(floating=1))
        self.bind(0x1003d1a4,self.colourrect)
        self.bind(0x1003d144,lambda:self.ret(8))
        self.write(rich.VT+4,0x2097100);self.callbacks[0x2097100]=self.area
        self.write(0x2006000+0x18,0x2007000);self.fs(0x2007000+0x14,0)
        self.bind(0x1003d410,lambda:self.ret(value=self.read(OBJ+0x338)))
        self.bind(0x1003d404,lambda:self.ret(value=self.read(OBJ+0x33c)))
        self.bind(0x1003d40c,lambda:self.ret(value=self.read(OBJ+0x33c)-self.read(OBJ+0x338)))
        self.bind(0x1003d130,self.colourrect);self.bind(0x1003d148,self.alpha)
        self.bind(0x1003d128,self.drawtext)
        self.bind(0x1003d1ac,self.intersection);self.bind(0x1003d414,self.assignrect)
        self.bind(0x1003d370,lambda:self.ret())
        self.bind(0x1003d140,self.image);self.bind(0x1003d1a0,self.rectctor)
        self.callbacks[0x10036a5c]=self.ftol
        self.write(0x1003d134,0x2008000);self.fs(0x2008000,0)
        self.write(LOCAL+0x24,0x2006000);self.fs(0x2006000+0x18+0x14,0)
        for i,values in [(0x28,[0,16,0,136]),(0x64,[0,16,0,136])]:
            for d,v in enumerate(values):self.fs(LOCAL+i+d*4,v)
        self.fs(LOCAL+0x4c,1);self.uc.mem_write(LOCAL+0x17,bytes([focused]))
        for off in [0x3e8,0x400,0x418,0x430]:
            for d,v in zip((0,4,8,12),(0,1,1,1)):self.fs(OBJ+off+d,v)
        self.write(OBJ+0x4ec,0x2009000);self.fs(0x2009000+0x20,1)
        self.write(OBJ+0x4f0,0x2009100);self.uc.mem_write(OBJ+0x50c,b'\1')
        self.uc.reg_write(UC_X86_REG_ECX,OBJ);self.uc.reg_write(UC_X86_REG_ESP,LOCAL+0x400);self.uc.reg_write(UC_X86_REG_ESI,OBJ);self.uc.reg_write(UC_X86_REG_EBP,FONT)
        self.write(LOCAL+0x3fc,END)
    def area(self):
        p=self.arg()
        for d,v in [(0,0),(4,16),(8,0),(12,136)]:self.fs(p+d,v)
        self.ret(4,value=p)
    def insert(self):
        position,count,codepoint=self.arg(),self.arg(1),self.arg(2)
        self.setstr(self.ecx(),self.s(self.ecx())[:position]+chr(codepoint)*count+self.s(self.ecx())[position:],12)
    def alpha(self):
        for i in range(4):self.fs(self.ecx()+i*24,self.f(self.uc.reg_read(UC_X86_REG_ESP)+4))
        self.ret(4)
    def intersection(self):
        out,other=self.arg(),self.arg(1)
        a=[self.f(self.ecx()+d) for d in (0,4,8,12)];b=[self.f(other+d) for d in (0,4,8,12)]
        for d,v in enumerate([max(a[0],b[0]),min(a[1],b[1]),max(a[2],b[2]),min(a[3],b[3])]):self.fs(out+d*4,v)
        self.ret(8,value=out)
    def assignrect(self):self.uc.mem_write(self.ecx(),bytes(self.uc.mem_read(self.arg(),16)));self.ret(4,value=self.ecx())
    def image(self):
        p=self.arg();self.brushes.append({'kind':'caret' if self.ecx()==0x2009000 else 'selection','rect':[self.f(p+d) for d in (8,0,12,4)]})
        self.ret(28)
rows=[]
for label,text,selection,focus in [('Chinese','中文密码123',(0,0),1),('Selected','中文密码123',(1,4),1),('Long','中文密码123'*8,(20,25),1),('Blurred','中文密码123',(1,4),0)]:
    n=Native(136);n.setup(text,selection,focus)
    n.uc.emu_start(0x1000a420,0x1000aede,count=100000)
    assert n.uc.reg_read(UC_X86_REG_EIP)==0x1000aede
    drawn=''.join(d['text'] for d in n.draws)
    assert drawn=='*'*len(text),(label,drawn,n.draws)
    assert all(set(t)<= {'*'} for t in n.extents)
    assert any(b['kind']=='caret' for b in n.brushes)==bool(focus)
    assert any(b['kind']=='selection' for b in n.brushes)==bool(selection[1]-selection[0])
    rows.append({'label':label,'inputCodepointCount':len(text),'maskCodepoint':'U+002A','draws':n.draws,'extentInputs':n.extents,'brushes':n.brushes,'selection':selection,'focused':bool(focus)})
# Execute original constructor default field writes and actual masked setter.
import sys
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from unicorn import UC_HOOK_CODE
base,images=map_original_binaries([ROOT/'CDTank/CEGUIBase.dll'])
base.mem_map(0,4096);base.mem_map(0x2000000,0x100000)
base.reg_write(UC_X86_REG_ESI,OBJ);base.reg_write(UC_X86_REG_EBX,0)
base.emu_start(0x100580b9,0x100580cf,count=10)
assert base.mem_read(OBJ+0x329,1)==b'\0'
assert struct.unpack('<I',base.mem_read(OBJ+0x32c,4))[0]==42
base.mem_write(OBJ,struct.pack('<I',0x2002000));base.mem_write(0x2002000+0x148,struct.pack('<I',0x2090100))
def hook(uc,p,size,user):
    if p==0x2090100:
        sp=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EIP,struct.unpack('<I',uc.mem_read(sp,4))[0]);uc.reg_write(UC_X86_REG_ESP,sp+8)
base.hook_add(UC_HOOK_CODE,hook)
base.mem_write(rich.STACK,struct.pack('<III',END,1,0));base.reg_write(UC_X86_REG_ESP,rich.STACK);base.reg_write(UC_X86_REG_ECX,OBJ)
base.emu_start(0x10054c90,END,count=1000)
assert base.mem_read(OBJ+0x329,1)==b'\1'
parts=[];md=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
for dll,ranges in [('CEGUIBase.dll',[(0x100580b9,0x1005811a),(0x10054c90,0x10054cee)]),('CEGUIWindowsLook.dll',[(0x1000a6a6,0x1000af47)]),('CDTank.exe',[(0x4a25c6,0x4a262e)])]:
    pe=pefile.PE(str(ROOT/'CDTank'/dll));binary=pe.get_memory_mapped_image();start=pe.OPTIONAL_HEADER.ImageBase;parts.append(dll)
    for a,z in ranges:parts.extend(f'{i.address:08x} {i.mnemonic} {i.op_str}' for i in md.disasm(binary[a-start:z-start],a))
result={'status':'PASS','defaultMasked':False,'defaultMaskCodepoint':'U+002A','roomPasswordEnable':'CDTank.exe0x4a25c6 resolves CreateRoomDlg/edtPassword;0x4a2628 calls Editbox::setTextMasked(true)','vectors':rows,'providers':['CEGUI String construction/copy/substr/insert/destruction; insert repeats actual native-supplied codepoint/count','Font extent7 per glyph and line16; Font::drawText/Image::draw record entries','Source text/clip rectangle, background render, and color providers; native complete draw entry/mask/selection/caret branches and arithmetic execute'],'boundary':'Not native font glyph width, original OS input/IME, GPU or framebuffer.'}
(ROOT/'recovery/output/room-create-password-native.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(ROOT/'recovery/output/room-create-password-native.disasm.txt').write_text('\n'.join(parts)+'\n')
print('PASS: original default mask, setter, 4 masked text/selection/caret vectors')
