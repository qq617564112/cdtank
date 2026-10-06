"""Execute original button state dispatcher and custom WindowsLook image consumers."""
import importlib.util,json,struct,sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('rich',ROOT/'recovery/evidence/chat/chat-rich-layout-source.py');rich=importlib.util.module_from_spec(spec);spec.loader.exec_module(rich)
OBJ,VT,END,STACK=rich.OBJ,rich.VT,rich.END,rich.STACK
sys.path.insert(0,str(ROOT/'recovery'));from effect_native import map_original_binaries
ui=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text());controls=next(l['windows'] for l in ui['layouts'] if l['path'].endswith('createroom.xml'))
def region(ref):
 if not ref:return None
 sn,im=ref[4:].split(' image:');sets=[s for s in ui['imagesets'] if s['attributes']['Name']==sn];s=next((s for s in sets if 'imagesets_dds/' in s['path']),sets[0]);return next(i for i in s['images'] if i['Name']==im)
class Native(rich.Native):
 def setup(self,name,alpha,selected=False):
  self.control=next(c for c in controls if c['name']==name);self.images=[];self.names={};self.alphaValue=alpha
  import re
  box=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',self.control['properties']['AbsoluteRect'])));self.width=box[2]-box[0];self.height=box[3]-box[1]
  self.write(VT+4,0x2097100);self.callbacks[0x2097100]=self.area
  self.bind(0x1003d154,self.area);self.bind(0x1003d150,lambda:self.ret(floating=alpha));self.bind(0x1003d144,self.custom)
  self.bind(0x1003d13c,self.copyrect);self.bind(0x1003d148,self.setalpha);self.bind(0x1003d14c,self.fourcolours)
  self.bind(0x1003d1a8,self.white);self.bind(0x1003d1a4,self.colourrect);self.bind(0x1003d130,self.colourrect)
  self.bind(0x1003d1a0,self.rectctor);self.bind(0x1003d140,self.image);self.bind(0x1003d128,lambda:self.ret(32,value=1))
  self.bind(0x1003d138,lambda:self.ret(value=0x2006000));self.write(0x2006000+0x18,0x2007000);self.fs(0x2007000+0x14,0)
  self.write(0x1003d134,0x2008000);self.fs(0x2008000,0);self.callbacks[0x10036a5c]=self.ftol
  self.putstr(OBJ+0x44,'');self.uc.mem_write(OBJ+0x32a,b'\0')
  for off in [0x32c,0x344,0x35c,0x374]:
   for d in [0,4,8,12]:self.fs(OBJ+off+d,1)
  self.uc.mem_write(OBJ+0x38c,bytes([selected]));self.uc.mem_write(OBJ+0x394,b'\1')
  for index,key in enumerate(['NormalImage','HoverImage','PushedImage','DisabledImage','CheckMarkImage']):
   im=region(self.control['properties'].get(key));ptr=0x2009000+index*0x100
   if self.control.get('type') != 'WindowsLook/RadioButton':
    if index<4:
     self.uc.mem_write(OBJ+0x38e+index,bytes([bool(im)]));self.names[OBJ+0x394+index*0x90]=key
     for d in range(4):
      for k in [0,4,8,12]:self.fs(OBJ+0x39c+index*0x90+d*24+k,1)
   else:
    field=[0x398,0x39c,0x3a0,0x3a8,0x3a4][index];self.write(OBJ+field,ptr if im else 0)
    if im:self.names[ptr]=key;self.fs(ptr+0x20,float(im['Width']));self.fs(ptr+0x24,float(im['Height']))
 def area(self):
  p=self.arg()
  for d,v in [(0,0),(4,self.height),(8,0),(12,self.width)]:self.fs(p+d,v)
  self.ret(4,value=p)
 def copyrect(self):self.uc.mem_write(self.ecx(),bytes(self.uc.mem_read(self.arg(),96)));self.ret(4,value=self.ecx())
 def setalpha(self):
  value=self.f(self.uc.reg_read(UC_X86_REG_ESP)+4)
  for d in range(4):self.fs(self.ecx()+d*24,value)
  self.ret(4)
 def fourcolours(self):
  for d in range(4):
   for k in [0,4,8,12]:self.fs(self.ecx()+d*24+k,1)
  self.ret(16,value=self.ecx())
 def white(self):
  vals=[self.f(self.uc.reg_read(UC_X86_REG_ESP)+4+d*4) for d in range(4)]
  for d,v in zip([4,8,12,0],vals):self.fs(self.ecx()+d,v)
  self.ret(16,value=self.ecx())
 def custom(self):
  self.images.append({'property':self.names[self.ecx()],'alpha':[self.f(self.ecx()+8+d*24) for d in range(4)]});self.ret(8)
 def image(self):
  p=self.arg();col=self.arg(3)
  self.images.append({'property':self.names[self.ecx()],'rect':[self.f(p+d) for d in [8,0,12,4]],'alpha':[self.f(col+d*24) for d in range(4)]});self.ret(28)
# Complete Base dispatcher and real pointer/capture state arithmetic.
uc,im=map_original_binaries([ROOT/'CDTank/CEGUIBase.dll']);uc.mem_map(0,4096);uc.mem_map(0x2000000,0x100000)
def wr(p,*v):uc.mem_write(p,struct.pack('<'+'I'*len(v),*v))
def rd(p):return struct.unpack('<I',uc.mem_read(p,4))[0]
def ret(cleanup=0,value=None):
 sp=uc.reg_read(UC_X86_REG_ESP)
 if value is not None:uc.reg_write(UC_X86_REG_EAX,value)
 uc.reg_write(UC_X86_REG_EIP,rd(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+cleanup)
state={'disabled':False,'inside':False};dispatch=[]
def hook(uc,p,size,user):
 if p==0x10030d10:ret(value=state['disabled'])
 elif p in [0x2097100,0x2097110,0x2097120,0x2097130]:dispatch.append({0x2097100:'Normal',0x2097110:'Hover',0x2097120:'Pushed',0x2097130:'Disabled'}[p]);ret(4)
 elif p==0x1002ce10:ret(value=0x2006000)
 elif p==0x10034cf0:ret(4,value=OBJ if state['inside'] else 0)
 elif p==0x100315b0:ret()
uc.hook_add(UC_HOOK_CODE,hook);wr(OBJ,VT)
for off,target in [(0xe4,0x2097100),(0xe8,0x2097110),(0xec,0x2097120),(0xf0,0x2097130)]:wr(VT+off,target)
wr(0x2006000+0x2c,0x2007000);wr(0x10197cb0,OBJ)
def invoke(entry,args=()):wr(STACK,END,*args);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OBJ);uc.emu_start(entry,END,count=1000);assert uc.reg_read(UC_X86_REG_EIP)==END
pointerRows=[]
for pushed,inside,disabled in [(False,False,False),(False,True,False),(True,True,False),(True,False,False),(False,False,True)]:
 state.update(inside=inside,disabled=disabled);uc.mem_write(OBJ+0x328,bytes([pushed]));invoke(0x1003f9e0,[0x2008000]);hover=uc.mem_read(OBJ+0x329,1)==b'\1';assert hover==(inside!=pushed);invoke(0x1003fba0,[0]);expected='Hover' if hover else 'Pushed' if pushed else 'Disabled' if disabled else 'Normal';assert dispatch[-1]==expected
 pointerRows.append({'pushed':pushed,'inside':inside,'disabled':disabled,'hovering':hover,'draw':dispatch[-1]})
