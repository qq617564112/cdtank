"""Execute original prgCrossbar drawSelf with source colour and effective alpha."""
import json
import struct
import sys
from pathlib import Path
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,images=map_original_binaries([ROOT/'CDTank/CEGUIWindowsLook.dll'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x100000)
OBJ,VTABLE,STACK,RETURN,SYSTEM,RENDERER,BACKGROUND,FILL= [0x2001000+n*0x1000 for n in range(8)]
STUB,TEMP=0x2020000,0x2030000

def word(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def floating(a,*v):uc.mem_write(a,struct.pack('<'+'f'*len(v),*v))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def floats(a,n=4):return list(struct.unpack('<'+'f'*n,uc.mem_read(a,n*4)))
def f32(v):return struct.unpack('<f',struct.pack('<f',v))[0]
imports={s.address:s.name.decode() for e in images['ceguiwindowslook.dll'].DIRECTORY_ENTRY_IMPORT for s in e.imports if s.name}
handlers={};events=[];rect=[0,28,0,179];effective_alpha=1
for index,a in enumerate([0x1003d138,0x1003d154,0x1003d144,0x1003d150,0x1003d1a4,0x1003d148,0x1003d140,0x1003d1a0,0x1003d130,0x1003d17c]):
 t=STUB+index*0x100;word(a,t);handlers[t]=imports[a]
word(OBJ,VTABLE);word(VTABLE+4,STUB+0x1000);handlers[STUB+0x1000]='outerClip'
word(0x1003d134,TEMP+0x10);floating(TEMP+0x10,0)
word(SYSTEM+0x18,RENDERER);floating(RENDERER+0x14,0)
# The original compiler conversion truncates ST(0); execute its small FISTP body.
uc.mem_write(0x10036a5c,bytes.fromhex('83ec0cd93c24668b042480cc0c6689442402d96c2402db5c2404d92c248b44240483c40cc3'))

def finish(pop=0,value=0):
 sp=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,read(sp));uc.reg_write(UC_X86_REG_ESP,sp+4+pop)
def hook(u,a,size,data):
 if a not in handlers:return
 n=handlers[a];sp=u.reg_read(UC_X86_REG_ESP);this=u.reg_read(UC_X86_REG_ECX)
 if n=='outerClip' or 'getUnclippedPixelRect' in n:
  out=read(sp+4);floating(out,*rect);finish(4,out)
 elif 'getSingleton' in n:finish(value=SYSTEM)
 elif 'getEffectiveAlpha' in n:
  floating(TEMP,effective_alpha);u.mem_write(a+0x20,b'\xd9\x05'+struct.pack('<I',TEMP)+b'\xc3');u.reg_write(UC_X86_REG_EIP,a+0x20)
 elif 'draw@RenderableElement' in n:finish(8)
 elif n=='??0colour@CEGUI@@QAE@I@Z':
  argb=read(sp+4);assert argb==0xffffff
  floating(this,1,1,1,0);finish(4,this)
 elif '??0ColourRect' in n or 'setColours' in n:
  colour=floats(read(sp+4));floating(this,*(colour*4));finish(4,this)
 elif 'setAlpha@ColourRect' in n:
  value=floats(sp+4,1)[0]
  for off in [12,28,44,60]:floating(this+off,value)
  finish(4)
 elif '??0Rect' in n:
  left,top,right,bottom=floats(sp+4);floating(this,top,bottom,left,right);finish(16,this)
 elif 'draw@Image' in n:
  dest,z,clip,colours=[read(sp+v*4) for v in range(1,5)]
  events.append({'part':'background' if this==BACKGROUND else 'fill','dest':floats(dest),'clip':floats(clip),'colours':floats(colours,16)})
  finish(28)
 else:raise AssertionError(n)
uc.hook_add(UC_HOOK_CODE,hook)
# Original static initializer 1003ac20 passes ARGB00FFFFFF to Colour(uint).
# Execute that static initializer; Colour(uint) output is a provider.
word(STACK,RETURN);uc.reg_write(UC_X86_REG_ESP,STACK)
uc.emu_start(0x1003ac20,RETURN,count=1000)
assert floats(0x10077084)==[1,1,1,0]
rows=[]
for scale in [1,1.8,3.6]:
 for progress in [0,.2,.33999997,.34,.5,.66999996,.67,.8,1]:
  rect=[0,f32(37*scale),0,f32(50*scale)];effective_alpha=f32(.6)
  word(OBJ+0x37c,BACKGROUND);word(OBJ+0x380,FILL);word(OBJ+0x378,1);floating(OBJ+0x328,progress)
  floating(OBJ+0x424,0,0,0,0)
  for offset in [0x330,0x348,0x360]:floating(OBJ+offset,1,1,1,f32(128/255))
  tilew=int(f32(50*f32(scale))+.5);tileh=int(f32(37*f32(scale))+.5)
  for img in [BACKGROUND,FILL]:floating(img+0x20,tilew,tileh)
  events.clear();word(STACK,RETURN,0);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,OBJ)
  uc.emu_start(0x1001bff0,RETURN,count=50000)
  assert uc.reg_read(UC_X86_REG_EIP)==RETURN
  fills=[e for e in events if e['part']=='fill'];assert fills
  extent=int(rect[1]*f32(progress)+.5);clip=[rect[1]-extent,rect[1],0,rect[3]]
  assert all(e['clip']==clip for e in fills)
  assert all(e['colours']==[1,1,1,f32(.6)]*4 for e in fills)
  rows.append({'scale':scale,'progress':f32(progress),'extent':extent,'tile':[tilew,tileh],'draws':list(events)})
result={'status':'PASS','entry':'0x1001bff0','source':{'rect':[373,234,50,37],'format':'Vertical','colour':['80FFFFFF']*3,'windowAlpha':f32(.6)},'rows':rows,'scope':'Complete original drawSelf return with prgCrossbar source values. Window rect/effective alpha, auto-scaled image sizes, original static initializer1003ac20 with Colour(00FFFFFF) constructor provider, ColourRect/Rect helpers and final Image draw are providers. setAlpha replaces selected colour alpha with effective window alpha; no GPU framebuffer.'}
(ROOT/'recovery/output/reload-draw-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS',len(rows),'original prgCrossbar draw/white RGB/alpha replacement vectors')
