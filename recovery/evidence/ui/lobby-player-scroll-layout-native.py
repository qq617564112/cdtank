"""Execute the supplied WLListbox scrollbar layout with explicit child rectangles."""
import json, struct, sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CEGUIWindowsLook.dll'])
uc.mem_map(0x2000000,0x100000)
OBJ,VERT,HORZ,STACK,RETURN=0x2001000,0x2002000,0x2003000,0x2080000,0x2090000
read=lambda a:struct.unpack('<I',uc.mem_read(a,4))[0]
f=lambda a:struct.unpack('<f',uc.mem_read(a,4))[0]
def ints(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def floats(a,*v):uc.mem_write(a,struct.pack('<'+'f'*len(v),*v))
def ret(n,value=0):
 sp=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,read(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+n)
def rect(a,x,y,w,h):floats(a+0xe4,y,y+h,x,x+w)
calls=[];visible=False
for i,(iat,name) in enumerate([(0x1003d37c,'relative'),(0x1003d36c,'visible'),(0x1003d4f4,'size'),(0x1003d4dc,'position')]):ints(iat,0x2091000+i*16)
def hook(uc,a,size,user):
 sp=uc.reg_read(UC_X86_REG_ESP);obj=uc.reg_read(UC_X86_REG_ECX)
 if a==0x2091000:
  out,ptr=read(sp+4),read(sp+8);floats(out,f(ptr)/170,f(ptr+4)/420);ret(8,out)
 elif a==0x2091010:ret(0,int(visible))
 elif a in [0x2091020,0x2091030]:
  mode,ptr=read(sp+4),read(sp+8);v=[f(ptr),f(ptr+4)];assert mode==0
  x,y,w,h=f(obj+0xec),f(obj+0xe4),f(obj+0xf0)-f(obj+0xec),f(obj+0xe8)-f(obj+0xe4)
  if a==0x2091020:w,h=v[0]*170,v[1]*420;kind='size'
  else:x,y=v[0]*170,v[1]*420;kind='position'
  rect(obj,x,y,w,h);calls.append({'child':'vertical' if obj==VERT else 'horizontal','kind':kind,'relative':v,'rectangle':[x,y,w,h]});ret(8)
uc.hook_add(UC_HOOK_CODE,hook);vectors=[]
for visible in [False,True]:
 calls=[];rect(OBJ,0,0,170,420);rect(VERT,0,0,8.5,420);rect(HORZ,0,0,170,8.5);ints(OBJ+0x32c,VERT,HORZ);ints(STACK,RETURN);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OBJ);uc.emu_start(0x100102f0,RETURN,count=1000)
 assert uc.reg_read(UC_X86_REG_EIP)==RETURN
 assert abs(f(VERT+0xec)-161.5)<.001
 assert abs(f(HORZ+0xf0)-(161.5 if visible else 170))<.001
 vectors.append({'verticalVisible':visible,'calls':calls})
result={'status':'PASS','source':'CEGUIWindowsLook.dll WLListbox::layoutComponentWidgets 0x100102f0','vectors':vectors,'providers':'List rectangle170x420; existing child vertical8.5x420/horizontal170x8.5; Window coordinate setters/relative conversion/visibility. Initial factory width and final framebuffer not established here.','property':'Original playerlist.xml VertScrollbarThumbMinExtent53','limits':['Initial child scrollbar dimensions are explicit providers','Font/raster/row/document extent remain Web projection']}
(ROOT/'recovery/output/lobby-player-scroll-layout-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS original WLListbox layout2 vectors')
