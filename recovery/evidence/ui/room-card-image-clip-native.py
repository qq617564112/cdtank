"""Execute original Window parent clipping for the two room-card team images."""
import json, struct, sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CEGUIBase.dll'])
BASE,CHILD,PARENT,VTABLE,STACK,RETURN,OUT,SYSTEM,RENDERER=0x2000000,0x2001000,0x2002000,0x2003000,0x2080000,0x2090000,0x2091000,0x2004000,0x2005000
uc.mem_map(BASE,0x100000)
def ints(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def floats(a,v):uc.mem_write(a,struct.pack('<4f',*v))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def rect(a):return list(struct.unpack('<4f',uc.mem_read(a,16)))
def ret(n,value=None):
 sp=uc.reg_read(UC_X86_REG_ESP)
 if value is not None:uc.reg_write(UC_X86_REG_EAX,value)
 uc.reg_write(UC_X86_REG_EIP,read(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+n)
current={}
def hook(uc,address,size,user):
 if address==0x1002ce10:ret(0,SYSTEM)
 elif address in [0x10034c50,0x2092000,0x2092100]:
  target=read(uc.reg_read(UC_X86_REG_ESP)+4)
  key='screen' if address==0x2092100 else 'parent' if uc.reg_read(UC_X86_REG_ECX)==PARENT else 'child'
  floats(target,current[key]);ret(4,target)
uc.hook_add(UC_HOOK_CODE,hook)
ints(CHILD,VTABLE);ints(PARENT,VTABLE);ints(CHILD+0x3c,PARENT);ints(VTABLE+8,0x2092000);ints(SYSTEM+0x18,RENDERER);ints(RENDERER,VTABLE);ints(VTABLE+0x4c,0x2092100)
ui=json.loads((ROOT/'recovery/output/web-assets/ui.json').read_text());layout=next(l for l in ui['layouts'] if l['path'].endswith('roomlist_icon.xml'));controls={w['name']:w for w in layout['windows']}
import re
def box(name):return list(map(float,re.findall(r'-?\d+\.\d+',controls[name]['properties']['AbsoluteRect'])))
rows=[]
for name in ['maomao','gougou']:
 control=controls[name];assert control['parent']=='picModeNormal' and 'ClippedByParent' not in control['properties'];parent=controls[control['parent']];assert parent['properties']['FrameEnabled']=='False' and parent['properties']['ClippedByParent']=='False'
 b=box(name);p=box(control['parent']);xy=[b[0]+p[0],b[1]+p[1],b[2]+p[0],b[3]+p[1]]
 for scale in [1,1.8,3]:
  torect=lambda v:[v[1]*scale,v[3]*scale,v[0]*scale,v[2]*scale]
  current={'child':torect(xy),'parent':torect(p),'screen':[0,600*scale,0,800*scale]}
  for clipped in [True,False]:
   uc.mem_write(CHILD+0x11f,bytes([clipped]));uc.mem_write(PARENT+0x11f,b'\0');ints(STACK,RETURN,OUT);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,CHILD);uc.emu_start(0x10039ae0,RETURN,count=10000)
   actual=rect(OUT);c=current['child'];q=current['parent'] if clipped else current['screen'];expected=[max(c[0],q[0]),min(c[1],q[1]),max(c[2],q[2]),min(c[3],q[3])];assert all(abs(a-b)<.0001 for a,b in zip(actual,expected))
   rows.append({'name':name,'scale':scale,'clippedByParent':clipped,'child':c,'parent':current['parent'],'clip':actual})
result={'status':'PASS','rows':rows,'scope':'Original getPixelRect/getInnerRect recursion and Rect intersection; XML absolute outer/inner rectangles and renderer extent supplied as providers. Source parent has no frame. Constructor default true reuses chat-scroll-source.md; no GPU execution.'}
(ROOT/'recovery/output/room-card-image-clip-native.json').write_text(json.dumps(result,indent=2)+'\n');print('PASS12 original source parent clip True/False at three scales')
